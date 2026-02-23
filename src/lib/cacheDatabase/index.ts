/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha - yevhen.kyriukha@modusbox.com                   *
 *                                                                        *
 *  CONTRIBUTORS:                                                         *
 *       James Bush - james.bush@modusbox.com                             *
 **************************************************************************/

import { setTimeout as sleep } from 'node:timers/promises';
import stringify from 'safe-stable-stringify';
import knex, { Knex } from 'knex';
import { Logger } from '../logger';
import Cache from './cache';

const knexConfig = {
  client: 'better-sqlite3',
  connection: {
    filename: ':memory:',
  },
  useNullAsDefault: true,
};

const cachedFulfilledKeys = new Set<string>();
const cachedPendingKeys = new Set<string>();

interface UserInfo {
  displayName?: string;
  firstName?: string;
  lastName?: string;
}

const getName = (userInfo: UserInfo) =>
  userInfo && (userInfo.displayName || `${userInfo.firstName} ${userInfo.lastName}`);

const getTransferStatus = (data: any) => {
  if (data.currentState === 'succeeded') {
    return true;
  } else if (data.currentState === 'errored') {
    return false;
  } else {
    return null;
  }
};

const getInboundTransferStatus = (data: any) => {
  switch (data.currentState) {
    case 'COMPLETED':
      return true;
    case 'ERROR_OCCURRED':
    case 'ABORTED':
      return false;
    default:
      return null;
  }
};

const getPartyNameFromQuoteRequest = (qr: any, partyType: any) => {
  // return display name if we have it
  if (qr.body[partyType].name) {
    return qr.body[partyType].name;
  }

  // otherwise try to build the name from the personalInfo
  const { complexName } = qr.body[partyType].personalInfo || {};

  if (complexName) {
    const n: string[] = [];
    const { firstName, middleName, lastName } = complexName;
    if (firstName) {
      n.push(firstName);
    }
    if (middleName) {
      n.push(middleName);
    }
    if (lastName) {
      n.push(lastName);
    }
    return n.join(' ');
  }
};

// rename to deps
interface SyncDBOpts {
  redisCache: Cache;
  db: Knex;
  logger: Logger;
}

const BATCH_SIZE = 100;

