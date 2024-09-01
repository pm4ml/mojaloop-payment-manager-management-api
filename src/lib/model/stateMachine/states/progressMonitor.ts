/** ************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 ************************************************************************* */

import { assign, DoneEventObject, MachineConfig } from 'xstate';
import { invokeRetry } from '../../../../lib/model/stateMachine/states/invokeRetry';
import { MachineOpts } from './MachineOpts';

export namespace ProgressMonitor {
  export interface Context {
    progressMonitor?: {
      PEER_JWS: boolean;
      DFSP_JWS: boolean;
      DFSP_CA: boolean;
      DFSP_SERVER_CERT: boolean;
      DFSP_CLIENT_CERT: boolean;
      HUB_CA: boolean;
      HUB_CERT: boolean;
      ENDPOINT_CONFIG: boolean;
    };
  }

  export type Event = DoneEventObject;

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, any> => ({
    id: 'progressMonitor',
    initial: 'idle',
    on: {
      NEW_HUB_CA_FETCHED: {
        actions: assign<Context>({ progressMonitor: (ctx) => ({ ...ctx.progressMonitor!, HUB_CA: true }) }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      DFSP_CA_PROPAGATED: {
        actions: assign<Context>({ progressMonitor: (ctx) => ({ ...ctx.progressMonitor!, DFSP_CA: true }) }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      DFSP_CLIENT_CERT_CONFIGURED: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({ ...ctx.progressMonitor!, DFSP_CLIENT_CERT: true }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      DFSP_SERVER_CERT_CONFIGURED: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({ ...ctx.progressMonitor!, DFSP_SERVER_CERT: true }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      HUB_CLIENT_CERT_SIGNED: {
        actions: assign<Context>({ progressMonitor: (ctx) => ({ ...ctx.progressMonitor!, HUB_CERT: true }) }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      PEER_JWS_CONFIGURED: {
        actions: assign<Context>({ progressMonitor: (ctx) => ({ ...ctx.progressMonitor!, PEER_JWS: true }) }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      DFSP_JWS_PROPAGATED: {
        actions: assign<Context>({ progressMonitor: (ctx) => ({ ...ctx.progressMonitor!, DFSP_JWS: true }) }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      ENDPOINT_CONFIG_PROPAGATED: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({ ...ctx.progressMonitor!, ENDPOINT_CONFIG: true }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
    },
    states: {
      init: {
        always: {
          actions: assign({
            progressMonitor: () => ({
              PEER_JWS: false,
              DFSP_JWS: false,
              DFSP_CA: false,
              DFSP_SERVER_CERT: false,
              DFSP_CLIENT_CERT: false,
              HUB_CA: false,
              HUB_CERT: false,
              ENDPOINT_CONFIG: false,
            }),
          }) as any,
          target: 'idle',
        },
      },
      idle: {},
      handlingProgressChange: {
        always: [{ target: 'notifyingCompleted', cond: 'completedStates' }, { target: 'idle' }],
      },
      notifyingCompleted: {
        invoke: {
          id: 'notifyCompleted',
          src: () =>
            invokeRetry({
              id: 'notifyCompleted',
              logger: opts.logger,
              retryInterval: opts.refreshIntervalSeconds * 1000,
              service: async () => {
                // TODO: notify onboard completed
              },
            }),
          onDone: 'idle',
        },
      },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export const createGuards = <TContext extends Context>() => ({
    completedStates: (ctx) => Object.values(ctx.progressMonitor).every((s) => s),
  });
}
