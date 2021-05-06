/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha - yevhen.kyriukha@modusbox.com                   *
 **************************************************************************/

const { DFSPCertificateModel, HubCertificateModel, HubEndpointModel, AuthModel, ConnectorModel } = require('@modusbox/mcm-client');
const { EmbeddedPKIEngine } = require('mojaloop-connection-manager-pki-engine');
const CertificatesModel = require('./CertificatesModel');
const util = require('util');

const DEFAULT_REFRESH_INTERVAL = 60;

class MCMStateModel {

    /**
     * @param opts {object}
     * @param opts.hubEndpoint {string}
     * @param opts.logger {object}
     * @param opts.dfspId {string}
     * @param opts.storage {object}
     * @param opts.envId {string}
     * @param opts.refreshIntervalSeconds {number}
     * @param opts.tlsServerPrivateKey {String}
     */
    constructor(opts) {
        this._dfspCertificateModel = new DFSPCertificateModel(opts);
        this._hubCertificateModel = new HubCertificateModel(opts);
        this._hubEndpointModel = new HubEndpointModel(opts);
        this._certificatesModel =  new CertificatesModel({
            ...opts,
            mcmServerEndpoint:opts.hubEndpoint
        });
        this._refreshIntervalSeconds = parseInt(opts.refreshIntervalSeconds) > 0 ?
            opts.refreshIntervalSeconds : DEFAULT_REFRESH_INTERVAL;
        this._storage = opts.storage;
        this._envId = opts.envId;
        this._dfspId = opts.dfspId;
        this._logger = opts.logger;
        this._authEnabled = opts.authEnabled;
        this._hubEndpoint = opts.hubEndpoint;
        this._tlsServerPrivateKey = opts.tlsServerPrivateKey;
        this._dfspCaPath = opts.dfspCaPath;

        this._authModel = new AuthModel(opts);
        this._connectorModel = new ConnectorModel(opts);
        this._db = opts.db;
    }

    async _refresh() {
        try {
            this._logger.log('starting mcm client refresh');
            const dfspCerts = await this._dfspCertificateModel.getCertificates({ envId: this._envId, dfpsId: this._dfspId });
            // await this._storage.setSecret('dfspCerts', JSON.stringify(
            //     dfspCerts.filter(cert => cert.certificate).map(cert => cert.certificate)
            // ));
            this._logger.log(`dfspCerts:: ${JSON.stringify(dfspCerts)}`);
            // Commenting till mutual TLS is working as expected.
            // const jwsCerts = await this._dfspCertificateModel.getAllJWSCertificates({ envId: this._envId, dfpsId: this._dfspId });
            // await this._storage.setSecret('jwsCerts', JSON.stringify(
            //     jwsCerts.map((cert) => ({
            //         rootCertificate: cert.rootCertificate,
            //         intermediateChain: cert.intermediateChain,
            //         jwsCertificate: cert.jwsCertificate,
            //     }))
            // ));
            // this._logger.log(`jwsCerts:: ${JSON.stringify(jwsCerts)}`);

            // Exchange Hub CSR 
            //await this.hubCSRExchangeProcess();

            // Check if Client certificates are available in Hub 
            await this.dfspClientCertificateExchangeProcess();

            //await this._certificatesModel.exchangeJWSConfiguration(jwsCerts);

            //const hubEndpoints = await this._hubEndpointModel.findAll({ envId: this._envId, state: 'CONFIRMED' });
            // await this._storage.setSecret('hubEndpoints', JSON.stringify(hubEndpoints));
        }
        catch(err) {
            this._logger.log(`Error refreshing MCM state model: ${err.stack || util.inspect(err)}`);
            //note: DONT throw at this point or we will crash our parent process!
        }
    }

    async dfspClientCertificateExchangeProcess(){
        const cache = this._db.redisCache;
        const inboundEnrollmentId = await cache.get(`inboundEnrollmentId_${this._envId}`);
        this._logger.log(`inboundEnrollmentId:: ${inboundEnrollmentId}`);
        if(inboundEnrollmentId){
            const encryptedClientPvtKey = await cache.get(`clientPrivateKey_${this._envId}`);
            const embeddedPKIEngine = new EmbeddedPKIEngine();
            const decryptedClientPvtKey = await embeddedPKIEngine.decryptKey(encryptedClientPvtKey);
            
            try {
                const wasExchanged = await this._certificatesModel.exchangeOutboundSdkConfiguration(inboundEnrollmentId, decryptedClientPvtKey);
                if(wasExchanged){
                    await cache.del(`inboundEnrollmentId_${this._envId}`);
                }
            } catch(err){
                this._logger.log(`Error refreshing client certificate: ${err.stack || util.inspect(err)}`);
            }
        }
    }

    async hubCSRExchangeProcess() {
        const hubCerts = await this.getUnprocessedCerts();
        for (const cert of hubCerts) {
            try {
                const hubCertificate = await this.signCsrAndCreateCertificate(cert.csr);
                await this.uploadCertificate(cert.id, hubCertificate);
            } catch (error) {
                console.log('Error with signing and uploading certificate', error);
            }
        }
    }

    async start() {
        let connected = false;

        while(!connected) {
            try {
                await this._authModel.login();
                connected = true;
            }
            catch(e) {
                this._logger.push(e).error('Error authenticating with MCM server. Retrying in 1 second');
                await new Promise(res => setTimeout(res, 1000));
            }
        }

        await this._refresh();
        this._timer = setInterval(this._refresh.bind(this), this._refreshIntervalSeconds * 10e3);
    }

    async stop() {
        clearInterval(this._timer);
    }

    async getUnprocessedCerts() {
        const hubCerts = await this._hubCertificateModel.getCertificates({ envId: this._envId });
        
        //filter all certs where cert state is CSR_LOADED
        const filteredCerts = hubCerts.filter(cert => (cert.state == 'CSR_LOADED')).map(cert =>
        { return { id: cert.id, csr: cert.csr };
        });

        return filteredCerts;
    }

    async signCsrAndCreateCertificate(csr) {
        const dfspCA = await this._storage.getSecret(this._dfspCaPath);

        const cache = this._db.redisCache;

        const serverPK = await cache.get(`serverPrivateKey_${this._envId}`);
        const tlsServerPrivateKey = serverPK.key;
        this._logger.log('server pk::', tlsServerPrivateKey);

        if (dfspCA) {
            const embeddedPKIEngine = new EmbeddedPKIEngine(dfspCA, tlsServerPrivateKey);
            const cert = await embeddedPKIEngine.sign(csr);
            this._logger.log('Certificate created and signed :: ', cert);
            return cert;

        } else {
            throw new Error('Not signing unprocessed csr since dfsp CA  certificate is null or empty');
        }

    }

    async uploadCertificate(enrollmentId, hubCertificate) {
        const body = {
            certificate: hubCertificate
        };

        return this._hubCertificateModel.uploadServerCertificate({ envId: this._envId, dfpsId: this._dfspId, enId: enrollmentId, entry: body } );

    }
}

module.exports = MCMStateModel;
