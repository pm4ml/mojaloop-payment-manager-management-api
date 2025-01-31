/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha - yevhen.kyriukha@modusbox.com                   *
 **************************************************************************/
const NodeVault = require('node-vault');
import { strict as assert } from 'assert';
import SDK from '@mojaloop/sdk-standard-components';
import forge from 'node-forge';

// TODO: Use hashi-vault-js package
// TODO: find and link document containing rules on allowable paths
enum VaultPaths {
  STATE_MACHINE_STATE = 'state-machine-state',
}

enum SubjectAltNameType {
  DNS = 2,
  IP = 7,
}

export interface Subject {
  CN: string;
  OU?: string;
  O?: string;
  L?: string;
  C?: string;
  ST?: string;
}

export interface CsrParams {
  subject: Subject;
  extensions?: {
    subjectAltName?: {
      dns?: string[];
      ips?: string[];
    };
  };
}

export interface VaultAuthK8s {
  k8s?: {
    token: string;
    role: string;
  };
}

export interface VaultAuthAppRole {
  appRole?: {
    roleId: string;
    roleSecretId: string;
  };
}

export interface VaultOpts {
  endpoint: string;
  mounts: {
    pki: string;
    kv: string;
  };
  pkiServerRole: string;
  pkiClientRole: string;
  auth: VaultAuthK8s & VaultAuthAppRole;
  signExpiryHours: string;
  keyLength: number;
  keyAlgorithm: string;
  logger: SDK.Logger.Logger;
  commonName: string;
}

const MAX_TIMEOUT = Math.pow(2, 31) / 2 - 1; // https://developer.mozilla.org/en-US/docs/Web/API/setTimeout#maximum_delay_value

class Vault {
  private cfg: VaultOpts;
  private reconnectTimer?: NodeJS.Timeout;
  private client?: NodeVault.client;
  private logger: SDK.Logger.Logger;

  constructor(private opts: VaultOpts) {
    this.cfg = opts;
    this.logger = opts.logger;
  }

  async connect() {
    const { auth, endpoint } = this.cfg;
    // Safely handle logger calls
    try {
      const loggerWithContext = this.logger.push({ endpoint });
      if (typeof loggerWithContext.log === 'function') {
        loggerWithContext.log('Connecting to Vault');
      }
    } catch (err) {
      console.error('Logger error:', err);
    }

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    let creds;
    try {
      const vault = NodeVault({ endpoint });

      // Verify vault initialization
      if (!vault) {
        throw new Error('Failed to initialize Vault client');
      }

      if (auth.appRole) {
        if (typeof vault.approleLogin !== 'function') {
          throw new Error('approleLogin method not available');
        }
        creds = await vault.approleLogin({
          role_id: auth.appRole.roleId,
          secret_id: auth.appRole.roleSecretId,
        });
      } else if (auth.k8s) {
        if (typeof vault.kubernetesLogin !== 'function') {
          throw new Error('kubernetesLogin method not available');
        }
        creds = await vault.kubernetesLogin({
          role: auth.k8s.role,
          jwt: auth.k8s.token,
        });
      } else {
        throw new Error('Unsupported auth method');
      }
    } catch (error) {
      throw new Error(`Vault connection failed: ${error.message}`);
    }

    this.client = NodeVault({
      endpoint,
      token: creds.auth.client_token,
    });

    const tokenRefreshMs = Math.min((creds.auth.lease_duration - 10) * 1000, MAX_TIMEOUT);
    this.reconnectTimer = setTimeout(this.connect.bind(this), tokenRefreshMs);

    this.logger.log(`Connected to Vault  [reconnect after: ${tokenRefreshMs} ms]`);
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }

  mountAll() {
    assert(this.client);
    return Promise.all([
      this.client.mount({ type: 'pki', prefix: `${this.cfg.mounts.pki}` }),
      this.client.mount({ type: 'kv', prefix: `${this.cfg.mounts.kv}` }),
    ]);
  }

  async createPkiRoles() {
    // return this._client.request({
    //     path: `${this.cfg.mounts.pki}/roles/${this._pkiBaseDomain}`,
    //     method: 'POST',
    //     json: {
    //         allow_any_name: true,
    //     }
    // });
  }

  _setSecret(key: string, value: any) {
    assert(this.client);
    assert(key !== null && key !== undefined, `Cannot set key: [${key}]`);
    const path = `${this.cfg.mounts.kv}/${key}`;
    return this.client.write(path, value);
  }

  async _getSecret(key: string) {
    assert(this.client);
    const path = `${this.cfg.mounts.kv}/${key}`;
    try {
      const { data } = await this.client.read(path);
      return data;
    } catch (e: any) {
      if (e?.response?.statusCode === 404) {
        return;
      }
      throw e;
    }
  }

  async _deleteSecret(key: string) {
    assert(this.client);
    const path = `${this.cfg.mounts.kv}/${key}`;
    await this.client.delete(path);
  }

