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
            privateKeyAlgorithm: 'rsa',
            privateKeyLength: 4096,
            parameters: 'mocked'
        };

        const createdCsrMock = { key: 'mocked', csr: 'mocked'};

        const context =  {
            'state': {
                'conf': {
                    envId: '1',
                    dfspId: 'pm4mltest',
                    privateKeyAlgorithm: csrParameters.privateKeyAlgorithm,
                    privateKeyLength : csrParameters.privateKeyLength,
                    dfspClientCsrParameters: csrParameters.parameters
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
                }
            },
            params: { 'envId': '1' }
        };

        const createCSRSpy = jest.spyOn(CertificatesModel.prototype, 'createCSR')
            .mockImplementation(() => { return createdCsrMock; });

        const uploadClientCSRSpy = jest.spyOn(CertificatesModel.prototype, 'uploadClientCSR')
            .mockImplementation(() => { return {ctx: {body: 1}};});
            
        await handlers['/environments/{envId}/dfsp/clientcerts/csr'].post(context);

        expect(createCSRSpy).toHaveBeenCalledTimes(1);
        expect(uploadClientCSRSpy).toHaveBeenCalledTimes(1);

        expect(createCSRSpy.mock.calls[0][0]).toStrictEqual(csrParameters);

        expect(uploadClientCSRSpy.mock.calls[0][0]).toStrictEqual(createdCsrMock.csr);
    });

    test('generate all certs calls to exchange server certificates with sdk', async () => {

        const csrParameters = {
            privateKeyAlgorithm: 'rsa',
            privateKeyLength: 4096,
            parameters: 'mocked'
        };

        const createdCsrMock = { key: 'mocked', csr: 'mocked'};
        const dfspCaPath = 'mockPath;';
        
        const context =  {
            'state': {
                'conf': {
                    envId: '1',
                    dfspId: 'pm4mltest',
                    privateKeyAlgorithm: csrParameters.privateKeyAlgorithm,
                    privateKeyLength : csrParameters.privateKeyLength,
                    dfspServerCsrParameters: csrParameters.parameters,
                    dfspCaPath: dfspCaPath
                },
                logger: {
                    push: (obj) => {
                        return { log : (msg) => {
                            // this is too verbose
                            // console.log(obj, msg);
                        }};
                    }
                }
            },
            params: { 'envId': '1' }
        };

        const createCSRSpy = jest.spyOn(CertificatesModel.prototype, 'createCSR')
            .mockImplementation(() => { return createdCsrMock; });

        const uploadCSRSpy = jest.spyOn(CertificatesModel.prototype, 'uploadClientCSR')
            .mockImplementation(() => { return {ctx: {body: 1}};});
            
        await handlers['/environments/{envId}/dfsp/allcerts'].post(context);

        expect(createCSRSpy).toHaveBeenCalledTimes(1);
        expect(uploadCSRSpy).toHaveBeenCalledTimes(1);

        expect(createCSRSpy.mock.calls[0][0]).toStrictEqual(csrParameters);

        expect(uploadCSRSpy.mock.calls[0][0]).toStrictEqual(createdCsrMock, dfspCaPath);
    });
});
