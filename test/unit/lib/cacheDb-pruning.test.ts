/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 * Eugen Klymniuk <eugen.klymniuk@infitx.com>

 --------------
 ******/

/**
 * Pruning tests for cacheDatabase.
 *
 * Uses real createMemoryCache + real in-memory SQLite with the shared
 * redis-mock (test/__mocks__/redis.ts). State is flushed between tests.
 */

jest.mock('redis');

import { CacheDatabase } from '@app/lib/cacheDatabase';
import { createTestDb, addTransferToCache } from './utils';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

describe('Pruning SQLite Tests -->', () => {
  let cacheDb: CacheDatabase;

  beforeEach(async () => {
    // Flush the shared redis-mock store so tests don't leak data
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const client = require('redis').createClient({});
    await client.flushdb();
  });

  afterEach(async () => {
    if (cacheDb) {
      await cacheDb.redisCache.disconnect();
      await cacheDb.destroy();
    }
  });

  test('should prune old completed transfers', async () => {
    cacheDb = await createTestDb({ transferRetentionHours: 48 });

    await addTransferToCache(cacheDb, {
      transferId: 'old-completed',
      currentState: 'succeeded',
      initiatedTimestamp: hoursAgo(49),
      completedTimestamp: hoursAgo(48),
    });
    await addTransferToCache(cacheDb, {
      transferId: 'recent-completed',
      currentState: 'succeeded',
      initiatedTimestamp: hoursAgo(1),
      completedTimestamp: hoursAgo(0),
    });

    await cacheDb.sync!();
    expect(await cacheDb.db.select('id').from('transfer')).toHaveLength(2);

    await cacheDb.prune!();
    const remaining = await cacheDb.db.select('id').from('transfer');
    expect(remaining).toEqual([{ id: 'recent-completed' }]);
  });

  test('should prune old pending transfers', async () => {
    cacheDb = await createTestDb({ transferRetentionHours: 48 });

    await addTransferToCache(cacheDb, {
      transferId: 'old-pending',
      isPending: true,
      currentState: 'payeeResolved',
      initiatedTimestamp: hoursAgo(49),
    });

    await cacheDb.sync!();
    expect(await cacheDb.db.select('id').from('transfer')).toHaveLength(1);

    await cacheDb.prune!();
    expect(await cacheDb.db.select('id').from('transfer')).toHaveLength(0);
  });

  test('should not prune when retention is 0 (disabled)', async () => {
    cacheDb = await createTestDb({ transferRetentionHours: 0 });

    await addTransferToCache(cacheDb, {
      transferId: 'old-transfer',
      currentState: 'succeeded',
      initiatedTimestamp: hoursAgo(999),
      completedTimestamp: hoursAgo(998),
    });

    await cacheDb.sync!();
    await cacheDb.prune!();

    const rows = await cacheDb.db.select('id').from('transfer');
    expect(rows).toEqual([{ id: 'old-transfer' }]);
  });

  test('should not prune rows with null created_at', async () => {
    cacheDb = await createTestDb({ transferRetentionHours: 48 });

    // Directly insert a row with null created_at
    await cacheDb.db('transfer').insert({
      id: 'null-created-at',
      redis_key: 'transferModel_null-created-at',
      created_at: null,
      completed_at: null,
      success: 1,
      raw: '{}',
    });

    expect(await cacheDb.db.select('id').from('transfer')).toHaveLength(1);

    await cacheDb.prune!();
    expect(await cacheDb.db.select('id').from('transfer')).toEqual([{ id: 'null-created-at' }]);
  });

  test('should clean up tracking Sets after pruning', async () => {
    cacheDb = await createTestDb({ transferRetentionHours: 48 });

    await addTransferToCache(cacheDb, {
      transferId: 'set-cleanup-test',
      currentState: 'succeeded',
      initiatedTimestamp: hoursAgo(49),
      completedTimestamp: hoursAgo(48),
    });

    // Sync inserts the row and adds to cachedFulfilledKeys/cachedPendingKeys
    await cacheDb.sync!();
    expect(await cacheDb.db.select('id').from('transfer')).toHaveLength(1);

    // Prune removes the row and cleans Sets
    await cacheDb.prune!();
    expect(await cacheDb.db.select('id').from('transfer')).toHaveLength(0);

    // Re-add same key to Redis with different data and sync — should be re-processed
    await addTransferToCache(cacheDb, {
      transferId: 'set-cleanup-test',
      currentState: 'succeeded',
      amount: '200',
      initiatedTimestamp: hoursAgo(1),
      completedTimestamp: hoursAgo(0),
    });

    await cacheDb.sync!();
    const rows = await cacheDb.db.select('id', 'amount').from('transfer');
    expect(rows).toEqual([{ id: 'set-cleanup-test', amount: '200' }]);
  });
});
