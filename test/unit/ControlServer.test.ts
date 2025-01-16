import randomPhrase from '@app/lib/randomphrase';
import * as ControlServer from '@app/ControlServer';
import { getInternalEventEmitter, INTERNAL_EVENTS, changeConfig, notifyPeerJWS, deserialise } from '@app/ControlServer';

import Client from './ControlClient';
import { Logger } from '@mojaloop/sdk-standard-components';

jest.mock('@app/lib/randomphrase', () => () => 'random-id');
const ControlServerEventEmitter = getInternalEventEmitter();
describe('ControlServer', () => {
  it('exposes a valid message API', () => {
    expect(Object.keys(ControlServer.build).sort()).toEqual(Object.keys(ControlServer.MESSAGE).sort());
    Object.entries(ControlServer.build).forEach(([, builders]) => {
      expect(Object.keys(ControlServer.VERB)).toEqual(expect.arrayContaining(Object.keys(builders)));
    });
    expect(Object.keys(ControlServer.build.ERROR.NOTIFY).sort()).toEqual(Object.keys(ControlServer.ERROR).sort());
  });

  describe('API', () => {
    let server, logger, client;
    const appConfig = { control: { port: 4005 }, what: 'ever' };
    const changedConfig = { ...appConfig, some: 'thing' };

    beforeEach(async () => {
      logger = new Logger.Logger({ stringify: () => '' });
      server = new ControlServer.Server({
        logger,
        port: 4005,
        onRequestConfig: (cl: any) => {
          cl.send(ControlServer.build.CONFIGURATION.NOTIFY(appConfig));
        },
        onRequestPeerJWS: (cl: any) => {},
        onUploadPeerJWS: (cl: any) => {},
      });
      server.registerInternalEvents();
      client = await Client.Client.Create({
        address: 'localhost',
        port: server.address().port,
        logger,
        appConfig,
      });
    });

    afterEach(async () => {
      await client.stop();
      await server.stop();
      jest.restoreAllMocks();
    });

    it('supplies config when requested', async () => {
      server.populateConfig = () => appConfig;
      await client.send(ControlServer.build.CONFIGURATION.READ());
      const response = await client.receive();

      expect(response).toEqual({
        ...JSON.parse(ControlServer.build.CONFIGURATION.NOTIFY(appConfig, response.id)),
      });
    });

    it('broadcasts new config when received', async () => {
      server.broadcast = jest.fn();
      ControlServerEventEmitter.emit(INTERNAL_EVENTS.SERVER.BROADCAST_CONFIG_CHANGE, changedConfig);

      expect(server.broadcast).toHaveBeenCalledTimes(1);
      expect(server.broadcast).toHaveBeenCalledWith(
        ControlServer.build.CONFIGURATION.NOTIFY(changedConfig, randomPhrase())
      );
    });
    it('broadcasts peer JWS when received', async () => {
      server.broadcast = jest.fn();
      const mockPeerJWS = { token: 'sampleJWS' };

      ControlServerEventEmitter.emit(INTERNAL_EVENTS.SERVER.BROADCAST_PEER_JWS_CHANGE, mockPeerJWS);

      expect(server.broadcast).toHaveBeenCalledTimes(1);
      expect(server.broadcast).toHaveBeenCalledWith(ControlServer.build.PEER_JWS.NOTIFY(mockPeerJWS, randomPhrase()));
    });

    it('responds with error on unsupported verb', async () => {
      jest.setTimeout(10000);

      client.receive = jest.fn().mockResolvedValue({
        msg: 'ERROR',
        verb: 'NOTIFY',
        data: 'UNSUPPORTED_VERB',
      });

      const unsupportedMessage = ControlServer.build.CONFIGURATION.PATCH({}, {}, 'random-id');
      server._handle(client, logger)(unsupportedMessage);

      const response = await client.receive();
      expect(response).toEqual(
        expect.objectContaining({
          msg: 'ERROR',
          verb: 'NOTIFY',
          data: 'UNSUPPORTED_VERB',
        })
      );
    });

    it('responds with error on invalid message', async () => {
      jest.setTimeout(10000);

      client.receive = jest.fn().mockResolvedValue({
        msg: 'ERROR',
        verb: 'NOTIFY',
        data: 'JSON_PARSE_ERROR',
      });

      const invalidMessage = 'invalid message format';
      server._handle(client, logger)(invalidMessage);

      const response = await client.receive();
      expect(response).toEqual(
        expect.objectContaining({
          msg: 'ERROR',
          verb: 'NOTIFY',
          data: 'JSON_PARSE_ERROR',
        })
      );
    });

    it('correctly processes PEER_JWS NOTIFY messages', async () => {
      const onUploadPeerJWSSpy = jest.spyOn(server, 'onUploadPeerJWS').mockImplementation(() => {});

      const peerJWSMessage = ControlServer.build.PEER_JWS.NOTIFY({ peer: 'sampleJWS' }, 'random-id');

      server._handle(client, logger)(peerJWSMessage);

      expect(onUploadPeerJWSSpy).toHaveBeenCalledWith({ peer: 'sampleJWS' });

      onUploadPeerJWSSpy.mockRestore();
    });

    it('logs and responds to invalid message type', async () => {
      jest.setTimeout(10000);

      const invalidTypeMessage = ControlServer.build.PEER_JWS.NOTIFY({ peer: 'sampleJWS' }, 'random-id');

      const parsedMessage = JSON.parse(invalidTypeMessage);
      parsedMessage.msg = 'INVALID_TYPE';

      client.receive = jest.fn().mockResolvedValue({
        msg: 'ERROR',
        verb: 'NOTIFY',
        data: 'UNSUPPORTED_MESSAGE',
      });

      server._handle(client, logger)(parsedMessage);

      const response = await client.receive();
      expect(response).toEqual(
        expect.objectContaining({
          msg: 'ERROR',
          verb: 'NOTIFY',
          data: 'UNSUPPORTED_MESSAGE',
        })
      );
    });

    it('logs error messages when MESSAGE.ERROR is received', async () => {
      jest.setTimeout(10000);
    
      const errorMessage = {
        msg: 'ERROR',
        verb: 'NOTIFY',
        data: {
          severity: 'critical',
          details: 'A critical error occurred',
        },
        id: 'random-id',
      };
    
      const loggerSpy = jest.spyOn(logger, 'push').mockReturnValue(logger);
      const logSpy = jest.spyOn(logger, 'log');
    
      client.send = jest.fn();
    
      server._handle(client, logger)(JSON.stringify(errorMessage));
    
      expect(loggerSpy).toHaveBeenCalledWith({ msg: errorMessage });
      expect(logSpy).toHaveBeenCalledWith('Received error message');
      expect(client.send).not.toHaveBeenCalled();
    });

    it('sends an error response for unsupported message type', async () => {
      jest.setTimeout(10000);
    
      const unsupportedMessage = {
        msg: 'UNKNOWN_MESSAGE',
        verb: 'UNKNOWN_VERB',
        data: {},
        id: 'random-id',
      };
    
      const loggerSpy = jest.spyOn(logger, 'push').mockReturnValue(logger);
      const logSpy = jest.spyOn(logger, 'log');
    
      client.send = jest.fn();
    
      server._handle(client, logger)(JSON.stringify(unsupportedMessage));
    
      expect(loggerSpy).toHaveBeenCalledWith({ msg: unsupportedMessage });
      expect(logSpy).toHaveBeenCalledWith('Handling received message');
      expect(client.send).toHaveBeenCalledWith(ControlServer.build.ERROR.NOTIFY.UNSUPPORTED_MESSAGE(unsupportedMessage.id));
    });
    
    
    it('sends an error response for unsupported verb', async () => {
      jest.setTimeout(10000);
    
      const unsupportedVerbMessage = {
        msg: 'PEER_JWS',
        verb: 'UNKNOWN_VERB',
        data: {},
        id: 'random-id',
      };
    
      const loggerSpy = jest.spyOn(logger, 'push').mockReturnValue(logger);
      const logSpy = jest.spyOn(logger, 'log');
    
      client.send = jest.fn();
    
      server._handle(client, logger)(JSON.stringify(unsupportedVerbMessage));
    
      expect(loggerSpy).toHaveBeenCalledWith({ msg: unsupportedVerbMessage });
      expect(logSpy).toHaveBeenCalledWith('Handling received message');
      expect(client.send).toHaveBeenCalledWith(ControlServer.build.ERROR.NOTIFY.UNSUPPORTED_VERB(unsupportedVerbMessage.id));
    });
    
    
    
    
    
  });
});