  async setStateMachineState(value: any) {
    return this._setSecret(VaultPaths.STATE_MACHINE_STATE, value);
  }

  async getStateMachineState() {
    return this._getSecret(VaultPaths.STATE_MACHINE_STATE);
  }

  /**
   * Delete root CA
   * @returns {Promise<void>}
   */
  async deleteCA() {
    assert(this.client);
    await this.client.request({
      path: `/${this.cfg.mounts.pki}/root`,
      method: 'DELETE',
    });
  }

  /**
   * Create root CA
   */
  async createCA(subject: Subject) {
    // eslint-disable-next-line no-empty
    try {
      await this.deleteCA();
    } catch (e) {}
    assert(this.client);
    const { data } = await this.client.request({
      path: `/${this.cfg.mounts.pki}/root/generate/exported`,
      method: 'POST',
      json: {
        common_name: subject.CN,
        ou: subject.OU,
        organization: subject.O,
        locality: subject.L,
        country: subject.C,
        province: subject.ST,
        key_type: this.cfg.keyAlgorithm,
        key_bits: this.cfg.keyLength,
      },
    });

    return {
      cert: data.certificate,
      key: data.private_key,
    };
  }

  async getCA() {
    assert(this.client);
    return this.client.request({
      path: `/${this.cfg.mounts.pki}/ca/pem`,
      method: 'GET',
    });
  }

  async createDFSPServerCert(csrParameters: CsrParams) {
    const reqJson: Record<string, any> = {
      common_name: csrParameters.subject.CN,
    };
    if (csrParameters?.extensions?.subjectAltName) {
      const { dns, ips } = csrParameters.extensions.subjectAltName;
      if (dns) {
        reqJson.alt_names = dns.join(',');
      }
      if (ips) {
        reqJson.ip_sans = ips.join(',');
      }
    }
    assert(this.client);

    const options = {
      path: `/${this.cfg.mounts.pki}/issue/${this.cfg.pkiServerRole}`,
      method: 'POST',
      json: reqJson,
    };
    this.logger.push({ options }).log(`sending createDFSPServerCert request`);

    const { data } = await this.client.request(options);
    return {
      intermediateChain: data.ca_chain,
      rootCertificate: data.issuing_ca,
      serverCertificate: data.certificate,
      privateKey: data.private_key,
    };
  }

  /**
   * Sign Hub CSR
   */
  async signHubCSR(csr: string) {
    assert(this.client);

    const options = {
      path: `/${this.cfg.mounts.pki}/sign/${this.cfg.pkiClientRole}`,
      method: 'POST',
      json: {
        common_name: this.cfg.commonName,
        csr: csr,
        // ttl: `${this._signExpiryHours}h`,
      },
    };
    this.logger.push({ options }).log(`sending signHubCSR request`);

    const { data } = await this.client.request(options);

    return data;
  }

  async setDFSPCaCertChain(certChainPem: string, privateKeyPem: string) {
    assert(this.client);
    await this.client.request({
      path: `/${this.cfg.mounts.pki}/config/ca`,
      method: 'POST',
      json: {
        pem_bundle: `${privateKeyPem}\n${certChainPem}`,
      },
    });
    // Secret object documentation:
    // https://github.com/modusintegration/mojaloop-k3s-bootstrap/blob/e3578fc57a024a41023c61cd365f382027b922bd/docs/README-vault.md#vault-crd-secrets-integration
    // https://vault.koudingspawn.de/supported-secret-types/secret-type-cert
  }

  async getDFSPCaCertChain() {
    assert(this.client);
    return this.client.request({
      path: `/${this.cfg.mounts.pki}/ca_chain`,
      method: 'GET',
    });
  }

  certIsValid(certPem, date = Date.now()) {
    const cert = forge.pki.certificateFromPem(certPem);
    return cert.validity.notBefore.getTime() > date && date < cert.validity.notAfter.getTime();
  }

  createCSR(csrParameters?: CsrParams) {
    const keys = forge.pki.rsa.generateKeyPair(this.cfg.keyLength);
    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = keys.publicKey;
    if (csrParameters?.subject) {
      csr.setSubject(Object.entries(csrParameters.subject).map(([shortName, value]) => ({ shortName, value })));
    }
    if (csrParameters?.extensions?.subjectAltName) {
      const { dns, ips } = csrParameters.extensions.subjectAltName;
      csr.setExtensions([
        {
          name: 'subjectAltName',
          altNames: [
            ...(dns?.map?.((value) => ({ type: SubjectAltNameType.DNS, value })) || []),
            ...(ips?.map?.((value) => ({ type: SubjectAltNameType.IP, value })) || []),
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

  createJWS() {
    const keypair = forge.pki.rsa.generateKeyPair({ bits: this.cfg.keyLength });
    return {
      publicKey: forge.pki.publicKeyToPem(keypair.publicKey, 72),
      privateKey: forge.pki.privateKeyToPem(keypair.privateKey, 72),
      createdAt: Math.floor(Date.now() / 1000),
    };
  }
}

module.exports = Vault;
