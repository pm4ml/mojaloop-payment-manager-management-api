/**************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 **************************************************************************/

import { IConfig } from '@app/config';

export default {
  dfspId: 'test5',
  control: {
    port: 4005,
  },
  inboundPort: 9000,
  logIndent: 2,
  runMigrations: true,
  cacheUrl: 'redis://localhost:7005',
  cacheSyncInterval: 10,
  mcmServerEndpoint: 'localhost:3001/api',
  refreshIntervalSeconds: 60,
  mojaloopConnectorFQDN: 'connector.fsp.example.com',
  certManager: {
    enabled: false,
  },
  vault: {
    endpoint: 'http://127.0.0.1:8233',
    mounts: {
      pki: 'pki',
      kv: 'secrets',
    },
    pkiServerRole: 'example.com',
    pkiClientRole: 'example.com',
    auth: {
      appRole: {
        roleId: '348c874d-22a6-7d34-94a9-201802093dd4',
        roleSecretId: '1029d634-64f3-c943-1558-34ad681b0f3d',
      },
    },
    signExpiryHours: '43800',
    keyLength: 4096,
    keyAlgorithm: 'rsa',
  },
  auth: {
    enabled: true,
    creds: {
      clientId: 'clientId',
      clientSecret: 'clientSecret',
    },
  },
  stateMachineDebugPort: 8888,
} as IConfig;
