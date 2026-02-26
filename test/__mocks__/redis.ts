/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha - yevhen.kyriukha@modusbox.com                   *
 **************************************************************************/

const redisMock = require('redis-mock');
const { promisify } = require('util');
const { EventEmitter } = require('events');
EventEmitter.defaultMaxListeners = 45;


// redis-mock currently ignores callback arguments, the following class fixes that
class RedisClient extends redisMock.RedisClient {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(opts) {
    super(opts);
  }

  subscribe(...args) {
    return promisify(super.set.subscribe(this))(...args);
  }

  publish(...args) {
    return promisify(super.set.publish(this))(...args);
  }

  set(...args) {
    return promisify(super.set.bind(this))(...args);
  }

  get(...args) {
    return promisify(super.get.bind(this))(...args);
  }

  del(...args) {
    return promisify(super.del.bind(this))(...args);
  }

  keys(...args) {
    return promisify(super.keys.bind(this))(...args);
  }

  flushdb(...args) {
    return promisify(super.flushdb.bind(this))(...args);
  }

  async ping() {
    return 'PONG';
  }

  async quit() {}

  // Async iterable that mimics redis v4 scanIterator using the instance's keys()
  scanIterator(opts: { MATCH?: string; COUNT?: number } = {}) {
    const self = this;
    const pattern = opts.MATCH || '*';
    return {
      async *[Symbol.asyncIterator]() {
        const keys = await self.keys(pattern);
        for (const key of keys) {
          yield key;
        }
      },
    };
  }

  connect() {}
}

module.exports = {
  createClient: (opts) => new RedisClient(opts),
};
