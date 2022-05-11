import { createMachine, interpret, assign } from 'xstate';
import { inspect } from '@xstate/inspect/lib/server';

import { DfspJWS, PeerJWS, DfspCA, DfspCert, HubCA, HubCert } from './states';

import { MachineOpts } from './states/MachineOpts';
import WebSocket from 'ws';

export interface Event {
  type: 'CREATE_EXT_CA' | 'CREATE_INT_CA';
}

interface PendingStates {
  PEER_JWS: boolean;
  DFSP_JWS: boolean;
  DFSP_CA: boolean;
  DFSP_CERT: boolean;
  HUB_CA: boolean;
  HUB_CERT: boolean;
}

interface MachineContext {
  pendingStates: PendingStates;
}

type Context = MachineContext &
  PeerJWS.Context &
  DfspJWS.Context &
  DfspCA.Context &
  DfspCert.Context &
  HubCert.Context &
  HubCA.Context;

class ConnectionStateMachine {
  private started: boolean = false;
  private service: any;
  private opts: MachineOpts;
  private idle: boolean = false;
  // private pendingStates: PendingStates = {};

  constructor(opts: MachineOpts) {
    this.opts = opts;
    this.serve();
    const machine = this.createMachine(opts);
    this.service = interpret(machine, { devTools: true }).onTransition(async (state) => {
      opts.logger.push({ state: state.value }).log('Transition');
      // console.log(this.service.getSnapshot());
      // const snapshot = this.service.getSnapshot();
      // delete (snapshot as any).actions;

      // await this.opts.vault.setStateMachineState(snapshot);
      await this.opts.vault.setStateMachineState(state);
    });
  }

  public sendEvent(event: Event) {
    this.service.send(event);
  }

  public async start() {
    const state = await this.opts.vault.getStateMachineState();
    this.service.start(state);

    this.started = true;
  }

  public stop() {
    this.service.stop();
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
    return createMachine<Context>(
      {
        id: 'machine',
        context: {
          pendingStates: {
            PEER_JWS: true,
            DFSP_JWS: true,
            DFSP_CA: true,
            DFSP_CERT: true,
            HUB_CA: true,
            HUB_CERT: true,
          },
        },
        type: 'parallel',
        states: {
          fetchingHubCA: {
            ...HubCA.createState<Context>(opts),
            entry: [assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ HUB_CA: true } }) })],
            on: {
              [HubCA.EventOut.COMPLETED]: [
                { actions: assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ HUB_CA: false } }) }) },
                { actions: 'notifyCompleted', cond: 'completedStates' },
              ],
            },
          },
          creatingDFSPCA: {
            ...DfspCA.createState<Context>(opts),
            entry: [assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ DFSP_CA: true } }) })],
            on: {
              [DfspCA.EventOut.COMPLETED]: [
                { actions: assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ DFSP_CA: false } }) }) },
                { actions: 'notifyCompleted', cond: 'completedStates' },
              ],
            },
          },
          creatingDfspClientCert: {
            ...DfspCert.createState<Context>(opts),
            entry: [assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ DFSP_CERT: true } }) })],
            on: {
              [DfspCert.EventOut.COMPLETED]: [
                { actions: assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ DFSP_CERT: false } }) }) },
                { actions: 'notifyCompleted', cond: 'completedStates' },
              ],
            },
          },
          creatingHubClientCert: {
            ...HubCert.createState<Context>(opts),
            entry: [assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ HUB_CERT: true } }) })],
            on: {
              [HubCert.EventOut.COMPLETED]: [
                { actions: assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ HUB_CERT: false } }) }) },
                { actions: 'notifyCompleted', cond: 'completedStates' },
              ],
            },
          },
          pullingPeerJWS: {
            ...PeerJWS.createState<Context>(opts),
            entry: [assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ PEER_JWS: true } }) })],
            on: {
              [PeerJWS.EventOut.COMPLETED]: [
                { actions: assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ PEER_JWS: false } }) }) },
                { actions: 'notifyCompleted', cond: 'completedStates' },
              ],
            },
          },
          creatingJWS: {
            ...DfspJWS.createState<Context>(opts),
            entry: [assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ DFSP_JWS: true } }) })],
            on: {
              [DfspJWS.EventOut.COMPLETED]: [
                { actions: assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ DFSP_JWS: false } }) }) },
                { actions: 'notifyCompleted', cond: 'completedStates' },
              ],
            },
          },
        },
      },
      {
        guards: {
          completedStates: (ctx) => Object.values(ctx.pendingStates).every((s) => !s),
          ...PeerJWS.createGuards<Context>(),
          // ...DfspJWS.createGuards<Context>(),
          ...DfspCert.createGuards<Context>(),
          // ...DfspCA.createGuards<Context>(),
          ...HubCert.createGuards<Context>(),
          ...HubCA.createGuards<Context>(),
        },
        actions: {
          // completeStep: (ctx) => assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ PEER_JWS: false } }) }),
          notifyCompleted: () => {
            // TODO: notify onboard completed
            console.log('Onboarding completed');
          },
        },
      }
    );
  }
}

export default ConnectionStateMachine;
