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

import { EndpointConfig } from '@app/lib/model/stateMachine/states';
import { createMachine, interpret } from 'xstate';
import { createMachineOpts } from './commonMocks';
import { waitFor } from 'xstate/lib/waitFor';

type Context = EndpointConfig.Context;
type Event = EndpointConfig.Event;

const startMachine = (opts: ReturnType<typeof createMachineOpts>) => {
  const machine = createMachine<Context, Event>(
    {
      id: 'testMachine',
      context: {},
      type: 'parallel',
      states: {
        endpointConfig: {
          ...EndpointConfig.createState<Context>(opts),
        },
      },
    },
    {
      guards: {
        ...EndpointConfig.createGuards<Context>(opts),
      },
      actions: {},
    }
  );

  const service = interpret(machine); // .onTransition((state) => console.log(state.changed, state.value));
  service.start();

  return service;
};

describe('EndpointConfig', () => {
  let opts: ReturnType<typeof createMachineOpts>;

  beforeEach(() => {
    opts = createMachineOpts();
  });

  test('should upload endpoint config', async () => {
    opts.config.whitelistIP = [{ address: '1.1.1.1', ports: ['8080', '9090'] }];
    opts.config.callbackHost = 'test-fsp.com';
    const service = startMachine(opts);

    await waitFor(service, (state) => state.matches('endpointConfig.retry'));

    expect(opts.dfspEndpointModel.create).toHaveBeenNthCalledWith(1, {
      direction: 'EGRESS',
      type: 'IP',
      ipList: opts.config.whitelistIP,
    });

    expect(opts.dfspEndpointModel.create).toHaveBeenNthCalledWith(2, {
      direction: 'INGRESS',
      type: 'URL',
      url: opts.config.callbackHost,
    });

    service.stop();
  });
});
