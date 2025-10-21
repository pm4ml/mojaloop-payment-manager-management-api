/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Murthy Kakarlamudi - murthy@modusbox.com                             *
 **************************************************************************/

import process from 'node:process';
import {
  AuthModel,
  DFSPCertificateModel,
  DFSPEndpointModel,
  HubCertificateModel,
  HubEndpointModel,
  Vault,
  ConnectionStateMachine,
  ControlServer,
} from '@pm4ml/mcm-client';

import config, { getSanitizedConfig } from './config';
import TestServer from './TestServer';
import UIAPIServer from './UIAPIServer';
import CertManager from './lib/model/CertManager';
import { createMetricsServer, MetricsServer } from './lib/metrics';
import { createMemoryCache } from './lib/cacheDatabase';
import { logger } from './lib/logger';

const LOG_ID = {
  CONTROL: { app: 'mojaloop-payment-manager-management-api-service-control-server' },
  CACHE: { component: 'cache' },
};

const createControlServer = async ({ vault, certManager }) => {
  const opts = {
    dfspId: config.dfspId,
    hubEndpoint: config.mcmServerEndpoint,
    logger,
  };

  const stateMachine = new ConnectionStateMachine({
    ...config, // todo: clarify, which configs we need to pass here
    config,
    port: config.stateMachineDebugPort,
    dfspCertificateModel: new DFSPCertificateModel(opts),
    hubCertificateModel: new HubCertificateModel(opts),
    hubEndpointModel: new HubEndpointModel(opts),
    dfspEndpointModel: new DFSPEndpointModel(opts),
    logger,
    vault,
    certManager,
    ControlServer,
  });
  await stateMachine.start();

  const controlServer = new ControlServer.Server({
    port: config.control.port,
    logger: logger.push(LOG_ID.CONTROL),
    onRequestConfig: () => stateMachine.sendEvent({ type: 'REQUEST_CONNECTOR_CONFIG' }),
    onRequestPeerJWS: () => stateMachine.sendEvent({ type: 'REQUEST_PEER_JWS' }),
    onUploadPeerJWS: (peerJWS: any) => stateMachine.sendEvent({ type: 'UPLOAD_PEER_JWS', data: peerJWS }),
  });
  controlServer.registerInternalEvents();

  return { controlServer, stateMachine };
};

(async () => {
  // Log config with sensitive fields removed
  logger.verbose('sanitized config: ', { config: getSanitizedConfig() });

  const authModel = new AuthModel({
    logger,
    auth: config.auth,
    hubIamProviderUrl: config.hubIamProviderUrl,
  });

  try {
    await authModel.login();
  } catch (error) {
    logger.info('authModel.login() failed');
    // error is logged in the authModel.login() method
  }

  const vault = new Vault({
    ...config.vault,
    commonName: config.mojaloopConnectorFQDN,
    logger,
  });
  await vault.connect();

  let certManager;
  if (config.certManager.enabled) {
    certManager = new CertManager({
      ...config.certManager.config!,
      logger,
    });
  }

  const { controlServer, stateMachine } = await createControlServer({ vault, certManager });

  let uiApiServer: UIAPIServer;
  if (config.enableUiApiServer) {
    let db;
    if (!config.disableUIApiCache) {
      db = await createMemoryCache({
        cacheUrl: config.cacheUrl,
        syncInterval: config.cacheSyncInterval,
        logger,
      });
    }

    uiApiServer = await UIAPIServer.create({
      config,
      vault,
      db,
      stateMachine,
      port: config.inboundPort,
      controlServer,
    });
    await uiApiServer.start();
  }

  let testServer: TestServer;
  if (config.enableTestAPI) {
    testServer = await TestServer.create({
      config,
      stateMachine,
      port: config.testApiPort,
    });
    await testServer.start();
  }

  let metricsServer: MetricsServer;
  if (!config.instrumentation.metrics.disabled) {
    metricsServer = createMetricsServer({ ...config.instrumentation.metrics, logger });
    await metricsServer.start();
  }

  // handle signals to exit gracefully
  ['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`${signal} received. Shutting down APIs...`);

      // eslint-disable-next-line
      await Promise.all([
        controlServer.stop(),
        uiApiServer?.stop(),
        testServer?.stop(),
        metricsServer?.stop()
      ]);
      vault.disconnect();

      process.exit(0);
    });
  });
})();
