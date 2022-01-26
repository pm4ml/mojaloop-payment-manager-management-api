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

const knex = require('knex');
const Cache = require('./cache');

const cachedFulfilledKeys = [];
const cachedPendingKeys = [];

const getName = (userInfo) => userInfo && (userInfo.displayName || `${userInfo.firstName} ${userInfo.lastName}`);

const getTransferStatus = (data) => {
    if (data.currentState === 'succeeded') {
        return true;
    } else if (data.currentState === 'errored') {
        return false;
    } else {
        return null;
    }
};

const getPartyNameFromQuoteRequest = (qr, partyType) => {
    // return display name if we have it
    if(qr.body[partyType].name) {
        return qr.body[partyType].name;
    }

    // otherwise try to build the name from the personalInfo
    const { complexName } = qr.body[partyType].personalInfo || {};

    if(complexName) {
        const n = [];
        const { firstName, middleName, lastName } = complexName;
        if(firstName) {
            n.push(firstName);
        }
        if(middleName) {
            n.push(middleName);
        }
        if(lastName) {
            n.push(lastName);
        }
        return n.join(' ');
    }
};



async function syncDB({redisCache, db, logger}) {
    logger.log('Syncing cache to in-memory DB');

    const asyncForEach = async (array, callback) => {
        for (let index = 0; index < array.length; index++) {
            await callback(array[index], index, array);
        }
    };

    const cacheKey = async (key) => {
        const rawData = await redisCache.get(key);
        let data;
        if (typeof(rawData) === 'string') {
            try {
                data = JSON.parse(rawData);
            }
            catch (err) {
                this._logger.push({ err }).log('Error parsing JSON cache value');

            }
        }

        // this is all a hack right now as we will eventually NOT use the cache as a source
        // of truth for transfers but rather some sort of dedicated persistence service instead.
        // Therefore we can afford to do some nasty things in order to get working features...
        // for now...


        const initiatedTimestamp = data.initiatedTimestamp ? new Date(data.initiatedTimestamp).getTime() : null;
        const completedTimestamp = data.fulfil ? new Date(data.fulfil.body.completedTimestamp).getTime() : null;


        // the cache data model for inbound transfers is lacking some properties that make it easy to extract
        // certain information...therefore we have to find it elsewhere...

        let row = {
            id: data.transferId,
            redis_key: key, // To be used instead of Transfer.cachedKeys
            raw: JSON.stringify(data),
            created_at: initiatedTimestamp,
            completed_at: completedTimestamp,
        };

        //logger.push({ data }).log('processing cache item');

        if(data.direction === 'INBOUND') {
            if(data.quoteResponse?.body) {
                data.quoteResponse.body = JSON.parse(data.quoteResponse.body);
            }
            if(data.fulfil?.body) {
                data.fulfil.body = JSON.parse(data.fulfil.body);
            }

            row = {
                ...row,
                sender: getPartyNameFromQuoteRequest(data.quoteRequest, 'payer'),
                recipient: getPartyNameFromQuoteRequest(data.quoteRequest, 'payee'),
                amount: data.quoteResponse?.body?.transferAmount.amount,
                currency: data.quoteResponse?.body?.transferAmount.currency,
                direction: -1,
                batch_id: '',
                details: data.quoteRequest?.body?.note,
                dfsp: data.quoteRequest?.body?.payer?.partyIdInfo.fspId,

                success: (data?.fulfil?.body?.transferState === 'COMMITTED') ? true : null,
            };
        } else if(data.direction === 'OUTBOUND') {
            row = {
                ...row,
                sender: getName(data.from),
                recipient: getName(data.to),
                amount: data.amount,
                currency: data.currency,
                direction: 1,
                batch_id: '', // TODO: Implement
                details: data.note,
                dfsp: data.to.fspId,
                success: getTransferStatus(data),
            };
        }
        else {
            logger.push({ data }).log('Unable to process row. No direction property found');
        }

        // logger.push({ ...row, raw: ''}).log('Row processed');

        const keyIndex = cachedPendingKeys.indexOf(key);
        if (keyIndex === -1) {
            await db('transfer').insert(row);
        } else {
            await db('transfer').where({ id: row.id }).update(row);
            cachedPendingKeys.splice(keyIndex, 1);
        }

        if (row.success === null) {
            cachedPendingKeys.push(key);
        } else {
            cachedFulfilledKeys.push(key);
        }

        // const sqlRaw = db('transfer').insert(row).toString();
        // db.raw(sqlRaw.replace(/^insert/i, 'insert or ignore')).then(resolve);
    };

    const keys = await redisCache.keys('transferModel_*');
    const uncachedOrPendingKeys = keys.filter((x) => cachedFulfilledKeys.indexOf(x) === -1);
    await asyncForEach(uncachedOrPendingKeys, cacheKey);
    logger.log('In-memory DB sync complete');
}

async function init(config) {
    const knexConfig = {
        client: 'better-sqlite3',
        connection: {
            filename: ':memory:',
        },
        useNullAsDefault: true,
    };

    const db = knex(knexConfig);

    Object.defineProperty(db,
        'createTransaction',
        async () => new Promise(resolve => db.transaction(resolve)));

    if (config.runMigrations) {
        await db.migrate.latest({directory: `${__dirname}/migrations`});
    }

    const redisCache = new Cache({
        logger: config.logger,
        url: config.cacheUrl,
    });
    await redisCache.connect();

    const doSyncDB = () => syncDB({
        redisCache,
        db,
        logger: config.logger,
    });

    if (!config.manualSync) {
        await doSyncDB();
        const interval = setInterval(doSyncDB, (config.syncInterval || 60) * 1e3);
        db.stopSync = () => clearInterval(interval);
    } else {
        db.sync = doSyncDB;
    }
    db.redisCache = redisCache; // for testing purposes

    return db;
}

module.exports = init;
