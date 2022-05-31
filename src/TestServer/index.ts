/**************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 **************************************************************************/

import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { oas } from 'koa-oas3';

import http from 'http';
import path from 'path';

import { Logger } from '@mojaloop/sdk-standard-components';

import { createHandlers } from './handlers';
import middlewares from '@app/UIAPIServer/middlewares';
import { IConfig } from '@app/config';
import assert from 'assert';
import { ConnectionStateMachine } from '@app/lib/model';

interface TestServerOptions {
  config: IConfig;
  stateMachine: ConnectionStateMachine;
  port: number;
}

class TestServer {
  private constructor(private server: http.Server, private logger: Logger.Logger, private port: number) {}

  static async create(opts: TestServerOptions) {
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

    return new TestServer(server, logger, opts.port);
  }

  async start() {
    assert(this.server);
    await new Promise<void>((resolve) => this.server.listen(this.port, resolve));
    this.logger.log(`Serving inbound test API on port ${this.port}`);
  }

  async stop() {
    if (!this.server) {
      return;
    }
    await new Promise((resolve) => this.server.close(resolve));
    console.log('inbound shut down complete');
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

export default TestServer;
