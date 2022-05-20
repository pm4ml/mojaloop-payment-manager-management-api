import { assign, DoneEventObject, MachineConfig, send } from 'xstate';
import { MachineOpts } from './MachineOpts';
import { invokeRetry } from './invokeRetry';
import { DfspCA } from './dfspCA';
import { CsrParams } from '@app/lib/vault';

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
    | DfspCA.Event;

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, Event> => ({
    id: 'dfspServerCert',
    initial: 'idle',
    on: {
      CREATE_DFSP_SERVER_CERT: { target: '.creatingDfspServerCert', internal: false },
      DFSP_CA_PROPAGATED: { target: '.creatingDfspServerCert', internal: false },
    },
    states: {
      idle: {},
      creatingDfspServerCert: {
        invoke: {
          id: 'createDFSPServerCert',
          src: (ctx, event) =>
            invokeRetry({
              id: 'createDFSPServerCert',
              logger: opts.logger,
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
        invoke: {
          id: 'dfspServerCertUpload',
          src: (ctx) =>
            invokeRetry({
              id: 'dfspServerCertUpload',
              logger: opts.logger,
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
}
