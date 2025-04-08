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
      // HubCA events
      FETCHING_HUB_CA: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            HUB_CA: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      HUB_CA_CHECKING_NEW: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            HUB_CA: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      HUB_CA_RETRYING: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            HUB_CA: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      NEW_HUB_CA_FETCHED: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            HUB_CA: { value: ProgressState.COMPLETED, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      // DfspCA events
      FETCHING_PREBUILT_CA: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            DFSP_CA: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      CREATE_INT_CA: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            DFSP_CA: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      CREATE_EXT_CA: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            DFSP_CA: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      UPLOADING_TO_HUB: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            DFSP_CA: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      DFSP_CA_PROPAGATED: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            DFSP_CA: { value: ProgressState.COMPLETED, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      // DfspClientCert events
      CREATING_DFSP_CSR: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            DFSP_CLIENT_CERT: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      UPLOADING_DFSP_CSR: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            DFSP_CLIENT_CERT: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      FETCHING_DFSP_CLIENT_CERT: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            DFSP_CLIENT_CERT: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      COMPLETING_DFSP_CLIENT_CERT: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            DFSP_CLIENT_CERT: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      DFSP_CLIENT_CERT_CONFIGURED: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            DFSP_CLIENT_CERT: { value: ProgressState.COMPLETED, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      // dfspServerCert Events
      REQUESTING_NEW_DFSP_SERVER_CERT: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            DFSP_SERVER_CERT: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      RENEWING_MANAGED_DFSP_SERVER_CERT: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            DFSP_SERVER_CERT: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      UPLOADING_DFSP_SERVER_CERT_TO_HUB: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            DFSP_SERVER_CERT: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      DFSP_SERVER_CERT_CONFIGURED: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            DFSP_SERVER_CERT: { value: ProgressState.COMPLETED, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      // hubClientCert events
      RESETTING_HUB_CLIENT_CERTS: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            HUB_CERT: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      FETCHING_HUB_CSR: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            HUB_CERT: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      UPDATING_HUB_CSR: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            HUB_CERT: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      SIGNING_HUB_CSR: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            HUB_CERT: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      UPLOADING_HUB_CERT: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            HUB_CERT: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      COMPLETING_HUB_CLIENT_CERT: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            HUB_CERT: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      HUB_CLIENT_CERT_SIGNED: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            HUB_CERT: { value: ProgressState.COMPLETED, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      // peerJws events
      FETCHING_PEER_JWS: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            PEER_JWS: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      COMPARING_PEER_JWS: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            PEER_JWS: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      NOTIFYING_PEER_JWS: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            PEER_JWS: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      COMPLETING_PEER_JWS: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            PEER_JWS: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      PEER_JWS_CONFIGURED: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            PEER_JWS: { value: ProgressState.COMPLETED, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      // dfspJWS events
      CREATING_DFSP_JWS: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            DFSP_JWS: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      UPLOADING_DFSP_JWS_TO_HUB: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            DFSP_JWS: { value: ProgressState.IN_PROGRESS, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      DFSP_JWS_PROPAGATED: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            DFSP_JWS: { value: ProgressState.COMPLETED, lastUpdated: new Date() },
          }),
        }) as any,
        target: '.handlingProgressChange',
        internal: false,
      },
      // endpointConfig events
      ENDPOINT_CONFIG_PROPAGATED: {
        actions: assign<Context>({
          progressMonitor: (ctx) => ({
            ...ctx.progressMonitor!,
            ENDPOINT_CONFIG: { value: ProgressState.COMPLETED, lastUpdated: new Date() },
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
              PEER_JWS: { value: ProgressState.PENDING, lastUpdated: null },
              DFSP_JWS: { value: ProgressState.PENDING, lastUpdated: null },
              DFSP_CA: { value: ProgressState.PENDING, lastUpdated: null },
              DFSP_SERVER_CERT: { value: ProgressState.PENDING, lastUpdated: null },
              DFSP_CLIENT_CERT: { value: ProgressState.PENDING, lastUpdated: null },
              HUB_CA: { value: ProgressState.PENDING, lastUpdated: null },
              HUB_CERT: { value: ProgressState.PENDING, lastUpdated: null },
              ENDPOINT_CONFIG: { value: ProgressState.PENDING, lastUpdated: null },
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
