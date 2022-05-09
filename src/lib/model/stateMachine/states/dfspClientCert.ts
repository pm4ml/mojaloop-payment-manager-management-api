import { createMachine } from 'xstate';
import { MachineOpts } from './MachineOpts';

export const dfspClientCert = (opts: MachineOpts) =>
  createMachine(
    {
      id: 'dfspClientCert',
      type: 'parallel',
      states: {
        getClientCert: {
          initial: 'getClientCert',
          states: {
            downloadClientCert: {
              invoke: {
                // src: () => opts.certificatesModel.downloadClientCert(),
                src: () => opts.certificatesModel.getOutboundTlsConfig(),
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
                60000: { target: 'downloadClientCert' },
              },
            },
          },
          onDone: {
            target: 'completed',
          },
        },
        getHubCA: {
          initial: 'getHubCA',
          states: {
            getHubCA: {
              invoke: {
                src: () => opts.certificatesModel.getHubCA(),
                onDone: {
                  target: 'downloaded',
                },
                onError: {
                  target: 'failure',
                },
              },
            },
            downloaded: {
              always: [{ target: 'changed', cond: 'isHubCAChanged' }, { target: 'completed' }],
            },
            changed: {
              invoke: {
                src: () => setHubCA,
                onDone: {
                  target: 'completed',
                },
              },
            },
            completed: {
              type: 'final',
            },
            failure: {
              after: {
                60000: { target: 'getHubCA' },
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
    },
    {
      guards: {
        isHubCAChanged: (context, event, { cond }) => {

          return true;
        },
      },
    }
  );
