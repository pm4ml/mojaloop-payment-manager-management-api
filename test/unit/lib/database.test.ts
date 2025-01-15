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

import 'jest';
import { Logger } from '@mojaloop/sdk-standard-components';
import * as CacheDatabase from '../../../src/lib/cacheDatabase';

jest.mock('@mojaloop/sdk-standard-components', () => ({
  Logger: {
    Logger: jest.fn().mockImplementation(() => ({
      stringify: jest.fn(),
    })),
  },
}));

jest.mock('../../../src/lib/cacheDatabase', () => ({
  createMemoryCache: jest.fn().mockImplementation(() => ({
    redisCache: jest.fn().mockReturnValue({
      set: jest.fn().mockResolvedValue(true),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockResolvedValue([
        { id: 'tr1', success: 1, amount: '100' },
        { id: 'tr2', success: null, amount: '50' },
        { id: 'tr3', success: 0, amount: '70' },
      ]),
      disconnect: jest.fn(),
    }),
    sync: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn(),
  })),
}));

describe('Utils', () => {
  let db;

  beforeEach(async () => {
    jest.clearAllMocks();
    db = await createTestDb();
  });

  describe('createTestDb', () => {
    it('should create a test database with correct configuration', async () => {
      expect(CacheDatabase.createMemoryCache).toHaveBeenCalledWith({
        cacheUrl: 'redis://dummyhost:1234',
        logger: expect.any(Object),
        manualSync: true,
      });
      expect(Logger.Logger).toHaveBeenCalledWith({ stringify: expect.any(Function) });
    });
  });

  describe('addTransferToCache', () => {
    it('should add transfer with default values', async () => {
      const opts = {
        transferId: 'test-transfer-id',
      };

      const result = await addTransferToCache(db, opts);

      expect(db.redisCache().set).toHaveBeenCalledWith('transferModel_test-transfer-id', expect.any(String));
      expect(result).toHaveProperty('transferId', 'test-transfer-id');
      expect(result).toHaveProperty('fulfil');
    });

    it('should handle error state correctly', async () => {
      const opts = {
        transferId: 'error-transfer',
        currentState: 'errored',
      };

      const result = await addTransferToCache(db, opts);

      expect(result).toHaveProperty('currentState', 'errored');
      expect(result).toHaveProperty('lastError');
    });

    it('should handle pending transfers', async () => {
      const opts = {
        transferId: 'pending-transfer',
        isPending: true,
      };

      const result = await addTransferToCache(db, opts);

      expect(result).not.toHaveProperty('fulfil');
    });

    it('should update custom amount configurations', async () => {
      const opts = {
        transferId: 'amount-test',
        amountType: 'custom',
        currency: 'EUR',
        amount: '100.00',
        transactionType: 'transfer',
      };

      const result = await addTransferToCache(db, opts);

      expect(result).toMatchObject({
        amountType: 'custom',
        currency: 'EUR',
        amount: '100.00',
        transactionType: 'transfer',
      });
    });

    it('should handle custom timestamps', async () => {
      const initiatedTimestamp = '2023-01-01T00:00:00.000Z';
      const completedTimestamp = '2023-01-01T00:01:00.000Z';

      const opts = {
        transferId: 'timestamp-test',
        initiatedTimestamp,
        completedTimestamp,
      };

      const result = await addTransferToCache(db, opts);

      expect(result.initiatedTimestamp).toBe(initiatedTimestamp);
      expect(result.fulfil.body.completedTimestamp).toBe(completedTimestamp);
    });
  });
});

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
    const rows = await db.redisCache().select('id', 'success', 'amount').from('transfer');
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
    const updatedRows = await db.redisCache().select('id', 'success', 'amount').from('transfer');
    // Fulfilled transfers shouldn't be refreshed in the cache
    expect(updatedRows).toMatchObject([
      { id: 'tr1', success: 1, amount: '100' },
      { id: 'tr2', success: null, amount: '50' },
      { id: 'tr3', success: 0, amount: '70' },
    ]);
  });
});
