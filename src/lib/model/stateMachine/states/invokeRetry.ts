import { createMachine } from 'xstate';
// import { StateMachine } from 'xstate/lib/types';

type AsyncFunc = (ctx?: any) => Promise<any>;

interface InvokeRetryOpts {
  id: string;
  // service: AsyncFunc | StateMachine<any, any, any>;
  service: AsyncFunc;
  maxRetries?: number;
  retryInterval?: number;
}

// interface IContext {
//   data?: any;
// }

const DEFAULT_RETRY_INTERVAL = 60000;

// const isPromise = (promise) => !!promise && typeof promise.then === 'function';

export const invokeRetry = (opts: InvokeRetryOpts) => {
  let retries = 0;
  return createMachine(
    {
      id: opts.id,
      initial: 'run',
      states: {
        run: {
          invoke: {
            // src: isPromise(opts.service) ? (ctx) => (opts.service as AsyncFunc)(ctx) : opts.service,
            src: opts.service,
            // data: {
            //   data: (context) => context.data,
            // },
            onDone: 'success',
            onError: {
              target: 'failure',
              actions: (ctx, event) => {
                const error = event.data;
                console.log(error); // TODO: use SDK Logger
              },
            },
          },
        },
        success: {
          type: 'final',
        },
        failure: {
          always: {
            target: 'error',
            cond: 'maxRetriesReached',
            actions: () => retries++,
          },
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
        maxRetriesReached: () => {
          return opts.maxRetries ? retries > opts.maxRetries : false;
        },
      },
    }
  );
};
