import { AnyEventObject, assign, DoneEventObject, DoneInvokeEvent, MachineConfig, sendParent } from 'xstate';
import stringify from 'json-stringify-deterministic';
import { MachineOpts } from './MachineOpts';
import { invokeRetry } from '@app/lib/model/stateMachine/states/invokeRetry';

export namespace PeerJWS {
  export type Context = {
    peerJWS: string[];
  };

  export enum EventOut {
    COMPLETED = 'PEER_JWS_CONFIGURED',
  }

  type EventIn = DoneEventObject;

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, EventIn> => ({
    id: 'getPeerJWS',
    initial: 'fetchingPeerJWS',
    states: {
      fetchingPeerJWS: {
        invoke: {
          src: () =>
            invokeRetry({
              id: 'getPeerDFSPJWSCertificates',
              service: () => opts.certificatesModel.getPeerDFSPJWSCertificates(),
            }),
          onDone: [
            { actions: assign({ peerJWS: (context, { data }) => data }) },
            { target: 'populatingPeerJWS', cond: 'peerJWSChanged' },
            { target: 'completed' },
            // target: 'success',
            // actions: assign({ result: (context, event) => event.data })
          ],
          // onError: {
          //   target: 'retry',
          //   // actions: assign({ error: (context, event) => event.data })
          // },
        },
      },
      populatingPeerJWS: {
        invoke: {
          src: (ctx) =>
            invokeRetry({
              id: 'getPeerDFSPJWSCertificates',
              service: () => opts.certificatesModel.exchangeJWSConfiguration(ctx.peerJWS),
            }),
          onDone: {
            target: 'completed',
            // actions: assign({ peerJWS: (context, event) => event.data })
          },
          // onError: {
          //   target: 'retry',
          //   // actions: assign({ error: (context, event) => event.data })
          // },
        },
      },
      completed: {
        always: {
          target: 'retry',
          actions: sendParent(EventOut.COMPLETED),
        },
      },
      retry: {
        after: {
          60000: { target: 'fetchingPeerJWS' },
        },
      },
    },
  });

  export const createGuards = <TContext extends Context>() => ({
    peerJWSChanged: (context: TContext, event: AnyEventObject) => stringify(event.data) !== stringify(context.peerJWS),
  });

  // export const createActions = <TContext extends Context>() => ({
  //   peerJWSChanged: (context: TContext, event: AnyEventObject) => stringify(event.data) !== stringify(context.peerJWS),
  // });
}
