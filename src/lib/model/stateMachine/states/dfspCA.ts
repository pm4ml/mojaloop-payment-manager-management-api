import { assign, MachineConfig, send, DoneEventObject } from 'xstate';
import { MachineOpts } from './MachineOpts';
import { invokeRetry } from './invokeRetry';
import { Subject } from '@app/lib/vault';

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
  export type Event = DoneEventObject | CreateIntCAEvent | CreateExtCAEvent | { type: 'DFSP_CA_PROPAGATED' };

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
        invoke: {
          id: 'getPrebuiltCA',
          src: () =>
            invokeRetry({
              id: 'getPrebuiltCA',
              logger: opts.logger,
              service: async () => opts.vault.getCA(),
            }),
          onDone: {
            target: 'uploadingToHub',
            actions: assign({ dfspCA: (context, { data }): any => ({ cert: data }) }),
          },
        },
      },
      creatingIntCA: {
        invoke: {
          id: 'dfspIntCACreate',
          src: (ctx, event) =>
            invokeRetry({
              id: 'dfspIntCACreate',
              logger: opts.logger,
              service: async () => opts.vault.createCA((event as CreateIntCAEvent).subject),
            }),
          onDone: {
            target: 'uploadingToHub',
            actions: assign({ dfspCA: (context, event) => event.data }),
          },
        },
      },
      creatingExtCA: {
        invoke: {
          id: 'dfspExtCACreate',
          src: (ctx, event) =>
            invokeRetry({
              id: 'dfspExtCACreate',
              logger: opts.logger,
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
        invoke: {
          id: 'dfspCAUpload',
          src: (ctx) =>
            invokeRetry({
              id: 'dfspCAUpload',
              logger: opts.logger,
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
