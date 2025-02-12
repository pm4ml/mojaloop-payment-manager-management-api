/**************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 **************************************************************************/

import { ProgressMonitor } from '@app/lib/model/stateMachine/states';
import { createMachine, interpret } from 'xstate';
import { createMachineOpts } from './commonMocks';
import { waitFor } from 'xstate/lib/waitFor';

type Context = ProgressMonitor.Context;
type Event = ProgressMonitor.Event;

const startMachine = (opts: ReturnType<typeof createMachineOpts>) => {
  const machine = createMachine<Context, Event>(
    {
      id: 'testMachine',
      context: {},
      type: 'parallel',
      states: {
        progressMonitor: ProgressMonitor.createState<Context>(opts),
      },
    },
    {
      guards: {
        ...ProgressMonitor.createGuards<Context>(),
      },
      actions: {},
    }
  );

  const service = interpret(machine); // .onTransition((state) => console.log(state.changed, state.value));
  service.start();

  return service;
};

describe('ProgressMonitor', () => {
  let opts: ReturnType<typeof createMachineOpts>;

  beforeAll(() => {
    opts = createMachineOpts();
  });

  test('should initialize context', async () => {
    const service = startMachine(opts);

    await waitFor(service, (state) => state.matches('progressMonitor.idle'));

    service.send('NEW_HUB_CA_FETCHED');
    service.send('DFSP_CA_PROPAGATED');
    service.send('DFSP_CLIENT_CERT_CONFIGURED');
    service.send('DFSP_SERVER_CERT_CONFIGURED');
    service.send('HUB_CLIENT_CERT_SIGNED');
    service.send('PEER_JWS_CONFIGURED');
    service.send('DFSP_JWS_PROPAGATED');
    service.send('ENDPOINT_CONFIG_PROPAGATED');

    await waitFor(service, (state) => state.matches('progressMonitor.notifyingCompleted'));

    service.stop();
  });
});
