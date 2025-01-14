import { createMachine, interpret } from 'xstate';
import { invokeRetry } from '../../../../src/lib/model/stateMachine/states/invokeRetry.ts';
import SDKStandardComponents from '@mojaloop/sdk-standard-components';

const Logger = SDKStandardComponents.Logger.Logger;

describe('invokeRetry', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      push: jest.fn().mockReturnThis(),
      log: jest.fn(),
    };
  });

  test('should succeed on first attempt', (done) => {
    const mockService = jest.fn().mockResolvedValue('success');
    const machine = invokeRetry({
      id: 'test',
      service: mockService,
      logger: mockLogger,
    });

    const service = interpret(machine).onDone((context) => {
      expect(context.data.retries).toBe(0);
      expect(mockService).toHaveBeenCalledTimes(1);
      done();
    });

    service.start();
  });

  test('should retry and succeed', (done) => {
    const mockService = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('success');
    const machine = invokeRetry({
      id: 'test',
      service: mockService,
      maxRetries: 2,
      retryInterval: 100,
      logger: mockLogger,
    });

    const service = interpret(machine).onDone((context) => {
      expect(context.data.retries).toBe(1);
      expect(mockService).toHaveBeenCalledTimes(2);
      done();
    });

    service.start();
  });

  test('should fail after max retries', (done) => {
    const mockService = jest.fn().mockRejectedValue(new Error('fail'));
    const machine = invokeRetry({
      id: 'test',
      service: mockService,
      maxRetries: 2,
      retryInterval: 100,
      logger: mockLogger,
    });

    const service = interpret(machine).onTransition((state) => {
      if (state.matches('error')) {
        expect(state.context.retries).toBe(3);
        expect(mockService).toHaveBeenCalledTimes(3);
        done();
      }
    });

    service.start();
  });

  test('should log error on failure', (done) => {
    const mockService = jest.fn().mockRejectedValue(new Error('fail'));
    const machine = invokeRetry({
      id: 'test',
      service: mockService,
      maxRetries: 1,
      retryInterval: 100,
      logger: mockLogger,
    });

    const service = interpret(machine).onTransition((state) => {
      if (state.matches('error')) {
        expect(mockLogger.push).toHaveBeenCalledWith({ error: 'fail' });
        expect(mockLogger.log).toHaveBeenCalledWith('Error invoking service test');
        done();
      }
    });

    service.start();
  });
});