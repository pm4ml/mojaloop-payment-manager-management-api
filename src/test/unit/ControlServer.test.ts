import randomPhrase from '@app/lib/randomphrase';
import * as ControlServer from '@app/ControlServer';
import { getInternalEventEmitter, INTERNAL_EVENTS } from '@app/ControlServer';

import TestControlClient from './ControlClient';
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
      });
      server.registerInternalEvents();
      client = await TestControlClient.Client.Create({
        address: 'localhost',
        port: server.address().port,
        logger,
        appConfig,
      });
    });

    afterEach(async () => {
      await client.stop();
      await server.stop();
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
  });
});
