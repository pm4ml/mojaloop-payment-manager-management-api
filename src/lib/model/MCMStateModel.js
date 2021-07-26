/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha - yevhen.kyriukha@modusbox.com                   *
 **************************************************************************/

const util = require('util');
const { DFSPCertificateModel, HubCertificateModel, HubEndpointModel, AuthModel, ConnectorModel } = require('@modusbox/mcm-client');
const CertificatesModel = require('./CertificatesModel');

class MCMStateModel {

    /**
     * @param opts {object}
     * @param opts.hubEndpoint {string}
     * @param opts.logger {object}
     * @param opts.dfspId {string}
     * @param opts.vault {object}
     * @param opts.envId {string}
     * @param opts.refreshIntervalSeconds {number}
     * @param opts.tlsServerPrivateKey {String}
     * @param opts.controlServer {ConnectorManager.Server}
     */
    constructor(opts) {
        const { logger, hubEndpoint, dfspId } = opts;
        this._dfspCertificateModel = new DFSPCertificateModel({ logger, hubEndpoint, dfspId });
        this._hubCertificateModel = new HubCertificateModel(opts);
        this._hubEndpointModel = new HubEndpointModel(opts);
        this._certificatesModel =  new CertificatesModel({
            ...opts,
            mcmServerEndpoint:opts.hubEndpoint
        });
        this._refreshIntervalSeconds = opts.refreshIntervalSeconds;
        this._vault = opts.vault;
        this._envId = opts.envId;
        this._dfspId = opts.dfspId;
        this._logger = opts.logger;
        this._authEnabled = opts.authEnabled;
        this._hubEndpoint = opts.hubEndpoint;

        this._authModel = new AuthModel(opts);
        this._connectorModel = new ConnectorModel(opts);
        this._db = opts.db;
    }

    async _refresh() {
        try {
            this._logger.log('starting mcm client refresh');
            const dfspCerts = await this._dfspCertificateModel.getCertificates({ envId: this._envId });
            // await this._vault.setSecret('dfspCerts', JSON.stringify(
            //     dfspCerts.filter(cert => cert.certificate).map(cert => cert.certificate)
            // ));
            this._logger.log(`dfspCerts:: ${JSON.stringify(dfspCerts)}`);

            const jwsCerts = await this._dfspCertificateModel.getAllJWSCertificates({ envId: this._envId, dfpsId: this._dfspId });
            const newCertsStr = JSON.stringify(
                jwsCerts.map((cert) => ({
                    rootCertificate: cert.rootCertificate,
                    intermediateChain: cert.intermediateChain,
                    jwsCertificate: cert.jwsCertificate,
                }))
            );

            // Check if this set of certs differs from the ones in vault.
            // If so, store them then broadcast them to the connectors.
            let oldJwsCerts = '';
            try {
                oldJwsCerts = await this._vault.getJWSCerts();
            } catch (_) { /* `jwsCerts` file/record does not exist yet.*/ }

            if (oldJwsCerts !== newCertsStr && newCertsStr) {
                await this._vault.setJWSCerts(newCertsStr);
                this._logger.log(`jwsCerts:: ${JSON.stringify(jwsCerts)}`);
                if (Array.isArray(jwsCerts) && jwsCerts.length) {
                    await this._certificatesModel.exchangeJWSConfiguration(jwsCerts);
                }
            }


            // Exchange Hub CSR
            //await this.hubCSRExchangeProcess();

            // Check if Client certificates are available in Hub
            await this.dfspClientCertificateExchangeProcess();


            //const hubEndpoints = await this._hubEndpointModel.findAll({ envId: this._envId, state: 'CONFIRMED' });
            // await this._vault.setSecret('hubEndpoints', JSON.stringify(hubEndpoints));
        }
        catch(err) {
            this._logger.push({ err }).log('Error refreshing MCM state model');
            //note: DONT throw at this point or we will crash our parent process!
        }
    }

    async dfspClientCertificateExchangeProcess(){
        const cache = this._db.redisCache;
        const inboundEnrollmentId = await cache.get(`inboundEnrollmentId_${this._envId}`);
        this._logger.log(`inboundEnrollmentId:: ${inboundEnrollmentId}`);
        if (inboundEnrollmentId) {
            const privateKey = await this._vault.getClientPrivateKey();

            try {
                const wasExchanged = await this._certificatesModel.exchangeOutboundSdkConfiguration(inboundEnrollmentId, privateKey);
                if (wasExchanged) {
                    await cache.del(`inboundEnrollmentId_${this._envId}`);
                }
            } catch(err) {
                this._logger.log(`Error refreshing client certificate: ${err.stack || util.inspect(err)}`);
            }
        }
    }

    async hubCSRExchangeProcess() {
        const hubCerts = await this.getUnprocessedCerts();
        for (const cert of hubCerts) {
            try {
                const hubCertificate = await this._vault.signServerCSR({
                    csr: cert.csr,
                    commonName: cert.csrInfo.subject.CN,
                });
                await this.uploadCertificate(cert.id, hubCertificate.certificate);
            } catch (error) {
                console.log('Error with signing and uploading certificate', error);
            }
        }
    }

    async start() {
        await this._authModel.login();
        await this._refresh();
        this._logger.push({ interval: this._refreshIntervalSeconds }).log('Beginning MCM client refresh interval');
        this._timer = setInterval(this._refresh.bind(this), this._refreshIntervalSeconds * 10e3);
    }

    async stop() {
        clearInterval(this._timer);
    }

    async getUnprocessedCerts() {
        const hubCerts = await this._hubCertificateModel.getCertificates({ envId: this._envId });

        //filter all certs where cert state is CSR_LOADED
        return hubCerts.filter(cert => (cert.state === 'CSR_LOADED')).map(cert => ({
            id: cert.id,
            csr: cert.csr,
            csrInfo: cert.csrInfo,
        }));
    }

    async uploadCertificate(enrollmentId, hubCertificate) {
        const body = {
            certificate: hubCertificate
        };

        return this._hubCertificateModel.uploadServerCertificate({ envId: this._envId, dfpsId: this._dfspId, enId: enrollmentId, entry: body } );

    }
}

module.exports = MCMStateModel;
