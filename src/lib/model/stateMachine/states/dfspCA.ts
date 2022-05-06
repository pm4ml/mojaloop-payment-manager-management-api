import { createMachine } from 'xstate';
import { MachineOpts } from './MachineOpts';

export const dfspCA = (opts: MachineOpts) =>
  createMachine({
    initial: 'create',
    states: {
      create: {
        initial: 'create',
        // type: 'compound',
        states: {
          create: {
            invoke: {
              src: () => opts.certificatesModel.createInternalDFSPCA(),
              onDone: {
                target: 'success',
              },
              onError: {
                target: 'failure',
              },
            },
          },
          success: {
            type: 'final',
          },
          failure: {
            after: {
              60000: { target: 'create' },
            },
          },
        },
        onDone: {
          target: 'upload',
        },
      },
      upload: {
        initial: 'upload',
        // type: 'compound',
        states: {
          upload: {
            invoke: {
              src: () => opts.certificatesModel.uploadDFSPCA(),
              onDone: {
                target: 'success',
              },
              onError: {
                target: 'failure',
              },
            },
          },
          success: {
            type: 'final',
          },
          failure: {
            after: {
              60000: { target: 'upload' },
            },
          },
        },
        onDone: {
          target: 'completed',
        },
      },
      completed: {
        type: 'final',
      },
    },
  });
