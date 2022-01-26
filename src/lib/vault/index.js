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
    ILP: 'ilp',
    JWS: 'jws',
    PEER_JWS: 'peer-jws',
    HUB_ENDPOINTS: 'hub-endpoints',
    DFSP_CA_CERT: 'dfsp-ca-cert',
    SERVER_CERT: 'server-cert',
    CLIENT_CERT: 'client-cert',
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
        signExpiryHours,
        logger = new Logger.Logger()
    }) {
        this._logger = logger;
        this._auth = auth;
        this._endpoint = endpoint;
        this._vault = vault({ endpoint });
        this._pkiBaseDomain = pkiBaseDomain;
        this._secretMount = mounts.kv;
        this._pkiMount = mounts.pki;
        this._signExpiryHours = signExpiryHours;
        this._reconnectTimer = null;
    }

    async connect() {
        await this._logger.log('Connecting to Vault');

        clearTimeout(this._reconnectTimer);

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

        const tokenRefreshMs = (creds.auth.lease_duration - 10) * 1000;
        this._reconnectTimer = setTimeout(this.connect.bind(this), tokenRefreshMs);

        await this._logger.push({ endpoint: this._endpoint }).log('Connected to Vault');
    }

    disconnect () {
        clearTimeout(this._reconnectTimer);
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
        return this._client.write(path, value);
    }

    async _getSecret(key) {
        const path = `${this._secretMount}/${key}`;
        try {
            const { data } = await this._client.read(path);
            return data;
        } catch (e) {
            if (e.response && e.response.statusCode === 404) {
                return null;
            }
            throw e;
        }
    }

    async _deleteSecret(key) {
        const path = `${this._secretMount}/${key}`;
        await this._client.delete(path);
    }

    async setClientCert(value) {
        return this._setSecret(vaultPaths.CLIENT_CERT, value);
    }

    async getClientCert() {
        return this._getSecret(vaultPaths.CLIENT_CERT);
    }

    async setJWS(value) {
        return this._setSecret(vaultPaths.JWS, value);
    }

    async getJWS() {
        return this._getSecret(vaultPaths.JWS);
    }

    async setPeerJWS(value) {
        return this._setSecret(vaultPaths.PEER_JWS, { list: value });
    }

    async getPeerJWS() {
        const data = await this._getSecret(vaultPaths.PEER_JWS);
        return data?.list;
    }

    async setILP(value) {
        return this._setSecret(vaultPaths.ILP, value);
    }

    async getILP() {
        return this._getSecret(vaultPaths.ILP);
    }

    /**
     * Delete root CA
     * @returns {Promise<void>}
     */
    async deleteCA () {
        await this._client.request({
            path: `/${this._pkiMount}/root`,
            method: 'DELETE',
        });
    }

    /**
     * Create root CA
     * @param {Object} caOptions
     */
    async createCA (caOptions) {
        // eslint-disable-next-line no-empty
        try { await this.deleteCA(); } catch (e) { }

        const { names } = caOptions.csr;
        const [,...altNamesObjs] = names;
        const altNames = altNamesObjs.map((name) => name.CN).join(',');
        const { data } = await this._client.request({
            path: `/${this._pkiMount}/root/generate/exported`,
            method: 'POST',
            json: {
                common_name: names[0].CN,
                alt_names: altNames,
                ou: names.map((name) => name.OU),
                organization: names.map((name) => name.O),
                locality: names.map((name) => name.L),
                country: names.map((name) => name.C),
                province: names.map((name) => name.ST),
                key_type: 'rsa',
                key_bits: '4096',
                ttl: '43800h',
            },
        });

        return {
            cert: data.certificate,
            key: data.private_key,
        };
    }

    async createDFSPServerCert (csrParameters) {
        const reqJson = {
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
        const { data } = await this._client.request({
            path: `/${this._pkiMount}/issue/${this._pkiBaseDomain}`,
            method: 'POST',
            json: reqJson,
        });
        return data;
    }

    /**
     * Sign Hub CSR
     * @param params
     * @returns {Promise<*>}
     */
    async signHubCSR(params) {
        const { data } = await this._client.request({
            path: `${this._pkiMount}/sign/${this._pkiBaseDomain}`,
            method: 'POST',
            json: {
                common_name: params.commonName,
                csr: params.csr,
                ttl: `${this._signExpiryHours}h`,
            }
        });
        return data;
    }


    async setDFSPCaCertChain (certChainPem, privateKeyPem) {
        await this._client.request({
            path: `/${this._pkiMount}/config/ca`,
            method: 'POST',
            json: {
                pem_bundle: `${privateKeyPem}\n${certChainPem}`,
            },
        });
        // Secret object documentation:
        // https://github.com/modusintegration/mojaloop-k3s-bootstrap/blob/e3578fc57a024a41023c61cd365f382027b922bd/docs/README-vault.md#vault-crd-secrets-integration
        // https://vault.koudingspawn.de/supported-secret-types/secret-type-cert
    }

    async getDFSPCaCertChain () {
        return this._client.request({
            path: `/${this._pkiMount}/ca_chain`,
            method: 'GET',
        });
    }

    async setHubEndpoints(value) {
        return this._setSecret(vaultPaths.HUB_ENDPOINTS, value);
    }

    async getHubEndpoints() {
        return this._getSecret(vaultPaths.HUB_ENDPOINTS);
    }
}

module.exports = Vault;
