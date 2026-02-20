/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Murthy Kakarlamudi - murthy@modusbox.com                         *
 **************************************************************************/

import Koa, { type Middleware } from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import { oas } from 'koa-oas3';

import http from 'http';
import path from 'path';
import assert from 'assert';

import { ConnectionStateMachine, ControlServer, Vault } from '@mojaloop/mcm-client';
import { Logger, logger as globalLogger } from '../lib/logger';
import { CacheDatabase } from '../lib/cacheDatabase';
import { IConfig } from '../config';
import { createHandlers } from './handlers';
import middlewares from './middlewares';

// todo: add typing
const openApiConfig = Object.freeze({
  file: path.join(__dirname, 'api.yaml'),
  endpoint: '/openapi.json',
  uiEndpoint: '/',
});

// todo: rename to UIAPIServerDeps
export interface UIAPIServerOptions {
  config: IConfig;
  vault: Vault;
  cache?: CacheDatabase;
  stateMachine: ConnectionStateMachine;
  controlServer: ControlServer;
  port: number;
}

class UIAPIServer {
  private static _validatorCache: Middleware;

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
        conf: opts.config, // todo: rename conf to config
        cache: opts.cache,
        vault: opts.vault,
        stateMachine: opts.stateMachine,
        controlServer: opts.controlServer,
      };
      await next();
    });

    // guard: return error for transfer endpoints when cache is unavailable
    api.use(async (ctx, next) => {
      if (ctx.path.startsWith('/transfer') && !ctx.state.cache) {
        ctx.status = 500; // or 503?
        ctx.body = { error: 'Transfer cache is not available' }; // move error message to constants
        return;
      }
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
    this.logger.info('inbound shut down complete');
  }

  private static _createLogger() {
    return globalLogger.child({ server: UIAPIServer.name });
  }

  private static async _createValidator(logger: Logger): Promise<Middleware> {
    if (!UIAPIServer._validatorCache) {
      try {
        UIAPIServer._validatorCache = await oas(openApiConfig);
      } catch (e) {
        const errMessage = 'Error loading API spec. Please validate it with https://editor.swagger.io/ ';
        logger.error(errMessage, e);
        throw new Error(errMessage);
      }
    }
    return UIAPIServer._validatorCache;
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
