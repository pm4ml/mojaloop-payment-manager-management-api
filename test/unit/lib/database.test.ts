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
import * as redis from 'redis';
import 'jest';
import SDK, { Logger } from '@mojaloop/sdk-standard-components';
import * as CacheDatabase from '../../../src/lib/cacheDatabase';
import Cache from '../../../src/lib/cacheDatabase/cache';

jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    quit: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    on: jest.fn(),
  })),
}));

const mockLogger = {
  push: jest.fn().mockReturnThis(),
  log: jest.fn(),
  debug: jest.fn(),
};

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

describe('Cache', () => {
  let cache: Cache;
  const mockRedisClient = redis.createClient();

  beforeEach(() => {
    jest.clearAllMocks();
    (redis.createClient as jest.Mock).mockReturnValue(mockRedisClient);
    cache = new Cache({
      cacheUrl: 'redis://test-url',
      logger: mockLogger as unknown as SDK.Logger.Logger,
    });
  });

  describe('connect', () => {
    it('should connect to Redis and handle the ready event', async () => {
      (mockRedisClient.on as jest.MockedFunction<typeof mockRedisClient.on>).mockImplementation(
        (event: string | symbol, callback: (...args: any[]) => void) => {
          if (event === 'ready') {
            callback();
          }
          return mockRedisClient as any;
        },
      );

      await cache.connect();

      expect(redis.createClient).toHaveBeenCalledWith({ url: 'redis://test-url' });
      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith('Connected to REDIS at: redis://test-url');
    });

    it('should throw an error if already connected', async () => {
      await cache.connect();
      await expect(cache.connect()).rejects.toThrow('already connected');
    });
  });

  describe('disconnect', () => {
    it('should disconnect the Redis client if connected', async () => {
      await cache.connect();
      await cache.disconnect();

      expect(mockRedisClient.quit).toHaveBeenCalled();
    });

    it('should do nothing if the Redis client is not connected', async () => {
      await cache.disconnect();

      expect(mockRedisClient.quit).not.toHaveBeenCalled();
    });
  });

  describe('set', () => {
    it('should set a string value in the cache', async () => {
      await cache.connect();
      await cache.set('testKey', 'testValue');

      expect(mockRedisClient.set).toHaveBeenCalledWith('testKey', 'testValue');
    });

    it('should stringify non-string values before setting them', async () => {
      await cache.connect();
      await cache.set('testKey', { key: 'value' });

      expect(mockLogger.debug).toHaveBeenCalledWith('in cache set: {"key":"value"}');
      expect(mockRedisClient.set).toHaveBeenCalledWith('testKey', '{"key":"value"}');
    });

    it('should throw an error if the client is not connected', async () => {
      await expect(cache.set('testKey', 'testValue')).rejects.toThrow();
    });
  });

  describe('get', () => {
    it('should retrieve a value from the cache', async () => {
      (redis.createClient() as jest.Mocked<any>).get.mockResolvedValue('testValue');
      await cache.connect();

      const value = await cache.get('testKey');
      expect(value).toBe('testValue');
      expect(mockRedisClient.get).toHaveBeenCalledWith('testKey');
    });

    it('should throw an error if the client is not connected', async () => {
      await expect(cache.get('testKey')).rejects.toThrow();
    });
  });

  describe('del', () => {
    it('should delete a key from the cache', async () => {
      (mockRedisClient.del as jest.Mock).mockResolvedValue(1);
      await cache.connect();

      const result = await cache.del('testKey');
      expect(result).toBe(1);
      expect(mockRedisClient.del).toHaveBeenCalledWith('testKey');
    });

    it('should throw an error if the client is not connected', async () => {
      await expect(cache.del('testKey')).rejects.toThrow();
    });
  });

  describe('keys', () => {
    it('should retrieve keys based on a pattern', async () => {
      (mockRedisClient.keys as jest.Mock).mockResolvedValue(['key1', 'key2']);
      await cache.connect();

      const keys = await cache.keys('test*');
      expect(keys).toEqual(['key1', 'key2']);
      expect(mockRedisClient.keys).toHaveBeenCalledWith('test*');
    });

    it('should throw an error if the client is not connected', async () => {
      await expect(cache.keys('test*')).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should log errors from the Redis client', async () => {
      (mockRedisClient.on as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'error') callback(new Error('Test Redis Error'));
      });

      await cache.connect();

      expect(mockLogger.push).toHaveBeenCalledWith({ err: expect.any(Error) });
      expect(mockLogger.log).toHaveBeenCalledWith('Error from REDIS client getting subscriber');
    });
  });
});
