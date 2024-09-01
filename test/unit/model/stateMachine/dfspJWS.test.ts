/**************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 **************************************************************************/

import { DfspJWS } from '@app/lib/model/stateMachine/states';
import { createMachine, interpret } from 'xstate';
import { createMachineOpts, createTestConfigState } from './commonMocks';
import { waitFor } from 'xstate/lib/waitFor';

type Context = DfspJWS.Context;
type Event = DfspJWS.Event;

const startMachine = (opts: ReturnType<typeof createMachineOpts>, onConfigChange: typeof jest.fn) => {
  const machine = createMachine<Context, Event>(
    {
      id: 'testMachine',
      context: {},
      type: 'parallel',
      states: {
        creatingJWS: DfspJWS.createState<Context>(opts),
        connectorConfig: createTestConfigState(onConfigChange),
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

describe('DfspJWS', () => {
  let opts: ReturnType<typeof createMachineOpts>;

  beforeEach(() => {
    opts = createMachineOpts();
  });

  test('should create JWS and upload it', async () => {
    opts.vault.createJWS.mockImplementation(() => ({ publicKey: 'JWS PUBKEY', privateKey: 'JWS PRIVKEY' }));

    const configUpdate = jest.fn();
    const service = startMachine(opts, configUpdate);

    await waitFor(service, (state) => state.matches('creatingJWS.idle'));

    expect(opts.vault.createJWS).toHaveBeenCalled();
    expect(opts.dfspCertificateModel.uploadJWS).toHaveBeenLastCalledWith({ publicKey: 'JWS PUBKEY' });
    expect(configUpdate).toHaveBeenCalledWith({ jwsSigningKey: 'JWS PRIVKEY' });

    // recreate JWS
    opts.vault.createJWS.mockImplementation(() => ({ publicKey: 'JWS PUBKEY NEW', privateKey: 'JWS PRIVKEY NEW' }));
    service.send({ type: 'CREATE_JWS' });
    await waitFor(service, (state) => state.matches('creatingJWS.idle'));
    expect(opts.vault.createJWS).toHaveBeenCalledTimes(2);
    expect(opts.dfspCertificateModel.uploadJWS).toHaveBeenLastCalledWith({ publicKey: 'JWS PUBKEY NEW' });
    expect(configUpdate).toHaveBeenCalledWith({ jwsSigningKey: 'JWS PRIVKEY NEW' });

    service.stop();
  });
});
