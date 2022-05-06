import { assign, createMachine } from 'xstate';

type TContext = {
  retries: number;
};

export const requestMachine = createMachine<TContext>({
  id: 'fetch',
  initial: 'requesting',
  context: {
    retries: 0,
  },
  states: {
    requesting: {
      on: {
        RESOLVE: 'success',
        REJECT: 'failure',
      },
    },
    success: {
      type: 'final',
    },
    failure: {
      on: {
        RETRY: {
          target: 'loading',
          actions: assign({
            retries: (context, event) => context.retries + 1,
          }),
        },
      },
    },
  },
});
