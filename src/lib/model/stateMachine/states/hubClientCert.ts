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

  export type Event =
    | DoneEventObject
    | { type: 'HUB_CLIENT_CERT_SIGNED' }
    | { type: 'HUB_CLIENT_CERT_IDLE' }
    | { type: 'RESETTING_HUB_CLIENT_CERTS' }
    | { type: 'FETCHING_HUB_CSR' }
    | { type: 'UPDATING_HUB_CSR' }
    | { type: 'SIGNING_HUB_CSR' }
    | { type: 'UPLOADING_HUB_CERT' }
    | { type: 'COMPLETING_HUB_CLIENT_CERT' }
    | { type: 'RETRYING_HUB_CLIENT_CERT' };

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, Event> => ({
    id: 'hubClientCert',
    initial: 'idle',
    on: {
      DFSP_CA_PROPAGATED: { target: '.resettingHubClientCerts', internal: false },
    },
    states: {
      idle: { entry: send('HUB_CLIENT_CERT_IDLE') },
      resettingHubClientCerts: {
        entry: send('RESETTING_HUB_CLIENT_CERTS'),
        always: {
          actions: assign({ hubClientCerts: [] }) as any,
          target: 'fetchingHubCSR',
        },
      },
      fetchingHubCSR: {
        entry: send('FETCHING_HUB_CSR'),
        invoke: {
          id: 'getUnprocessedHubCSRs',
          src: () =>
            invokeRetry({
              id: 'getUnprocessedHubCSRs',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              service: async () => opts.hubCertificateModel.getClientCerts(),
            }),
          onDone: [
            {
              cond: 'missingDataMap',
              target: 'retry',
            },
            {
              target: 'updatingCSR',
            },
          ],
        },
      },
      updatingCSR: {
        entry: [
          send('UPDATING_HUB_CSR'),
          assign({
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
        ],
        always: [
          {
            target: 'signingHubCSR',
            cond: 'hasUnprocessedCerts',
          },
          { target: 'completed' },
        ],
      },
      signingHubCSR: {
        entry: send('SIGNING_HUB_CSR'),
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
        entry: send('UPLOADING_HUB_CERT'),
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
        entry: send('COMPLETING_HUB_CLIENT_CERT'),
        always: {
          target: 'retry',
          actions: send('HUB_CLIENT_CERT_SIGNED'),
        },
      },
      retry: {
        entry: send('RETRYING_HUB_CLIENT_CERT'),
        after: {
          [opts.refreshIntervalSeconds * 1000]: { target: 'fetchingHubCSR' },
        },
      },
    },
  });

  export const createGuards = <TContext extends Context>() => ({
    hasUnprocessedCerts: (ctx: TContext) => ctx.hubClientCerts!.some((cert) => !cert.cert),
    missingDataMap: (_ctx: TContext, event: AnyEventObject) => typeof event?.data?.map !== 'function',
  });
}
