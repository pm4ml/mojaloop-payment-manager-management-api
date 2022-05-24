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

export namespace DfspClientCert {
  export interface Context {
    dfspClientCert?: {
      id?: number;
      csr?: string;
      cert?: string;
      privateKey?: string;
    };
  }

  export type Event = DoneEventObject | { type: 'DFSP_CLIENT_CERT_CONFIGURED' };

  enum CertState {
    CERT_SIGNED = 'CERT_SIGNED',
  }

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, Event> => ({
    id: 'dfspClientCert',
    initial: 'creatingDfspCsr',
    states: {
      creatingDfspCsr: {
        invoke: {
          id: 'createCsr',
          src: () =>
            invokeRetry({
              id: 'createCsr',
              logger: opts.logger,
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
        invoke: {
          id: 'uploadCsr',
          src: (ctx) =>
            invokeRetry({
              id: 'uploadCsr',
              logger: opts.logger,
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
        invoke: {
          id: 'getDfspClientCert',
          src: (ctx) =>
            invokeRetry({
              id: 'getDfspClientCert',
              logger: opts.logger,
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
      event.data.state === CertState.CERT_SIGNED && event.data.certificate !== ctx.dfspClientCert!.cert,
  });
}
