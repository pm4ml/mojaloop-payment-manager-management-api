/**************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 **************************************************************************/

import { AnyEventObject, assign, DoneEventObject, MachineConfig, send } from 'xstate';
import { MachineOpts } from './MachineOpts';
import { invokeRetry } from './invokeRetry';
import _ from 'lodash';

export namespace PeerJWS {
  export type JWS = {
    dfspId: string;
    publicKey: string;
    createdAt: number; // Unix timestamp
  };

  export type Context = {
    peerJWS?: JWS[];
  };

  export type Event = DoneEventObject | { type: 'PEER_JWS_CONFIGURED' };

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, Event> => ({
    id: 'getPeerJWS',
    initial: 'fetchingPeerJWS',
    on: {
      REQUEST_PEER_JWS: { target: '.notifyPeerJWS', internal: false },
    },
    states: {
      fetchingPeerJWS: {
        invoke: {
          id: 'getPeerDFSPJWSCertificates',
          src: () =>
            invokeRetry({
              id: 'getPeerDFSPJWSCertificates',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              service: async () => opts.dfspCertificateModel.getAllJWSCertificates(),
            }),
          onDone: 'comparePeerJWS',
        },
      },
      comparePeerJWS: {
        invoke: {
          src: async (context, event: AnyEventObject) => {
            const peerJWS = event.data;
            const changes = _.differenceWith(
              peerJWS as JWS[],
              context.peerJWS!,
              (a, b) => a.dfspId === b.dfspId && a.createdAt <= b.createdAt
            );
            if (changes.length === 0) {
              throw new Error('No changes detected');
            }
            // Iterate through changes array and replace those values in the context with the new values
            // Clone the context.peerJWS array
            const updatedPeerJWS = context.peerJWS ? _.cloneDeep(context.peerJWS) : [];

            changes.forEach((change) => {
              const index = updatedPeerJWS!.findIndex((jws) => jws.dfspId === change.dfspId);
              if (index === -1) {
                updatedPeerJWS!.push(change);
              } else {
                updatedPeerJWS![index] = change;
              }
            });
            return { changes, updatedPeerJWS };
          },
          onDone: {
            target: 'notifyPeerJWS',
            actions: [
              assign({ peerJWS: (_context, event) => event.data.updatedPeerJWS }),
              send((_context, event) => {
                const peerJWSKeys = Object.fromEntries(event.data.updatedPeerJWS.map((e) => [e.dfspId, e.publicKey]));
                return { type: 'UPDATE_CONNECTOR_CONFIG', config: { peerJWSKeys } };
              }),
            ],
          },
          onError: {
            target: 'completed',
            actions: send('NO_PEER_JWS_CHANGES'),
          }
        }
      },
      notifyPeerJWS: {
        invoke: {
          id: 'notifyPeerJWS',
          src: (ctx: TContext) =>
            invokeRetry({
              id: 'notifyPeerJWS',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              service: async () => opts.ControlServer.notifyPeerJWS(ctx.peerJWS),
            }),
          onDone: {
            target: 'completed',
          },
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
    peerJWSChanged: (context: TContext, event: AnyEventObject) => !_.isEqual(event.data, context.peerJWS),
  });

  // export const createActions = <TContext extends Context>() => ({
  //   peerJWSChanged: (context: TContext, event: AnyEventObject) => stringify(event.data) !== stringify(context.peerJWS),
  // });
}
