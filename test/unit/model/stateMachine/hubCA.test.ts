/**************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 **************************************************************************/

import 'tsconfig-paths/register';

import { HubCA } from '@app/lib/model/stateMachine/states';
import { createMachine, interpret } from 'xstate';
import { createMachineOpts, createTestConfigState } from './commonMocks';
import { waitFor } from 'xstate/lib/waitFor';

type Context = HubCA.Context;
type Event = HubCA.Event;

const startMachine = (opts: ReturnType<typeof createMachineOpts>, onConfigChange: typeof jest.fn) => {
  const machine = createMachine<Context, Event>(
    {
      id: 'testMachine',
      context: {},
      type: 'parallel',
      states: {
        fetchingHubCA: HubCA.createState<Context>(opts),
        connectorConfig: createTestConfigState(onConfigChange),
      },
    },
    {
      guards: {
        ...HubCA.createGuards<Context>(),
      },
      actions: {},
    }
  );

  const service = interpret(machine); // .onTransition((state) => console.log(state.changed, state.value));
  service.start();

  return service;
};

describe('HubCA', () => {
  let opts: ReturnType<typeof createMachineOpts>;

  beforeEach(() => {
    opts = createMachineOpts();
  });

  test('should download hub CA', async () => {
    opts.hubCertificateModel.getHubCA.mockImplementation(async () => ({
      intermediateChain: 'HUB CA CHAIN',
      rootCertificate: 'HUB CA',
    }));
    const configUpdate = jest.fn();
    opts.refreshIntervalSeconds = 1;
    const service = startMachine(opts, configUpdate);

    await waitFor(service, (state) => state.matches('fetchingHubCA.retry'));

    expect(opts.hubCertificateModel.getHubCA).toHaveBeenCalled();

    expect(configUpdate).toHaveBeenCalledWith({
      outbound: {
        tls: {
          creds: {
            ca: 'HUB CA CHAIN\nHUB CA',
          },
        },
      },
    });

    await waitFor(service, (state) => state.matches('fetchingHubCA.gettingHubCA'));
    await waitFor(service, (state) => state.matches('fetchingHubCA.retry'));

    // cert is the same therefore no changes to config
    expect(configUpdate).toHaveBeenCalledTimes(1);

    // now change cert response
    opts.hubCertificateModel.getHubCA.mockImplementation(async () => ({
      intermediateChain: 'HUB CA CHAIN NEW',
      rootCertificate: 'HUB CA NEW',
    }));

    await waitFor(service, (state) => state.matches('fetchingHubCA.gettingHubCA'));
    await waitFor(service, (state) => state.matches('fetchingHubCA.retry'));

    expect(opts.hubCertificateModel.getHubCA).toHaveBeenCalledTimes(3);
    expect(configUpdate).toHaveBeenNthCalledWith(2, {
      outbound: {
        tls: {
          creds: {
            ca: 'HUB CA CHAIN NEW\nHUB CA NEW',
          },
        },
      },
    });

    service.stop();
  });
});
