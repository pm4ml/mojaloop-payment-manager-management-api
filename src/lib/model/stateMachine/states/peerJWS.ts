import { assign, createMachine, DoneInvokeEvent, sendParent } from 'xstate';
import stringify from 'json-stringify-deterministic';
import { MachineOpts } from './MachineOpts';

type TContext = {
  peerJWS?: string[];
  result?: any;
  error?: string;
};

type TEvent = DoneInvokeEvent<any>;

export const createPeerJWSExchangeMachine = (opts: MachineOpts) =>
  createMachine<TContext, TEvent>(
    {
      id: 'getPeerJWS',
      initial: 'fetchingPeerJWS',
      context: {},
      states: {
        fetchingPeerJWS: {
          invoke: {
            src: () => opts.certificatesModel.getPeerDFSPJWSCertificates(),
            onDone: [
              { target: 'populatingPeerJWS', cond: 'peerJWSChanged' },
              { target: 'completed' },
              // target: 'success',
              // actions: assign({ result: (context, event) => event.data })
            ],
            onError: {
              target: 'retry',
              // actions: assign({ error: (context, event) => event.data })
            },
          },
        },
        populatingPeerJWS: {
          invoke: {
            src: (context, event) => opts.certificatesModel.propagatePeerJWS(event.data),
            onDone: {
              target: 'completed',
              // actions: assign({ peerJWS: (context, event) => event.data })
            },
            onError: {
              target: 'retry',
              // actions: assign({ error: (context, event) => event.data })
            },
          },
        },
        completed: {
          always: {
            target: 'retry',
            actions: [
              assign({ peerJWS: (context, { data }) => data }),
              sendParent('PEED_JWS_PULLED')
            ],
          },
        },
        retry: {
          after: {
            60000: { target: 'fetchingPeerJWS' },
          },
        },
      },
    },
    {
      guards: {
        peerJWSChanged: (context, { data }) => stringify(data) !== stringify(context.peerJWS),
      },
    }
  );
