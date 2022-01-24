/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Murthy Kakarlamudi - murthy@modusbox.com                         *
 **************************************************************************/
'use strict';

const fs = require('fs');
require('dotenv').config();
const { from } = require('env-var');
const yaml = require('js-yaml');

function getFileContent(path) {
    if (!fs.existsSync(path)) {
        throw new Error(`File ${path} doesn't exist`);
    }
    return fs.readFileSync(path);
}

const env = from(process.env, {
    asFileContent: (path) => getFileContent(path),
    asFileListContent: (pathList) => pathList.split(',').map((path) => getFileContent(path)),
    asYamlConfig: (path) => yaml.load(getFileContent(path)),
    asJsonConfig: (path) => JSON.parse(getFileContent(path)),
    asTextFileContent: (path) => getFileContent(path).toString().trim(),
});

const vaultAuthMethod = env.get('VAULT_AUTH_METHOD').required().asEnum(['K8S', 'APP_ROLE']);
let vaultAuth;
if (vaultAuthMethod === 'K8S') {
    vaultAuth = {
        k8s: {
            token: env.get('VAULT_K8S_TOKEN_FILE').default('/var/run/secrets/kubernetes.io/serviceaccount/token').asTextFileContent(),
            role: env.get('VAULT_K8S_ROLE').required().asString(),
        },
    };
} else if (vaultAuthMethod === 'APP_ROLE') {
    vaultAuth = {
        appRole: {
            // Generated per: https://www.vaultproject.io/docs/auth/approle#via-the-cli-1
            // Or: https://github.com/kr1sp1n/node-vault/blob/70097269d35a58bb560b5290190093def96c87b1/example/auth_approle.js
            roleId: env.get('VAULT_ROLE_ID_FILE').default('/vault/role-id').asTextFileContent(),
            roleSecretId: env.get('VAULT_ROLE_SECRET_ID_FILE').default('/vault/role-secret-id').asTextFileContent(),
        },
    };
}

module.exports = {
    dfspId: env.get('DFSP_ID').required().asString(),
    control: {
        port: env.get('CONTROL_LISTEN_PORT').default('4005').asPortNumber(),
    },
    inboundPort: env.get('INBOUND_LISTEN_PORT').default('9000').asPortNumber(),
    logIndent: env.get('LOG_INDENT').default('2').asIntPositive(),
    runMigrations: env.get('RUN_DB_MIGRATIONS').default('true').asBool(),

    cacheUrl: env.get('CACHE_URL').default('redis://redis:6379').asUrlString(),
    cacheSyncInterval: env.get('CACHE_SYNC_INTERVAL_SECONDS').default(30).asIntPositive(),

    mcmServerEndpoint: env.get('MCM_SERVER_ENDPOINT').required().asString(),
    mcmClientRefreshIntervalSeconds: env.get('MCM_CLIENT_REFRESH_INTERVAL_SECONDS').default(60).asIntPositive(),
    vault: {
        endpoint: env.get('VAULT_ENDPOINT').required().asString(),
        mounts: {
            pki: env.get('VAULT_MOUNT_PKI').default('pki').asString(),
            kv: env.get('VAULT_MOUNT_KV').default('secrets').asString(),
        },
        pkiBaseDomain: env.get('VAULT_PKI_BASE_DOMAIN').required().asString(),
        auth: vaultAuth,
        signExpiryHours: env.get('VAULT_SIGN_EXPIRY_HOURS').default('43800').asString(),
    },
    auth: {
        enabled:  env.get('AUTH_ENABLED').asBoolStrict(),
        creds: {
            user: env.get('AUTH_USER').asString(),
            pass: env.get('AUTH_PASS').asString(),
        }
    },
    privateKeyLength: env.get('PRIVATE_KEY_LENGTH').default(4096).asIntPositive(),
    privateKeyAlgorithm: env.get('PRIVATE_KEY_ALGORITHM').default('rsa').asString(),
    dfspClientCsrParameters: env.get('DFSP_CLIENT_CSR_PARAMETERS').asJsonConfig(),
    dfspServerCsrParameters: env.get('DFSP_SERVER_CSR_PARAMETERS').asJsonConfig(),
};
