import { AnyEventObject, assign, DoneEventObject, MachineConfig, send } from 'xstate';
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

  export type Event = DoneEventObject | { type: 'PEER_JWS_CONFIGURED' };

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, Event> => ({
    id: 'getPeerJWS',
    initial: 'fetchingPeerJWS',
    states: {
      fetchingPeerJWS: {
        invoke: {
          src: () =>
            invokeRetry({
              id: 'getPeerDFSPJWSCertificates',
              logger: opts.logger,
              service: async () => opts.dfspCertificateModel.getDFSPJWSCertificates(),
            }),
          onDone: [
            {
              actions: [
                assign({ peerJWS: (context, { data }) => data }),
                send((ctx) => {
                  const peerJWSKeys = Object.fromEntries(ctx.peerJWS!.map((e) => [e.dfspId, e.publicKey]));
                  return { type: 'UPDATE_CONNECTOR_CONFIG', config: { peerJWSKeys } };
                }),
              ],
              cond: 'peerJWSChanged',
              target: 'completed',
            },
            { target: 'completed' },
          ],
        },
      },
      completed: {
        always: {
          target: 'retry',
          actions: send('PEER_JWS_CONFIGURED'),
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
