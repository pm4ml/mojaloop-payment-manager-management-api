/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       James Bush - james.bush@modusbox.com                             *
 **************************************************************************/

import stringify from 'safe-stable-stringify';
import * as redis from 'redis';
import assert from 'assert';
import { Logger, logger } from '../logger';

const SCAN_COUNT = 500; // todo: make configurable, figure out the right value?

/**
 * A shared cache abstraction over a REDIS distributed key/value store
 */

interface CacheOpts {
  cacheUrl: string;
  logger: Logger;
}

class Cache {
  private client?: ReturnType<typeof redis.createClient>;
  private url: string;
  private logger: Logger;

  constructor(opts: CacheOpts) {
    this.url = opts.cacheUrl;
    this.logger = (opts.logger || logger).child({ component: Cache.name });
  }

  /**
   * Connects to a redis server and waits for ready events
   * Note: We create two connections. One for get, set and publish commands
   * and another for subscribe commands. We do this as we are not supposed
   * to issue any non-pub/sub related commands on a connection used for sub
   * See: https://redis.io/topics/pubsub
   */
  async connect() {
    if (this.client) {
      throw new Error('already connected');
    }
    this.client = await this._getClient();
  }

  async disconnect() {
    if (!this.client) {
      return;
    }
    await this.client.quit();
  }

  /**
   * Returns a new redis client
   *
   * @returns {object} - a connected REDIS client
   * */
  async _getClient() {
    const client = redis.createClient({ url: this.url });
    client.on('error', (error) => {
      this.logger.push({ error }).warn('Error from REDIS client getting subscriber');
    });

    client.on('ready', () => {
      this.logger.info(`Connected to REDIS at: ${this.url}`);
    });
    await client.connect();
    return client;
  }

  /**
   * Sets a value in the cache
   *
   * @param key {string} - cache key
   * @param value {string} - cache value
   */
  async set(key: string, value: any) {
    assert(this.client);
    //if we are given an object, turn it into a string
    if (typeof value !== 'string') {
      value = stringify(value);
      this.logger.debug(`in cache set: ${value}`);
    }

    await this.client.set(key, value);
  }

  /**
   * Gets a value from the cache
   *
   * @param key {string} - cache key
   */
  async get(key: string) {
    assert(this.client);
    return this.client.get(key);
  }

  /**
   * Delete a key
   *
   * @param {string} key
   */
  async del(key: string) {
    assert(this.client);
    return this.client.del(key);
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets keys from the cache based on the pattern
   *
   * @param pattern {string} - keys pattern
   */
  async keys(pattern: string) {
    assert(this.client);
    // Use SCAN instead of KEYS to avoid blocking the entire Redis server.
    // - KEYS is O(N) and single-threaded
    // - SCAN is O(N), cursor-based and yields between batches
    const keys: string[] = [];
    for await (const key of this.client.scanIterator({ MATCH: pattern, COUNT: SCAN_COUNT })) {
      keys.push(key);
    }
    return keys;
  }

  /**
   * Gets keys from the cache based on the pattern (using sync KEYS)
   *
   * @param pattern {string} - keys pattern
   */
  // async keysSync(pattern: string) {
  //   assert(this.client);
  //   return this.client.keys(pattern);
  // }
}

export default Cache;
