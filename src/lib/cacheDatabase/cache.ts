/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       James Bush - james.bush@modusbox.com                             *
 **************************************************************************/

import * as redis from 'redis';
import assert from 'assert';
import Logger from '@app/lib/logger';

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
    this.logger = opts.logger;
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
    client.on('error', (err) => {
      this.logger.push({ err }).log('Error from REDIS client getting subscriber');
    });

    client.on('ready', () => {
      this.logger.log(`Connected to REDIS at: ${this.url}`);
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
      value = JSON.stringify(value);
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

  /**
   * Gets keys from the cache based on the pattern
   *
   * @param pattern {string} - keys pattern
   */
  async keys(pattern: string) {
    assert(this.client);
    return this.client.keys(pattern);
  }
}

export default Cache;
