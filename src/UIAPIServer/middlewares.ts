/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Murthy Kakarlamudi - murthy@modusbox.com                         *
 **************************************************************************/

import util from 'util';
import Router from 'koa-router';
import randomPhrase from '@app/lib/randomphrase';
import { HTTPResponseError } from '@pm4ml/mcm-client';

/**
 * Log raw to console as a last resort
 * @return {Function}
 */
const createErrorHandler = () => async (ctx, next) => {
  try {
    await next();
  } catch (err: any) {
    // TODO: return a 500 here if the response has not already been sent?
    console.log(`Error caught in catchall: ${err.stack || util.inspect(err, { depth: 10 })}`);
  }
};

/**
 * tag each incoming request with a unique identifier
 * @return {Function}
 */
const createRequestIdGenerator = () => async (ctx, next) => {
  ctx.request.id = randomPhrase();
  await next();
};

/**
 * Add a log context for each request, log the receipt and handling thereof
 * @param logger
 * @return {Function}
 */
const createLogger = (logger) => async (ctx, next) => {
  ctx.state.logger = logger.push({
    request: {
      id: ctx.request.id,
      path: ctx.path,
      method: ctx.method,
    },
  });
  if (ctx.path !== '/health') {
    await ctx.state.logger.push({ body: ctx.request.body }).log('Request received');
  }
  try {
    await next();
  } catch (err: any) {
    console.log(`Error caught in createLogger: ${err.stack || util.inspect(err, { depth: 10 })}`);
  }
  if (ctx.path !== '/health') {
    await ctx.state.logger.log('Request processed');
  }
};

/**
 * Creates koa routes based on handler map
 */

interface HandlerMethods {
  get?: (ctx: any) => Promise<any>;
  post?: (ctx: any) => Promise<any>;
  put?: (ctx: any) => Promise<any>;
}

const createRouter = (handlerMap: Record<string, HandlerMethods>) => {
  const router = new Router();

  for (const [endpoint, methods] of Object.entries(handlerMap)) {
    const koaEndpoint = endpoint.replace(/{/g, ':').replace(/}/g, '');
    for (const [method, handler] of Object.entries(methods)) {
      router[method](koaEndpoint, async (ctx, next) => {
        try {
          ctx.state.logger = ctx.state.logger.push({ handler: handler.name });
          await Promise.resolve(handler(ctx, next));
        } catch (e: any) {
          ctx.state.logger.log(`Error: ${e.stack || util.inspect(e)}`);
          ctx.body = { errorMessage: e.message };
          ctx.status = 500;
          if (e instanceof HTTPResponseError) {
            ctx.body = e.getData().res.data;
            ctx.status = e.getData().res.statusCode;
          } else {
            throw e;
          }
        }
      });
    }
  }
  return router.routes();
};

export default {
  createErrorHandler,
  createRequestIdGenerator,
  createLogger,
  createRouter,
};
