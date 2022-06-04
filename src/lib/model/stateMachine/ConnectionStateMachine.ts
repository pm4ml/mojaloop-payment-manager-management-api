/**************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 **************************************************************************/

import { createMachine, interpret } from 'xstate';
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
  ProgressMonitor,
} from './states';

import { MachineOpts } from './states/MachineOpts';
import WebSocket from 'ws';
import * as crypto from 'crypto';
import { ActionObject } from 'xstate/lib/types';

type Context = PeerJWS.Context &
  DfspJWS.Context &
  DfspCA.Context &
  DfspClientCert.Context &
  DfspServerCert.Context &
  HubCert.Context &
  HubCA.Context &
  ConnectorConfig.Context &
  EndpointConfig.Context &
  ProgressMonitor.Context;

type Event =
  | PeerJWS.Event
  | DfspJWS.Event
  | DfspCA.Event
  | DfspClientCert.Event
  | DfspServerCert.Event
  | HubCert.Event
  | HubCA.Event
  | ConnectorConfig.Event
  | EndpointConfig.Event
  | ProgressMonitor.Event;

class ConnectionStateMachine {
  private static VERSION = 2;
  private started: boolean = false;
  private readonly hash: string;
  private service: any;
  private opts: MachineOpts;
  private context?: Context;
  private actions: Record<string, ActionObject<Context, Event>> = {};

  constructor(opts: MachineOpts) {
    this.opts = opts;
    this.serve();
    const machine = this.createMachine(opts);
    this.hash = crypto.createHash('sha256').update(JSON.stringify(machine.config.states)).digest('base64');
    this.service = interpret(machine, { devTools: true }).onTransition(async (state) => {
      opts.logger.push({ state: state.value }).log('Transition');
      this.context = state.context;
      this.updateActions(state.actions);
      await this.opts.vault.setStateMachineState({
        state,
        hash: this.hash,
        version: ConnectionStateMachine.VERSION,
        actions: this.actions,
      });
    });
  }

  private updateActions(acts: Array<ActionObject<Context, Event>>) {
    acts.forEach((action) => {
      if (action.type === 'xstate.cancel') {
        delete this.actions[action.sendId];
      }
      if (action.event?.type?.startsWith('xstate.after')) {
        this.actions[action.id] = action;
      }
      if (action.activity?.type === 'xstate.invoke') {
        if (action.type === 'xstate.stop') {
          delete this.actions[action.activity.id];
        }
        if (action.type === 'xstate.start') {
          this.actions[action.activity.id] = action;
        }
      }
    });
  }

  public sendEvent(event: Event) {
    this.service.send(event);
  }

  public async start() {
    const state = await this.opts.vault.getStateMachineState();
    if (state?.hash === this.hash && state?.version === ConnectionStateMachine.VERSION) {
      this.opts.logger.log('Restoring state machine from previous state');
      this.actions = state.actions;
      this.service.start({
        ...state.state,
        actions: Object.values(this.actions),
      });
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
        context: {},
        type: 'parallel',
        states: {
          fetchingHubCA: HubCA.createState<Context>(opts),
          creatingDFSPCA: DfspCA.createState<Context>(opts),
          creatingDfspClientCert: DfspClientCert.createState<Context>(opts),
          creatingDfspServerCert: DfspServerCert.createState<Context>(opts),
          creatingHubClientCert: HubCert.createState<Context>(opts),
          pullingPeerJWS: PeerJWS.createState<Context>(opts),
          creatingJWS: DfspJWS.createState<Context>(opts),
          endpointConfig: EndpointConfig.createState<Context>(opts),
          connectorConfig: ConnectorConfig.createState<Context>(opts),
        },
      },
      {
        guards: {
          ...PeerJWS.createGuards<Context>(),
          // ...DfspJWS.createGuards<Context>(),
          ...DfspClientCert.createGuards<Context>(),
          ...DfspServerCert.createGuards<Context>(opts),
          // ...DfspCA.createGuards<Context>(),
          ...HubCert.createGuards<Context>(),
          ...HubCA.createGuards<Context>(),
          ...EndpointConfig.createGuards<Context>(opts),
          ...ProgressMonitor.createGuards<Context>(),
        },
        actions: {
          // ...ConnectorConfig.createActions<Context>(),
        },
      }
    );
  }
}

export { ConnectionStateMachine };
