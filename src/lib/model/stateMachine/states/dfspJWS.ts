/** ************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 ************************************************************************* */

import { assign, send, MachineConfig, DoneEventObject } from 'xstate';
import { MachineOpts } from './MachineOpts';
import { invokeRetry } from './invokeRetry';
import { stop } from 'xstate/lib/actions';

export namespace DfspJWS {
  export type Context = {
    dfspJWS?: {
      publicKey: string;
      privateKey: string;
      createdAt: number;
    };
  };

  export type Event =
    | DoneEventObject
    | { type: 'RECREATE_JWS' }
    | { type: 'CREATE_JWS' | 'DFSP_JWS_PROPAGATED' }
    | { type: 'CREATING_DFSP_JWS' }
    | { type: 'UPLOADING_DFSP_JWS_TO_HUB' };

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, Event> => ({
    id: 'createJWS',
    initial: 'creating',
    on: {
      RECREATE_JWS: {
        target: '.creating',
        internal: false,
        actions: [
          stop('creating'),
          stop('uploadingToHub'),
          assign({
            dfspJWS: (ctx): any => ({
              ...ctx.dfspJWS,
              publicKey: undefined,
              privateKey: undefined,
              createdAt: undefined,
            }),
          }),
        ],
      },
      CREATE_JWS: { target: '.creating', internal: false },
    },
    states: {
      idle: {},
      creating: {
        entry: send('CREATING_DFSP_JWS'),
        invoke: {
          id: 'dfspJWSCreate',
          src: () =>
            invokeRetry({
              id: 'dfspJWSCreate',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              machine: 'DFSP_JWS',
              state: 'creating',
              service: async () => opts.vault.createJWS(),
            }),
          onDone: {
            target: 'uploadingToHub',
            actions: [
              assign({ dfspJWS: (context, event) => event.data }),
              send((ctx) => ({
                type: 'UPDATE_CONNECTOR_CONFIG',
                config: { jwsSigningKey: ctx.dfspJWS!.privateKey },
              })),
            ],
          },
        },
      },
      uploadingToHub: {
        entry: send('UPLOADING_DFSP_JWS_TO_HUB'),
        invoke: {
          id: 'dfspJWSUpload',
          src: (ctx) =>
            invokeRetry({
              id: 'dfspJWSUpload',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              machine: 'DFSP_JWS',
              state: 'uploadingToHub',
              service: async () =>
                opts.dfspCertificateModel.uploadJWS({
                  publicKey: ctx.dfspJWS!.publicKey,
                  createdAt: ctx.dfspJWS!.createdAt,
                }),
            }),
          onDone: {
            target: 'idle',
            actions: send('DFSP_JWS_PROPAGATED'),
          },
        },
      },
    },
  });
}
