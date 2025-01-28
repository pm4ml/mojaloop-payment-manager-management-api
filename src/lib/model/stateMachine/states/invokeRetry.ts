/**************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 **************************************************************************/

import { assign, createMachine } from 'xstate';
import SDKStandardComponents from '@mojaloop/sdk-standard-components';
import Logger = SDKStandardComponents.Logger.Logger;
// import { StateMachine } from 'xstate/lib/types';

type AsyncFunc = (ctx?: any) => Promise<any>;

interface InvokeRetryOpts {
  id: string;
  // service: AsyncFunc | StateMachine<any, any, any>;
  service: AsyncFunc;
  maxRetries?: number;
  retryInterval?: number;
  logger: Logger;
}

// interface IContext {
//   data?: any;
// }

const DEFAULT_RETRY_INTERVAL = 60000;

// const isPromise = (promise) => !!promise && typeof promise.then === 'function';

type Context = {
  retries: number;
  error?: any;
};

export const invokeRetry = (opts: InvokeRetryOpts) =>
  createMachine<Context>(
    {
      id: opts.id,
      initial: 'run',
      context: {
        retries: 0,
      },
      states: {
        run: {
          invoke: {
            id: opts.id,
            // src: isPromise(opts.service) ? (ctx) => (opts.service as AsyncFunc)(ctx) : opts.service,
            src: opts.service,
            // data: {
            //   data: (context) => context.data,
            // },
            onDone: {
              target: 'success',
            },
            onError: {
              target: 'failure',
              actions: [assign({ error: (ctx, event) => event.data?.message }), 'logError'],
            },
          },
        },
        success: {
          type: 'final',
          data: (context, event) => event.data,
        },
        failure: {
          entry: assign({ retries: (ctx) => ctx.retries + 1 }),
          always: { target: 'error', cond: 'maxRetriesReached' },
          after: {
            [opts.retryInterval ?? DEFAULT_RETRY_INTERVAL]: 'run',
          },
        },
        error: {
          type: 'final',
        },
      },
    },
    {
      guards: {
        maxRetriesReached: (ctx) => {
          return opts.maxRetries ? ctx.retries > opts.maxRetries : false;
        },
      },
      actions: {
        logError: (ctx, event) => opts.logger.push({ error: event.data })?.log(`Error invoking service ${opts.id}`),
      },
    }
  );
