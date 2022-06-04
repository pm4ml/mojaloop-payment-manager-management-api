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

import { PeerJWS } from '@app/lib/model/stateMachine/states';
import { createMachine, interpret } from 'xstate';
import { createMachineOpts, createTestConfigState } from './commonMocks';
import { waitFor } from 'xstate/lib/waitFor';

type Context = PeerJWS.Context;
type Event = PeerJWS.Event;

const startMachine = (opts: ReturnType<typeof createMachineOpts>, onConfigChange: typeof jest.fn) => {
  const machine = createMachine<Context, Event>(
    {
      id: 'testMachine',
      context: {},
      type: 'parallel',
      states: {
        pullingPeerJWS: PeerJWS.createState<Context>(opts),
        connectorConfig: createTestConfigState(onConfigChange),
      },
    },
    {
      guards: {
        ...PeerJWS.createGuards<Context>(),
      },
      actions: {},
    }
  );

  const service = interpret(machine); // .onTransition((state) => console.log(state.changed, state.value));
  service.start();

  return service;
};

describe('PeerJWS', () => {
  let opts: ReturnType<typeof createMachineOpts>;

  beforeEach(() => {
    opts = createMachineOpts();
  });

  test('should download peer JWS', async () => {
    opts.dfspCertificateModel.getAllJWSCertificates.mockImplementation(async () => [
      { dfspId: 'testfsp1', publicKey: 'TEST KEY 1' },
      { dfspId: 'testfsp2', publicKey: 'TEST KEY 2' },
    ]);
    const configUpdate = jest.fn();
    opts.refreshIntervalSeconds = 1;
    const service = startMachine(opts, configUpdate);

    await waitFor(service, (state) => state.matches('pullingPeerJWS.retry'));

    expect(opts.dfspCertificateModel.getAllJWSCertificates).toHaveBeenCalled();

    expect(configUpdate).toHaveBeenCalledWith({ peerJWSKeys: { testfsp1: 'TEST KEY 1', testfsp2: 'TEST KEY 2' } });

    await waitFor(service, (state) => state.matches('pullingPeerJWS.fetchingPeerJWS'));
    await waitFor(service, (state) => state.matches('pullingPeerJWS.retry'));

    // keys are the same therefore no changes to config
    expect(configUpdate).toHaveBeenCalledTimes(1);

    // now change peer jws keys
    opts.dfspCertificateModel.getAllJWSCertificates.mockImplementation(async () => [
      { dfspId: 'testfsp1', publicKey: 'TEST KEY 1' },
      { dfspId: 'testfsp3', publicKey: 'TEST KEY 3' },
      { dfspId: 'testfsp4', publicKey: 'TEST KEY 4' },
    ]);

    await waitFor(service, (state) => state.matches('pullingPeerJWS.fetchingPeerJWS'));
    await waitFor(service, (state) => state.matches('pullingPeerJWS.retry'));

    expect(opts.dfspCertificateModel.getAllJWSCertificates).toHaveBeenCalledTimes(3);
    expect(configUpdate).toHaveBeenCalledWith({
      peerJWSKeys: { testfsp1: 'TEST KEY 1', testfsp3: 'TEST KEY 3', testfsp4: 'TEST KEY 4' },
    });

    service.stop();
  });
});
