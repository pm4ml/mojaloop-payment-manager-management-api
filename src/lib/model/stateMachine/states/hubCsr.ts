import { createMachine } from 'xstate';
import { MachineOpts } from './MachineOpts';

// type TEvent = { type: 'FETCH'; id: string } | { type: 'RESOLVE'; user: string } | { type: 'REJECT'; error: string };

export const hubCsr = (opts: MachineOpts) =>
  createMachine({
    id: 'hubCsr',
    initial: 'createCsr',
    states: {
      createCsr: {
        initial: 'createCsr',
        states: {
          createCsr: {
            invoke: {
              src: () => opts.certificatesModel.createCSR(opts.keyLength),
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
              60000: { target: 'createCsr' },
            },
          },
        },
        onDone: {
          target: 'uploadCsr',
        },
      },
      uploadCsr: {
        initial: 'uploadCsr',
        states: {
          upload: {
            invoke: {
              src: () => opts.certificatesModel.uploadClientCSR(),
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
          target: 'getClientCert',
        },
      },
      getClientCert: {
        initial: 'getClientCert',
        states: {
          getClientCert: {
            invoke: {
              src: downloadClientCert,
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
              60000: { target: 'getClientCert' },
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
