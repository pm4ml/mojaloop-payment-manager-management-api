/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Murthy Kakarlamudi - murthy@modusbox.com                         *
 **************************************************************************/

const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const { oas } = require('koa-oas3');

const http = require('http');
const path = require('path');
const { MCMStateModel, Storage } = require('@internal/model');

const { Logger, Transports } = require('@internal/log');

const database = require('@internal/database');
const handlers = require('./handlers');
const middlewares = require('./middlewares');

class UIAPIServer {
    constructor(conf) {
        this._conf = conf;
        this._api = null;
        this._server = null;
        this._logger = null;
    }

    async setupApi() {
        this._api = new Koa();
        this._logger = await this._createLogger();
        let validator;
        try {
            validator = await oas({
                file: path.join(__dirname, 'api.yaml'),
                endpoint: '/openapi.json',
                uiEndpoint: '/',
            });
        } catch (e) {
            throw new Error('Error loading API spec. Please validate it with https://editor.swagger.io/');
        }

        this._db = await database({
            ...this._conf,
            syncInterval: this._conf.cacheSyncInterval,
            logger: this._logger,
        });


        this._storage = new Storage.File({ dirName: this._conf.mcmClientSecretsLocation });
        this._api.use(async (ctx, next) => {
            ctx.state = {
                conf: this._conf,
                db: this._db,
                storage: this._storage
            };
            await next();
        });
        this._api.use(middlewares.createErrorHandler());
        this._api.use(middlewares.createLogger(this._logger));
        this._api.use(bodyParser());
        this._api.use(validator);
        this._api.use(middlewares.createRouter(handlers));

        this._server = this._createServer();

        // Code to setup mcm client
        this._mcmState = new MCMStateModel({
            dfspId: this._conf.dfspId,
            envId: 1, // FIXME: itereate over all the environments
            hubEndpoint: this._conf.mcmServerEndpoint,
            refreshIntervalSeconds: this._conf.mcmClientRefreshInternal,
            storage: this._storage,
            logger: this._logger,
            tlsServerPrivateKey: this._conf.tlsServerPrivateKey,
            dfspCaPath: this._conf.dfspCaPath,
            auth: this._conf.auth,
            db: this._db
        });

        return this._server;
    }

    async start() {
        await new Promise((resolve) => this._server.listen(this._conf.inboundPort, resolve));
        await this._mcmState.start();
        this._logger.log(`Serving inbound API on port ${this._conf.inboundPort}`);

    }

    async stop() {
        if (!this._server) {
            return;
        }
        await new Promise(resolve => this._server.close(resolve));
        console.log('inbound shut down complete');
    }

    async _createLogger() {
        const transports = await Promise.all([Transports.consoleDir()]);
        // Set up a logger for each running server
        return new Logger({
            context: {
                app: 'mojaloop-payment-manager-management-api-service'
            },
            space: this._conf.logIndent,
            transports,
        });
    }

    _createServer() {
        return http.createServer(this._api.callback());
    }

}

module.exports = UIAPIServer;
