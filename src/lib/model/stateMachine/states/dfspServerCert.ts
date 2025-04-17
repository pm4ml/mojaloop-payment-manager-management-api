/** ************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 ************************************************************************* */

import { assign, DoneEventObject, MachineConfig, send } from 'xstate';
import { CsrParams } from '../../../../lib/vault';
import { MachineOpts } from './MachineOpts';
import { invokeRetry } from './invokeRetry';
import { DfspCA } from './dfspCA';

export namespace DfspServerCert {
  export interface Context {
    dfspServerCert?: {
      rootCertificate?: string;
      intermediateChain?: string;
      serverCertificate?: string;
      privateKey?: string;
    };
  }

  type CreateDfspServerCertEvent = { type: 'CREATE_DFSP_SERVER_CERT'; csr: CsrParams };
  export type Event =
    | DoneEventObject
    | { type: 'DFSP_SERVER_CERT_CONFIGURED' }
    | CreateDfspServerCertEvent
    | DfspCA.Event
    | { type: 'DFSP_SERVER_CERT_IDLE' }
    | { type: 'REQUESTING_NEW_DFSP_SERVER_CERT' }
    | { type: 'RENEWING_MANAGED_DFSP_SERVER_CERT' }
    | { type: 'CREATING_DFSP_SERVER_CERT' }
    | { type: 'UPLOADING_DFSP_SERVER_CERT_TO_HUB' };

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, Event> => ({
    id: 'dfspServerCert',
    initial: 'idle',
    on: {
      CREATE_DFSP_SERVER_CERT: { target: '.requestedNewDfspServerCert', internal: false },
      DFSP_CA_PROPAGATED: { target: '.requestedNewDfspServerCert', internal: false },
    },
    states: {
      idle: {},
      requestedNewDfspServerCert: {
        entry: send('REQUESTING_NEW_DFSP_SERVER_CERT'),
        always: [
          { target: 'renewingManagedDfspServerCert', cond: 'managedByCertManager' },
          { target: 'creatingDfspServerCert' },
        ],
      },
      renewingManagedDfspServerCert: {
        entry: send('RENEWING_MANAGED_DFSP_SERVER_CERT'),
        invoke: {
          id: 'renewManagedDfspServerCert',
          src: () =>
            invokeRetry({
              id: 'renewManagedDfspServerCert',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              machine: 'DFSP_SERVER_CERT',
              state: 'renewingManagedDfspServerCert',
              service: async () => opts.certManager!.renewServerCert(),
            }),
          onDone: {
            target: 'idle',
            actions: send('DFSP_SERVER_CERT_CONFIGURED'),
          },
        },
      },
      creatingDfspServerCert: {
        entry: send('CREATING_DFSP_SERVER_CERT'),
        invoke: {
          id: 'createDFSPServerCert',
          src: (ctx, event) =>
            invokeRetry({
              id: 'createDFSPServerCert',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              machine: 'DFSP_SERVER_CERT',
              state: 'creatingDfspServerCert',
              service: async () =>
                opts.vault.createDFSPServerCert(
                  (event as CreateDfspServerCertEvent).csr || opts.config.dfspServerCsrParameters
                ),
            }),
          onDone: {
            actions: [
              assign({
                dfspServerCert: (ctx, { data }) => data,
              }),
              send((ctx) => ({
                type: 'UPDATE_CONNECTOR_CONFIG',
                config: {
                  inbound: {
                    tls: {
                      creds: {
                        ca: ctx.dfspServerCert!.rootCertificate,
                        cert: ctx.dfspServerCert!.serverCertificate,
                        key: ctx.dfspServerCert!.privateKey,
                      },
                    },
                  },
                },
              })),
            ],
            target: 'uploadingDfspServerCertToHub',
          },
        },
      },
      uploadingDfspServerCertToHub: {
        entry: send('UPLOADING_DFSP_SERVER_CERT_TO_HUB'),
        invoke: {
          id: 'dfspServerCertUpload',
          src: (ctx) =>
            invokeRetry({
              id: 'dfspServerCertUpload',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              machine: 'DFSP_SERVER_CERT',
              state: 'uploadingDfspServerCertToHub',
              service: async () => {
                const { privateKey, ...body } = ctx.dfspServerCert!;
                return opts.dfspCertificateModel.uploadServerCertificates(body);
              },
            }),
          onDone: {
            target: 'idle',
            actions: send('DFSP_SERVER_CERT_CONFIGURED'),
          },
        },
      },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export const createGuards = <TContext extends Context>(opts: MachineOpts) => ({
    managedByCertManager: () => !!opts.certManager,
  });
}
