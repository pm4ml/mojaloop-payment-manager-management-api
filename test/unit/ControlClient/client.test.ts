const { Client, EVENT, VERB, MESSAGE, buildPatchConfiguration, build } = require('../ControlClient');
const randomPhrase = require('@app/lib/randomphrase');
const jsonPatch = require('fast-json-patch');
const ws = require('ws');
jest.mock('ws');
jest.mock('@app/lib/randomphrase', () => () => 'random-id');

describe('Control Client', () => {
  let loggerMock;
  const appConfig = { control: { port: 4005 }, app: 'config' };

  beforeEach(() => {
    jsonPatch.applyPatch = jest.fn();
    loggerMock = { push: jest.fn().mockReturnThis(), log: jest.fn() };
    ws.mockClear();
    ws.prototype.send = jest.fn((data, callback) => callback());
    ws.prototype.on = jest.fn((event, callback) => {
      if (event === 'open') callback();
    });
    ws.prototype.once = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    loggerMock = null;
  });

  it('should construct a Client with the correct properties', () => {
    const client = new Client({ address: 'example.com', port: 1234, logger: loggerMock, appConfig });

    expect(ws).toHaveBeenCalledWith('ws://example.com:1234');
    expect(client._logger).toBe(loggerMock);
  });

  it('should expose the Build getter', () => {
    const client = new Client({ address: 'example.com', port: 1234, logger: loggerMock, appConfig });

    expect(client.Build).toBeDefined();
  });

  it('should create a new Client instance using the Create static method', async () => {
    const client = await Client.Create({ address: 'example.com', port: 1234, logger: loggerMock, appConfig });

    expect(client).toBeInstanceOf(Client);
    expect(ws.prototype.on).toHaveBeenCalledWith('open', expect.any(Function));
  });

  it('should throw an error if the websocket fails to open during Create', async () => {
    ws.prototype.on = jest.fn((event, callback) => {
      if (event === 'error') callback(new Error('Connection failed'));
    });

    await expect(Client.Create({ address: 'example.com', port: 1234, logger: loggerMock, appConfig })).rejects.toThrow(
      'Connection failed'
    );
  });

  it('should log and send a message through the websocket', async () => {
    const client = new Client({ address: 'example.com', port: 1234, logger: loggerMock, appConfig });

    const message = { type: 'test', payload: 'data' };
    const serializedMessage = JSON.stringify(message);

    await client.send(message);

    expect(loggerMock.log).toHaveBeenCalledWith('Sending message');
    expect(ws.prototype.send).toHaveBeenCalledWith(serializedMessage, expect.any(Function));
  });

  it('should handle string messages in send', async () => {
    const client = new Client({ address: 'example.com', port: 1234, logger: loggerMock, appConfig });

    const message = 'Hello World';

    await client.send(message);
    expect(loggerMock.log).toHaveBeenCalledWith('Sending message');
    expect(ws.prototype.send).toHaveBeenCalledWith(message, expect.any(Function));
  });

  it('should correctly receive and deserialise a single message', async () => {
    const client = new Client({ address: 'example.com', port: 1234, logger: loggerMock, appConfig });
    const mockData = JSON.stringify({ msg: 'testMessage', id: 1 });
    const mockSocket = ws.mock.instances[0];

    mockSocket.once.mockImplementation((event, callback) => {
      if (event === 'message') {
        callback(mockData);
      }
    });

    const receivedMessage = await client.receive();

    expect(receivedMessage).toEqual({ msg: 'testMessage', id: 1 });
    expect(mockSocket.once).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('should reconfigure the client with new logger and appConfig', () => {
    const initialLogger = { push: jest.fn().mockReturnThis(), log: jest.fn() };
    const newLogger = { push: jest.fn().mockReturnThis(), log: jest.fn() };
    const initialAppConfig = { control: { port: 4005 }, old: 'oldConfig' };
    const newAppConfig = { control: { port: 4005 }, new: 'newConfig' };

    const client = new Client({
      address: 'example.com',
      port: 4005,
      logger: initialLogger,
      appConfig: initialAppConfig,
    });

    client._socket = { remotePort: 4005 };

    const restartFn = client.reconfigure({ logger: newLogger, port: 4005, appConfig: newAppConfig });

    expect(client._logger).toBe(initialLogger);
    expect(client._appConfig).toBe(initialAppConfig);
    restartFn();
    expect(client._logger).toBe(newLogger);
    expect(client._appConfig).toBe(newAppConfig);
    expect(newLogger.log).toHaveBeenCalledWith('restarted');
  });

  it('should handle valid configuration notify message', () => {
    jsonPatch.applyPatch = jest.fn();

    const msgData = {
      msg: MESSAGE.CONFIGURATION,
      verb: VERB.NOTIFY,
      data: [],
      id: '12345',
    };

    const serializedMessage = JSON.stringify(msgData);

    const client = new Client({ address: 'example.com', port: 1234, logger: loggerMock, appConfig });

    client._handle(serializedMessage);

    expect(jsonPatch.applyPatch).not.toHaveBeenCalled();
  });

  it('should handle valid configuration patch message', () => {
    jsonPatch.applyPatch = jest.fn();

    const msgData = {
      msg: MESSAGE.CONFIGURATION,
      verb: VERB.PATCH,
      data: [{ op: 'replace', path: '/control/port', value: 4005 }],
      id: '12345',
    };

    const serializedMessage = JSON.stringify(msgData);

    const client = new Client({ address: 'example.com', port: 1234, logger: loggerMock, appConfig });

    client._handle(serializedMessage);

    expect(jsonPatch.applyPatch).toHaveBeenCalledWith(expect.anything(), msgData.data);
    expect(loggerMock.push).toHaveBeenCalledWith({
      oldConf: appConfig,
      newConf: expect.objectContaining({ control: { port: 4005 } }),
    });
    expect(loggerMock.log).toHaveBeenCalledWith('Emitting new configuration');
    expect(client.emit).toHaveBeenCalledWith(EVENT.RECONFIGURE, expect.objectContaining({ control: { port: 4005 } }));
  });

  it('should handle unsupported verb', () => {
    const msgData = {
      msg: MESSAGE.CONFIGURATION,
      verb: 'UNSUPPORTED_VERB',
      data: [],
      id: '12345',
    };

    const serializedMessage = JSON.stringify(msgData);

    const client = new Client({ address: 'example.com', port: 1234, logger: loggerMock, appConfig });

    client.send = jest.fn();

    client._handle(serializedMessage);

    expect(client.send).toHaveBeenCalledWith(build.ERROR.NOTIFY.UNSUPPORTED_VERB(msgData.id));
  });
  it('should handle unsupported message', () => {
    const msgData = {
      msg: 'UNSUPPORTED_MESSAGE',
      verb: VERB.PATCH,
      data: [],
      id: '12345',
    };

    const serializedMessage = JSON.stringify(msgData);

    const client = new Client({ address: 'example.com', port: 1234, logger: loggerMock, appConfig });

    client.send = jest.fn();

    client._handle(serializedMessage);

    expect(client.send).toHaveBeenCalledWith(build.ERROR.NOTIFY.UNSUPPORTED_MESSAGE(msgData.id));
  });

  it('should handle JSON parsing error', () => {
    const invalidData = '{ "msg": "INVALID_JSON", "data": "[]"';

    const client = new Client({ address: 'example.com', port: 1234, logger: loggerMock, appConfig });

    client.send = jest.fn();

    client._handle(invalidData);

    expect(loggerMock.push).toHaveBeenCalledWith({ data: invalidData });
    expect(loggerMock.log).toHaveBeenCalledWith("Couldn't parse received message");
    expect(client.send).toHaveBeenCalledWith(build.ERROR.NOTIFY.JSON_PARSE_ERROR());
  });

  it('should log a shutdown message and call close() on stop', async () => {
    const client = new Client({ address: 'example.com', port: 1234, logger: loggerMock, appConfig });
    client.close = jest.fn();

    await client.stop();

    expect(loggerMock.log).toHaveBeenCalledWith('Control client shutting down...');
    expect(client.close).toHaveBeenCalled();
  });

  it('should generate a PATCH message with correct structure', () => {
    const oldConfig = { control: { port: 4005 }, old: 'oldConfig' };
    const newConfig = { control: { port: 4005 }, new: 'newConfig' };
    const id = '12345';
    const result = buildPatchConfiguration(oldConfig, newConfig, id);

    const expectedMessage = {
      verb: VERB.PATCH,
      msg: MESSAGE.CONFIGURATION,
      data: jsonPatch.compare(oldConfig, newConfig),
      id,
    };

    expect(JSON.parse(result)).toEqual(expectedMessage);
  });
});
