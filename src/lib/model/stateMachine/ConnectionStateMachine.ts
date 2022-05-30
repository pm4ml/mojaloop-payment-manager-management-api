/**************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 **************************************************************************/

import { createMachine, interpret, assign, actions } from 'xstate';
import { inspect } from '@xstate/inspect/lib/server';

import {
  DfspJWS,
  PeerJWS,
  DfspCA,
  DfspClientCert,
  DfspServerCert,
  HubCA,
  HubCert,
  ConnectorConfig,
  EndpointConfig,
} from './states';

import { MachineOpts } from './states/MachineOpts';
import WebSocket from 'ws';
import * as crypto from 'crypto';

interface PendingStates {
  PEER_JWS: boolean;
  DFSP_JWS: boolean;
  DFSP_CA: boolean;
  DFSP_SERVER_CERT: boolean;
  DFSP_CLIENT_CERT: boolean;
  HUB_CA: boolean;
  HUB_CERT: boolean;
  ENDPOINT_CONFIG: boolean;
}

interface MachineContext {
  pendingStates: PendingStates;
}

type Context = MachineContext &
  PeerJWS.Context &
  DfspJWS.Context &
  DfspCA.Context &
  DfspClientCert.Context &
  DfspServerCert.Context &
  HubCert.Context &
  HubCA.Context &
  ConnectorConfig.Context &
  EndpointConfig.Context;

type Event =
  | PeerJWS.Event
  | DfspJWS.Event
  | DfspCA.Event
  | DfspClientCert.Event
  | DfspServerCert.Event
  | HubCert.Event
  | HubCA.Event
  | ConnectorConfig.Event
  | EndpointConfig.Event;

class ConnectionStateMachine {
  private started: boolean = false;
  private hash: string;
  private service: any;
  private opts: MachineOpts;
  private context?: Context;
  // private pendingStates: PendingStates = {};

  constructor(opts: MachineOpts) {
    this.opts = opts;
    this.serve();
    const machine = this.createMachine(opts);
    this.hash = crypto.createHash('sha256').update(JSON.stringify(machine.config.states)).digest('base64');
    this.service = interpret(machine, { devTools: true }).onTransition(async (state) => {
      opts.logger.push({ state: state.value }).log('Transition');
      this.context = state.context;
      // Invoked services are stored in activities.
      // Load actions from activities so that services can be invoked at state machine resume
      await this.opts.vault.setStateMachineState({
        ...state,
        __hash: this.hash,
        actions: Object.values(state.activities)
          .map((activity) => activity && activity.activity)
          .filter((activity) => activity)
          .map(actions.start),
      });
    });
  }

  public sendEvent(event: Event) {
    this.service.send(event);
  }

  public async start() {
    const state = await this.opts.vault.getStateMachineState();
    if (state?.__hash === this.hash) {
      this.opts.logger.log('Restoring state machine from previous state');
      this.service.start(state);
    } else {
      const reason = state ? 'state machine changed' : 'no previous state found';
      this.opts.logger.log(`Starting state machine from scratch because ${reason}`);
      this.service.start();
    }

    this.started = true;
  }

  public stop() {
    this.service.stop();
  }

  public getContext() {
    return this.context;
  }

  private serve() {
    console.log(
      `Serving state machine introspection on port ${this.opts.port}\n` +
        `Access URL: https://stately.ai/viz?inspect&server=ws://localhost:${this.opts.port}`
    );
    inspect({
      server: new WebSocket.Server({
        port: this.opts.port,
      }),
    });
  }

