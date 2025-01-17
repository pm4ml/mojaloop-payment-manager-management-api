/** ************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Vijay Kumar Guthi <vijaya.guthi@infitx.com>                   *
 ************************************************************************* */

import { UploadPeerJWS } from '@app/lib/model/stateMachine/states';
import { createMachine, interpret } from 'xstate';
import { createMachineOpts } from './commonMocks';
import { waitFor } from 'xstate/lib/waitFor';

type Context = UploadPeerJWS.Context;
type Event = UploadPeerJWS.Event;

const startMachine = (opts: ReturnType<typeof createMachineOpts>) => {
  const machine = createMachine<Context, Event>(
    {
      id: 'testMachine',
      context: {},
      type: 'parallel',
      states: {
        uploadingPeerJWS: UploadPeerJWS.createState<Context>(opts),
      },
    },
    {
      guards: {},
      actions: {},
      predictableActionArguments: true, // Add this option
    },
  );

  const service = interpret(machine); // .onTransition((state) => console.log(state.changed, state.value));
  service.start();

  return service;
};

describe('UploadPeerJWS', () => {
  let opts: ReturnType<typeof createMachineOpts>;
  const createdAt = Math.floor(Date.now() / 1000);
  const testfsp1JWS = { dfspId: 'testfsp1', publicKey: 'TEST KEY 1', createdAt };
  const testfsp2JWS = { dfspId: 'testfsp2', publicKey: 'TEST KEY 2', createdAt };
  const testfsp3JWS = { dfspId: 'testfsp3', publicKey: 'TEST KEY 3', createdAt };
  let service: ReturnType<typeof startMachine>;

  beforeAll(() => {
    opts = createMachineOpts();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Start the state machine', async () => {
    opts.dfspCertificateModel.uploadExternalDfspJWS.mockImplementation(async () => {});
    service = startMachine(opts);
    await waitFor(service, (state) => state.matches('uploadingPeerJWS.idle'));
  });

  test('should call uploadExternalDfspJWS on event', async () => {
    const sampleData = [testfsp1JWS, testfsp2JWS];
    opts.dfspCertificateModel.uploadExternalDfspJWS.mockImplementation(async () => true);
    service.send({ type: 'UPLOAD_PEER_JWS', data: sampleData });
    await waitFor(service, (state) => state.matches('uploadingPeerJWS.comparePeerJWS'));
    await waitFor(service, (state) => state.matches('uploadingPeerJWS.uploadingPeerJWS'));
    await waitFor(service, (state) => state.matches('uploadingPeerJWS.idle'));
    expect(opts.dfspCertificateModel.uploadExternalDfspJWS).toHaveBeenCalled();
    expect(opts.dfspCertificateModel.uploadExternalDfspJWS).toHaveBeenCalledWith(sampleData);
    expect(service.state.context).toHaveProperty('peerJWS');
    expect(service.state.context.peerJWS).toContainEqual(testfsp1JWS);
    expect(service.state.context.peerJWS).toContainEqual(testfsp2JWS);
  });

  test('should call uploadExternalDfspJWS with only changed certs', async () => {
    const sampleData = [testfsp1JWS, testfsp2JWS, testfsp3JWS];
    opts.dfspCertificateModel.uploadExternalDfspJWS.mockImplementation(async () => true);
    service.send({ type: 'UPLOAD_PEER_JWS', data: sampleData });
    await waitFor(service, (state) => state.matches('uploadingPeerJWS.comparePeerJWS'));
    await waitFor(service, (state) => state.matches('uploadingPeerJWS.uploadingPeerJWS'));
    await waitFor(service, (state) => state.matches('uploadingPeerJWS.idle'));
    expect(opts.dfspCertificateModel.uploadExternalDfspJWS).toHaveBeenCalled();
    expect(opts.dfspCertificateModel.uploadExternalDfspJWS).toHaveBeenCalledWith([testfsp3JWS]);
    expect(service.state.context.peerJWS).toContainEqual(testfsp1JWS);
    expect(service.state.context.peerJWS).toContainEqual(testfsp2JWS);
    expect(service.state.context.peerJWS).toContainEqual(testfsp3JWS);
  });

  test('should not call uploadExternalDfspJWS if an older cert is passed', async () => {
    const sampleData = [
      testfsp1JWS,
      testfsp2JWS,
      {
        ...testfsp3JWS,
        createdAt: createdAt - 1,
        publicKey: 'TEST KEY 3 OLD',
      },
    ];
    opts.dfspCertificateModel.uploadExternalDfspJWS.mockImplementation(async () => true);
    service.send({ type: 'UPLOAD_PEER_JWS', data: sampleData });
    await waitFor(service, (state) => state.matches('uploadingPeerJWS.comparePeerJWS'));
    await waitFor(service, (state) => state.matches('uploadingPeerJWS.idle'));
    expect(opts.dfspCertificateModel.uploadExternalDfspJWS).not.toHaveBeenCalled();
    expect(service.state.context.peerJWS).toContainEqual(testfsp1JWS);
    expect(service.state.context.peerJWS).toContainEqual(testfsp2JWS);
    expect(service.state.context.peerJWS).toContainEqual(testfsp3JWS);
  });
  //// TODO: This test is failing. The onError handler in the xstate library seems not working as expected.
  //// Since there are no such error tests in other test files, we need to investigate the reason for this.
  // test('should not update the stored certs if uploadExternalDfspJWS throws an error', async () => {
  //   const sampleData = [testfsp1JWS, testfsp2JWS, testfsp3JWS, testfsp4JWS];
  //   opts.dfspCertificateModel.uploadExternalDfspJWS.mockImplementation(async () => { throw new Error('Test Error'); });
  //   service.send({ type: 'UPLOAD_PEER_JWS' , data: sampleData });
  //   await waitFor(service, (state) => state.matches('uploadingPeerJWS.comparePeerJWS'));
  //   await waitFor(service, (state) => state.matches('uploadingPeerJWS.uploadingPeerJWS'));
  //   await waitFor(service, (state) => state.matches('uploadingPeerJWS.idle'));
  //   expect(opts.dfspCertificateModel.uploadExternalDfspJWS).toHaveBeenCalled();
  //   expect(opts.dfspCertificateModel.uploadExternalDfspJWS).toHaveBeenCalledWith([testfsp4JWS]);
  //   expect(service.state.context.peerJWS).toContainEqual(testfsp1JWS);
  //   expect(service.state.context.peerJWS).toContainEqual(testfsp2JWS);
  //   expect(service.state.context.peerJWS).toContainEqual(testfsp3JWS);
  //   expect(service.state.context.peerJWS).not.toContainEqual(testfsp4JWS);
  // });

  test('Stop state machine', async () => {
    service.stop();
  });
});
