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

import { HubCert } from '@app/lib/model/stateMachine/states';
import { createMachine, interpret } from 'xstate';
import { createMachineOpts } from './commonMocks';
import { waitFor } from 'xstate/lib/waitFor';

type Context = HubCert.Context;
type Event = HubCert.Event;

const startMachine = (opts: ReturnType<typeof createMachineOpts>) => {
  const machine = createMachine<Context, Event>(
    {
      id: 'testMachine',
      context: {},
      type: 'parallel',
      states: {
        creatingHubClientCert: HubCert.createState<Context>(opts),
      },
    },
    {
      guards: {
        ...HubCert.createGuards<Context>(),
      },
      actions: {},
    }
  );

  const service = interpret(machine); // .onTransition((state) => console.log(state.changed, state.value));
  service.start();

  return service;
};

describe('HubCert', () => {
  const opts = createMachineOpts();
  opts.vault.signHubCSR.mockImplementation(async (csr) => {
    if (csr === 'HUB CSR 1') return { certificate: 'HUB CERT 1' };
    if (csr === 'HUB CSR 1 (NEW)') return { certificate: 'HUB CERT 1 (NEW)' };
    if (csr === 'HUB CSR 2') return { certificate: 'HUB CERT 2' };
    if (csr === 'HUB CSR 3') return { certificate: 'HUB CERT 3' };
    if (csr === 'HUB CSR 4') return { certificate: 'HUB CERT 4' };
  });

  opts.vault.certIsValid.mockImplementation(() => true);

  opts.refreshIntervalSeconds = 1;
  const service = startMachine(opts);

  let signHubCSRCalls = 0;
  let uploadServerCertCalls = 0;

  afterAll(() => {
    service.stop();
  });

  test('should start with idle', async () => {
    opts.hubCertificateModel.getClientCerts.mockImplementation(async () => [
      { id: 111, csr: 'HUB CSR 1' },
      { id: 222, csr: 'HUB CSR 2' },
    ]);

    await waitFor(service, (state) => state.matches('creatingHubClientCert.idle'));
  });

  test('should transit on CA propagation event', async () => {
    service.send({ type: 'DFSP_CA_PROPAGATED' });

    await waitFor(service, (state) => state.matches('creatingHubClientCert.retry'));
  });

  test('should sign hub CSRs', async () => {
    expect(opts.hubCertificateModel.getClientCerts).toHaveBeenCalled();
    expect(opts.vault.signHubCSR).toHaveBeenNthCalledWith(++signHubCSRCalls, 'HUB CSR 1');
    expect(opts.vault.signHubCSR).toHaveBeenNthCalledWith(++signHubCSRCalls, 'HUB CSR 2');
    expect(opts.hubCertificateModel.uploadServerCertificate).toHaveBeenNthCalledWith(++uploadServerCertCalls, {
      enId: 111,
      entry: { certificate: 'HUB CERT 1' },
    });
    expect(opts.hubCertificateModel.uploadServerCertificate).toHaveBeenNthCalledWith(++uploadServerCertCalls, {
      enId: 222,
      entry: { certificate: 'HUB CERT 2' },
    });
  });

  test('should not sign already processed certificate', async () => {
    // return data with certificates
    opts.hubCertificateModel.getClientCerts.mockImplementation(async () => [
      { id: 111, csr: 'HUB CSR 1', certificate: 'HUB CERT 1' },
      { id: 222, csr: 'HUB CSR 2', certificate: 'HUB CERT 2' },
    ]);

    await waitFor(service, (state) => state.matches('creatingHubClientCert.fetchingHubCSR'));
    await waitFor(service, (state) => state.matches('creatingHubClientCert.retry'));

    expect(opts.vault.signHubCSR).toHaveBeenCalledTimes(signHubCSRCalls);
    expect(opts.hubCertificateModel.uploadServerCertificate).toHaveBeenCalledTimes(uploadServerCertCalls);
  });

  test('should sign new Hub CSRs', async () => {
    opts.hubCertificateModel.getClientCerts.mockImplementation(async () => [
      { id: 111, csr: 'HUB CSR 1', certificate: 'HUB CERT 1' },
      { id: 222, csr: 'HUB CSR 2', certificate: 'HUB CERT 2' },
      { id: 333, csr: 'HUB CSR 3' },
      { id: 444, csr: 'HUB CSR 4' },
    ]);

    await waitFor(service, (state) => state.matches('creatingHubClientCert.fetchingHubCSR'));
    await waitFor(service, (state) => state.matches('creatingHubClientCert.retry'));

    expect(opts.hubCertificateModel.getClientCerts).toHaveBeenCalled();
    expect(opts.vault.signHubCSR).toHaveBeenNthCalledWith(++signHubCSRCalls, 'HUB CSR 3');
    expect(opts.vault.signHubCSR).toHaveBeenNthCalledWith(++signHubCSRCalls, 'HUB CSR 4');
    uploadServerCertCalls += 2;
    expect(opts.hubCertificateModel.uploadServerCertificate).toHaveBeenNthCalledWith(++uploadServerCertCalls, {
      enId: 333,
      entry: { certificate: 'HUB CERT 3' },
    });
    expect(opts.hubCertificateModel.uploadServerCertificate).toHaveBeenNthCalledWith(++uploadServerCertCalls, {
      enId: 444,
      entry: { certificate: 'HUB CERT 4' },
    });
  });

  test('should re-sign all Hub CSRs on DFSP CA change', async () => {
    opts.hubCertificateModel.getClientCerts.mockImplementation(async () => [
      { id: 111, csr: 'HUB CSR 1', certificate: 'HUB CERT 1' },
      { id: 222, csr: 'HUB CSR 2', certificate: 'HUB CERT 2' },
      { id: 333, csr: 'HUB CSR 3', certificate: 'HUB CERT 3' },
      { id: 444, csr: 'HUB CSR 4', certificate: 'HUB CERT 4' },
    ]);

    service.send({ type: 'DFSP_CA_PROPAGATED' });

    await waitFor(service, (state) => state.matches('creatingHubClientCert.fetchingHubCSR'));
    await waitFor(service, (state) => state.matches('creatingHubClientCert.retry'));

    expect(opts.hubCertificateModel.getClientCerts).toHaveBeenCalled();
    expect(opts.vault.signHubCSR).toHaveBeenNthCalledWith(++signHubCSRCalls, 'HUB CSR 1');
    expect(opts.vault.signHubCSR).toHaveBeenNthCalledWith(++signHubCSRCalls, 'HUB CSR 2');
    expect(opts.vault.signHubCSR).toHaveBeenNthCalledWith(++signHubCSRCalls, 'HUB CSR 3');
    expect(opts.vault.signHubCSR).toHaveBeenNthCalledWith(++signHubCSRCalls, 'HUB CSR 4');
    expect(opts.hubCertificateModel.uploadServerCertificate).toHaveBeenNthCalledWith(++uploadServerCertCalls, {
      enId: 111,
      entry: { certificate: 'HUB CERT 1' },
    });
    expect(opts.hubCertificateModel.uploadServerCertificate).toHaveBeenNthCalledWith(++uploadServerCertCalls, {
      enId: 222,
      entry: { certificate: 'HUB CERT 2' },
    });
    expect(opts.hubCertificateModel.uploadServerCertificate).toHaveBeenNthCalledWith(++uploadServerCertCalls, {
      enId: 333,
      entry: { certificate: 'HUB CERT 3' },
    });
    expect(opts.hubCertificateModel.uploadServerCertificate).toHaveBeenNthCalledWith(++uploadServerCertCalls, {
      enId: 444,
      entry: { certificate: 'HUB CERT 4' },
    });
  });

  test('should re-sign changed hub CSR', async () => {
    opts.hubCertificateModel.getClientCerts.mockImplementation(async () => [
      { id: 111, csr: 'HUB CSR 1 (NEW)', certificate: 'HUB CERT 1' },
      { id: 222, csr: 'HUB CSR 2', certificate: 'HUB CERT 2' },
      { id: 333, csr: 'HUB CSR 3', certificate: 'HUB CERT 3' },
      { id: 444, csr: 'HUB CSR 4', certificate: 'HUB CERT 4' },
    ]);

    await waitFor(service, (state) => state.matches('creatingHubClientCert.fetchingHubCSR'));
    await waitFor(service, (state) => state.matches('creatingHubClientCert.retry'));

    expect(opts.hubCertificateModel.getClientCerts).toHaveBeenCalled();
    expect(opts.vault.signHubCSR).toHaveBeenNthCalledWith(++signHubCSRCalls, 'HUB CSR 1 (NEW)');
    expect(opts.hubCertificateModel.uploadServerCertificate).toHaveBeenNthCalledWith(++uploadServerCertCalls, {
      enId: 111,
      entry: { certificate: 'HUB CERT 1 (NEW)' },
    });
    uploadServerCertCalls += 3;
  });

  test('should re-sign expired hub certificates', async () => {
    opts.hubCertificateModel.getClientCerts.mockImplementation(async () => [
      { id: 111, csr: 'HUB CSR 1 (NEW)', certificate: 'HUB CERT 1 (NEW)' },
      { id: 222, csr: 'HUB CSR 2', certificate: 'HUB CERT 2' },
      { id: 333, csr: 'HUB CSR 3', certificate: 'HUB CERT 3' },
      { id: 444, csr: 'HUB CSR 4', certificate: 'HUB CERT 4' },
    ]);

    opts.vault.signHubCSR.mockImplementation(async () => ({ certificate: 'HUB CERT 4 (RENEWED)' }));

    opts.vault.certIsValid.mockImplementation((cert) => cert !== 'HUB CERT 4');

    await waitFor(service, (state) => state.matches('creatingHubClientCert.fetchingHubCSR'));
    await waitFor(service, (state) => state.matches('creatingHubClientCert.retry'));

    expect(opts.hubCertificateModel.getClientCerts).toHaveBeenCalled();
    expect(opts.vault.signHubCSR).toHaveBeenNthCalledWith(++signHubCSRCalls, 'HUB CSR 4');
    uploadServerCertCalls += 3;
    expect(opts.hubCertificateModel.uploadServerCertificate).toHaveBeenNthCalledWith(++uploadServerCertCalls, {
      enId: 444,
      entry: { certificate: 'HUB CERT 4 (RENEWED)' },
    });
  });
});
