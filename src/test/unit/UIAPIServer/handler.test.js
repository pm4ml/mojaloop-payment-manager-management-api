/* eslint-disable no-unused-vars */
'use strict';
const handlers = require('../../../UIAPIServer/handlers');
const { CertificatesModel } = require('@internal/model');

describe('create dfsp csr and upload to mcm', () => {

    afterEach( () => {
        jest.clearAllMocks();
    });

    test('when creating a csr it calls one time to certificates model csr creation and upload csr', async () => {

        const csrParameters = {
            keyAlgorithm: 'rsa',
            keyLength: 4096,
            parameters: 'mocked'
        };

        const createdCsrMock = { key: 'mocked', csr: 'mocked'};

        const context =  {
            'state': {
                'conf': {
                    dfspId: 'pm4mltest',
                    vault: {
                        keyAlgorithm: csrParameters.keyAlgorithm,
                        keyLength: csrParameters.keyLength,
                    },
                    dfspClientCsrParameters: csrParameters.parameters,
                    dfspServerCsrParameters: csrParameters.parameters,
                },
                logger: {
                    push: (obj) => {
                        return { log : (msg) => {
                            // this is too verbose
                            // console.log(obj, msg);
                        }};
                    }
                },
                db:{
                    redisCache: {
                        set: () => {},
                        get: () => {}
                    }
                },
                vault: {
                    setClientCert: () => {},
                }
            },
            params: { }
        };

        const createCSRSpy = jest.spyOn(CertificatesModel.prototype, 'createCSR')
            .mockImplementation(() => { return createdCsrMock; });

        const uploadClientCSRSpy = jest.spyOn(CertificatesModel.prototype, 'uploadClientCSR')
            .mockImplementation(() => { return {ctx: {body: 1}};});

        await handlers['/dfsp/clientcerts/csr'].post(context);

        expect(createCSRSpy).toHaveBeenCalledTimes(1);
        expect(uploadClientCSRSpy).toHaveBeenCalledTimes(1);

        expect(uploadClientCSRSpy.mock.calls[0][0]).toStrictEqual(createdCsrMock.csr);
    });

    test('generate all certs calls to exchange server certificates with sdk', async () => {

        const csrParameters = {
            keyAlgorithm: 'rsa',
            keyLength: 4096,
            parameters: 'mocked'
        };

        const createdCsrMock = { key: 'mocked', csr: 'mocked'};

        const context =  {
            'state': {
                'conf': {
                    dfspId: 'pm4mltest',
                    vault: {
                        keyAlgorithm: csrParameters.keyAlgorithm,
                        keyLength: csrParameters.keyLength,
                    },
                    dfspServerCsrParameters: csrParameters.parameters,
                },
                logger: {
                    push: (obj) => {
                        return { log : (msg) => {
                            // this is too verbose
                            // console.log(obj, msg);
                        }};
                    }
                },
                vault: {
                    setClientCert: () => {},
                    setJWS: () => {},
                    createDFSPServerCert: () => ({ certificate: 'cert', private_key: 'pkey', issuing_ca: 'ca' })
                }
            },
            request: { },
            params: { }
        };

        const createCSRSpy = jest.spyOn(CertificatesModel.prototype, 'createCSR')
            .mockImplementation(() => { return createdCsrMock; });

        const uploadCSRSpy = jest.spyOn(CertificatesModel.prototype, 'uploadClientCSR')
            .mockImplementation(() => { return {ctx: {body: 1}};});

        const uploadServerCertificates = jest.spyOn(CertificatesModel.prototype, 'uploadServerCertificates')
            .mockImplementation(() => { return {ctx: {body: 1}};});

        const uploadJWS = jest.spyOn(CertificatesModel.prototype, 'uploadJWS')
            .mockImplementation(() => { return {ctx: {body: 1}};});

        await handlers['/dfsp/allcerts'].post(context);

        expect(createCSRSpy).toHaveBeenCalledTimes(1);
        expect(uploadCSRSpy).toHaveBeenCalledTimes(1);
        expect(uploadServerCertificates).toHaveBeenCalledTimes(1);
        expect(uploadJWS).toHaveBeenCalledTimes(1);
    });
});
