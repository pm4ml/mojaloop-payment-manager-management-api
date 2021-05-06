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

const config = require('./config');
const UIAPIServer = require('./UIAPIServer');
const Log = require('@internal/log');

/**
 * Class that creates and manages http servers that expose the scheme adapter APIs.
 */
class Server {
    constructor(conf) {
        this.conf = conf;
        this.uiApiServer = null;
    }

    async start() {
        this.uiApiServer = new UIAPIServer(this.conf);

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
            this.uiApiServer.stop()
        ]);
    }
}


if(require.main === module) {
    (async () => {
        // this module is main i.e. we were started as a server;
        // not used in unit test or "require" scenarios
        const svr = new Server(config);

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
