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
  export interface ProgressMonitorEntry {
    value: boolean;
    lastUpdated: Date | null;
  }

  export interface Context {
    progressMonitor?: {
      PEER_JWS: ProgressMonitorEntry;
      DFSP_JWS: ProgressMonitorEntry;
      DFSP_CA: ProgressMonitorEntry;
      DFSP_SERVER_CERT: ProgressMonitorEntry;
      DFSP_CLIENT_CERT: ProgressMonitorEntry;
      HUB_CA: ProgressMonitorEntry;
      HUB_CERT: ProgressMonitorEntry;
      ENDPOINT_CONFIG: ProgressMonitorEntry;
    };
  }

  export type Event = DoneEventObject;

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, any> => ({
    id: 'progressMonitor',
    initial: 'init',
    on: {
      NEW_HUB_CA_FETCHED: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({ ...ctx.progressMonitor!, HUB_CA: { value: true, lastUpdated: new Date() } }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      DFSP_CA_PROPAGATED: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({ ...ctx.progressMonitor!, DFSP_CA: { value: true, lastUpdated: new Date() } }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      DFSP_CLIENT_CERT_CONFIGURED: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            DFSP_CLIENT_CERT: { value: true, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      DFSP_SERVER_CERT_CONFIGURED: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            DFSP_SERVER_CERT: { value: true, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      HUB_CLIENT_CERT_SIGNED: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({ ...ctx.progressMonitor!, HUB_CERT: { value: true, lastUpdated: new Date() } }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      PEER_JWS_CONFIGURED: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({ ...ctx.progressMonitor!, PEER_JWS: { value: true, lastUpdated: new Date() } }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      DFSP_JWS_PROPAGATED: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({ ...ctx.progressMonitor!, DFSP_JWS: { value: true, lastUpdated: new Date() } }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      ENDPOINT_CONFIG_PROPAGATED: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            ENDPOINT_CONFIG: { value: true, lastUpdated: new Date() },
          }),
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
              PEER_JWS: { value: false, lastUpdated: null },
              DFSP_JWS: { value: false, lastUpdated: null },
              DFSP_CA: { value: false, lastUpdated: null },
              DFSP_SERVER_CERT: { value: false, lastUpdated: null },
              DFSP_CLIENT_CERT: { value: false, lastUpdated: null },
              HUB_CA: { value: false, lastUpdated: null },
              HUB_CERT: { value: false, lastUpdated: null },
              ENDPOINT_CONFIG: { value: false, lastUpdated: null },
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
    completedStates: (ctx) => Object.values(ctx.progressMonitor).every((entry) => entry.value),
  });
}
