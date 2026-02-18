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
import cors from '@koa/cors';

import http from 'http';
import path from 'path';
import assert from 'assert';

import { ConnectionStateMachine, ControlServer, Vault } from '@mojaloop/mcm-client';
import { Logger, logger as globalLogger } from '../lib/logger';
import { MemoryCache } from '../lib/cacheDatabase';
import { IConfig } from '../config';
import { createHandlers } from './handlers';
import middlewares from './middlewares';

export interface UIAPIServerOptions {
  config: IConfig;
  vault: Vault;
  db: MemoryCache;
  stateMachine: ConnectionStateMachine;
  port: number;
  controlServer: ControlServer;
}

class UIAPIServer {
  private constructor(
    private server: http.Server,
    private logger: Logger,
    private port: number,
  ) {}

  static async create(opts: UIAPIServerOptions) {
    const api = new Koa();
    const logger = UIAPIServer._createLogger();
    const validator = await UIAPIServer._createValidator(logger);

    api.use(async (ctx, next) => {
      ctx.state = {
        conf: opts.config,
        db: opts.db,
        vault: opts.vault,
        stateMachine: opts.stateMachine,
        controlServer: opts.controlServer,
      };
      await next();
    });

    if (opts.config.enableCors) {
      api.use(cors({ credentials: true }));
    }

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
    this.logger.info(`Serving inbound API on port ${this.port}`);
  }

  async stop() {
    if (!this.server) {
      return;
    }
    await new Promise((resolve) => this.server.close(resolve));
    // todo: add DB disconnect (knex and redis)
    this.logger.info('inbound shut down complete');
  }

  static _createLogger() {
    return globalLogger.child({ server: 'UIAPIServer' });
  }

  static async _createValidator(logger: Logger) {
    try {
      return await oas({
        file: path.join(__dirname, 'api.yaml'),
        endpoint: '/openapi.json',
        uiEndpoint: '/',
      });
    } catch (e) {
      const errMessage = 'Error loading API spec. Please validate it with https://editor.swagger.io/ ';
      logger.error(errMessage, e);
      throw new Error(errMessage);
    }
  }
}

export default UIAPIServer;
