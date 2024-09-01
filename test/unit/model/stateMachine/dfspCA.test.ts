/**************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 **************************************************************************/

import { DfspCA } from '@app/lib/model/stateMachine/states';
import { createMachine, interpret } from 'xstate';
import { createMachineOpts } from './commonMocks';
import { waitFor } from 'xstate/lib/waitFor';

type Context = DfspCA.Context;
type Event = DfspCA.Event;

const startMachine = (opts: ReturnType<typeof createMachineOpts>) => {
  const machine = createMachine<Context, Event>(
    {
      id: 'testMachine',
      context: {},
      type: 'parallel',
      states: {
        creatingDFSPCA: DfspCA.createState<Context>(opts),
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

describe('DfspCA', () => {
  let opts: ReturnType<typeof createMachineOpts>;

  beforeEach(() => {
    opts = createMachineOpts();
  });

  test('should upload builtin CA', async () => {
    opts.vault.getCA.mockImplementation(async () => 'MOCK CA');
    const service = startMachine(opts);

    await waitFor(service, (state) => state.matches('creatingDFSPCA.idle'));

    expect(opts.vault.getCA).toHaveBeenCalled();
    expect(opts.dfspCertificateModel.uploadDFSPCA).toHaveBeenCalledWith({
      rootCertificate: 'MOCK CA',
    });
    service.stop();
  });

  test('should create CA by provided subject and upload it', async () => {
    const buildCA = (subject: any) => ({
      cert: `cert-${JSON.stringify(subject)}`,
      key: `key-${JSON.stringify(subject)}`,
    });

    opts.vault.getCA.mockImplementation(async () => 'MOCK CA');
    opts.vault.createCA.mockImplementation(async (csr) => buildCA(csr));

    const service = startMachine(opts);

    await waitFor(service, (state) => state.matches('creatingDFSPCA.idle'));

    const subject = {
      CN: 'testcn',
      OU: 'testou',
      O: 'testo',
      L: 'testl',
      C: 'testc',
      ST: 'testst',
    };

    service.send({ type: 'CREATE_INT_CA', subject });

    await waitFor(service, (state) => state.matches('creatingDFSPCA.idle'));
    expect(opts.vault.createCA).toHaveBeenCalledWith(subject);
    expect(opts.dfspCertificateModel.uploadDFSPCA).toHaveBeenLastCalledWith({
      rootCertificate: buildCA(subject).cert,
    });

    service.stop();
  });

  test('should create external CA upload it', async () => {
    opts.vault.getCA.mockImplementation(async () => 'MOCK CA');

    const service = startMachine(opts);

    await waitFor(service, (state) => state.matches('creatingDFSPCA.idle'));

    service.send({ type: 'CREATE_EXT_CA', rootCert: 'ROOT CA', intermediateChain: 'CA CHAIN', privateKey: 'PKEY' });

    await waitFor(service, (state) => state.matches('creatingDFSPCA.idle'));
    expect(opts.vault.setDFSPCaCertChain).toHaveBeenCalledWith('ROOT CA\nCA CHAIN', 'PKEY');
    expect(opts.dfspCertificateModel.uploadDFSPCA).toHaveBeenLastCalledWith({
      rootCertificate: 'ROOT CA',
      intermediateChain: 'CA CHAIN',
    });

    service.stop();
  });
});
