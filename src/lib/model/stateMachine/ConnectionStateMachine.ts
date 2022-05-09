import { createMachine, StateMachine, interpret, toSCXMLEvent, Interpreter, assign, sendParent } from 'xstate';
import { inspect } from '@xstate/inspect/lib/server';

import { DfspJWS, PeerJWS, DfspCA, hubCsr, dfspClientCert } from './states';

import { MachineOpts } from './states/MachineOpts';
import { Knex } from 'knex';
import WebSocket from 'ws';

export interface Event {
  type: 'CREATE_JWS' | 'CREATE_CA';
}

// interface DBState {
//   data: Record<string, any>;
// }

interface PendingStates {
  PEER_JWS?: boolean;
  DFSP_JWS?: boolean;
  DFSP_CA?: boolean;
}

interface MachineContext {
  pendingStates: PendingStates;
}

type Context = MachineContext & PeerJWS.Context & DfspJWS.Context & DfspCA.Context;

class ConnectionStateMachine {
  private db: Knex;
  private started: boolean = false;
  private service: any;
  private opts: MachineOpts;
  private idle: boolean = false;
  private pendingStates: PendingStates = {};

  constructor(opts: MachineOpts) {
    this.db = opts.db;
    this.opts = opts;
    this.serve();
    const machine = this.createMachine(opts);
    this.service = interpret(machine, { devTools: true }).onTransition(async (state) => {
      console.log('Transition -> ', state.value);
      await this.opts.vault.setStateMachineState(state);
    });
  }

  public sendEvent(event: Event) {
    this.db('events').insert({ event });
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

  private addPendingState(state: keyof PendingStates) {
    this.pendingStates[state] = true;
  }

  private removePendingState(state: keyof PendingStates) {
    this.pendingStates[state] = false;
    const pending = Object.values(this.pendingStates).every((s) => s);
    if (!pending) {
      // send notification about onboarding completion
    }
  }

  private createMachine(opts: MachineOpts) {
    return createMachine<Context>(
      {
        id: 'machine',
        context: {
          pendingStates: {},
          peerJWS: [],
        },
        type: 'parallel',
        states: {
          certExchange: {
            initial: 'creatingDFSPCA',
            // initial: 'hubCsr',
            states: {
              creatingDFSPCA: {
                ...DfspCA.createState<Context>(opts),
                entry: [assign({ pendingStates: (ctx) => ({ ...ctx.pendingStates, ...{ DFSP_CA: true } }) })],
                on: {
                  [DfspJWS.EventOut.COMPLETED]: 'hubCsr',
                },
              },
              hubCsr: {
                invoke: {
                  src: hubCsr(opts),
                },
                onDone: {
                  target: 'dfspClientCert',
                },
              },
              dfspClientCert: {
                invoke: {
                  src: dfspClientCert(opts),
                },
                onDone: {
                  target: 'completed',
                },
              },
              completed: {
                type: 'final',
              },
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
          completedStates: (ctx) => Object.values(ctx.pendingStates).every((s) => s),
          ...PeerJWS.createGuards<Context>(),
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
