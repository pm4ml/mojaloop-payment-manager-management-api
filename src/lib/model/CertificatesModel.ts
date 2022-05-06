/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Murthy Kakarlamudi - murthy@modusbox.com                   *
 **************************************************************************/

import Vault from '../vault';
import { DFSPCertificateModel, HTTPResponseError, HubCertificateModel } from '@pm4ml/mcm-client';

import assert from 'assert';
import * as forge from 'node-forge';
import ConnectorManager from './ConnectorManager';
import { Logger } from '@mojaloop/sdk-standard-components';
import { Knex } from 'knex';

export interface CertificatesModelOpts {
  logger: Logger.Logger;
  vault: Vault;
  db: Knex;
  dfspId: string;
}

class CertificatesModel {
  private _logger: Logger.Logger;
  private _vault: Vault;
  private _db: Knex;
  private _outboundCert?: string;
  private _connectorManager: ConnectorManager;

  constructor(opts: CertificatesModelOpts) {
    this._logger = opts.logger;
    this._vault = opts.vault;
    this._db = opts.db;

    this._mcmClientDFSPCertModel = new DFSPCertificateModel({
      dfspId: opts.dfspId,
      logger: opts.logger,
      hubEndpoint: opts.mcmServerEndpoint,
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
      csr: body,
    });
  }

  async createCSR(keyBits, csrParameters = {}) {
    const keys = forge.pki.rsa.generateKeyPair(keyBits);
    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = keys.publicKey;
    if (csrParameters?.subject) {
      csr.setSubject(Object.entries(csrParameters.subject).map(([shortName, value]) => ({ shortName, value })));
    }
    if (csrParameters?.extensions?.subjectAltName) {
      const DNS_TYPE = 2;
      const IP_TYPE = 7;
      const { dns, ips } = csrParameters.extensions.subjectAltName;
      csr.setAttributes([
        {
          name: 'extensionRequest',
          extensions: [
            {
              name: 'subjectAltName',
              altNames: [
                ...(dns?.map?.((value) => ({ type: DNS_TYPE, value })) || []),
                ...(ips?.map?.((value) => ({ type: IP_TYPE, value })) || []),
              ],
            },
          ],
        },
      ]);
    }

    csr.sign(keys.privateKey, forge.md.sha256.create());

    return {
      csr: forge.pki.certificationRequestToPem(csr),
      privateKey: forge.pki.privateKeyToPem(keys.privateKey, 72),
    };
  }

  /**
   * Gets uploaded DFSP CSRs and certificates
   */
  async getCertificates() {
    return this._mcmClientDFSPCertModel.getCertificates();
  }

  /**
   * Gets uploaded DFSP CA
   */
  async getDFSPCA() {
    return this._mcmClientDFSPCertModel.getDFSPCA();
  }

  async createInternalDFSPCA(body) {
    const { cert } = await this._vault.createCA(body);
    return this.uploadDFSPCA(cert);
  }

  async createExternalDFSPCA(body) {
    const rootCertificate = body.rootCertificate || '';
    const intermediateChain = body.intermediateChain || '';
    const { privateKey } = body;
    assert(privateKey, 'Missing "privateKey" property');

    const info = await this.uploadDFSPCA(rootCertificate, intermediateChain);
    await this._vault.setDFSPCaCertChain(rootCertificate + '\n' + intermediateChain, privateKey);
    return info;
  }

  /**
   * Upload DFSP CA
   */
  async uploadDFSPCA(rootCertificate, intermediateChain) {
    return this._mcmClientDFSPCertModel.uploadDFSPCA({ rootCertificate, intermediateChain });
  }

  /**
   * Get DFSP Server Certificates
   */
  async getDFSPServerCertificates() {
    return this._mcmClientDFSPCertModel.getDFSPServerCertificates();
  }

  async uploadServerCertificates(body) {
    return this._mcmClientDFSPCertModel.uploadServerCertificates(body);
  }

  /**
   * Gets all JWS certificate
   */
  async getAllJWSCertificates() {
    return this._mcmClientDFSPCertModel.getAllJWSCertificates();
  }