  private createMachine(opts: MachineOpts) {
    return createMachine<Context, Event>(
      {
        id: 'machine',
        context: {
          pendingStates: {
            PEER_JWS: true,
            DFSP_JWS: true,
            DFSP_CA: true,
            DFSP_SERVER_CERT: true,
            DFSP_CLIENT_CERT: true,
            HUB_CA: true,
            HUB_CERT: true,
            ENDPOINT_CONFIG: true,
          },
        },
        type: 'parallel',
        states: {
          fetchingHubCA: {
            ...HubCA.createState<Context>(opts),
            entry: [assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ HUB_CA: true } }) })],
            on: {
              NEW_HUB_CA_FETCHED: [
                { actions: assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ HUB_CA: false } }) }) },
                { actions: 'notifyCompleted', cond: 'completedStates' },
              ],
            },
          },
          creatingDFSPCA: {
            ...DfspCA.createState<Context>(opts),
            entry: [assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ DFSP_CA: true } }) })],
            on: {
              DFSP_CA_PROPAGATED: [
                { actions: assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ DFSP_CA: false } }) }) },
                { actions: 'notifyCompleted', cond: 'completedStates' },
              ],
            },
          },
          creatingDfspClientCert: {
            ...DfspClientCert.createState<Context>(opts),
            entry: [assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ DFSP_CLIENT_CERT: true } }) })],
            on: {
              DFSP_CLIENT_CERT_CONFIGURED: [
                {
                  actions: assign({
                    pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ DFSP_CLIENT_CERT: false } }),
                  }),
                },
                { actions: 'notifyCompleted', cond: 'completedStates' },
              ],
            },
          },
          creatingDfspServerCert: {
            ...DfspServerCert.createState<Context>(opts),
            entry: [assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ DFSP_SERVER_CERT: true } }) })],
            on: {
              DFSP_SERVER_CERT_CONFIGURED: [
                {
                  actions: assign({
                    pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ DFSP_SERVER_CERT: false } }),
                  }),
                },
                { actions: 'notifyCompleted', cond: 'completedStates' },
              ],
            },
          },
          creatingHubClientCert: {
            ...HubCert.createState<Context>(opts),
            entry: [assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ HUB_CERT: true } }) })],
            on: {
              HUB_CLIENT_CERT_SIGNED: [
                { actions: assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ HUB_CERT: false } }) }) },
                { actions: 'notifyCompleted', cond: 'completedStates' },
              ],
            },
          },
          pullingPeerJWS: {
            ...PeerJWS.createState<Context>(opts),
            entry: [assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ PEER_JWS: true } }) })],
            on: {
              PEER_JWS_CONFIGURED: [
                { actions: assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ PEER_JWS: false } }) }) },
                { actions: 'notifyCompleted', cond: 'completedStates' },
              ],
            },
          },
          creatingJWS: {
            ...DfspJWS.createState<Context>(opts),
            entry: [assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ DFSP_JWS: true } }) })],
            on: {
              DFSP_JWS_PROPAGATED: [
                { actions: assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ DFSP_JWS: false } }) }) },
                { actions: 'notifyCompleted', cond: 'completedStates' },
              ],
            },
          },
          endpointConfig: {
            ...EndpointConfig.createState<Context>(opts),
            entry: [assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ ENDPOINT_CONFIG: true } }) })],
            on: {
              DFSP_JWS_PROPAGATED: [
                {
                  actions: assign({
                    pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ ENDPOINT_CONFIG: false } }),
                  }),
                },
                { actions: 'notifyCompleted', cond: 'completedStates' },
              ],
            },
          },
          connectorConfig: {
            ...ConnectorConfig.createState<Context>(opts),
          },
        },
      },
      {
        guards: {
          completedStates: (ctx) => Object.values(ctx.pendingStates).every((s) => !s),
          ...PeerJWS.createGuards<Context>(),
          // ...DfspJWS.createGuards<Context>(),
          ...DfspClientCert.createGuards<Context>(),
          // ...DfspServerCert.createGuards<Context>(),
          // ...DfspCA.createGuards<Context>(),
          ...HubCert.createGuards<Context>(),
          ...HubCA.createGuards<Context>(),
          ...EndpointConfig.createGuards<Context>(opts),
        },
        actions: {
          // completeStep: (ctx) => assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ PEER_JWS: false } }) }),
          notifyCompleted: () => {
            // TODO: notify onboard completed
            console.log('Onboarding completed');
          },
          // ...ConnectorConfig.createActions<Context>(),
        },
      }
    );
  }
}

export { ConnectionStateMachine };
