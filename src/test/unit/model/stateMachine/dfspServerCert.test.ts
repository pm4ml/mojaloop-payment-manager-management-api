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

import { DfspServerCert } from '@app/lib/model/stateMachine/states';
import { createMachine, interpret } from 'xstate';
import { createMachineOpts, createTestConfigState } from './commonMocks';
import { waitFor } from 'xstate/lib/waitFor';

type Context = DfspServerCert.Context;
type Event = DfspServerCert.Event;

const startMachine = (opts: ReturnType<typeof createMachineOpts>, onConfigChange: typeof jest.fn) => {
  const machine = createMachine<Context, Event>(
    {
      id: 'testMachine',
      context: {},
      type: 'parallel',
      states: {
        creatingDfspServerCert: {
          ...DfspServerCert.createState<Context>(opts),
        },
        connectorConfig: {
          ...createTestConfigState(onConfigChange),
        },
      },
    },
    {
      guards: {
        ...DfspServerCert.createGuards<Context>(opts),
      },
      actions: {},
    }
  );

  const service = interpret(machine); // .onTransition((state) => console.log(state.changed, state.value));
  service.start();

  return service;
};

describe('DfspServerCert', () => {
  let opts: ReturnType<typeof createMachineOpts>;

  beforeEach(() => {
    opts = createMachineOpts();
  });

  test('should create DFSP Server Cert and upload it', async () => {
    opts.vault.createDFSPServerCert.mockImplementation(async () => ({
      intermediateChain: 'CA CHAIN',
      rootCertificate: 'ROOT CA',
      serverCertificate: 'SERVER CERT',
      privateKey: 'PKEY',
    }));

    const configUpdate = jest.fn();
    const service = startMachine(opts, configUpdate);

    const csr = { subject: { CN: 'test-server' } };

    service.send({ type: 'CREATE_DFSP_SERVER_CERT', csr });

    await waitFor(service, (state) => state.matches('creatingDfspServerCert.idle'));

    expect(opts.vault.createDFSPServerCert).toHaveBeenCalledWith(csr);
    expect(opts.dfspCertificateModel.uploadServerCertificates).toHaveBeenCalledWith({
      intermediateChain: 'CA CHAIN',
      rootCertificate: 'ROOT CA',
      serverCertificate: 'SERVER CERT',
    });
    expect(configUpdate).toHaveBeenCalledWith({
      inbound: {
        tls: {
          creds: {
            ca: 'ROOT CA',
            cert: 'SERVER CERT',
            key: 'PKEY',
          },
        },
      },
    });

    service.stop();
  });
});
