/**************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 **************************************************************************/

import { DfspClientCert } from '@app/lib/model/stateMachine/states';
import { createMachine, interpret } from 'xstate';
import { createMachineOpts, createTestConfigState } from './commonMocks';
import { waitFor } from 'xstate/lib/waitFor';

type Context = DfspClientCert.Context;
type Event = DfspClientCert.Event;

const startMachine = (opts: ReturnType<typeof createMachineOpts>, onConfigChange: typeof jest.fn) => {
  const machine = createMachine<Context, Event>(
    {
      id: 'testMachine',
      context: {},
      type: 'parallel',
      states: {
        creatingDfspClientCert: DfspClientCert.createState<Context>(opts),
        connectorConfig: createTestConfigState(onConfigChange),
      },
    },
    {
      guards: {
        ...DfspClientCert.createGuards<Context>(),
      },
      actions: {},
    }
  );

  const service = interpret(machine); // .onTransition((state) => console.log(state.changed, state.value));
  service.start();

  return service;
};

describe('DfspClientCert', () => {
  let opts: ReturnType<typeof createMachineOpts>;

  beforeEach(() => {
    opts = createMachineOpts();
  });

  test('should create client cert and handle cert changes', async () => {
    opts.vault.createCSR.mockImplementation(() => ({ csr: 'DFSP CSR', privateKey: 'PKEY' }));
    opts.dfspCertificateModel.uploadCSR.mockImplementation(async () => ({ id: 123 }));
    opts.dfspCertificateModel.getClientCertificate.mockImplementation(async () => ({
      certificate: 'DFSP CERT',
      state: 'CERT_SIGNED',
    }));
    const configUpdate = jest.fn();
    opts.refreshIntervalSeconds = 1;
    const service = startMachine(opts, configUpdate);

    await waitFor(service, (state) => state.matches('creatingDfspClientCert.retry'));

    expect(opts.dfspCertificateModel.uploadCSR).toHaveBeenCalledWith({
      csr: 'DFSP CSR',
    });
    expect(opts.dfspCertificateModel.getClientCertificate).toHaveBeenCalledWith({
      inboundEnrollmentId: 123,
    });
    expect(configUpdate).toHaveBeenCalledWith({
      outbound: {
        tls: {
          creds: {
            cert: 'DFSP CERT',
            key: 'PKEY',
          },
        },
      },
    });

    await waitFor(service, (state) => state.matches('creatingDfspClientCert.gettingDfspClientCert'));
    await waitFor(service, (state) => state.matches('creatingDfspClientCert.retry'));

    expect(opts.dfspCertificateModel.getClientCertificate).toHaveBeenNthCalledWith(2, {
      inboundEnrollmentId: 123,
    });
    // cert is the same therefore no changes to config
    expect(configUpdate).toHaveBeenCalledTimes(1);

    // now change cert response
    opts.dfspCertificateModel.getClientCertificate.mockImplementation(async () => ({
      certificate: 'DFSP CERT NEW',
      state: 'CERT_SIGNED',
    }));

    await waitFor(service, (state) => state.matches('creatingDfspClientCert.gettingDfspClientCert'));
    await waitFor(service, (state) => state.matches('creatingDfspClientCert.retry'));

    expect(opts.dfspCertificateModel.getClientCertificate).toHaveBeenCalledTimes(3);
    expect(configUpdate).toHaveBeenNthCalledWith(2, {
      outbound: {
        tls: {
          creds: {
            cert: 'DFSP CERT NEW',
            key: 'PKEY',
          },
        },
      },
    });

    service.stop();
  });
});
