/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Murthy Kakarlamudi - murthy@modusbox.com                         *
 **************************************************************************/

import fs from 'fs';
import { from } from 'env-var';
import yaml from 'js-yaml';

function getFileContent(path: string) {
  if (!fs.existsSync(path)) {
    throw new Error(`File ${path} doesn't exist`);
  }
  return fs.readFileSync(path);
}

const env = from(process.env, {
  asFileContent: (path) => getFileContent(path),
  asFileListContent: (pathList) => pathList.split(',').map((path) => getFileContent(path)),
  asYamlConfig: (path) => yaml.load(getFileContent(path) as any),
  asJsonConfig: (path) => JSON.parse(getFileContent(path) as any),
  asTextFileContent: (path) => getFileContent(path).toString().trim(),
  asList: (data) => data.split(','),
});

const vaultAuthMethod = env.get('VAULT_AUTH_METHOD').required().asEnum(['K8S', 'APP_ROLE']);
const vaultAuth = {
  ...(vaultAuthMethod === 'K8S' && {
    k8s: {
      token: env
        .get('VAULT_K8S_TOKEN_FILE')
        .default('/var/run/secrets/kubernetes.io/serviceaccount/token')
        .asTextFileContent(),
      role: env.get('VAULT_K8S_ROLE').required().asString(),
    },
  }),
  ...(vaultAuthMethod === 'APP_ROLE' && {
    appRole: {
      // Generated per: https://www.vaultproject.io/docs/auth/approle#via-the-cli-1
      // Or: https://github.com/kr1sp1n/node-vault/blob/70097269d35a58bb560b5290190093def96c87b1/example/auth_approle.js
      roleId: env.get('VAULT_ROLE_ID_FILE').default('/vault/role-id').asTextFileContent(),
      roleSecretId: env.get('VAULT_ROLE_SECRET_ID_FILE').default('/vault/role-secret-id').asTextFileContent(),
    },
  }),
};

const certManagerEnabled = env.get('CERT_MANAGER_ENABLED').default('false').asBool();

const certManager = {
  enabled: certManagerEnabled,
  ...(certManagerEnabled && {
    config: {
      serverCertSecretName: env.get('CERT_MANAGER_SERVER_CERT_SECRET_NAME').required().asString(),
      serverCertSecretNamespace: env.get('CERT_MANAGER_SERVER_CERT_SECRET_NAMESPACE').required().asString(),
    },
  }),
};

const vault = {
  endpoint: env.get('VAULT_ENDPOINT').required().asString(),
  mounts: {
    pki: env.get('VAULT_MOUNT_PKI').default('pki').asString(),
    kv: env.get('VAULT_MOUNT_KV').default('secrets').asString(),
  },
  pkiServerRole: env.get('VAULT_PKI_SERVER_ROLE').required().asString(),
  pkiClientRole: env.get('VAULT_PKI_CLIENT_ROLE').required().asString(),
  auth: vaultAuth,
  signExpiryHours: env.get('VAULT_SIGN_EXPIRY_HOURS').default('43800').asString(),
  keyLength: env.get('PRIVATE_KEY_LENGTH').default(4096).asIntPositive(),
  keyAlgorithm: env.get('PRIVATE_KEY_ALGORITHM').default('rsa').asString(),
};

const authEnabled = env.get('AUTH_ENABLED').default('false').asBoolStrict();

