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
const stringify = require('json-stringify-deterministic');
const { DFSPCertificateModel, HubCertificateModel, HubEndpointModel, AuthModel, ConnectorModel } = require('@pm4ml/mcm-client');
const CertificatesModel = require('./CertificatesModel');

class MCMStateModel {

    /**
     * @param opts {object}
     * @param opts.hubEndpoint {string}
     * @param opts.logger {object}
     * @param opts.dfspId {string}
     * @param opts.mojaloopConnectorFQDN {string}
     * @param opts.vault {object}
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
        this._dfspId = opts.dfspId;
        this._logger = opts.logger;
        this._mojaloopConnectorFQDN = opts.mojaloopConnectorFQDN;
        this._authEnabled = opts.authEnabled;
        this._hubEndpoint = opts.hubEndpoint;

        this._authModel = new AuthModel(opts);
        this._connectorModel = new ConnectorModel(opts);
        this._db = opts.db;
        this._refreshTimer = null;
    }

    async _refresh() {
        try {
            this._logger.log('starting mcm client refresh');
            clearTimeout(this._refreshTimer);

            await this.uploadDFSPCA();
            await this.uploadClientCSR();
            await this.uploadJWS();

            await this.exchangeJWS();

            // Exchange Hub CSR
            await this.hubCSRExchangeProcess();

            // Check if Client certificates are available in Hub
            await this.dfspClientCertificateExchangeProcess();

            //const hubEndpoints = await this._hubEndpointModel.findAll({ state: 'CONFIRMED' });
            // await this._vault.setSecret('hubEndpoints', JSON.stringify(hubEndpoints));

            this._refreshTimer = setTimeout(this._refresh.bind(this), this._refreshIntervalSeconds * 1000);
        }
        catch(err) {
            this._logger.push({ err }).log('Error refreshing MCM state model');
            //note: DONT throw at this point or we will crash our parent process!
        }
    }

    async uploadDFSPCA() {
        const cert = await this._vault.getCA();
        const sent = await this._vault.getSentDFSPCA();
        if (sent?.cert !== cert) {
            await this._certificatesModel.uploadDFSPCA(cert);
            await this._vault.setSentDFSPCA({ cert });
        }
    }

    async uploadClientCSR() {
        const cert = await this._vault.getClientCert();
        const sent = await this._vault.getSentClientCert();
        if (!cert || sent?.privateKey !== cert.privateKey) {

            const createdCSR = await this._certificatesModel.createCSR();

            const csr = await this._certificatesModel.uploadClientCSR(createdCSR.csr);

            await this._vault.setClientCert({
                id: csr.id,
                privateKey: createdCSR.privateKey,
            });

            await this._vault.setSentClientCert({ privateKey: createdCSR.privateKey });
        }
    }

    async uploadJWS() {
        const jws = await this._vault.getJWS();
        const sent = await this._vault.getSentJWS();
        if (!jws || sent?.publicKey !== jws.publicKey) {
            const jws = this._certificatesModel.createJWS();
            await this._certificatesModel.storeJWS(jws);
            await this._certificatesModel.uploadJWS({ publicKey: jws.publicKey });
            await this._vault.setSentJWS({ publicKey: jws.publicKey });
        }
    }

    async dfspClientCertificateExchangeProcess(){
        try {
            await this._certificatesModel.exchangeOutboundSdkConfiguration();
        } catch (err) {
            this._logger.log(`Error refreshing client certificate: ${err.stack || util.inspect(err)}`);
        }
    }

    async exchangeJWS() {
        const jwsCerts = await this._dfspCertificateModel.getAllJWSCertificates({ dfpsId: this._dfspId });

        // Check if this set of certs differs from the ones in vault.
        // If so, store them then broadcast them to the connectors.
        const oldJwsCerts = await this._vault.getPeerJWS();
        if (jwsCerts && stringify(oldJwsCerts) !== stringify(jwsCerts)) {
            await this._vault.setPeerJWS(jwsCerts);
            this._logger.push(jwsCerts).log('Exchanged JWS certs');
            if (Array.isArray(jwsCerts) && jwsCerts.length) {
                await this._certificatesModel.exchangeJWSConfiguration(jwsCerts);
            }
        }
    }

    async hubCSRExchangeProcess() {
        const hubCerts = await this._hubCertificateModel.getUnprocessedCerts();
        for await (const cert of hubCerts) {
            try {
                const hubCertificate = await this._vault.signHubCSR({
                    csr: cert.csr,
                    commonName: this._mojaloopConnectorFQDN,
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
    }

    async stop() {
        clearInterval(this._refreshTimer);
    }

    async uploadCertificate(enrollmentId, hubCertificate) {
        const body = {
            certificate: hubCertificate
        };

        return this._hubCertificateModel.uploadServerCertificate({ enId: enrollmentId, entry: body } );

    }
}

module.exports = MCMStateModel;
