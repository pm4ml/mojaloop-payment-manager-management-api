import { AnyEventObject, assign, DoneEventObject, DoneInvokeEvent, MachineConfig, sendParent } from 'xstate';
import { MachineOpts } from './MachineOpts';
import { invokeRetry } from './invokeRetry';

export namespace DfspCert {
  export interface Context {
    dfspClientCert?: {
      id?: number;
      csr?: string;
      cert?: string;
      privateKey?: string;
    };
  }

  export enum EventOut {
    COMPLETED = 'DFSP_CLIENT_CERT_CONFIGURED',
  }

  type EventIn = DoneEventObject;

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, any> => ({
    id: 'dfspClientCert',
    initial: 'creatingDfspCsr',
    states: {
      creatingDfspCsr: {
        invoke: {
          src: () =>
            invokeRetry({
              id: 'createCsr',
              logger: opts.logger,
              service: async () => opts.vault.createCSR(opts.keyLength),
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
            target: 'getDfspClientCert',
          },
        },
      },
      getDfspClientCert: {
        invoke: {
          src: (ctx) =>
            invokeRetry({
              id: 'getDfspClientCertificate',
              logger: opts.logger,
              service: () =>
                opts.dfspCertificateModel.getClientCertificate({ inboundEnrollmentId: ctx.dfspClientCert!.id! }),
            }),
        },
        onDone: [
          {
            target: 'populatingDfspCert',
            actions: assign({
              dfspClientCert: (context, { data }): any => ({
                ...context.dfspClientCert,
                certificate: data.certificate,
              }),
            }),
            cond: 'hasNewDfspClientCert',
          },
          { target: 'completed' },
        ],
      },
      populatingDfspCert: {
        invoke: {
          src: (ctx) =>
            invokeRetry({
              id: 'populateOutboundCertSDK',
              logger: opts.logger,
              service: async () =>
                opts.ControlServer.changeConfig({
                  outbound: {
                    tls: {
                      creds: {
                        cert: ctx.dfspClientCert!.cert,
                        key: ctx.dfspClientCert!.privateKey,
                      },
                    },
                  },
                }),
            }),
          onDone: {
            target: 'completed',
          },
        },
      },
      completed: {
        always: {
          target: 'retry',
          actions: sendParent(EventOut.COMPLETED),
        },
      },
      retry: {
        after: {
          [opts.refreshIntervalSeconds * 1000]: { target: 'getDfspClientCert' },
        },
      },
    },
  });

  export const createGuards = <TContext extends Context>() => ({
    hasNewDfspClientCert: (ctx: TContext, event: AnyEventObject) =>
      event.data.state === 'CERT_SIGNED' && event.data.certificate !== ctx.dfspClientCert!.cert,
  });
}