const cfg = {
  dfspId: env.get('DFSP_ID').required().asString(),
  control: {
    port: env.get('CONTROL_LISTEN_PORT').default('4005').asPortNumber(),
  },
  inboundPort: env.get('INBOUND_LISTEN_PORT').default('9000').asPortNumber(),
  logIndent: env.get('LOG_INDENT').default('2').asIntPositive(),
  runMigrations: env.get('RUN_DB_MIGRATIONS').default('true').asBool(),

  enableCors: env.get('ENABLE_CORS').default('false').asBool(),

  enableUiApiServer: env.get('ENABLE_UI_API_SERVER').default('true').asBool(),
  disableUIApiCache: env.get('DISABLE_UI_API_CACHE').default('false').asBool(),
  cacheUrl: env.get('CACHE_URL').default('redis://redis:6379').asUrlString(),
  cacheSyncInterval: env.get('CACHE_SYNC_INTERVAL_SECONDS').default(30).asIntPositive(),
  transferRetentionHours: env.get('TRANSFER_RETENTION_HOURS').default(168).asIntPositive(), // see REDIS_CACHE_TTL env var in SDK
  pruneIntervalSeconds: env.get('TRANSFER_PRUNE_INTERVAL_SECONDS').default(300).asIntPositive(),

  hubIamProviderUrl: env.get('HUB_IAM_PROVIDER_URL').required().asString(), // with schema
  mcmServerEndpoint: env.get('MCM_SERVER_ENDPOINT').required().asString(),
  refreshIntervalSeconds: env.get('REFRESH_INTERVAL_SECONDS').default(60).asIntPositive(),
  jwsRotationIntervalMs: env
    .get('JWS_ROTATION_INTERVAL_MS')
    .default(24 * 60 * 60 * 1000)
    .asIntPositive(),
  certExpiryThresholdDays: env.get('CERT_EXPIRY_THRESHOLD_DAYS').default(7).asFloatPositive(),
  mojaloopConnectorFQDN: env.get('MOJALOOP_CONNECTOR_FQDN').default('connector.fsp.example.com').asString(),
  certManager,
  vault,
  auth: {
    enabled: authEnabled,
    ...(authEnabled && {
      creds: {
        clientId: env.get('AUTH_CLIENT_ID').required().asString(),
        clientSecret: env.get('AUTH_CLIENT_SECRET').required().asString(),
      },
      tokenRefreshMarginSeconds: env.get('AUTH_TOKEN_REFRESH_MARGIN_SECONDS').default(30).asIntPositive(),
      tokenRefreshEnabled: env.get('AUTH_TOKEN_REFRESH_ENABLED').default('true').asBool(),
    }),
  },
  dfspClientCsrParameters: env.get('DFSP_CLIENT_CSR_PARAMETERS').asJsonConfig(),
  dfspServerCsrParameters: env.get('DFSP_SERVER_CSR_PARAMETERS').asJsonConfig(),
  caCsrParameters: env.get('CA_CSR_PARAMETERS').asJsonConfig(),

  stateMachineDebugPort: env.get('STATE_MACHINE_DEBUG_PORT').default(8888).asPortNumber(),
  stateMachineInspectEnabled: env.get('STATE_MACHINE_INSPECT_ENABLED').default('false').asBool(),
  whitelistIP: env.get('WHITELIST_IP').default('').asList(),
  callbackURL: env.get('CALLBACK_URL').default('connector.fsp.example.com:443').asUrlString(),
  enableTestAPI: env.get('ENABLE_TEST_API').default('true').asBool(),
  testApiPort: env.get('TEST_API_PORT').default('9050').asPortNumber(),

  instrumentation: {
    metrics: {
      disabled: env.get('INSTRUMENTATION_METRICS_DISABLED').default('false').asBool(),
      port: env.get('INSTRUMENTATION_METRICS_PORT').default('4003').asPortNumber(),
      config: {
        timeout: env.get('INSTRUMENTATION_METRICS_CONFIG_TIMEOUT').default(5000).asIntPositive(),
        prefix: env.get('INSTRUMENTATION_METRICS_CONFIG_PREFIX').default('').asString(),
        defaultLabels: {
          serviceName: 'payment-manager-management-api-service',
        },
      },
    },
  },
};

export function getSanitizedConfig(): Partial<IConfig> {
  const sanitized = structuredClone(cfg);

  if (sanitized.auth?.creds?.clientId) sanitized.auth.creds.clientId = '[REDACTED]';
  if (sanitized.auth?.creds?.clientSecret) sanitized.auth.creds.clientSecret = '[REDACTED]';
  if (sanitized.vault?.auth?.appRole?.roleId) sanitized.vault.auth.appRole.roleId = '[REDACTED]';
  if (sanitized.vault?.auth?.appRole?.roleSecretId) sanitized.vault.auth.appRole.roleSecretId = '[REDACTED]';
  if (sanitized.vault?.auth?.k8s?.token) sanitized.vault.auth.k8s.token = '[REDACTED]';

  return sanitized;
}

export type IConfigVault = typeof vault;
export type IConfig = typeof cfg;
export default cfg;
