/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Murthy Kakarlamudi - murthy@modusbox.com                         *
 **************************************************************************/

import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { oas } from 'koa-oas3';

import http from 'http';
import path from 'path';
import CertManager from '@app/lib/model/CertManager';

import { Logger } from '@mojaloop/sdk-standard-components';

import { createMemoryCache, MemoryCache } from '@app/lib/cacheDatabase';
import handlers from './handlers';
import middlewares from './middlewares';
import { IConfig } from '@app/config';
import Vault from '@app/lib/vault';
import assert from 'assert';

class UIAPIServer {
  private api?: Koa;
  private logger?: Logger.Logger;
  private db?: MemoryCache;
  private server?: http.Server;

  constructor(private conf: IConfig, private vault: Vault) {
  }

  async setupApi() {
    this.api = new Koa();
    this.logger = await this._createLogger();
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

    this.db = await createMemoryCache({
      ...this.conf,
      syncInterval: this.conf.cacheSyncInterval,
      logger: this.logger,
    });

    let certManager;
    if (this.conf.certManager.enabled) {
      certManager = new CertManager({
        ...this.conf.certManager.config!,
        logger: this.logger,
      });
    }

    this.api.use(async (ctx, next) => {
      ctx.state = {
        conf: this.conf,
        db: this.db,
        vault: this.vault,
        certManager,
      };
      await next();
    });
    this.api.use(middlewares.createErrorHandler());
    this.api.use(middlewares.createLogger(this.logger));
    this.api.use(bodyParser());
    this.api.use(validator);
    this.api.use(middlewares.createRouter(handlers));

    this.server = http.createServer(this.api.callback());

    return this.server;
  }

  async start() {
    assert(this.server);
    await new Promise((resolve) => this.server.listen(this.conf.inboundPort, resolve));
    // await this.mcmState.start();
    this.logger.log(`Serving inbound API on port ${this.conf.inboundPort}`);
  }

  async stop() {
    if (!this.server) {
      return;
    }
    await new Promise((resolve) => this.server.close(resolve));
    console.log('inbound shut down complete');
  }

  async _createLogger() {
    // Set up a logger for each running server
    return new Logger.Logger({
      context: {
        app: 'mojaloop-payment-manager-management-api-service',
      },
      stringify: Logger.buildStringify({ space: this.conf.logIndent }),
    });
  }
}

export default UIAPIServer;
