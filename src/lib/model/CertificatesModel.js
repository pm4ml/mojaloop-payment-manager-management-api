/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Murthy Kakarlamudi - murthy@modusbox.com                   *
 **************************************************************************/

const { DFSPCertificateModel, HubCertificateModel } = require('@modusbox/mcm-client');
const { EmbeddedPKIEngine } = require('mojaloop-connection-manager-pki-engine');
const ConnectorManager = require('./ConnectorManager');
const forge = require('node-forge');

class CertificatesModel {
    constructor(opts) {
        this._logger = opts.logger;
        this._envId = opts.envId;
        this._storage = opts.storage;
        this._wsUrl = opts.wsUrl;
        this._wsPort = opts.wsPort;
        this._db = opts.db;

        this._mcmClientDFSPCertModel = new DFSPCertificateModel({
            dfspId: opts.dfspId,
            logger: opts.logger,
            hubEndpoint: opts.mcmServerEndpoint
        });

        this._certificateModel = new HubCertificateModel({
            dfspId: opts.dfspId,
            logger: opts.logger,
            hubEndpoint: opts.mcmServerEndpoint,
        });      

        this._connectorManager = new ConnectorManager(opts);
    }

    async uploadClientCSR(body) {
        return this._mcmClientDFSPCertModel.uploadCSR({
            envId : this._envId,
            csr: body,
        });
    }

    async createCSR(csrParameters) {
        const createdCSR = await this._mcmClientDFSPCertModel.createCSR({
            envId : this._envId,
            csrParameters: csrParameters
        });

        //FIXME: createdCSR.key value should be saved in vault. Not being saved now in storage since secrets type in kubernetes are read-only

        return createdCSR;
    }

    /**
     * Gets uploaded DFSP CSRs and certificates
     */
    async getCertificates() {
        return this._mcmClientDFSPCertModel.getCertificates({
            envId : this._envId,
        });
    }

    /**
     * Gets uploaded DFSP CA
     */
    async getDFSPCA() {
        return this._mcmClientDFSPCertModel.getDFSPCA({
            envId : this._envId,
        });
    }

    /**
     * Upload DFSP CA
     */
    async uploadDFSPCA(body) {
        return this._mcmClientDFSPCertModel.uploadDFSPCA({
            envId : this._envId,
            entry: body,
        });
    }

    /**
     * Get DFSP Server Certificates
     * @param
     */
    async getDFSPServerCertificates() {
        return this._mcmClientDFSPCertModel.getDFSPServerCertificates({
            envId : this._envId,
        });
    }

    async uploadServerCertificates(body) {
        return this._mcmClientDFSPCertModel.uploadServerCertificates({
            envId : this._envId,
            entry: body,
        });
    }

    /**
     * Gets all JWS certificate
     */
    async getAllJWSCertificates() {
        return this._mcmClientDFSPCertModel.getAllJWSCertificates({
            envId : this._envId,
        });
    }

    async getClientCertificate(inboundEnrollmentId) {
        return this._mcmClientDFSPCertModel.getClientCertificate({
            envId : this._envId,
            inboundEnrollmentId
        });
    }

    async processDfspServerCerts(csr, dfspCaPath) {
        const dfspCA = await this._storage.getSecret(dfspCaPath);

        if (dfspCA) {
            const embeddedPKIEngine = new EmbeddedPKIEngine(dfspCA, csr.key);
            const cert = await embeddedPKIEngine.sign(csr.csr);
            this._logger.log('Certificate created and signed :: ', cert);

            //key generated with csr is encrypted
            try {
                const decryptedCsrPrivateKey = await embeddedPKIEngine.decryptKey(csr.key);
                this._logger.log('private key was decrypted :: ');

                //Save in redis decrypted private key
                // FIXME: (in the future will be in Vault)
                const cache = this._db.redisCache;
                await cache.set(`serverPrivateKey_${this._envId}`, {key: decryptedCsrPrivateKey});

                this._logger.push({dfspCA: dfspCA.toString(), cert: cert}).log('Printing values of DFSP CA and cert');

                await this.uploadServerCertificates({rootCertificate: dfspCA.toString(), serverCertificate: cert});
                
                await this._connectorManager.reconfigureInboundSdk(decryptedCsrPrivateKey, cert, dfspCA);

            } catch (error) {
                this._logger.log('Error decrypting or reconfiguring inbound sdk', error);
                throw error;

            }


        } else {
            throw new Error('Not signing dfsp own csr since dfsp CA  certificate is null or empty');
        }
    }

    async exchangeOutboundSdkConfiguration(inboundEnrollmentId, key) {
        let exchanged = false;
        
        const inboundEnrollment = await this.getClientCertificate(inboundEnrollmentId);
        this._logger.push({inboundEnrollment}).log('inboundEnrollment');
        if(inboundEnrollment.state === 'CERT_SIGNED'){
            const objHubCA = await this._certificateModel.getHubCAS({
                envId : this._envId
            });
            const caChain = `${objHubCA[0].intermediateChain}${objHubCA[0].rootCertificate}`.trim();
            this._logger.push({cert: caChain }).log('hubCA');

            await this._connectorManager.reconfigureOutboundSdk(caChain, key, inboundEnrollment.certificate);
            exchanged = true;
        }
        return exchanged;
    }   
    
    async exchangeJWSConfiguration(jwsCerts) {
        let peerJWSPublicKeys = {};
        jwsCerts.forEach(jwsCert => {
            const keyName = jwsCert.dfspId;
            const keyValue = forge.pki.publicKeyToPem((forge.pki.certificateFromPem(jwsCert.jwsCertificate.trim().replace(/\\n/g,'\n'))).publicKey);
            peerJWSPublicKeys[keyName] = keyValue;
        });
        this._logger.push({peerJWSPublicKeys}).log('Peer JWS Public Keys');
        await this._connectorManager.reconfigureOutboundSdkForJWS(JSON.stringify(peerJWSPublicKeys));
    }

    /**
     * Gets uploaded JWS certificate
     */
    async getDFSPJWSCertificates() {
        return this._mcmClientDFSPCertModel.getDFSPJWSCertificates({
            envId : this._envId,
        });
    }

    /**
     * Upload DFSP JWS
     */
    async uploadJWS(body) {
        return this._mcmClientDFSPCertModel.uploadJWS({
            envId : this._envId,
            entry: body,
        });
    }

    /**
     * Update DFSP JWS
     */
    async updateJWS(body) {
        return this._mcmClientDFSPCertModel.updateJWS({
            envId : this._envId,
            entry: body,
        });
    }

    /**
     * Delete DFSP JWS
     */
    async deleteJWS() {
        return this._mcmClientDFSPCertModel.deleteJWS({
            envId : this._envId,
        });
    }

}

module.exports = CertificatesModel;