describe('ControlServer Events', () => {
  let eventEmitter: ReturnType<typeof getInternalEventEmitter>;

  beforeEach(() => {
    eventEmitter = getInternalEventEmitter();
  });

  afterEach(() => {
    eventEmitter.removeAllListeners();
  });

  test('should emit BROADCAST_CONFIG_CHANGE with the correct payload', () => {
    const mockConfig = { key: 'value' };
    const listener = jest.fn();

    eventEmitter.on(INTERNAL_EVENTS.SERVER.BROADCAST_CONFIG_CHANGE, listener);
    changeConfig(mockConfig);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(mockConfig);
  });

  test('should emit BROADCAST_PEER_JWS_CHANGE with the correct payload', () => {
    const mockPeerJWS = { token: 'sampleJWS' };
    const listener = jest.fn();

    eventEmitter.on(INTERNAL_EVENTS.SERVER.BROADCAST_PEER_JWS_CHANGE, listener);
    notifyPeerJWS(mockPeerJWS);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(mockPeerJWS);
  });

  test('should support multiple listeners for the same event', () => {
    const mockConfig = { key: 'value' };
    const listener1 = jest.fn();
    const listener2 = jest.fn();

    eventEmitter.on(INTERNAL_EVENTS.SERVER.BROADCAST_CONFIG_CHANGE, listener1);
    eventEmitter.on(INTERNAL_EVENTS.SERVER.BROADCAST_CONFIG_CHANGE, listener2);
    changeConfig(mockConfig);

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener1).toHaveBeenCalledWith(mockConfig);
    expect(listener2).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledWith(mockConfig);
  });

  test('should not trigger unrelated events', () => {
    const mockConfig = { key: 'value' };
    const unrelatedListener = jest.fn();

    eventEmitter.on(INTERNAL_EVENTS.SERVER.BROADCAST_PEER_JWS_CHANGE, unrelatedListener);
    changeConfig(mockConfig);

    expect(unrelatedListener).not.toHaveBeenCalled();
  });
});

