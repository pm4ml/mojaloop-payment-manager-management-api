/** ************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 ************************************************************************* */

import { assign, DoneEventObject, MachineConfig, send } from 'xstate';
import { MachineOpts } from './MachineOpts';
import { invokeRetry } from './invokeRetry';
import _ from 'lodash';

export namespace EndpointConfig {
  type IP = {
    address: string;
    ports: string[];
  };

  export type Context = {
    endpointConfig?: {
      ipList: IP[];
      callbackHost: string;
    };
  };

  export type Event = DoneEventObject | { type: 'IP_ENDPOINT_CONFIGURED' };

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, Event> => ({
    id: 'endpointConfig',
    initial: 'checkingChanges',
    states: {
      checkingChanges: {
        always: [
          {
            cond: 'configChanged',
            actions: assign({
              endpointConfig: () => ({
                callbackHost: opts.config.callbackHost,
                ipList: opts.config.whitelistIP,
              }),
            }) as any,
            target: 'propagatingEndpointConfig',
          },
          { target: 'completed' },
        ],
      },
      propagatingEndpointConfig: {
        type: 'parallel',
        states: {
          uploadingWhitelistIP: {
            invoke: {
              id: 'uploadIPWhitelist',
              src: (ctx) =>
                invokeRetry({
                  id: 'uploadIPWhitelist',
                  logger: opts.logger,
                  service: async () =>
                    opts.dfspEndpointModel.create({
                      direction: 'EGRESS',
                      type: 'IP',
                      ipList: ctx.endpointConfig?.ipList,
                    }),
                }),
              onDone: '.completed',
            },
            initial: 'processing',
            states: {
              processing: {},
              completed: { type: 'final' },
            },
          },
          uploadingCallbackHost: {
            invoke: {
              id: 'uploadCallbackHost',
              src: (ctx) =>
                invokeRetry({
                  id: 'uploadCallbackHost',
                  logger: opts.logger,
                  service: async () =>
                    opts.dfspEndpointModel.create({
                      direction: 'INGRESS',
                      type: 'URL',
                      url: ctx.endpointConfig?.callbackHost,
                    }),
                }),
              onDone: '.completed',
            },
            initial: 'processing',
            states: {
              processing: {},
              completed: { type: 'final' },
            },
          },
        },
        onDone: {
          target: 'completed',
        },
      },
      completed: {
        always: {
          target: 'retry',
          actions: send('PEER_JWS_CONFIGURED'),
        },
      },
      retry: {
        after: {
          [opts.refreshIntervalSeconds * 1000]: { target: 'checkingChanges' },
        },
      },
    },
  });

  export const createGuards = <TContext extends Context>(opts: MachineOpts) => ({
    configChanged: (ctx: TContext) =>
      !!(opts.config.callbackHost && opts.config.callbackHost !== ctx.endpointConfig?.callbackHost) ||
      !!(opts.config.whitelistIP && !_.isEqual(opts.config.whitelistIP, ctx.endpointConfig?.ipList)),
  });
}
