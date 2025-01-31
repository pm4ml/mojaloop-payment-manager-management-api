import { interpret } from 'xstate';
import { invokeRetry } from '../../../../src/lib/model/stateMachine/states/invokeRetry';
import SDKStandardComponents from '@mojaloop/sdk-standard-components';

const logger = new SDKStandardComponents.Logger.Logger();

describe('invokeRetry', () => {
  jest.useFakeTimers();
  const retryInterval = 1000;
  const mockServiceSuccess = jest.fn(async () => 'Success');
  const mockServiceFail = jest.fn(async () => {
    throw new Error('Service Error');
  });

  const mockLogger = {
    push: jest.fn().mockReturnThis(),
    log: jest.fn(),
  } as unknown as typeof logger;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should transition to success when the service resolves', async () => {
    const machine = invokeRetry({
      id: 'testService',
      service: mockServiceSuccess,
      maxRetries: 3,
      retryInterval,
      logger: mockLogger,
    });

    const service = interpret(machine).start();
    jest.advanceTimersByTime(retryInterval);

    service.onTransition((state) => {
      if (state.matches('success')) {
        expect(mockServiceSuccess).toHaveBeenCalledTimes(1);
        expect(state.context.retries).toBe(0);
        expect(state.done).toBeTruthy();
        service.stop();
      }
    });
  });

  it('should retry the service on failure up to the maximum retries', async () => {
    const machine = invokeRetry({
      id: 'testService',
      service: mockServiceFail,
      maxRetries: 3,
      retryInterval,
      logger: mockLogger,
    });

    const service = interpret(machine).start();
    jest.advanceTimersByTime(retryInterval);

    service.onTransition((state) => {
      if (state.matches('error')) {
        expect(mockServiceFail).toHaveBeenCalledTimes(4); // Initial attempt + 3 retries
        expect(state.context.retries).toBe(4);
        service.stop();
      }
    });
  });

  it('should log an error when the service fails', async () => {
    const machine = invokeRetry({
      id: 'testService',
      service: mockServiceFail,
      maxRetries: 1,
      retryInterval,
      logger: mockLogger,
    });

    const service = interpret(machine).start();
    service.onTransition((state) => {
      if (state.matches('error')) {
        expect(mockLogger.push).toHaveBeenCalled();
        expect(mockLogger.log).toHaveBeenCalledWith(`Error invoking service testService`);
        service.stop();
      }
    });
  });

  it('should respect the retry interval between attempts', async () => {
    const machine = invokeRetry({
      id: 'testService',
      service: mockServiceFail,
      maxRetries: 2,
      retryInterval,
      logger: mockLogger,
    });

    const service = interpret(machine).start();
    const startTime = Date.now();
    jest.advanceTimersByTime(retryInterval);
    service.onTransition((state) => {
      if (state.matches('error')) {
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeGreaterThanOrEqual(retryInterval * 2);
        service.stop();
      }
    });
  });

  it('should immediately transition to error if maxRetries is 0', async () => {
    const machine = invokeRetry({
      id: 'testService',
      service: mockServiceFail,
      maxRetries: 0,
      retryInterval,
      logger: mockLogger,
    });

    const service = interpret(machine).start();
    jest.advanceTimersByTime(retryInterval);
    service.onTransition((state) => {
      if (state.matches('error')) {
        expect(mockServiceFail).toHaveBeenCalledTimes(1);
        expect(state.context.retries).toBe(1);
        service.stop();
      }
    });
  });
});
