/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       James Bush - james.bush@modusbox.com                             *
 **************************************************************************/

const redis = require('redis');


/**
 * A shared cache abstraction over a REDIS distributed key/value store
 */
class Cache {
    constructor(config) {
        this._config = config;

        if(!config.url || !config.logger) {
            throw new Error('Cache config requires url and logger properties');
        }

        this._logger = config.logger;

        // a redis connection to handle get, set and publish operations
        this._client = null;
    }


    /**
     * Connects to a redis server and waits for ready events
     * Note: We create two connections. One for get, set and publish commands
     * and another for subscribe commands. We do this as we are not supposed
     * to issue any non-pub/sub related commands on a connection used for sub
     * See: https://redis.io/topics/pubsub
     */
    async connect() {
        if (this._connected) {
            throw new Error('already connected');
        }
        this._connected = true;
        this._client = await this._getClient();
    }

    async disconnect() {
        if (!this._connected) {
            return;
        }
        await this._client.quit();
        this._connected = false;
    }

    /**
     * Returns a new redis client
     *
     * @returns {object} - a connected REDIS client
     * */
    async _getClient() {
        const client = redis.createClient(this._config);
        client.on('error', (err) => {
            this._logger.push({ err }).log('Error from REDIS client getting subscriber');
        });

        client.on('ready', () => {
            this._logger.log(`Connected to REDIS at: ${this._config.url}`);
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
    async set(key, value) {
        //if we are given an object, turn it into a string
        if(typeof(value) !== 'string') {
            value = JSON.stringify(value);
            console.log(`in cache set: ${value}`);
        }

        await this._client.set(key, value);
    }

    /**
     * Gets a value from the cache
     *
     * @param key {string} - cache key
     */
    async get(key) {
        return this._client.get(key);
    }

    /**
     * Delete a key
     *
     * @param {string} key
     */
    async del(key) {
        return this._client.del(key);
    }

    /**
     * Gets keys from the cache based on the pattern
     *
     * @param pattern {string} - keys pattern
     */
    async keys(pattern) {
        return this._client.keys(pattern);
    }
}


module.exports = Cache;
