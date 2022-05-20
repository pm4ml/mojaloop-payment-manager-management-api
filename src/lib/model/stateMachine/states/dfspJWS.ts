import { assign, send, MachineConfig, DoneEventObject } from 'xstate';
import { MachineOpts } from './MachineOpts';
import { invokeRetry } from './invokeRetry';

export namespace DfspJWS {
  export type Context = {
    dfspJWS?: {
      publicKey: string;
      privateKey: string;
    };
  };

  export type Event = DoneEventObject | { type: 'CREATE_JWS' | 'DFSP_JWS_PROPAGATED' };

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, Event> => ({
    id: 'createJWS',
    initial: 'creating',
    on: {
      CREATE_JWS: { target: '.creating', internal: false },
    },
    states: {
      idle: {},
      creating: {
        invoke: {
          id: 'dfspJWSCreate',
          src: () =>
            invokeRetry({
              id: 'dfspJWSCreate',
              logger: opts.logger,
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
        invoke: {
          id: 'dfspJWSUpload',
          src: (ctx) =>
            invokeRetry({
              id: 'dfspJWSUpload',
              logger: opts.logger,
              service: async () => opts.dfspCertificateModel.uploadJWS({ publicKey: ctx.dfspJWS!.publicKey }),
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
