/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha - yevhen.kyriukha@modusbox.com                   *
 **************************************************************************/

const vault = require('node-vault');
const Storage = require('./Storage');

class Vault extends Storage {

    /**
     * @param opts {object}
     * @param opts.endpoint {string}
     * @param opts.token {string}
     * @param opts.roleId {string}
     */
    constructor(opts) {
        super(opts);
        this._vault = vault({
            apiVersion: 'v1',
            endpoint: opts.endpoint,
            token: opts.token,
        });
        this._roleId = opts.roleId;
    }

    async connect() {
        const result = await this._vault.unwrap();
        const secretId = result.data.secret_id;
        // login with approleLogin
        const loginResult = this._vault.approleLogin({ role_id: this._roleId, secret_id: secretId });
        const client_token = loginResult.auth.client_token;
        console.log(`Using client token to login ${client_token}`);
        const client_options = {
            apiVersion: 'v1', // default
            endpoint: 'http://127.0.0.1:8200',
            token: client_token //client token
        };

        this._clientVault = vault(client_options);
    }

    disconnect() {

    }

    getSecret(key) {
        return this._clientVault.read(`secret/mcm-client/${key}`);
    }

    setSecret(key, value) {
        return this._clientVault.write(`secret/mcm-client/${key}`, value);
    }

    deleteSecret(key) {
        return this._clientVault.delete(`secret/mcm-client/${key}`);
    }
}

module.exports = Vault;
