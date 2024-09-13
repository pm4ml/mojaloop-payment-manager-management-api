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
import { hostname } from 'node:os';
import { Logger } from '@mojaloop/sdk-standard-components';
import {
  AuthModel,
  DFSPCertificateModel,
  DFSPEndpointModel,
  HubCertificateModel, // with getHubJWSCertificate() method
  HubEndpointModel,
} from '@pm4ml/mcm-client';

import Vault from './lib/vault';
import config from './config';
import { ConnectionStateMachine } from './lib/model';
import { createMemoryCache } from './lib/cacheDatabase';
import TestServer from './TestServer';
import * as ControlServer from './ControlServer';
import UIAPIServer from './UIAPIServer';
import CertManager from './lib/model/CertManager';
import { createMetricsServer, MetricsServer } from './lib/metrics';

const LOG_ID = {
  CONTROL: { app: 'mojaloop-payment-manager-management-api-service-control-server' },
  CACHE: { component: 'cache' },
};

(async () => {
  const logger = new Logger.Logger({
    ctx: {
      // If we're running from a Mojaloop helm chart deployment, we'll have a SIM_NAME
      simulator: process.env.SIM_NAME,
      hostname: hostname(),
    },
    stringify: Logger.buildStringify({ space: config.logIndent }) as Logger.Stringify,
  });

  logger.push({ config: JSON.stringify(config) }).info('config');

  const authModel = new AuthModel({
    logger,
    auth: config.auth,
    hubIamProviderUrl: config.hubIamProviderUrl,
  });

  try {
    await authModel.login();
  } catch (error) {
    // error is logged in the authModel.login() method
  }

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

  const controlServer = new ControlServer.Server({
    port: config.control.port,
    logger: logger.push(LOG_ID.CONTROL),
    onRequestConfig: () => stateMachine.sendEvent({ type: 'REQUEST_CONNECTOR_CONFIG' }),
    onRequestPeerJWS: () => stateMachine.sendEvent({ type: 'REQUEST_PEER_JWS' }),
    onUploadPeerJWS: (peerJWS: any) => stateMachine.sendEvent({ type: 'UPLOAD_PEER_JWS', data: peerJWS }),
  });
  controlServer.registerInternalEvents();

  let uiApiServer: UIAPIServer;
  if (config.enableUiApiServer) {
    const db = await createMemoryCache({
      cacheUrl: config.cacheUrl,
      syncInterval: config.cacheSyncInterval,
      logger,
    });

    uiApiServer = await UIAPIServer.create({
      config,
      vault,
      db,
      stateMachine,
      port: config.inboundPort,
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
