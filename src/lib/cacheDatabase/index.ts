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

import stringify from 'safe-stable-stringify';
import knex, { Knex } from 'knex';
import { Logger } from '../logger';
import Cache from './cache';

const cachedFulfilledKeys: string[] = [];
const cachedPendingKeys: string[] = [];

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

interface SyncDBOpts {
  redisCache: Cache;
  db: Knex;
  logger: Logger;
}

async function syncDB({ redisCache, db, logger }: SyncDBOpts) {
  const log = logger.child({ component: 'syncDB' });
  log.info('syncing cache to in-memory DB...');

  const parseData = (rawData: any) => {
    let data;
    if (typeof rawData === 'string') {
      try {
        data = JSON.parse(rawData);
      } catch (err: any) {
        log.warn('Error parsing JSON cache value:', err);
      }
    }

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

      const keyIndex = cachedPendingKeys.indexOf(row.id);
      if (keyIndex === -1) {
        await db('transfer').insert(row);
        cachedPendingKeys.push(row.id);
      } else {
        await db('transfer').where({ id: row.id }).update(row);
        // cachedPendingKeys.splice(keyIndex, 1);
      }
      log.debug('cache row stored in db:', { row });

      if (row.success !== null) {
        cachedFulfilledKeys.push(key);
      }

      // const sqlRaw = db('transfer').insert(row).toString();
      // db.raw(sqlRaw.replace(/^insert/i, 'insert or ignore')).then(resolve);
    } catch (err: any) {
      log.error(`error in chachKey sync [key: ${key}]:`, err);
    }
  };

  const keys = await redisCache.keys('transferModel_*');
  const uncachedOrPendingKeys = keys.filter((x) => cachedFulfilledKeys.indexOf(x) === -1);

  await Promise.all(uncachedOrPendingKeys.map(cacheKey));
  log.info('syncing cache to in-memory DB completed');
}

interface MemoryCacheOpts {
  logger: Logger;
  cacheUrl: string;
  manualSync?: boolean;
  syncInterval?: number;
}

export const createMemoryCache = async (config: MemoryCacheOpts): Promise<Knex> => {
  const knexConfig = {
    client: 'better-sqlite3',
    connection: {
      filename: ':memory:',
    },
    useNullAsDefault: true,
  };

  const db = knex(knexConfig);

  Object.defineProperty(db, 'createTransaction', async () => new Promise((resolve) => db.transaction(resolve)));

  await db.migrate.latest({ directory: `${__dirname}/migrations` });

  const redisCache = new Cache(config);
  await redisCache.connect();
  config.logger.verbose('connected to redis cache');

  const doSyncDB = () =>
    syncDB({
      redisCache,
      db,
      logger: config.logger,
    });

  if (!config.manualSync) {
    // Don't block startup on initial sync -- transfer endpoints return empty results
    // until the first sync completes (~30s). The interval timer handles retries.
    doSyncDB().catch((err) =>
      config.logger.push({ err }).warn('Initial cache sync failed, will retry on next interval')
    );
    const interval = setInterval(doSyncDB, (config.syncInterval || 60) * 1e3);
    (db as any).stopSync = () => clearInterval(interval);
  } else {
    (db as any).sync = doSyncDB;
  }
  (db as any).redisCache = () => redisCache; // for testing purposes

  return db;
};

export type MemoryCache = Knex;