  async getClientCertificate(inboundEnrollmentId) {
    return this._mcmClientDFSPCertModel.getClientCertificate({
      inboundEnrollmentId,
    });
  }

  async createDfspServerCert(params) {
    const serverCertData = await this._vault.createDFSPServerCert(params);

    const cert = {};
    if (serverCertData.ca_chain) {
      cert.intermediateChain = serverCertData.ca_chain;
    }
    if (serverCertData.issuing_ca) {
      cert.rootCertificate = serverCertData.issuing_ca;
    }
    cert.serverCertificate = serverCertData.certificate;
    const response = await this.uploadServerCertificates(cert);
    this._logger.push(response).log('uploadServerCertificates');

    await this._connectorManager.reconfigureInboundSdk(
      serverCertData.private_key,
      serverCertData.certificate,
      serverCertData.issuing_ca
    );

    return response;
  }

  async getHubCA() {
    return this._certificateModel.getHubCA();
  }

  async getOutboundTlsConfig() {
    try {
      const cert = await this._vault.getClientCert();

      if (!cert?.id) return;

      const inboundEnrollment = await this.getClientCertificate(cert.id);

      if (inboundEnrollment.state !== 'CERT_SIGNED') {
        return;
      }

      const objHubCA = await this._certificateModel.getHubCA();
      const caChain = `${objHubCA.intermediateChain || ''}\n${objHubCA.rootCertificate}`.trim();

      return {
        ca: caChain,
        cert: inboundEnrollment.certificate,
        key: cert.privateKey,
      };
    } catch (e) {
      if (!(e instanceof HTTPResponseError)) {
        throw e;
      }
    }
  }

  async exchangeOutboundSdkConfiguration() {
    const config = await this.getOutboundTlsConfig();
    if (!config || this._outboundCert === config.cert) {
      return;
    }
    await this._connectorManager.reconfigureOutboundSdk(config.ca, config.key, config.cert);
    this._outboundCert = config.cert;
  }

  async exchangeJWSConfiguration(jwsCerts) {
    let peerJWSPublicKeys = {};
    jwsCerts.forEach((jwsCert) => {
      peerJWSPublicKeys[jwsCert.dfspId] = jwsCert.publicKey;
    });
    this._logger.push({ peerJWSPublicKeys }).log('Peer JWS Public Keys');
    await this._connectorManager.reconfigureOutboundSdkForPeerJWS(JSON.stringify(peerJWSPublicKeys));
  }

  /**
   * Gets uploaded JWS certificate
   */
  async getPeerDFSPJWSCertificates() {
    return this._mcmClientDFSPCertModel.getDFSPJWSCertificates();
  }

  /**
   * Upload DFSP JWS
   */
  async uploadJWS() {
    const { publicKey } = await this.getJWSKeypair();
    return this._mcmClientDFSPCertModel.uploadJWS({ publicKey });
  }

  async storeJWS(keypair) {
    await this._vault.setJWS(keypair);
    await this._connectorManager.reconfigureOutboundSdkForJWS(keypair.privateKey);
  }

  getJWSKeypair() {
    return this._vault.getJWS();
  }

  validateJWSKeyPair(jwsKeyPair) {
    forge.pki.publicKeyFromPem(jwsKeyPair.publicKey);
    forge.pki.privateKeyFromPem(jwsKeyPair.privateKey);
  }

  /**
   * Upload DFSP JWS
   */
  async createJWS() {
    const keypair = forge.rsa.generateKeyPair({ bits: 2048 });
    const keypairPem = {
      publicKey: forge.pki.publicKeyToPem(keypair.publicKey, 72),
      privateKey: forge.pki.privateKeyToPem(keypair.privateKey, 72),
    };

    await this.storeJWS(keypairPem);
  }

  /**
   * Update DFSP JWS
   */
  async updateJWS(body) {
    return this._mcmClientDFSPCertModel.updateJWS(body);
  }

  /**
   * Delete DFSP JWS
   */
  async deleteJWS() {
    return this._mcmClientDFSPCertModel.deleteJWS();
  }
}

export default CertificatesModel;
