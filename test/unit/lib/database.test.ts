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

import { addTransferToCache, createTestDb } from './utils';

describe('Database', () => {
  let db;

  beforeEach(async () => {
    db = await createTestDb();
  });

  afterEach(async () => {
    await db.redisCache().disconnect();
    db.destroy();
  });

  test('Should cache Redis records', async () => {
    const now = Date.now();
    const createTimestamp = (secondsAdd: number = 0) => new Date(now + secondsAdd * 1e3).toISOString();
    await addTransferToCache(db, {
      currency: 'USD',
      amount: '100',
      transferId: 'tr1',
      currentState: 'succeeded',
      initiatedTimestamp: createTimestamp(),
      completedTimestamp: createTimestamp(10),
    });
    await addTransferToCache(db, {
      isPending: true,
      currency: 'EUR',
      amount: '50',
      transferId: 'tr2',
      currentState: 'payeeResolved',
      initiatedTimestamp: createTimestamp(5),
    });
    await addTransferToCache(db, {
      currency: 'UAH',
      amount: '70',
      transferId: 'tr3',
      currentState: 'errored',
      initiatedTimestamp: createTimestamp(8),
      completedTimestamp: createTimestamp(20),
    });

    await db.sync();
    const rows = await db('transfer').select('id', 'success', 'amount');
    expect(rows).toMatchObject([
      { id: 'tr1', success: 1, amount: '100' },
      { id: 'tr2', success: null, amount: '50' },
      { id: 'tr3', success: 0, amount: '70' },
    ]);

    // Modify transfers
    await addTransferToCache(db, {
      currency: 'USD',
      amount: '200',
      transferId: 'tr1',
      currentState: 'succeeded',
      initiatedTimestamp: createTimestamp(),
      completedTimestamp: createTimestamp(10),
    });
    await addTransferToCache(db, {
      currency: 'EUR',
      amount: '200',
      transferId: 'tr2',
      currentState: 'succeeded',
      initiatedTimestamp: createTimestamp(5),
      completedTimestamp: createTimestamp(10),
    });
    await addTransferToCache(db, {
      currency: 'UAH',
      amount: '200',
      transferId: 'tr3',
      currentState: 'succeeded',
      initiatedTimestamp: createTimestamp(5),
      completedTimestamp: createTimestamp(10),
    });

    await db.sync();
    const updatedRows = await db('transfer').select('id', 'success', 'amount');
    // Fulfilled transfers shouldn't be refreshed in the cache
    expect(updatedRows).toMatchObject([
      { id: 'tr1', success: 1, amount: '100' },
      { id: 'tr2', success: 1, amount: '200' },
      { id: 'tr3', success: 0, amount: '70' },
    ]);
  });
});
