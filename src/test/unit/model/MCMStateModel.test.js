'use strict';
const MCMStateModel = require('../../../lib/model/MCMStateModel');
const hubCertsResource = require('./resources/hubCerts');
const { EmbeddedPKIEngine } = require('mojaloop-connection-manager-pki-engine');
const { HubCertificateModel } = require('@modusbox/mcm-client');

describe('MCMState Model:', () => {

    class Logger {
        constructor() {}

        push() {
            return new Logger();
        }
        async log() {
        }
    }

    const logger = new Logger();

    class Storage {
        constructor(dfspCA, dfspKey) {
            this.dfspCA = dfspCA;
            this.dfspKey = dfspKey;
        }

        async getSecret() {
            return this.dfspCA;
        }
        async getSecretAsString() {
            return this.dfspKey;
        }
    }


    class Cache {
        constructor() {}

        get() {
            return '';
        }
    }

    const mockCache = new Cache();

    const mockDB = {redisCache: mockCache};

    afterEach( () => {
        jest.clearAllMocks();
    });

    describe('download Hub csr, sign and create certificate, upload it to mcm', () => {

        test('when outbound enrollment list from mcm comes empty then it does not call upload', async () => {

            const storage = new Storage('MOCK CA', 'MOCK KEY');
            const mcmState = new MCMStateModel({
                dfspId: 'dfsptest',
                envId: 1,
                hubEndpoint: 'localhost',
                refreshIntervalSeconds: 1000,
                storage: storage,
                logger: logger,
                db: mockDB
            });

            const getCertificatesSpy = jest.spyOn(HubCertificateModel.prototype, 'getCertificates')
                .mockImplementation(() => []);

            const signCsrSpy = jest.spyOn(EmbeddedPKIEngine.prototype, 'sign')
                .mockImplementation(() => { return {cert: 'cert mocked'}; });

            const uploadServerCertificateSpy = jest.spyOn(HubCertificateModel.prototype, 'uploadServerCertificate')
                .mockImplementation(() => []);

            await mcmState.hubCSRExchangeProcess();

            expect(getCertificatesSpy).toHaveBeenCalledTimes(1);
            expect(getCertificatesSpy.mock.calls[0][0]).toStrictEqual({ envId: 1 });

            expect(signCsrSpy).toHaveBeenCalledTimes(0);
            expect(uploadServerCertificateSpy).toHaveBeenCalledTimes(0);

        });

        test('when outbound enrollment list comes with a not CSR_LOADED state from mcm then it does not call upload', async () => {

            const storage = new Storage('MOCK CA', 'MOCK KEY');

            const mcmState = new MCMStateModel({
                dfspId: 'dfsptest',
                envId: 1,
                hubEndpoint: 'localhost',
                refreshIntervalSeconds: 1000,
                storage: storage,
                logger: logger,
                db: mockDB
            });

            const getCertificatesSpy = jest.spyOn(HubCertificateModel.prototype, 'getCertificates')
                .mockImplementation(() => hubCertsResource.signedCertList);

            const signCsrSpy = jest.spyOn(EmbeddedPKIEngine.prototype, 'sign')
                .mockImplementation(() => { return {cert: 'cert mocked'}; });

            const uploadServerCertificateSpy = jest.spyOn(HubCertificateModel.prototype, 'uploadServerCertificate')
                .mockImplementation(() => []);

            await mcmState.hubCSRExchangeProcess();

            expect(getCertificatesSpy).toHaveBeenCalledTimes(1);
            expect(getCertificatesSpy.mock.calls[0][0]).toStrictEqual({ envId: 1 });

            expect(signCsrSpy).toHaveBeenCalledTimes(0);
            expect(uploadServerCertificateSpy).toHaveBeenCalledTimes(0);
        });

        test('when outbound enrollment list comes with one csr in CSR_LOADED state and there is no DFSP CA then fails', async () => {

            const storage = new Storage(null, 'MOCK KEY');

            const mcmState = new MCMStateModel({
                dfspId: 'dfsptest',
                envId: 1,
                hubEndpoint: 'localhost',
                refreshIntervalSeconds: 1000,
                storage: storage,
                logger: logger,
                db: mockDB
            });

            const getCertificatesSpy = jest.spyOn(HubCertificateModel.prototype, 'getCertificates')
                .mockImplementation(() => hubCertsResource.csrLoadedCertList);

            const signCsrSpy = jest.spyOn(EmbeddedPKIEngine.prototype, 'sign')
                .mockImplementation(() => { return {cert: 'cert mocked'}; });

            const uploadServerCertificateSpy = jest.spyOn(HubCertificateModel.prototype, 'uploadServerCertificate')
                .mockImplementation(() => []);

            await mcmState.hubCSRExchangeProcess();

            expect(getCertificatesSpy).toHaveBeenCalledTimes(1);
            expect(getCertificatesSpy.mock.calls[0][0]).toStrictEqual({ envId: 1 });

            expect(signCsrSpy).toHaveBeenCalledTimes(0);
            expect(uploadServerCertificateSpy).toHaveBeenCalledTimes(0);
        });

        test('when outbound enrollment list comes with one csr in CSR_LOADED and there is one DFSP CA then sign and upload', async () => {

            const storage = new Storage('MOCK CA', 'MOCK KEY');

            const mcmState = new MCMStateModel({
                dfspId: 'dfsptest',
                envId: 1,
                hubEndpoint: 'localhost',
                refreshIntervalSeconds: 1000,
                storage: storage,
                logger: logger,
                db: mockDB

            });

            const getCertificatesSpy = jest.spyOn(HubCertificateModel.prototype, 'getCertificates')
                .mockImplementation(() => hubCertsResource.csrLoadedCertList);

            const signCsrSpy = jest.spyOn(EmbeddedPKIEngine.prototype, 'sign')
                .mockImplementation(() => { return {cert: 'cert mocked'}; });

            const uploadServerCertificateSpy = jest.spyOn(HubCertificateModel.prototype, 'uploadServerCertificate')
                .mockImplementation(() => []);

            await mcmState.hubCSRExchangeProcess();

            expect(getCertificatesSpy).toHaveBeenCalledTimes(1);
            expect(getCertificatesSpy.mock.calls[0][0]).toStrictEqual({ envId: 1 });

            expect(signCsrSpy).toHaveBeenCalledTimes(1);
            expect(uploadServerCertificateSpy).toHaveBeenCalledTimes(1);

            const certificateToUpload = uploadServerCertificateSpy.mock.calls[0][0];

            expect(certificateToUpload.envId).toStrictEqual(1);
            expect(certificateToUpload.dfpsId).toStrictEqual('dfsptest');
            expect(certificateToUpload.enId).toStrictEqual(11);

        });
    });

});