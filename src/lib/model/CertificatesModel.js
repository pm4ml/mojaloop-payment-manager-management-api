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
const ConnectorManager = require('./ConnectorManager');
const forge = require('node-forge');

class CertificatesModel {
    constructor(opts) {
        this._logger = opts.logger;
        this._envId = opts.envId;
        this._vault = opts.vault;
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
        return this._vault.createCSR(csrParameters);
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
    async uploadDFSPCA(certPem, privateKeyPem) {
        await this._vault.setDfspCaCert(certPem, privateKeyPem);
        return this._mcmClientDFSPCertModel.uploadDFSPCA({
            envId : this._envId,
            entry: { rootCertificate: certPem },
        });
    }

    /**
     * Get DFSP Server Certificates
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

    async processDfspServerCert(csr) {
        const cert = await this._vault.signCSR(csr.csr);
        this._logger.push(cert).log('DFSP server cert signed with DFSP CA cert');

        await Promise.all([
            this._vault.setDfspServerCert(cert.certificate),
            await this.uploadServerCertificates({ rootCertificate: cert.issuing_ca, serverCertificate: cert.certificate }),
        ]);

        await this._connectorManager.reconfigureInboundSdk(csr.private_key, cert.certificate, cert.issuing_ca);
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
            peerJWSPublicKeys[jwsCert.dfspId] = forge.pki.publicKeyToPem((
                forge.pki.certificateFromPem(jwsCert.jwsCertificate.trim().replace(/\\n/g, '\n'))).publicKey);
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
