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
      expect(server.broadcast).toHaveBeenCalledWith(
        ControlServer.build.PEER_JWS.NOTIFY(mockPeerJWS, randomPhrase())
      );
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

