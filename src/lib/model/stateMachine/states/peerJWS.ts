import { AnyEventObject, assign, DoneEventObject, DoneInvokeEvent, MachineConfig, sendParent } from 'xstate';
import stringify from 'json-stringify-deterministic';
import { MachineOpts } from './MachineOpts';
import { invokeRetry } from './invokeRetry';

export namespace PeerJWS {
  type JWS = {
    dfspId: string;
    publicKey: string;
  };

  export type Context = {
    peerJWS?: JWS[];
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
              logger: opts.logger,
              service: () => opts.dfspCertificateModel.getDFSPJWSCertificates({}),
            }),
          onDone: [
            { actions: assign({ peerJWS: (context, { data }) => data }) },
            { target: 'populatingPeerJWS', cond: 'peerJWSChanged' },
            { target: 'completed' },
          ],
        },
      },
      populatingPeerJWS: {
        invoke: {
          src: (ctx) =>
            invokeRetry({
              id: 'getPeerDFSPJWSCertificates',
              logger: opts.logger,
              service: async () => {
                const peerJWSKeys = Object.fromEntries(ctx.peerJWS!.map((e) => [e.dfspId, e.publicKey]));
                return opts.ControlServer.changeConfig({ peerJWSKeys });
              },
            }),
          onDone: {
            target: 'completed',
          },
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
          [opts.refreshIntervalSeconds * 1000]: { target: 'fetchingPeerJWS' },
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
