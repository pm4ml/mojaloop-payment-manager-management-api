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
  export enum ProgressState {
    PENDING = 'pending',
    IN_PROGRESS = 'inProgress',
    COMPLETED = 'completed',
    IN_ERROR = 'inError',
  }
  export interface ProgressMonitorEntry {
    value: ProgressState;
    lastUpdated: Date | null;
    retries?: number;
    error?: string;
    description?: string;
  }

  export enum MachineName {
    DFSP_SERVER_CERT = 'DFSP_SERVER_CERT',
    PEER_JWS = 'PEER_JWS',
    DFSP_JWS = 'DFSP_JWS',
    DFSP_CA = 'DFSP_CA',
    DFSP_CLIENT_CERT = 'DFSP_CLIENT_CERT',
    HUB_CA = 'HUB_CA',
    HUB_CERT = 'HUB_CERT',
    ENDPOINT_CONFIG = 'ENDPOINT_CONFIG',
    UPLOAD_PEER_JWS = 'UPLOAD_PEER_JWS',
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

  export type Event =
    | DoneEventObject
    | { type: 'FAILED'; machine: string; state: string; error: string; retries: number };

  const eventToProgressMap: { [key: string]: { machine: MachineName; state: ProgressState } } = {
    // HUB_CA events
    FETCHING_HUB_CA: { machine: MachineName.HUB_CA, state: ProgressState.COMPLETED },
    HUB_CA_CHECKING_NEW: { machine: MachineName.HUB_CA, state: ProgressState.COMPLETED },
    NEW_HUB_CA_FETCHED: { machine: MachineName.HUB_CA, state: ProgressState.COMPLETED },
    // DFSP_CA events
    FETCHING_PREBUILT_CA: { machine: MachineName.DFSP_CA, state: ProgressState.IN_PROGRESS },
    CREATING_INT_CA: { machine: MachineName.DFSP_CA, state: ProgressState.IN_PROGRESS },
    CREATING_EXT_CA: { machine: MachineName.DFSP_CA, state: ProgressState.IN_PROGRESS },
    UPLOADING_TO_HUB: { machine: MachineName.DFSP_CA, state: ProgressState.IN_PROGRESS },
    DFSP_CA_PROPAGATED: { machine: MachineName.DFSP_CA, state: ProgressState.COMPLETED },
    // DFSP_CLIENT_CERT events
    DFSP_CLIENT_CERT_CONFIGURED: { machine: MachineName.DFSP_CLIENT_CERT, state: ProgressState.COMPLETED },
    // DFSP_SERVER_CERT events
    DFSP_SERVER_CERT_CONFIGURED: { machine: MachineName.DFSP_SERVER_CERT, state: ProgressState.COMPLETED },
    // HUB_CERT events
    HUB_CLIENT_CERT_SIGNED: { machine: MachineName.HUB_CERT, state: ProgressState.COMPLETED },
    // PEER_JWS events
    PEER_JWS_CONFIGURED: { machine: MachineName.PEER_JWS, state: ProgressState.COMPLETED },
    // DFSP_JWS events
    DFSP_JWS_PROPAGATED: { machine: MachineName.DFSP_JWS, state: ProgressState.COMPLETED },
    // ENDPOINT_CONFIG events
    ENDPOINT_CONFIG_PROPAGATED: { machine: MachineName.ENDPOINT_CONFIG, state: ProgressState.COMPLETED },
  };

  export const createState = <TContext extends Context>(opts: MachineOpts): MachineConfig<TContext, any, any> => ({
    id: 'progressMonitor',
    initial: 'init',
    on: {
      FAILED: {
        actions: assign<Context>({
          progressMonitor: (ctx, event) => {
            if (!event.machine) return ctx.progressMonitor;
            return {
              ...ctx.progressMonitor!,
              [event.machine]: {
                value: ProgressState.IN_ERROR,
                lastUpdated: new Date(),
                retries: event.retries,
                error: event.error,
              },
            };
          },
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      '*': {
        actions: assign<Context>({
          progressMonitor: (ctx, event) => {
            const mapping = eventToProgressMap[event.type];
            console.log('===================================');
            console.log('Helllo asdadasladja');
            console.log('event.type is ', event.type);
            console.log('===================================');
            if (!mapping) return ctx.progressMonitor!;
            return {
              ...ctx.progressMonitor!,
              [mapping.machine]: {
                value: mapping.state,
                lastUpdated: new Date(),
              },
            };
          },
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
              PEER_JWS: { value: ProgressState.PENDING, lastUpdated: null, description: `Service not initialized` },
              DFSP_JWS: { value: ProgressState.PENDING, lastUpdated: null, description: `Service not initialized` },
              DFSP_CA: { value: ProgressState.PENDING, lastUpdated: null, description: `Service not initialized` },
              DFSP_SERVER_CERT: {
                value: ProgressState.PENDING,
                lastUpdated: null,
                description: `Service not initialized`,
              },
              DFSP_CLIENT_CERT: {
                value: ProgressState.PENDING,
                lastUpdated: null,
                description: `Service not initialized`,
              },
              HUB_CA: { value: ProgressState.PENDING, lastUpdated: null, description: `Service not initialized` },
              HUB_CERT: { value: ProgressState.PENDING, lastUpdated: null, description: `Service not initialized` },
              ENDPOINT_CONFIG: {
                value: ProgressState.PENDING,
                lastUpdated: null,
                description: `Service not initialized`,
              },
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
              machine: 'progressMonitor',
              state: 'notifyCompleted',
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
