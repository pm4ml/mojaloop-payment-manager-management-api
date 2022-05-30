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
          id: 'getPeerDFSPJWSCertificates',
          src: () =>
            invokeRetry({
              id: 'getPeerDFSPJWSCertificates',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              service: async () => opts.dfspCertificateModel.getAllJWSCertificates(),
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
    peerJWSChanged: (context: TContext, event: AnyEventObject) => !_.isEqual(event.data, context.peerJWS),
  });

  // export const createActions = <TContext extends Context>() => ({
  //   peerJWSChanged: (context: TContext, event: AnyEventObject) => stringify(event.data) !== stringify(context.peerJWS),
  // });
}
