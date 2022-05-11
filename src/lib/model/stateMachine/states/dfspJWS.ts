import { assign, sendParent, MachineConfig, DoneEventObject } from 'xstate';
import { MachineOpts } from './MachineOpts';
import { invokeRetry } from './invokeRetry';

export namespace DfspJWS {
  export type Context = {
    dfspJWS?: {
      publicKey: string;
      privateKey: string;
    };
  };

  export enum EventOut {
    COMPLETED = 'DFSP_JWS_PROPAGATED',
  }

  type EventIn = { type: 'CREATE_JWS' } | DoneEventObject;

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, EventIn> => ({
    id: 'createJWS',
    initial: 'idle',
    states: {
      idle: {
        on: {
          CREATE_JWS: 'creating',
        },
      },
      creating: {
        invoke: {
          src: () =>
            invokeRetry({
              id: 'dfspJWSCreate',
              logger: opts.logger,
              service: async () => opts.vault.createJWS(),
            }),
          onDone: {
            target: 'propagate',
            actions: assign({ dfspJWS: (context, event) => event.data }),
          },
        },
      },
      propagate: {
        type: 'parallel',
        states: {
          populatingSDK: {
            invoke: {
              src: (ctx) =>
                invokeRetry({
                  id: 'dfspJWSPopulateSDK',
                  logger: opts.logger,
                  service: async () => opts.ControlServer.changeConfig({ jwsSigningKey: ctx.dfspJWS!.privateKey }),
                }),
            },
          },
          uploadingToHub: {
            invoke: {
              src: (ctx) =>
                invokeRetry({
                  id: 'dfspJWSUpload',
                  logger: opts.logger,
                  service: () => opts.dfspCertificateModel.uploadJWS({ publicKey: ctx.dfspJWS!.publicKey }),
                }),
            },
          },
        },
        on: {
          CREATE_JWS: 'creating',
        },
        onDone: {
          target: 'idle',
          actions: sendParent(EventOut.COMPLETED),
        },
      },
    },
  });
}
