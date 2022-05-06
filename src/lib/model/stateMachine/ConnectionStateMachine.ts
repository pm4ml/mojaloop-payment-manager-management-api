import { createMachine, StateMachine, interpret, toSCXMLEvent, Interpreter, assign } from 'xstate';
import { inspect } from '@xstate/inspect/lib/server';

import {
  dfspCA,
  dfspClientCert,
  hubCsr,
  createPeerJWSExchangeMachine,
  createDFSPJWSGeneratorMachine,
} from './states';

import { MachineOpts } from './states/MachineOpts';
import { Knex } from 'knex';
import assert from 'assert';
import WebSocket from 'ws';

export interface Event {
  type: 'CREATE_JWS' | 'CREATE_CA';
}

interface DBState {
  data: Record<string, any>;
}

interface PendingStates {
  PEER_JWS?: boolean;
  DFSP_JWS?: boolean;
}

interface TContext {
  pendingStates: PendingStates;
}

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
    const machine = this.createMachine(opts);
    this.service = interpret(machine, { devTools: true }).onTransition((state) => {
      console.log(state.value);
      this.db('state').update({ data: state });
    });
  }

  public sendEvent(event: Event) {
    this.db('events').insert({ event });
    this.service.send(event);
  }

  public async start() {
    const state = await this.db.select('data').from<DBState>('state');
    assert(state.length > 0);
    this.service.start(state[0].data);

    this.started = true;
  }

  public stop() {
    this.service.stop();
  }

  public serve() {
    console.log(`Serving state machine introspection on port ${this.opts.port}`);
    inspect({
      server: new WebSocket.Server({
        port: this.opts.port,
      }),
    });
  }

  private updateRemainingStates(states: PendingStates) {
    this.pendingStates = states;
    if (Object.keys(this.pendingStates).length) {
      // send notification about onboarding completion
    }
  }

  private createMachine(opts: MachineOpts) {
    return createMachine<TContext>({
      id: 'machine',
      context: {
        pendingStates: {},
      },
      type: 'parallel',
      states: {
        certExchange: {
          initial: 'creatingDFSPCA',
          states: {
            creatingDFSPCA: {
              ...dfspCA,
              onDone: {
                target: 'hubCsr',
              },
            },
            hubCsr: {
              ...hubCsr,
              onDone: {
                target: 'dfspClientCert',
              },
            },
            dfspClientCert: {
              ...dfspClientCert,
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
          invoke: {
            src: createPeerJWSExchangeMachine(opts),
          },
          on: {
            PEED_JWS_PULLED: {
              // target: 'success',
              actions: assign({
                pendingStates: (ctx) => {
                  const { PEER_JWS, ...states } = ctx.pendingStates;
                  this.updateRemainingStates(states);
                  return states;
                },
              }),
            },
          },
        },
        creatingJWS: {
          invoke: {
            src: createDFSPJWSGeneratorMachine(opts),
          },
          on: {
            DFSP_JWS_CREATED: {
              // target: 'success',
              actions: assign({
                pendingStates: (ctx) => {
                  const { DFSP_JWS, ...states } = ctx.pendingStates;
                  this.updateRemainingStates(states);
                  return states;
                },
              }),
            },
          },
        },
      },
    });
  }
}

export default ConnectionStateMachine;
