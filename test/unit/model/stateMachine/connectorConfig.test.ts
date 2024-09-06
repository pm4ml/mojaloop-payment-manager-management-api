/**************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 **************************************************************************/

import { ConnectorConfig } from '@app/lib/model/stateMachine/states';
import { createMachine, interpret } from 'xstate';
import { createMachineOpts } from './commonMocks';
import { waitFor } from 'xstate/lib/waitFor';

type Context = ConnectorConfig.Context;
type Event = ConnectorConfig.Event;

const startMachine = (opts: ReturnType<typeof createMachineOpts>) => {
  const machine = createMachine<Context, Event>(
    {
      id: 'testMachine',
      context: {},
      type: 'parallel',
      states: {
        connectorConfig: ConnectorConfig.createState<Context>(opts),
      },
    },
    {
      guards: {},
      actions: {},
    }
  );

  const service = interpret(machine); // .onTransition((state) => console.log(state.changed, state.value));
  service.start();
  return service;
};

describe('ConnectorConfig', () => {
  let opts: ReturnType<typeof createMachineOpts>;

  beforeEach(() => {
    opts = createMachineOpts();
  });

  test('should create state machine and handle config changes', async () => {
    const service = startMachine(opts);

    const connectorConfig = {
      jwsSigningKey: 'Mock key',
      peerJWSKeys: {
        testfsp1: 'jwskey1',
        testfsp2: 'jwskey2',
      },
      outbound: {
        tls: {
          creds: {
            cert: 'cert',
            key: 'key',
          },
        },
      },
    };
    service.send({ type: 'UPDATE_CONNECTOR_CONFIG', config: connectorConfig });

    expect(opts.ControlServer.changeConfig).toHaveBeenCalledWith(connectorConfig);

    const updatedConnectorConfig = {
      jwsSigningKey: 'Mock key - 2',
      peerJWSKeys: {
        testfsp2: 'jwskey2',
      },
      outbound: {
        tls: {
          creds: {
            cert: 'cert - 2',
            key: 'key - 2',
          },
        },
      },
    };

    service.send({ type: 'UPDATE_CONNECTOR_CONFIG', config: updatedConnectorConfig });

    expect(opts.ControlServer.changeConfig).toHaveBeenLastCalledWith(updatedConnectorConfig);

    const tlsConfig = {
      outbound: {
        tls: {
          creds: {
            cert: 'cert - 3',
            key: 'key - 3',
          },
        },
      },
    };

    await waitFor(service, (state) => state.matches('connectorConfig.idle'));

    service.send({ type: 'UPDATE_CONNECTOR_CONFIG', config: tlsConfig });

    expect(opts.ControlServer.changeConfig).toHaveBeenLastCalledWith({
      ...updatedConnectorConfig,
      ...tlsConfig,
    });

    service.stop();
  });
});
