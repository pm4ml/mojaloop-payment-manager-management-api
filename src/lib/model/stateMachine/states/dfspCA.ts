/** ************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 ************************************************************************* */

import { assign, MachineConfig, send, DoneEventObject } from 'xstate';
import { Subject } from '../../../../lib/vault';
import { MachineOpts } from './MachineOpts';
import { invokeRetry } from './invokeRetry';

export namespace DfspCA {
  export type Context = {
    dfspCA?: {
      cert: string;
      chain: string;
      key: string;
    };
  };

  type CreateIntCAEvent = { type: 'CREATE_INT_CA'; subject: Subject };
  type CreateExtCAEvent = { type: 'CREATE_EXT_CA'; rootCert: string; intermediateChain: string; privateKey: string };

  // type EventIn = { type: 'CREATE_CA'; csr: CSR } | DoneEventObject;
  export type Event =
    | DoneEventObject
    | CreateIntCAEvent
    | CreateExtCAEvent
    | { type: 'DFSP_CA_PROPAGATED' }
    | { type: 'FETCHING_PREBUILT_CA' }
    | { type: 'CREATE_INT_CA' }
    | { type: 'CREATE_EXT_CA' }
    | { type: 'UPLOADING_TO_HUB' };

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, Event> => ({
    id: 'createCA',
    // initial: 'idle',
    initial: 'gettingPrebuiltCA',
    on: {
      CREATE_INT_CA: { target: '.creatingIntCA', internal: false },
      CREATE_EXT_CA: { target: '.creatingExtCA', internal: false },
    },
    states: {
      idle: {},
      gettingPrebuiltCA: {
        entry: send('FETCHING_PREBUILT_CA'),
        invoke: {
          id: 'getPrebuiltCA',
          src: () =>
            invokeRetry({
              id: 'getPrebuiltCA',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              service: async () => opts.vault.getCA(),
            }),
          onDone: {
            target: 'uploadingToHub',
            actions: assign({ dfspCA: (context, { data }): any => ({ cert: data }) }),
          },
        },
      },
      creatingIntCA: {
        entry: send('CREATING_INT_CA'),
        invoke: {
          id: 'dfspIntCACreate',
          src: (ctx, event) =>
            invokeRetry({
              id: 'dfspIntCACreate',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              service: async () => opts.vault.createCA((event as CreateIntCAEvent).subject),
            }),
          onDone: {
            target: 'uploadingToHub',
            actions: assign({ dfspCA: (context, event) => event.data }),
          },
        },
      },
      creatingExtCA: {
        entry: send('CREATING_EXT_CA'),
        invoke: {
          id: 'dfspExtCACreate',
          src: (ctx, event) =>
            invokeRetry({
              id: 'dfspExtCACreate',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              service: async () => {
                const ev = event as CreateExtCAEvent;
                const cert = ev.rootCert || '';
                const chain = ev.intermediateChain || '';
                const key = ev.privateKey;
                await opts.vault.setDFSPCaCertChain(`${cert}\n${chain}`, key);
                return { cert, chain, key };
              },
            }),
          onDone: {
            target: 'uploadingToHub',
            actions: assign({ dfspCA: (context, event) => event.data }),
          },
        },
      },
      uploadingToHub: {
        entry: send('UPLOADING_TO_HUB'),
        invoke: {
          id: 'dfspCAUpload',
          src: (ctx) =>
            invokeRetry({
              id: 'dfspCAUpload',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              service: async () =>
                opts.dfspCertificateModel.uploadDFSPCA({
                  rootCertificate: ctx.dfspCA!.cert,
                  intermediateChain: ctx.dfspCA!.chain,
                }),
            }),
          onDone: {
            target: 'idle',
            actions: send('DFSP_CA_PROPAGATED'),
          },
        },
      },
    },
  });
}