describe('ControlServer additional tests', () => {
  let server, logger, client;
  const appConfig = { control: { port: 4005 }, what: 'ever' };

  beforeEach(async () => {
    logger = new Logger.Logger({ stringify: () => '' });
    server = new ControlServer.Server({
      logger,
      port: 4005,
      onRequestConfig: (cl: any) => {
        cl.send(ControlServer.build.CONFIGURATION.NOTIFY(appConfig));
      },
      onRequestPeerJWS: (cl: any) => {},
      onUploadPeerJWS: (cl: any) => {},
    });
    server.registerInternalEvents();
    client = await Client.Client.Create({
      address: 'localhost',
      port: server.address().port,
      logger,
      appConfig,
    });
  });

  afterEach(async () => {
    await client.stop();
    await server.stop();
    jest.restoreAllMocks();
  });

  it('handles PEER_JWS READ request correctly', async () => {
    const onRequestPeerJWSSpy = jest.spyOn(server, 'onRequestPeerJWS');

    const peerJWSReadMessage = ControlServer.build.PEER_JWS.READ('test-id');
    server._handle(client, logger)(peerJWSReadMessage);

    expect(onRequestPeerJWSSpy).toHaveBeenCalledWith(client);
    onRequestPeerJWSSpy.mockRestore();
  });

  it('maintains client data on connection', async () => {
    const mockReq = {
      url: 'ws://localhost:4005',
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' },
      connection: { remoteAddress: '127.0.0.1' },
    };

    const mockSocket = {
      on: jest.fn(),
      terminate: jest.fn(),
    };

    server.emit('connection', mockSocket, mockReq);

    expect(server._clientData.has(mockSocket)).toBeTruthy();
    const clientData = server._clientData.get(mockSocket);
    expect(clientData.ip).toBe('127.0.0.1');
  });

  it('removes client data on connection close', async () => {
    const mockSocket = {
      on: jest.fn(),
      terminate: jest.fn(),
    };

    const mockReq = {
      url: 'ws://localhost:4005',
      socket: { remoteAddress: '127.0.0.1' },
      headers: {},
      connection: { remoteAddress: '127.0.0.1' },
    };

    server.emit('connection', mockSocket, mockReq);

    // Get the close handler that was registered
    const closeHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'close')[1];

    // Simulate connection close
    closeHandler(1000, 'Normal close');

    expect(server._clientData.has(mockSocket)).toBeFalsy();
  });

  it('broadcasts only to clients in OPEN state', async () => {
    const mockMessage = 'test message';
    const mockOpenClient = { readyState: 1, send: jest.fn(), terminate: jest.fn() }; // WebSocket.OPEN = 1
    const mockClosedClient = { readyState: 2, send: jest.fn(), terminate: jest.fn() }; // WebSocket.CLOSING = 2

    server.clients = new Set([mockOpenClient, mockClosedClient]);

    server.broadcast(mockMessage);

    expect(mockOpenClient.send).toHaveBeenCalledWith(mockMessage);
    expect(mockClosedClient.send).not.toHaveBeenCalled();
  });
});

describe('ControlServer error handling', () => {
  let server, logger;

  beforeEach(() => {
    logger = new Logger.Logger({ stringify: () => '' });
    server = new ControlServer.Server({
      logger,
      port: 4005,
      onRequestConfig: () => {},
      onRequestPeerJWS: () => {},
      onUploadPeerJWS: () => {},
    });
  });

  afterEach(async () => {
    await server.stop();
    jest.restoreAllMocks();
  });

  it('should handle server error events and exit process', () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const mockError = new Error('Test error');

    server.emit('error', mockError);

    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });

  it('should close all client connections on server stop', async () => {
    const mockClient1 = { terminate: jest.fn() };
    const mockClient2 = { terminate: jest.fn() };

    server.clients = new Set([mockClient1, mockClient2]);

    await server.stop();

    expect(mockClient1.terminate).toHaveBeenCalled();
    expect(mockClient2.terminate).toHaveBeenCalled();
  });
});
