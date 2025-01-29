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
import assert from 'assert';

import { Logger } from '@mojaloop/sdk-standard-components';

import Vault from '../lib/vault';
import { MemoryCache } from '../lib/cacheDatabase';
import { IConfig } from '../config';
import { ConnectionStateMachine } from '../lib/model';
import { createHandlers } from './handlers';
import middlewares from './middlewares';

interface UIAPIServerOptions {
  config: IConfig;
  vault: Vault;
  db: MemoryCache;
  stateMachine: ConnectionStateMachine;
  port: number;
}

class UIAPIServer {
  private constructor(
    private server: http.Server,
    private logger: Logger.Logger,
    private port: number,
  ) {}

  static async create(opts: UIAPIServerOptions) {
    const api = new Koa();
    const logger = this._createLogger();
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

    api.use(async (ctx, next) => {
      ctx.state = {
        conf: opts.config,
        db: opts.db,
        vault: opts.vault,
        stateMachine: opts.stateMachine,
      };
      await next();
    });
    api.use(middlewares.createErrorHandler());
    api.use(middlewares.createLogger(logger));
    api.use(bodyParser());
    api.use(validator);
    api.use(middlewares.createRouter(createHandlers()));

    const server = http.createServer(api.callback());

    return new UIAPIServer(server, logger, opts.port);
  }

  async start() {
    assert(this.server);
    await new Promise<void>((resolve) => this.server.listen(this.port, resolve));
    this.logger.log(`Serving inbound API on port ${this.port}`);
  }

  async stop() {
    if (!this.server) {
      return;
    }
    await new Promise((resolve) => this.server.close(resolve));
    // todo: add DB disconnect (knex and redis)
    this.logger.log('inbound shut down complete');
  }

  static _createLogger() {
    // Set up a logger for each running server
    return new Logger.Logger({
      ctx: {
        app: 'mojaloop-payment-manager-management-api-service',
      },
    });
  }
}

export default UIAPIServer;
