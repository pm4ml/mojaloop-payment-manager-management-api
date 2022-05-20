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
        creatingHubClientCert: {
          ...HubCert.createState<Context>(opts),
        },
      },
    },
    {
      guards: {
        ...HubCert.createGuards<Context>(),
      },
      actions: {},
    }
  );

  const service = interpret(machine).onTransition((state) => console.log(state.changed, state.value));
  service.start();

  return service;
};

describe('HubCert', () => {
  let opts: ReturnType<typeof createMachineOpts>;

  beforeEach(() => {
    opts = createMachineOpts();
  });

  test('should create hub client cert and handle cert changes', async () => {
    // opts.hubCertificateModel.uploadServerCertificate.mockImplementation(async () => ({ id: 123 }));
    opts.hubCertificateModel.getUnprocessedCerts.mockImplementation(async () => [
      { id: 111, csr: 'HUB CSR 1' },
      { id: 222, csr: 'HUB CSR 2' },
    ]);
    opts.vault.signHubCSR.mockImplementation(async (csr) => {
      if (csr === 'HUB CSR 1') return { certificate: 'HUB CERT 1' };
      if (csr === 'HUB CSR 2') return { certificate: 'HUB CERT 2' };
      if (csr === 'HUB CSR 3') return { certificate: 'HUB CERT 3' };
      if (csr === 'HUB CSR 4') return { certificate: 'HUB CERT 4' };
    });

    opts.refreshIntervalSeconds = 1;
    const service = startMachine(opts);

    await waitFor(service, (state) => state.matches('creatingHubClientCert.retry'));

    expect(opts.hubCertificateModel.getUnprocessedCerts).toHaveBeenCalled();
    expect(opts.vault.signHubCSR).toHaveBeenNthCalledWith(1, 'HUB CSR 1');
    expect(opts.vault.signHubCSR).toHaveBeenNthCalledWith(2, 'HUB CSR 2');
    expect(opts.hubCertificateModel.uploadServerCertificate).toHaveBeenNthCalledWith(1, {
      enId: 111,
      entry: { certificate: 'HUB CERT 1' },
    });
    expect(opts.hubCertificateModel.uploadServerCertificate).toHaveBeenNthCalledWith(2, {
      enId: 222,
      entry: { certificate: 'HUB CERT 2' },
    });

    // no unprocessed hub certs
    opts.hubCertificateModel.getUnprocessedCerts.mockImplementation(async () => []);

    await waitFor(service, (state) => state.matches('creatingHubClientCert.fetchingHubCSR'));
    await waitFor(service, (state) => state.matches('creatingHubClientCert.retry'));

    expect(opts.hubCertificateModel.uploadServerCertificate).toHaveBeenCalledTimes(2);

    // now add another unprocessed hub certs
    opts.hubCertificateModel.getUnprocessedCerts.mockImplementation(async () => [
      { id: 333, csr: 'HUB CSR 3' },
      { id: 444, csr: 'HUB CSR 4' },
    ]);

    await waitFor(service, (state) => state.matches('creatingHubClientCert.fetchingHubCSR'));
    await waitFor(service, (state) => state.matches('creatingHubClientCert.retry'));

    expect(opts.hubCertificateModel.getUnprocessedCerts).toHaveBeenCalled();
    expect(opts.vault.signHubCSR).toHaveBeenNthCalledWith(3, 'HUB CSR 3');
    expect(opts.vault.signHubCSR).toHaveBeenNthCalledWith(4, 'HUB CSR 4');
    expect(opts.hubCertificateModel.uploadServerCertificate).toHaveBeenNthCalledWith(3, {
      enId: 333,
      entry: { certificate: 'HUB CERT 3' },
    });
    expect(opts.hubCertificateModel.uploadServerCertificate).toHaveBeenNthCalledWith(4, {
      enId: 444,
      entry: { certificate: 'HUB CERT 4' },
    });

    service.stop();
  });
});
