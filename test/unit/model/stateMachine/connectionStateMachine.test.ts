import { State } from 'xstate';
import { ConnectionStateMachine } from '../../../../src/lib/model/stateMachine/ConnectionStateMachine';

import WebSocket from 'ws';
import { inspect } from '@xstate/inspect/lib/server';

jest.mock('@xstate/inspect/lib/server', () => ({
  inspect: jest.fn(),
}));

jest.mock('ws', () => ({
  Server: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn(),
  })),
}));

jest.mock('xstate', () => ({
  ...jest.requireActual('xstate'),
  interpret: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    send: jest.fn(),
    onTransition: jest.fn(),
  })),
}));

describe('ConnectionStateMachine', () => {
  let opts: any;
  let vaultMock: any;
  let loggerMock: any;
  let connectionStateMachine: ConnectionStateMachine;

  beforeEach(() => {
    vaultMock = {
      setStateMachineState: jest.fn(() => Promise.resolve()),
      getStateMachineState: jest.fn(() => Promise.resolve(null)),
    };
    loggerMock = {
      push: jest.fn(() => loggerMock),
      log: jest.fn(),
    };

    opts = {
      vault: vaultMock,
      logger: loggerMock,
      config: {
        stateMachineInspectEnabled: false,
      },
      port: 8080,
    };
    connectionStateMachine = new ConnectionStateMachine(opts);
  });

  describe('getContext', () => {
    it('should return the correct context', () => {
      const context = connectionStateMachine.getContext();
      expect(context).toBe(connectionStateMachine.context);
    });
  });

  describe('serve', () => {
    it('should not serve state machine inspection if disabled', () => {
      connectionStateMachine.serve();

      expect(WebSocket.Server).not.toHaveBeenCalled();
      expect(inspect).not.toHaveBeenCalled();
      expect(loggerMock.log).not.toHaveBeenCalled();
    });

    it('should serve state machine inspection if enabled', () => {
      opts.config.stateMachineInspectEnabled = true;
      connectionStateMachine = new ConnectionStateMachine(opts);
      connectionStateMachine.serve();
      expect(WebSocket.Server).toHaveBeenCalledWith({ port: opts.port });
      expect(inspect).toHaveBeenCalledWith({
        server: expect.objectContaining({
          on: expect.any(Function),
          close: expect.any(Function),
        }),
      });
      expect(loggerMock.log).toHaveBeenCalledWith(
        `StateMachine introspection URL: https://stately.ai/viz?inspect&server=ws://localhost:${opts.port}`,
      );
    });
  });

  describe('start', () => {
    it('should initialize and start the state machine', async () => {
      await connectionStateMachine.start();

      expect(opts.vault.getStateMachineState).toHaveBeenCalled();
      expect(connectionStateMachine.service.start).toHaveBeenCalled();
      expect(loggerMock.log).toHaveBeenCalledWith(expect.stringContaining('Starting state machine from scratch'));
    });

    it('should start the state machine from scratch when the version is different', async () => {
      const previousState = {
        state: { value: 'previousState' },
        hash: connectionStateMachine.hash,
        version: 2,
        actions: {},
      };

      opts.vault.getStateMachineState.mockResolvedValueOnce(previousState);
      await connectionStateMachine.start();
      expect(loggerMock.log).toHaveBeenCalledWith(
        expect.stringContaining('Starting state machine from scratch because state machine changed'),
      );
      expect(connectionStateMachine.service.start).toHaveBeenCalled();
    });

    it('should restore the state machine if previous state exists', async () => {
      vaultMock.getStateMachineState.mockResolvedValueOnce({
        state: { value: 'someState' },
        hash: connectionStateMachine.hash,
        version: 3,
        actions: {},
      });

      await connectionStateMachine.start();

      expect(loggerMock.log).toHaveBeenCalledWith(
        expect.stringContaining('Restoring state machine from previous state'),
      );
      expect(connectionStateMachine.service.start).toHaveBeenCalledWith(
        expect.objectContaining({
          actions: expect.any(Array),
        }),
      );
    });

    it('should start the state machine from scratch when no previous state is found', async () => {
      const previousState = null;

      opts.vault.getStateMachineState.mockResolvedValueOnce(previousState);
      await connectionStateMachine.start();

      expect(loggerMock.log).toHaveBeenCalledWith(
        expect.stringContaining('Starting state machine from scratch because no previous state found'),
      );
      expect(connectionStateMachine.service.start).toHaveBeenCalled();
    });
  });

  describe('updateActions', () => {
    beforeEach(() => {
      connectionStateMachine = new ConnectionStateMachine(opts);
      connectionStateMachine.actions = {};
    });

    it('should remove actions with type "xstate.cancel"', () => {
      connectionStateMachine.actions = { testActionId: { type: 'test' } };
      connectionStateMachine.updateActions([{ type: 'xstate.cancel', sendId: 'testActionId' }]);

      expect(connectionStateMachine.actions.testActionId).toBeUndefined();
    });

    it('should add actions with type "xstate.after"', () => {
      connectionStateMachine.updateActions([
        { type: 'xstate.after', id: 'afterActionId', event: { type: 'xstate.after(1000)' } },
      ]);

      expect(connectionStateMachine.actions.afterActionId).toEqual({
        type: 'xstate.after',
        id: 'afterActionId',
        event: { type: 'xstate.after(1000)' },
      });
    });

    it('should handle "xstate.invoke" actions with type "xstate.stop"', () => {
      connectionStateMachine.actions = { invokeActionId: { type: 'xstate.invoke' } };
      connectionStateMachine.updateActions([
        {
          type: 'xstate.stop',
          activity: { id: 'invokeActionId', type: 'xstate.invoke' },
        },
      ]);

      expect(connectionStateMachine.actions.invokeActionId).toBeUndefined();
    });

    it('should handle "xstate.invoke" actions with type "xstate.start"', () => {
      connectionStateMachine.updateActions([
        {
          type: 'xstate.start',
          activity: { id: 'newInvokeActionId', type: 'xstate.invoke' },
        },
      ]);

      expect(connectionStateMachine.actions.newInvokeActionId).toEqual({
        type: 'xstate.start',
        activity: { id: 'newInvokeActionId', type: 'xstate.invoke' },
      });
    });
  });

  it('should log an error if setStateMachineState fails', async () => {
    const error = new Error('Failed to set state');
    vaultMock.setStateMachineState.mockRejectedValueOnce(error);
    await connectionStateMachine.setState();
    expect(loggerMock.push).toHaveBeenCalledWith({ err: error });
    expect(loggerMock.log).toHaveBeenCalledWith('Failed to set state machine state');
  });

  it('should handle state transitions', () => {
    const stateMock = {
      value: 'newState',
      context: {},
      actions: [],
    };

    connectionStateMachine.handleTransition(stateMock as unknown as State<any, any>);

    expect(loggerMock.push).toHaveBeenCalledWith({ state: 'newState' });
    expect(connectionStateMachine.context).toEqual(stateMock.context);
  });

  it('should send events to the state machine', () => {
    const event = { type: 'TEST_EVENT' };

    connectionStateMachine.sendEvent(event);

    expect(connectionStateMachine.service.send).toHaveBeenCalledWith(event);
  });

  it('should stop the state machine', () => {
    connectionStateMachine.stop();

    expect(connectionStateMachine.service.stop).toHaveBeenCalled();
  });
});