async function syncDB({ redisCache, db, logger }: SyncDBOpts) {
  const log = logger.child({ function: syncDB.name });
  log.info('syncing cache to in-memory DB...');

  const parseData = (rawData: any) => {
    if (typeof rawData !== 'string') return null;

    let data;
    try {
      data = JSON.parse(rawData);
    } catch (err: any) {
      log.warn('Error parsing JSON cache value:', err);
      return null;
    }

    if (!data || typeof data !== 'object') return null;

    if (data.direction === 'INBOUND') {
      if (data.quoteResponse?.body && typeof data.quoteResponse.body === 'string') {
        try {
          data.quoteResponse.body = JSON.parse(data.quoteResponse.body);
        } catch (err: any) {
          log.push({ err, quoteResponse: data.quoteResponse }).warn('Error parsing quoteResponse body');
        }
      }
      if (data.fulfil?.body && typeof data.fulfil.body === 'string') {
        try {
          data.fulfil.body = JSON.parse(data.fulfil.body);
        } catch (err: any) {
          log.push({ err, fulfil: data.fulfil }).warn('Error parsing fulfil body');
        }
      }
    }

    log.debug('parsed data:', { data });
    return data;
  };

  const cacheKey = async (key: string) => {
    try {
      const rawData = await redisCache.get(key);
      const data = parseData(rawData);
      if (!data) return;

      // this is all a hack right now as we will eventually NOT use the cache as a source
      // of truth for transfers but rather some sort of dedicated persistence service instead.
      // Therefore we can afford to do some nasty things in order to get working features...
      // for now...

      const initiatedTimestamp = data.initiatedTimestamp ? new Date(data.initiatedTimestamp).getTime() : null;
      const completedTimestamp = data.fulfil ? new Date(data.fulfil?.body?.completedTimestamp).getTime() : null;

      // the cache data model for inbound transfers is lacking some properties that make it easy to extract
      // certain information...therefore we have to find it elsewhere...

      if (!['INBOUND', 'OUTBOUND'].includes(data.direction))
        log.warn('Unable to process row. No direction property found', { data });

      const row = {
        id: data.transferId,
        redis_key: key, // To be used instead of Transfer.cachedKeys
        raw: stringify(data),
        created_at: initiatedTimestamp,
        completed_at: completedTimestamp,
        ...(data.direction === 'INBOUND' && {
          sender: getPartyNameFromQuoteRequest(data.quoteRequest, 'payer'),
          sender_id_type: data.quoteRequest?.body?.payer?.partyIdInfo?.partyIdType,
          sender_id_sub_value: data.quoteRequest?.body?.payer?.partyIdInfo?.partySubIdOrType,
          sender_id_value: data.quoteRequest?.body?.payer?.partyIdInfo?.partyIdentifier,
          recipient: getPartyNameFromQuoteRequest(data.quoteRequest, 'payee'),
          recipient_id_type: data.quoteRequest?.body?.payee?.partyIdInfo?.partyIdType,
          recipient_id_sub_value: data.quoteRequest?.body?.payee?.partyIdInfo?.partySubIdOrType,
          recipient_id_value: data.quoteRequest?.body?.payee?.partyIdInfo?.partyIdentifier,
          amount: data.quoteResponse?.body?.transferAmount?.amount,
          currency: data.quoteResponse?.body?.transferAmount?.currency,
          direction: -1,
          batch_id: '',
          details: data.quoteRequest?.body?.note,
          dfsp: data.quoteRequest?.body?.payer?.partyIdInfo?.fspId,

          success: getInboundTransferStatus(data),
        }),
        ...(data.direction === 'OUTBOUND' && {
          sender: getName(data.from),
          sender_id_type: data.from?.idType,
          sender_id_sub_value: data.from?.idSubType,
          sender_id_value: data.from?.idValue,
          recipient: getName(data.to),
          recipient_id_type: data.to?.idType,
          recipient_id_sub_value: data.to?.idSubType,
          recipient_id_value: data.to?.idValue,
          amount: data.amount,
          currency: data.currency,
          direction: 1,
          batch_id: '', // TODO: Implement
          details: data.note,
          dfsp: data.to?.fspId,
          success: getTransferStatus(data),
        }),
      };

      if (!cachedPendingKeys.has(row.id)) {
        await db('transfer').insert(row);
        cachedPendingKeys.add(row.id);
      } else {
        await db('transfer').where({ id: row.id }).update(row);
      }
      log.debug('cache row stored in db:', { row });

      if (row.success !== null) {
        cachedFulfilledKeys.add(key);
      }

      // const sqlRaw = db('transfer').insert(row).toString();
      // db.raw(sqlRaw.replace(/^insert/i, 'insert or ignore')).then(resolve);
    } catch (err: any) {
      log.error(`error in cacheKey sync [key: ${key}]:`, err);
    }
  };

  const PATTERN = 'transferModel_*';
  const keys = await redisCache.keys(PATTERN);
  const uncachedOrPendingKeys = keys.filter((x) => !cachedFulfilledKeys.has(x));

  const startTime = Date.now();
  for (let i = 0; i < uncachedOrPendingKeys.length; i += BATCH_SIZE) {
    const batch = uncachedOrPendingKeys.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(cacheKey));
  }

  const duration = (Date.now() - startTime) / 1000;
  log.info(`syncing cache to in-memory DB completed  [duration.s: ${duration}]`, {
    PATTERN,
    keysCount: keys.length,
    BATCH_SIZE,
    duration,
  });
}

interface PruneDBOpts {
  db: Knex;
  logger: Logger;
  transferRetentionHours: number;
}

