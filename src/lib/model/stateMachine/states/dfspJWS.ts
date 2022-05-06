import { createMachine, sendParent } from 'xstate';
import { MachineOpts } from './MachineOpts';

type TContext = {};

type TEvent = { type: 'CREATE_JWS' };

export const createDFSPJWSGeneratorMachine = (opts: MachineOpts) =>
  createMachine<TContext, TEvent>({
    id: 'createJWS',
    initial: 'idle',
    states: {
      idle: {
        on: {
          CREATE_JWS: 'creating',
        },
      },
      creating: {
        initial: 'creating',
        states: {
          creating: {
            invoke: {
              src: () => opts.certificatesModel.createJWS(),
              onDone: 'success',
              onError: 'failure',
            },
          },
          success: {
            type: 'final',
          },
          failure: {
            after: {
              60000: 'creating',
            },
          },
        },
        onDone: 'uploading',
      },
      uploading: {
        initial: 'upload',
        states: {
          upload: {
            invoke: {
              src: () => opts.certificatesModel.uploadJWS(),
              onDone: 'success',
              onError: 'failure',
            },
          },
          success: {
            type: 'final',
          },
          failure: {
            after: {
              60000: 'upload',
            },
          },
        },
        onDone: {
          target: 'idle',
          actions: [sendParent('DFSP_JWS_CREATED')],
        },
        on: {
          CREATE_JWS: 'creating',
        },
      },
    },
  });
