/**************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 **************************************************************************/

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
      predictableActionArguments: true, // Add this line
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
    },
  );

  const service = interpret(machine); // .onTransition((state) => console.log(state.changed, state.value));
  service.start();

  return service;
};

describe('PeerJWS', () => {
  let opts: ReturnType<typeof createMachineOpts>;
  const createdAt = Math.floor(Date.now() / 1000);
  const testfsp1JWS = { dfspId: 'testfsp1', publicKey: 'TEST KEY 1', createdAt };
  const testfsp2JWS = { dfspId: 'testfsp2', publicKey: 'TEST KEY 2', createdAt };
  const testfsp3JWS = { dfspId: 'testfsp3', publicKey: 'TEST KEY 3', createdAt };
  const testfsp4JWS = { dfspId: 'testfsp4', publicKey: 'TEST KEY 4', createdAt };
  let service: ReturnType<typeof startMachine>;
  const configUpdate = jest.fn();

  beforeAll(() => {
    opts = createMachineOpts();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Start the state machine', async () => {
    opts.dfspCertificateModel.getAllJWSCertificates.mockImplementation(async () => [testfsp1JWS, testfsp2JWS]);
    opts.ControlServer.notifyPeerJWS.mockImplementation(async () => {});

    opts.refreshIntervalSeconds = 1;
    service = startMachine(opts, configUpdate);
    await waitFor(service, (state) => state.matches('pullingPeerJWS.retry'));

    expect(opts.dfspCertificateModel.getAllJWSCertificates).toHaveBeenCalled();
    expect(opts.ControlServer.notifyPeerJWS).toHaveBeenCalledWith([testfsp1JWS, testfsp2JWS]);

    expect(configUpdate).toHaveBeenCalledWith({
      peerJWSKeys: {
        [testfsp1JWS.dfspId]: testfsp1JWS.publicKey,
        [testfsp2JWS.dfspId]: testfsp2JWS.publicKey,
      },
    });
  });

  test('should not notify if there are no changes', async () => {
    opts.dfspCertificateModel.getAllJWSCertificates.mockImplementation(async () => [testfsp1JWS, testfsp2JWS]);
    opts.ControlServer.notifyPeerJWS.mockImplementation(async () => {});
    // No changes
    await waitFor(service, (state) => state.matches('pullingPeerJWS.fetchingPeerJWS'));
    await waitFor(service, (state) => state.matches('pullingPeerJWS.retry'));
    // keys are the same therefore no changes to config
    expect(configUpdate).toHaveBeenCalledTimes(0);
  });

  test('should notify when new peer JWS are available', async () => {
    // now add two more peer jws keys
    opts.dfspCertificateModel.getAllJWSCertificates.mockImplementation(async () => [
      testfsp1JWS,
      testfsp2JWS,
      testfsp3JWS,
      testfsp4JWS,
    ]);
    opts.ControlServer.notifyPeerJWS.mockImplementation(async () => {});

    await waitFor(service, (state) => state.matches('pullingPeerJWS.fetchingPeerJWS'));
    await waitFor(service, (state) => state.matches('pullingPeerJWS.retry'));

    expect(configUpdate).toHaveBeenCalledTimes(1);
    expect(configUpdate).toHaveBeenCalledWith({
      peerJWSKeys: {
        [testfsp1JWS.dfspId]: testfsp1JWS.publicKey,
        [testfsp2JWS.dfspId]: testfsp2JWS.publicKey,
        [testfsp3JWS.dfspId]: testfsp3JWS.publicKey,
        [testfsp4JWS.dfspId]: testfsp4JWS.publicKey,
      },
    });
  });

  test('should not notify when a JWS cert with old timestamp passed', async () => {
    opts.dfspCertificateModel.getAllJWSCertificates.mockImplementation(async () => [
      testfsp1JWS,
      testfsp2JWS,
      testfsp3JWS,
      {
        ...testfsp4JWS,
        createdAt: createdAt - 1,
        publicKey: 'TEST KEY 4 OLD',
      },
    ]);
    opts.ControlServer.notifyPeerJWS.mockImplementation(async () => {});

    await waitFor(service, (state) => state.matches('pullingPeerJWS.fetchingPeerJWS'));
    await waitFor(service, (state) => state.matches('pullingPeerJWS.retry'));

    expect(configUpdate).toHaveBeenCalledTimes(0);
  });

  test('should notify when some keys are updated', async () => {
    // now change some keys and update timestamp
    const createdAtUpdated = Math.floor(Date.now() / 1000);
    const testfsp3JWSUpdated = {
      ...testfsp3JWS,
      publicKey: 'TEST KEY 3 UPDATED',
      createdAt: createdAtUpdated,
    };
    const testfsp4JWSUpdated = {
      ...testfsp4JWS,
      publicKey: 'TEST KEY 4 UPDATED',
      createdAt: createdAtUpdated,
    };
    opts.dfspCertificateModel.getAllJWSCertificates.mockImplementation(async () => [
      testfsp1JWS,
      testfsp2JWS,
      testfsp3JWSUpdated,
      testfsp4JWSUpdated,
    ]);

    await waitFor(service, (state) => state.matches('pullingPeerJWS.fetchingPeerJWS'));
    await waitFor(service, (state) => state.matches('pullingPeerJWS.retry'));

    expect(configUpdate).toHaveBeenCalledTimes(1);
    expect(configUpdate).toHaveBeenCalledWith({
      peerJWSKeys: {
        [testfsp1JWS.dfspId]: testfsp1JWS.publicKey,
        [testfsp2JWS.dfspId]: testfsp2JWS.publicKey,
        [testfsp3JWSUpdated.dfspId]: testfsp3JWSUpdated.publicKey,
        [testfsp4JWSUpdated.dfspId]: testfsp4JWSUpdated.publicKey,
      },
    });
  });

  test('Stop state machine', async () => {
    // No changes again this time for final check
    await waitFor(service, (state) => state.matches('pullingPeerJWS.fetchingPeerJWS'));
    await waitFor(service, (state) => state.matches('pullingPeerJWS.retry'));

    expect(configUpdate).toHaveBeenCalledTimes(0);

    service.stop();
  });
});
