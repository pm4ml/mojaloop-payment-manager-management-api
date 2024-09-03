/**************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 **************************************************************************/

import { createHash } from 'node:crypto';
import { createMachine, interpret, State, StateMachine } from 'xstate';
import { ActionObject } from 'xstate/lib/types';
import { inspect } from '@xstate/inspect/lib/server';
import WebSocket from 'ws';

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
  UploadPeerJWS,
} from './states';

import { MachineOpts } from './states/MachineOpts';

type Context = PeerJWS.Context &
  DfspJWS.Context &
  DfspCA.Context &
  DfspClientCert.Context &
  DfspServerCert.Context &
  HubCert.Context &
  HubCA.Context &
  ConnectorConfig.Context &
  UploadPeerJWS.Context &
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
  | UploadPeerJWS.Event
  | EndpointConfig.Event
  | ProgressMonitor.Event;

type ActionType = ActionObject<Context, Event>;

type StateMachineType = StateMachine<Context, any, Event>;

class ConnectionStateMachine {
  private static VERSION = 3;
  private started: boolean = false;

  private readonly hash: string;
  private service: any; // todo: define type
  private opts: MachineOpts;
  private context?: Context;
  private actions: Record<string, ActionType> = {};

  constructor(opts: MachineOpts) {
    this.opts = opts;
    this.serve();

    const machine = this.createMachine(opts);
    this.hash = ConnectionStateMachine.createHash(machine);

    this.service = interpret(machine, { devTools: true });
    this.service.onTransition(this.handleTransition.bind(this));
  }

  private handleTransition(state: State<Context, Event>) {
    this.opts.logger.push({ state: state.value }).log('Transition');
    this.context = state.context;
    this.updateActions(state.actions);
    this.setState(state);
  }

  private setState(state: State<Context, Event>) {
    this.opts.vault
      .setStateMachineState({
        state,
        hash: this.hash,
        version: ConnectionStateMachine.VERSION,
        actions: this.actions,
      })
      .catch((err) => {
        this.opts.logger.push({ err }).log('Failed to set state machine state');
      });
  }

  private updateActions(acts: Array<ActionType>) {
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
    const isPrevious = state?.hash === this.hash && state?.version === ConnectionStateMachine.VERSION;

    if (isPrevious) {
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
    if (this.opts.config.stateMachineInspectEnabled) {
      const { port } = this.opts;
      inspect({
        server: new WebSocket.Server({ port }),
      });
      this.opts.logger.log(
        `StateMachine introspection URL: https://stately.ai/viz?inspect&server=ws://localhost:${port}`
      );
    }
  }

  private createMachine(opts: MachineOpts): StateMachineType {
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
          uploadingPeerJWS: UploadPeerJWS.createState<Context>(opts),
          creatingJWS: DfspJWS.createState<Context>(opts),
          endpointConfig: EndpointConfig.createState<Context>(opts),
          connectorConfig: ConnectorConfig.createState<Context>(opts),
          progressMonitor: ProgressMonitor.createState<Context>(opts),
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

  static createHash(machine: StateMachineType) {
    return createHash('sha256').update(JSON.stringify(machine.config.states)).digest('base64');
  }
}

export { ConnectionStateMachine };
