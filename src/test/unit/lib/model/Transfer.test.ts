/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha - yevhen.kyriukha@modusbox.com                   *
 **************************************************************************/

jest.mock('redis');

const uuid = require('uuid');
const MockDate = require('mockdate');
const { Transfer } = require('@internal/model');
const { createTestDb, addTransferToCache } = require('../utils');

describe('Transfer', () => {
    let db;
    let transfer;

    beforeEach(async () => {
        db = await createTestDb();
        transfer = new Transfer({ db });
        MockDate.set('2000-11-22');
    });

    afterEach(async () => {
        await db.redisCache().disconnect();
        db.destroy();
        MockDate.reset();
    });

    const populateCache = async (currency, startTime, seq) => {
        const createTimestamp = (secondsAdd) => new Date(startTime + (secondsAdd || 0) * 1e3 + seq).toISOString();
        return Promise.all([
            addTransferToCache(db, {
                currency: currency,
                amount: '50',
                transferId: uuid.v4(),
                currentState: 'succeeded',
                initiatedTimestamp: createTimestamp(15),
                completedTimestamp: createTimestamp(17)
            }),
            addTransferToCache(db, {
                currency: currency,
                amount: '60',
                transferId: uuid.v4(),
                currentState: 'succeeded',
                initiatedTimestamp: createTimestamp(20),
                completedTimestamp: createTimestamp(22)
            }),
            addTransferToCache(db, {
                currency: currency,
                amount: '70',
                transferId: uuid.v4(),
                currentState: 'errored',
                initiatedTimestamp: createTimestamp(30),
                completedTimestamp: createTimestamp(32),
            }),
            addTransferToCache(db, {
                currency: currency,
                amount: '80',
                transferId: uuid.v4(),
                currentState: 'payeeResolved',
                initiatedTimestamp: createTimestamp(40),
            }),
            addTransferToCache(db, {
                currency: currency,
                amount: '90',
                transferId: uuid.v4(),
                currentState: 'payeeResolved',
                initiatedTimestamp: createTimestamp(50),
            }),
        ]);
    };

    const populateByMinutes = async (now, minutes) => {
        const MINUTE = 60 * 1000;
        const transfers = [];
        for (let i = 1; i <= minutes; i++) {
            transfers.push(populateCache('EUR', new Date(now - i * MINUTE).getTime(), i));
            transfers.push(populateCache('USD', new Date(now - i * MINUTE).getTime(), 10 * i));
        }
        const sortFn = (a, b) => a.initiatedTimestamp.localeCompare(b.initiatedTimestamp);
        const result = (await Promise.all(transfers)).flat(Infinity);
        result.sort(sortFn);
        return result;
    };

    const populateByHours = async (now, hours) => {
        const HOUR = 3600 * 1000;
        const transfers = [];
        for (let i = 1; i <= hours; i++) {
            transfers.push(populateCache('EUR', new Date(now - i * HOUR).getTime(), i));
            transfers.push(populateCache('USD', new Date(now - i * HOUR).getTime(), 10 * i));
        }
        const sortFn = (a, b) => a.initiatedTimestamp.localeCompare(b.initiatedTimestamp);
        const result = (await Promise.all(transfers)).flat(Infinity);
        result.sort(sortFn);
        return result;
    };

    test.skip('/transfers', async () => {
        const now = Date.now();
        const MINUTE = 60 * 1000;
        const populated = await populateByMinutes(now, 5);
        await db.sync();
        const result = await transfer.findAll({
            startTimestamp: new Date(now - 4 * MINUTE).toISOString(),
            endTimestamp: new Date(now - MINUTE).toISOString(),
        });

        expect(result.length).toBe(30);

        populated.splice(0, 10);
        populated.splice(30, 10);

        const expected = populated.map((item) => ({
            currency: item.currency,
            amount: item.amount,
        }));

        expect(result).toMatchObject(expected);
    });

    test('/transfers by direction outbound', async () => {
        const now = Date.now();
        await populateByMinutes(now, 5);

        await db.sync();
        const result = await transfer.findAll({
            direction: 'OUTBOUND',
        });

        expect(result.length).toBe(50);
        result.forEach(element => expect(element.direction).toBe('OUTBOUND'));
    });

    test('/transfers by direction inbound', async () => {
        const now = Date.now();
        await populateByMinutes(now, 5);

        await db.sync();
        const result = await transfer.findAll({
            direction: 'INBOUND',
        });

        expect(result.length).toBe(0);
    });

    test('/transfers by payee alias MSISDN', async () => {
        const now = Date.now();
        await populateByMinutes(now, 5);

        await db.sync();
        const result = await transfer.findAll({
            recipientIdType: 'MSISDN',
            recipientIdValue: '987654321',
        });

        expect(result.length).toBe(50);

        result.forEach(element => expect(element.recipientIdType).toBe('MSISDN'));
        result.forEach(element => expect(element.recipientIdValue).toBe('987654321'));

    });

    test('/transfers by payee alias ACCOUNT_ID', async () => {
        const now = Date.now();
        await populateByMinutes(now, 5);

        await db.sync();
        const result = await transfer.findAll({
            recipientIdType: 'ACCOUNT_ID',
            recipientIdValue: '1298765432',
        });

        expect(result.length).toBe(0);
    });

    test('/hourlyFlow', async () => {
        const now = Date.now();
        await populateByHours(now, 5);
        await db.sync();
        const result = await transfer.hourlyFlow({ hoursPrevious: 3 });

        const expected = [];
        for (let i = 0; i < 3; i++) {
            for (const currency of ['EUR', 'USD']) {
                expected.push({
                    currency,
                    outbound: 50 + 60 + 70 + 80 + 90,
                });
            }
        }

        expect(result).toMatchObject(expected);
    });

    test('/minuteSuccessfulTransferPerc', async () => {
        const now = Date.now();
        await populateByMinutes(now, 5);
        await db.sync();
        const result = await transfer.successRate({ minutePrevious: 3 });

        expect(result.length).toBe(3);
        expect(result[0]).toMatchObject({ percentage: (2 / 5) * 100 });
    });

    test('/minuteAverageTransferResponseTime', async () => {
        const now = Date.now();
        await populateByMinutes(now, 5);
        await db.sync();
        const result = await transfer.avgResponseTime({ minutePrevious: 3 });

        expect(result.length).toBe(3);
        expect(result[0]).toMatchObject({ averageResponseTime: 2 * 1000 });
    });

    test.skip('/transferStatusSummary', async () => {
        const now = Date.now();
        const MINUTE = 60 * 1000;
        await populateByMinutes(now, 5);
        await db.sync();
        const result = await transfer.statusSummary({
            startTimestamp: new Date(now - 4 * MINUTE).toISOString(),
            endTimestamp: new Date(now - MINUTE).toISOString(),
        });

        const expected = [
            { status: 'SUCCESS', count: 2 * 2 * 3 },
            { status: 'PENDING', count: 2 * 2 * 3 },
            { status: 'ERROR', count: 2 * 3},
        ].sort((a, b) => a.status.localeCompare(b.status));

        expect(result).toMatchObject(expected);
    });
});
