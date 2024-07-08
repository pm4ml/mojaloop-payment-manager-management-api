/** ************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Vijay Kumar Guthi <vijaya.guthi@infitx.com>                   *
 ************************************************************************* */

import { AnyEventObject, assign, DoneEventObject, MachineConfig } from 'xstate';
import { MachineOpts } from './MachineOpts';
import { invokeRetry } from './invokeRetry';
import { PeerJWS } from './peerJWS';
import _ from 'lodash';

type JWS = PeerJWS.JWS;

export namespace UploadPeerJWS {

  export interface Context {
    peerJWS?: JWS[];
  }

  type UpdateAction =
    | { type: 'UPLOAD_PEER_JWS'; peerJWS: JWS[] };

  export type Event = UpdateAction | DoneEventObject;

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, Event> => ({
    id: 'uploadPeerJWS',
    initial: 'idle',
    on: {
      UPLOAD_PEER_JWS: { target: '.comparePeerJWS', internal: false },
    },
    states: {
      idle: {},
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
            target: 'uploadingPeerJWS',
          },
          onError: {
            target: 'idle',
          }
        }
      },
      uploadingPeerJWS: {
        invoke: {
          id: 'uploadingPeerJWS',
          src: (_ctx, event: AnyEventObject) =>
            invokeRetry({
              id: 'uploadingPeerJWS',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              service: async () => {
                const changesToUpload = event.data.changes.map(({dfspId, publicKey, createdAt}) => {
                  return {
                    dfspId,
                    publicKey,
                    createdAt,
                  }
                });
                return opts.dfspCertificateModel.uploadExternalDfspJWS(changesToUpload);
              },
            }),
          onDone: {
            target: 'idle',
            actions: [
              assign({ peerJWS: (_context, event) => event.data.updatedPeerJWS }),
            ],
          },
        },
      },
    },
  });
}