async function pruneDB({ db, logger, transferRetentionHours }: PruneDBOpts) {
  if (transferRetentionHours <= 0) return;

  const log = logger.child({ function: pruneDB.name });
  const cutoffMs = Date.now() - transferRetentionHours * 3600_000;

  const staleRows: Array<{ id: string; redis_key: string }> = await db('transfer')
    .select('id', 'redis_key')
    .where('created_at', '<', cutoffMs);

  if (staleRows.length === 0) return;

  const staleIds = staleRows.map((r) => r.id);
  await db('transfer').whereIn('id', staleIds).del();

  for (const row of staleRows) {
    cachedFulfilledKeys.delete(row.redis_key);
    cachedPendingKeys.delete(row.id);
  }

  log.info(`pruned transfers older than ${transferRetentionHours}h  [count: ${staleRows.length}]`);
}

interface MemoryCacheOpts {
  logger: Logger;
  cacheUrl: string;
  manualSync?: boolean;
  syncInterval?: number;
  transferRetentionHours?: number;
  pruneIntervalSeconds?: number;
}

export interface CacheDatabase {
  db: Knex;
  destroy: () => Promise<void>;
  sync?: () => Promise<void>;
  prune?: () => Promise<void>;
  redisCache: Cache;
}

export const createMemoryCache = async (config: MemoryCacheOpts): Promise<CacheDatabase> => {
  const log = config.logger.child({ function: createMemoryCache.name });

  const db = knex(knexConfig);
  Object.defineProperty(db, 'createTransaction', async () => new Promise((resolve) => db.transaction(resolve)));

  await db.migrate.latest({ directory: `${__dirname}/migrations` });

  const redisCache = new Cache(config);
  await redisCache.connect();
  log.verbose('connected to redis cache');

  let interval: ReturnType<typeof setInterval> | undefined;
  let pruneInterval: ReturnType<typeof setInterval> | undefined;
  let syncInProgress = false;
  let pruneInProgress = false;
  let destroyed = false;

  const doSyncDB = async () => {
    if (syncInProgress) {
      log.info('syncDB already in progress, skipping');
      return;
    }
    if (pruneInProgress) {
      log.info('pruneDB in progress, deferring sync');
      return;
    }
    syncInProgress = true;
    try {
      await syncDB({
        redisCache,
        db,
        logger: log,
      });
    } catch (err) {
      log.warn('error syncing cache to in-memory DB, will retry on next interval: ', err);
    } finally {
      syncInProgress = false;
    }
  };

  const doPruneDB = async () => {
    if (pruneInProgress) {
      log.info('pruneDB already in progress, skipping');
      return;
    }
    if (syncInProgress) {
      log.info('syncDB in progress, deferring prune');
      return;
    }
    pruneInProgress = true;
    try {
      await pruneDB({
        db,
        logger: log,
        transferRetentionHours: config.transferRetentionHours || 0,
      });
    } catch (err) {
      log.warn('error pruning old transfers: ', err);
    } finally {
      pruneInProgress = false;
    }
  };

  if (!config.manualSync) {
    // Don't block startup on initial sync -- transfer endpoints return empty results
    // until the first sync completes (~30s). The interval timer handles retries.
    doSyncDB();
    interval = setInterval(doSyncDB, (config.syncInterval || 60) * 1e3);

    if (config.transferRetentionHours && config.transferRetentionHours > 0) {
      const pruneMs = (config.pruneIntervalSeconds ?? 300) * 1e3;
      pruneInterval = setInterval(doPruneDB, pruneMs);
    }
  }

  return {
    db,
    redisCache,
    sync: config.manualSync ? doSyncDB : undefined,
    prune: config.manualSync ? doPruneDB : undefined,
    destroy: async () => {
      if (destroyed) return;
      destroyed = true;
      if (interval) clearInterval(interval);
      if (pruneInterval) clearInterval(pruneInterval);
      const MAX_WAIT = 3_000;
      const start = Date.now();
      while ((syncInProgress || pruneInProgress) && Date.now() - start < MAX_WAIT) {
        await sleep(100);
      }
      /* prettier-ignore */
      await Promise.all([
        redisCache.disconnect(),
        db.destroy(),
      ]);
      log.info('cache database destroyed');
    },
  };
};
