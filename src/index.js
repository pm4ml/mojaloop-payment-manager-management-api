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

const { hostname } = require('os');
const config = require('./config');
const UIAPIServer = require('./UIAPIServer');
const ControlServer = require('./ControlServer');
const Log = require('@internal/log');
const { Logger } = require('@mojaloop/sdk-standard-components');

const LOG_ID = {
    CONTROL:   { app: 'mojaloop-payment-manager-management-api-service-control-server' },
    CACHE:     { component: 'cache' },
};

/**
 * Class that creates and manages http servers that expose the scheme adapter APIs.
 */
class Server {
    constructor(conf, logger) {
        this.conf = conf;
        this.logger = logger;
        this.uiApiServer = new UIAPIServer(this.conf);
        this.controlServer = null;
    }

    async start() {        
        // Start up the control server (websocket server) for communicating with connectors.
        // We register this instance to receive events from internal modules.
        // Internal communication with this server is facilitated by its event emitter.
        // @see `ConnectorManager.getInternalEventEmitter()`
        this.controlServer = await new ControlServer.Server({
            appConfig: this.conf,
            logger: this.logger.push(LOG_ID.CONTROL),
        }),
        this.controlServer.registerInternalEvents();
        await Promise.all([
            this._startUIAPIServer()
        ]);
    }

    async _startUIAPIServer() {
        await this.uiApiServer.setupApi();
        await this.uiApiServer.start();
    }


    stop() {
        return Promise.all([
            this.uiApiServer.stop(),
            this.controlServer.stop()
        ]);
    }
}


if(require.main === module) {
    (async () => {
        // this module is main i.e. we were started as a server;
        // not used in unit test or "require" scenarios
        const logger = new Logger.Logger({
            context: {
                // If we're running from a Mojaloop helm chart deployment, we'll have a SIM_NAME
                simulator: process.env['SIM_NAME'],
                hostname: hostname(),
            },
            stringify: Logger.buildStringify({ space: config.logIndent }),
        });
        const svr = new Server(config, logger);

        // handle SIGTERM to exit gracefully
        process.on('SIGTERM', async () => {
            console.log('SIGTERM received. Shutting down APIs...');

            await svr.stop();
            process.exit(0);
        });

        svr.start().catch(err => {
            console.log(err);
            process.exit(1);
        });
    })();
}


// export things we want to expose e.g. for unit tests and users who dont want to use the entire
// scheme adapter as a service
module.exports = {
    Server: Server,
    Log: Log
};
