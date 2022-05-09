import { assign, sendParent, MachineConfig, DoneEventObject } from 'xstate';
import { MachineOpts } from './MachineOpts';
import { invokeRetry } from './invokeRetry';
import { CSR } from '@app/lib/vault';

export namespace DfspCA {
  export type Context = {
    dfspCA?: {
      cert: string;
      chain: string;
      key: string;
    };
  };

  export enum EventOut {
    COMPLETED = 'DFSP_CA_PROPAGATED',
  }

  type CreateIntCAEvent = { type: 'CREATE_INT_CA'; csr: CSR };
  type CreateExtCAEvent = { type: 'CREATE_EXT_CA'; rootCert: string; intermediateChain: string; privateKey: string };

  // type EventIn = { type: 'CREATE_CA'; csr: CSR } | DoneEventObject;
  type EventIn = CreateIntCAEvent | CreateExtCAEvent | DoneEventObject;

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, EventIn> => ({
    id: 'createCA',
    initial: 'idle',
    states: {
      idle: {
        on: {
          CREATE_INT_CA: 'creatingIntCA',
          CREATE_EXT_CA: 'creatingExtCA',
        },
      },
      creatingIntCA: {
        invoke: {
          src: (ctx, event) =>
            invokeRetry({
              id: 'dfspIntCACreate',
              service: () => opts.vault.createCA((event as CreateIntCAEvent).csr),
            }),
          onDone: {
            target: 'propagate',
            actions: assign({ dfspCA: (context, event) => event.data }),
          },
        },
      },
      creatingExtCA: {
        invoke: {
          src: (ctx, event) =>
            invokeRetry({
              id: 'dfspExtCACreate',
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
            target: 'propagate',
            actions: assign({ dfspCA: (context, event) => event.data }),
          },
        },
      },
      propagate: {
        type: 'parallel',
        states: {
          uploadingToHub: {
            invoke: {
              src: (ctx) =>
                invokeRetry({
                  id: 'dfspJWSUpload',
                  service: () => opts.certificatesModel.uploadDFSPCA(ctx.dfspCA!.cert, ctx.dfspCA!.chain),
                }),
            },
          },
        },
        on: {
          CREATE_EXT_CA: 'creatingExtCA',
          CREATE_INT_CA: 'creatingIntCA',
        },
        onDone: {
          target: 'idle',
          actions: sendParent(EventOut.COMPLETED),
        },
      },
    },
  });
}
