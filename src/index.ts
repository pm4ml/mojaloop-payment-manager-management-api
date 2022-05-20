/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Murthy Kakarlamudi - murthy@modusbox.com                             *
 **************************************************************************/

import 'tsconfig-paths/register';

import Vault from '@app/lib/vault';
import { Logger } from '@mojaloop/sdk-standard-components';
import UIAPIServer from './UIAPIServer';
import { hostname } from 'os';
import config from '@app/config';
import { ConnectionStateMachine } from '@app/lib/model';
import {
  AuthModel,
  DFSPCertificateModel,
  DFSPEndpointModel,
  HubCertificateModel,
  HubEndpointModel,
} from '@pm4ml/mcm-client';
import * as ControlServer from './ControlServer';
import { createMemoryCache } from '@app/lib/cacheDatabase';
import CertManager from './lib/model/CertManager';

const LOG_ID = {
  CONTROL: { app: 'mojaloop-payment-manager-management-api-service-control-server' },
  CACHE: { component: 'cache' },
};

(async () => {
  const logger = new Logger.Logger({
    context: {
      // If we're running from a Mojaloop helm chart deployment, we'll have a SIM_NAME
      simulator: process.env.SIM_NAME,
      hostname: hostname(),
    },
    stringify: Logger.buildStringify({ space: config.logIndent }),
  });

  console.log(JSON.stringify(config));

  const authModel = new AuthModel({
    logger,
    auth: config.auth,
    hubEndpoint: config.mcmServerEndpoint,
  });
  await authModel.login();

  const vault = new Vault({
    ...config.vault,
    commonName: config.mojaloopConnectorFQDN,
    logger,
  });
  await vault.connect();

  const opts = {
    dfspId: config.dfspId,
    hubEndpoint: config.mcmServerEndpoint,
    logger,
  };
  const ctx = {
    dfspCertificateModel: new DFSPCertificateModel(opts),
    hubCertificateModel: new HubCertificateModel(opts),
    hubEndpointModel: new HubEndpointModel(opts),
    dfspEndpointModel: new DFSPEndpointModel(opts),
  };

  let certManager;
  if (config.certManager.enabled) {
    certManager = new CertManager({
      ...config.certManager.config!,
      logger,
    });
  }

  const stateMachine = new ConnectionStateMachine({
    ...config,
    config,
    port: config.stateMachineDebugPort,
    ...ctx,
    logger,
    vault,
    certManager,
    ControlServer,
  });
  await stateMachine.start();

  const db = await createMemoryCache({
    cacheUrl: config.cacheUrl,
    syncInterval: config.cacheSyncInterval,
    logger,
  });

  const controlServer = new ControlServer.Server({
    port: config.control.port,
    logger: logger.push(LOG_ID.CONTROL),
    onRequestConfig: () => stateMachine.sendEvent({ type: 'REQUEST_CONNECTOR_CONFIG' }),
  });
  controlServer.registerInternalEvents();

  const uiApiServer = new UIAPIServer(config, vault, db);
  await uiApiServer.setupApi();
  await uiApiServer.start();

  // handle SIGTERM to exit gracefully
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Shutting down APIs...');

    await Promise.all([uiApiServer.stop(), controlServer.stop()]);
    vault.disconnect();
    process.exit(0);
  });
})();
