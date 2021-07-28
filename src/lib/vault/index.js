/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha - yevhen.kyriukha@modusbox.com                   *
 **************************************************************************/

const assert = require('assert').strict;
// TODO: Use hashi-vault-js package
const vault = require('node-vault');
const { Logger } = require('@mojaloop/sdk-standard-components');

// TODO: find and link document containing rules on allowable paths
const vaultPaths = {
    JWS_CERTS: 'jws-certs',
    HUB_ENDPOINTS: 'hub-endpoints',
    DFSP_CA_CERT: 'dfsp-ca-cert',
    SERVER_CERT: 'server-cert',
    CLIENT_PKEY: 'client-pkey',
    SERVER_PKEY: 'server-pkey',
};

class Vault {
    /**
     *
     * @param opts {object}
     * @param opts.endpoint {string}
     * @param opts.mounts {object}
     * @param opts.auth {object}
     * @param opts.logger {Logger}
     */
    constructor({
        endpoint,
        mounts,
        auth,
        pkiBaseDomain,
        logger = new Logger.Logger()
    }) {
        this._logger = logger;
        this._auth = auth;
        this._endpoint = endpoint;
        this._vault = vault({ endpoint });
        this._pkiBaseDomain = pkiBaseDomain;
        this._secretMount = mounts.kv;
        this._pkiMount = mounts.pki;
    }

    async connect() {
        await this._logger.log('Connecting to Vault');

        let creds;

        if (this._auth.appRole) {
            creds = await this._vault.approleLogin({
                role_id: this._auth.appRole.roleId,
                secret_id: this._auth.appRole.roleSecretId
            });
        } else if (this._auth.k8s) {
            creds = await this._vault.kubernetesLogin({
                role: this._auth.k8s.role,
                jwt: this._auth.k8s.token,
            });
        } else {
            throw new Error('Unsupported auth method');
        }
        this._client = vault({
            endpoint: this._endpoint,
            token: creds.auth.client_token,
        });

        await this._logger.push({ endpoint: this._endpoint }).log('Connected to Vault');
    }

    mountAll() {
        return Promise.all([
            this._client.mount({ type: 'pki', prefix: `${this._pkiMount}` }),
            this._client.mount({ type: 'kv', prefix: `${this._secretMount}` }),
        ]);
    }

    async createPkiRoles() {
        return this._client.request({
            path: `${this._pkiMount}/roles/${this._pkiBaseDomain}`,
            method: 'POST',
            json: {
                allow_any_name: true,
            }
        });
    }

    _setSecret(key, value) {
        assert(key !== null && key !== undefined, `Cannot set key: [${key}]`);
        const path = `${this._secretMount}/${key}`;
        return this._client.write(path, { value });
    }

    async _getSecret(key) {
        const path = `${this._secretMount}/${key}`;
        const { data: { value } } = await this._client.read(path);
        return value;
    }

    async _deleteSecret(key) {
        const path = `${this._secretMount}/${key}`;
        const { data } = await this._client.delete(path);
        return data;
    }

    async setClientPrivateKey(value) {
        return this._setSecret(vaultPaths.CLIENT_PKEY, value);
    }

    async getClientPrivateKey() {
        return this._getSecret(vaultPaths.CLIENT_PKEY);
    }

    async setServerPrivateKey(value) {
        return this._setSecret(vaultPaths.SERVER_PKEY, value);
    }

    async getServerPrivateKey() {
        return this._getSecret(vaultPaths.SERVER_PKEY);
    }

    async setJWSCerts(value) {
        return this._setSecret(vaultPaths.JWS_CERTS, value);
    }

    async getJWSCerts() {
        return this._getSecret(vaultPaths.JWS_CERTS);
    }

    /**
     * co
     * @param params
     * @returns {Promise<any>}
     */
    async createCSR(params) {
        const { parameters } = params;
        const { data } = await this._client.request({
            path: `${this._pkiMount}/intermediate/generate/exported`,
            method: 'POST',
            json: {
                alt_names: parameters.extensions.subjectAltName.dns.join(','),
                ip_sans: parameters.extensions.subjectAltName.ips.join(','),
                common_name: parameters.subject.CN,
                key_type: params.privateKeyAlgorithm,
                key_bits: params.privateKeyLength,
            }
        });
        return data;
    }

    async signCSR(params) {
        const { data } = await this._client.request({
            path: `${this._pkiMount}/root/sign-intermediate`,
            method: 'POST',
            json: {
                use_csr_values: true,
                common_name: params.commonName,
                csr: params.csr,
            }
        });
        return data;
    }

    /**
     * Sign Hub CSR
     * @param params
     * @returns {Promise<*>}
     */
    async signServerCSR(params) {
        const { data } = await this._client.request({
            path: `${this._pkiMount}/sign/${this._pkiBaseDomain}`,
            method: 'POST',
            json: {
                common_name: params.commonName,
                csr: params.csr,
            }
        });
        return data;
    }

    async setDfspCaCert(certPem, privateKeyPem) {
        await this._client.request({
            path: `${this._pkiMount}/config/ca`,
            method: 'POST',
            json: {
                pem_bundle: `${privateKeyPem}\n${certPem}`,
            }
        });

        // Secret object documentation:
        // https://github.com/modusintegration/mojaloop-k3s-bootstrap/blob/e3578fc57a024a41023c61cd365f382027b922bd/docs/README-vault.md#vault-crd-secrets-integration
        // https://vault.koudingspawn.de/supported-secret-types/secret-type-cert
    }

    async getDfspCaCert() {
        return this._client.request({
            path: `${this._pkiMount}/ca/pem`,
            method: 'GET',
        });
    }

    async setDfspServerCert(certPem) {
        await this._client.request({
            path: `${this._pkiMount}/intermediate/set-signed`,
            method: 'POST',
            json: {
                certificate: certPem,
            }
        });
    }

    async getDfspServerCert() {
        return this._getSecret(vaultPaths.SERVER_CERT);
    }

    async setHubEndpoints(value) {
        return this._setSecret(vaultPaths.HUB_ENDPOINTS, value);
    }

    async getHubEndpoints() {
        return this._getSecret(vaultPaths.HUB_ENDPOINTS);
    }
}

module.exports = Vault;
