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

export namespace HubCert {
  type HubClientCert = {
    id: string;
    csr: string;
    cert: string;
  };

  export type Context = {
    hubClientCerts?: HubClientCert[];
  };

  export type Event = DoneEventObject | { type: 'HUB_CLIENT_CERT_SIGNED' };

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, Event> => ({
    id: 'hubClientCert',
    initial: 'idle',
    on: {
      DFSP_CA_PROPAGATED: { target: '.resettingHubClientCerts', internal: false },
    },
    states: {
      idle: {},
      resettingHubClientCerts: {
        always: {
          actions: assign({ hubClientCerts: [] }) as any,
          target: 'fetchingHubCSR',
        },
      },
      fetchingHubCSR: {
        invoke: {
          id: 'getUnprocessedHubCSRs',
          src: () =>
            invokeRetry({
              id: 'getUnprocessedHubCSRs',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              service: async () => opts.hubCertificateModel.getClientCerts(),
            }),
          onDone: 'updatingCSR',
        },
      },
      updatingCSR: {
        entry: assign({
          hubClientCerts: (ctx, event: AnyEventObject) =>
            event.data.map((remoteCsr) => ({
              id: remoteCsr.id,
              csr: remoteCsr.csr,
              ...(ctx.hubClientCerts?.some(
                (processedCsr) =>
                  processedCsr.csr === remoteCsr.csr &&
                  remoteCsr.certificate &&
                  opts.vault.certIsValid(remoteCsr.certificate)
              ) && {
                cert: remoteCsr.certificate,
              }),
            })),
        }),
        always: [
          {
            target: 'signingHubCSR',
            cond: 'hasUnprocessedCerts',
          },
          { target: 'completed' },
        ],
      },
      signingHubCSR: {
        invoke: {
          id: 'signHubCSRs',
          src: (ctx) =>
            invokeRetry({
              id: 'signHubCSRs',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              service: () =>
                Promise.all(
                  ctx.hubClientCerts!.map(async (hubCert) => {
                    if (hubCert.cert) return hubCert;
                    const { certificate } = await opts.vault.signHubCSR(hubCert.csr);
                    return { ...hubCert, cert: certificate };
                  })
                ),
            }),
          onDone: { actions: assign({ hubClientCerts: (context, { data }) => data }), target: 'uploadingHubCert' },
        },
      },
      uploadingHubCert: {
        invoke: {
          id: 'uploadHubCert',
          src: (ctx) =>
            invokeRetry({
              id: 'uploadHubCert',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              service: () =>
                Promise.all(
                  ctx.hubClientCerts!.map((cert) =>
                    opts.hubCertificateModel.uploadServerCertificate({
                      enId: cert.id,
                      entry: { certificate: cert.cert },
                    })
                  )
                ),
            }),
          onDone: {
            target: 'completed',
          },
        },
      },
      completed: {
        always: {
          target: 'retry',
          actions: send('HUB_CLIENT_CERT_SIGNED'),
        },
      },
      retry: {
        after: {
          [opts.refreshIntervalSeconds * 1000]: { target: 'fetchingHubCSR' },
        },
      },
    },
  });

  export const createGuards = <TContext extends Context>() => ({
    hasUnprocessedCerts: (ctx: TContext) => ctx.hubClientCerts!.some((cert) => !cert.cert),
  });
}
