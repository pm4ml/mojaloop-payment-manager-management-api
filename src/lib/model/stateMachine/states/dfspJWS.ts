import { assign, createMachine, sendParent } from 'xstate';
import { MachineOpts } from './MachineOpts';

type TContext = {
  // stream: Maybe<MediaStream>
  // streamError: Maybe<Error>
  // streamActor: Maybe<Actor<TEvents>>
};

type TEvent = { type: 'CREATE_JWS' };
// | { type: 'RETRY' }
// | { type: 'STOP' }
// | { type: 'GOT_STREAM'; stream: MediaStream }
// | { type: 'GOT_ERROR'; error: Error }

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
