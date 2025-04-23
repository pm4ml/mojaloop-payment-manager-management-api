/** ************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 ************************************************************************* */

import { AnyEventObject, assign, DoneEventObject, MachineConfig, send } from 'xstate';
import { MachineOpts } from './MachineOpts';
import { invokeRetry } from './invokeRetry';
import { stop } from 'xstate/lib/actions';

export namespace DfspClientCert {
  export interface Context {
    dfspClientCert?: {
      id?: number;
      csr?: string;
      cert?: string;
      privateKey?: string;
    };
  }

  export type Event =
    | DoneEventObject
    | { type: 'DFSP_CLIENT_CERT_CONFIGURED' }
    | { type: 'RECREATE_DFSP_CLIENT_CERT' }
    | { type: 'CREATING_DFSP_CSR' }
    | { type: 'UPLOADING_DFSP_CSR' }
    | { type: 'FETCHING_DFSP_CLIENT_CERT' }
    | { type: 'COMPLETING_DFSP_CLIENT_CERT' };

  enum CertState {
    CERT_SIGNED = 'CERT_SIGNED',
  }

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, Event> => ({
    id: 'dfspClientCert',
    initial: 'creatingDfspCsr',
    on: {
      RECREATE_DFSP_CLIENT_CERT: {
        actions: [
          stop('createCsr'),
          stop('uploadCsr'),
          stop('getDfspClientCert'),
          assign({
            dfspClientCert: (ctx): any => ({
              ...ctx.dfspClientCert,
              id: undefined,
              privateKey: undefined,
              csr: undefined,
              cert: undefined,
            }),
          }),
        ],
        target: 'idle',
        internal: false,
      },
    },
    states: {
      idle: {},
      creatingDfspCsr: {
        entry: send('CREATING_DFSP_CSR'),
        invoke: {
          id: 'createCsr',
          src: () =>
            invokeRetry({
              id: 'createCsr',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              machine: 'DFSP_CLIENT_CERT',
              state: 'creatingDfspCsr',
              service: async () => opts.vault.createCSR(),
            }),
          onDone: {
            actions: assign({
              dfspClientCert: (ctx, { data }) => data,
            }),
            target: 'uploadingDfspCsr',
          },
        },
      },
      uploadingDfspCsr: {
        entry: send('UPLOADING_DFSP_CSR'),
        invoke: {
          id: 'uploadCsr',
          src: (ctx) =>
            invokeRetry({
              id: 'uploadCsr',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              machine: 'DFSP_CLIENT_CERT',
              state: 'uploadingDfspCsr',
              service: () => opts.dfspCertificateModel.uploadCSR({ csr: ctx.dfspClientCert!.csr! }),
            }),
          onDone: {
            actions: assign({
              dfspClientCert: (ctx, { data }): any => ({
                ...ctx.dfspClientCert,
                id: data.id,
              }),
            }),
            target: 'gettingDfspClientCert',
          },
        },
      },
      gettingDfspClientCert: {
        entry: send('FETCHING_DFSP_CLIENT_CERT'),
        invoke: {
          id: 'getDfspClientCert',
          src: (ctx) =>
            invokeRetry({
              id: 'getDfspClientCert',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              machine: 'DFSP_CLIENT_CERT',
              state: 'gettingDfspClientCert',
              service: () =>
                opts.dfspCertificateModel.getClientCertificate({ inboundEnrollmentId: ctx.dfspClientCert!.id! }),
            }),
          onDone: [
            {
              target: 'completed',
              cond: 'hasNewDfspClientCert',
              actions: [
                assign({
                  dfspClientCert: (context, { data }): any => ({
                    ...context.dfspClientCert,
                    cert: data.certificate,
                  }),
                }),
                send((ctx) => ({
                  type: 'UPDATE_CONNECTOR_CONFIG',
                  config: {
                    outbound: {
                      tls: {
                        creds: {
                          cert: ctx.dfspClientCert!.cert,
                          key: ctx.dfspClientCert!.privateKey,
                        },
                      },
                    },
                  },
                })),
              ],
            },
            { target: 'completed' },
          ],
        },
      },
      completed: {
        entry: send('COMPLETING_DFSP_CLIENT_CERT'),
        always: {
          target: 'retry',
          actions: send('DFSP_CLIENT_CERT_CONFIGURED'),
        },
      },
      retry: {
        after: {
          [opts.refreshIntervalSeconds * 1000]: { target: 'gettingDfspClientCert' },
        },
      },
    },
  });

  export const createGuards = <TContext extends Context>() => ({
    hasNewDfspClientCert: (ctx: TContext, event: AnyEventObject) =>
      event.data?.state === CertState.CERT_SIGNED && event.data.certificate !== ctx.dfspClientCert!.cert,
  });
}
