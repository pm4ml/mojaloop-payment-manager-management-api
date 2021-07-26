/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Murthy Kakarlamudi - murthy@modusbox.com                             *
 **************************************************************************/

'use strict';

const http = require('http');
const { request } = require('@mojaloop/sdk-standard-components');
const { buildUrl, throwOrJson, HTTPResponseError } = require('./common');


/**
 * A class for making requests to DFSP backend API
 */
class Requests {
    constructor(config) {
        this.logger = config.logger;

        // make sure we keep alive connections to the backend
        this.agent = new http.Agent({
            keepAlive: true
        });

        this.transportScheme = 'http';

        // Switch or peer DFSP endpoint
        this.endpoint = `${this.transportScheme}://${config.endpoint}`;
    }

    /**
     * Utility function for building outgoing request headers as required by the mojaloop api spec
     *
     * @returns {object} - headers object for use in requests to mojaloop api endpoints
     */
    _buildHeaders () {
        return {
            'Content-Type': 'application/json',
        };
    }

    _get(url) {
        const reqOpts = {
            method: 'GET',
            uri: buildUrl(this.endpoint, url),
            headers: this._buildHeaders(),
        };

        // Note we do not JWS sign requests with no body i.e. GET requests
        this.logger.push({ reqOpts }).log('Executing HTTP GET');
        return request({...reqOpts, agent: this.agent})
            .then(throwOrJson)
            .catch(e => {
                this.logger.push({ e, reqOpts }).log('Error attempting HTTP GET');
                throw e;
            });
    }


    _put(url, body) {
        const reqOpts = {
            method: 'PUT',
            uri: buildUrl(this.endpoint, url),
            headers: this._buildHeaders(),
            body: JSON.stringify(body),
        };

        this.logger.push({ reqOpts }).log('Executing HTTP PUT');
        return request({...reqOpts, agent: this.agent})
            .then(throwOrJson)
            .catch(e => {
                this.logger.push({ e, reqOpts }).log('Error attempting HTTP PUT');
                throw e;
            });
    }


    _post(url, body) {
        const reqOpts = {
            method: 'POST',
            uri: buildUrl(this.endpoint, url),
            headers: this._buildHeaders(),
            body: JSON.stringify(body),
        };

        this.logger.push({ reqOpts }).log('Executing HTTP POST');
        return request({...reqOpts, agent: this.agent})
            .then(throwOrJson)
            .catch(e => {
                this.logger.push({ e, reqOpts }).log('Error attempting POST.');
                throw e;
            });
    }
}


module.exports = {
    Requests,
    buildUrl,
    HTTPResponseError,
};
