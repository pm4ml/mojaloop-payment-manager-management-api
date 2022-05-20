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

import knex, { Knex } from 'knex';
import Cache from './cache';
import SDK from '@mojaloop/sdk-standard-components';

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
    const n = [];
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
  logger: SDK.Logger.Logger;
}

async function syncDB({ redisCache, db, logger }: SyncDBOpts) {
  // logger.log('Syncing cache to in-memory DB');

  const parseData = (rawData: any) => {
    let data;
    if (typeof rawData === 'string') {
      try {
        data = JSON.parse(rawData);
      } catch (err) {
        logger.push({ err }).log('Error parsing JSON cache value');
      }
    }

    if (data.direction === 'INBOUND') {
      if (data.quoteResponse?.body) {
        data.quoteResponse.body = JSON.parse(data.quoteResponse.body);
      }
      if (data.fulfil?.body) {
        data.fulfil.body = JSON.parse(data.fulfil.body);
      }
    }
    return data;
  };

  const cacheKey = async (key: string) => {
    const rawData = await redisCache.get(key);
    const data = parseData(rawData);

    // this is all a hack right now as we will eventually NOT use the cache as a source
    // of truth for transfers but rather some sort of dedicated persistence service instead.
    // Therefore we can afford to do some nasty things in order to get working features...
    // for now...

    const initiatedTimestamp = data.initiatedTimestamp ? new Date(data.initiatedTimestamp).getTime() : null;
    const completedTimestamp = data.fulfil ? new Date(data.fulfil.body.completedTimestamp).getTime() : null;

    // the cache data model for inbound transfers is lacking some properties that make it easy to extract
    // certain information...therefore we have to find it elsewhere...

    if (!['INBOUND', 'OUTBOUND'].includes(data.direction))
      logger.push({ data }).log('Unable to process row. No direction property found');

    const row = {
      id: data.transferId,
      redis_key: key, // To be used instead of Transfer.cachedKeys
      raw: JSON.stringify(data),
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
        amount: data.quoteResponse?.body?.transferAmount.amount,
        currency: data.quoteResponse?.body?.transferAmount.currency,
        direction: -1,
        batch_id: '',
        details: data.quoteRequest?.body?.note,
        dfsp: data.quoteRequest?.body?.payer?.partyIdInfo.fspId,

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

    //logger.push({ data }).log('processing cache item');

    // logger.push({ ...row, raw: ''}).log('Row processed');

    const keyIndex = cachedPendingKeys.indexOf(row.id);
    if (keyIndex === -1) {
      await db('transfer').insert(row);
      cachedPendingKeys.push(row.id);
    } else {
      await db('transfer').where({ id: row.id }).update(row);
      // cachedPendingKeys.splice(keyIndex, 1);
    }

    if (row.success !== null) {
      cachedFulfilledKeys.push(key);
    }

    // const sqlRaw = db('transfer').insert(row).toString();
    // db.raw(sqlRaw.replace(/^insert/i, 'insert or ignore')).then(resolve);
  };

  const keys = await redisCache.keys('transferModel_*');
  const uncachedOrPendingKeys = keys.filter((x) => cachedFulfilledKeys.indexOf(x) === -1);
  await Promise.all(uncachedOrPendingKeys.map(cacheKey));
  // logger.log('In-memory DB sync complete');
}

interface MemoryCacheOpts {
  logger: SDK.Logger.Logger;
  cacheUrl: string;
  manualSync?: boolean;
  syncInterval?: number;
}

export const createMemoryCache = async (config: MemoryCacheOpts): Knex => {
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

  const doSyncDB = () =>
    syncDB({
      redisCache,
      db,
      logger: config.logger,
    });

  if (!config.manualSync) {
    await doSyncDB();
    const interval = setInterval(doSyncDB, (config.syncInterval || 60) * 1e3);
    (db as any).stopSync = () => clearInterval(interval);
  } else {
    (db as any).sync = doSyncDB;
  }
  (db as any).redisCache = () => redisCache; // for testing purposes

  return db;
};

export type MemoryCache = Knex;
