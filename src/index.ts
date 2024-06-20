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
  HubCertificateModel, // with getHubJWSCertificate() method
  HubEndpointModel,
} from '@pm4ml/mcm-client';
import * as ControlServer from './ControlServer';
import { createMemoryCache } from '@app/lib/cacheDatabase';
import CertManager from './lib/model/CertManager';
import TestServer from '@app/TestServer';

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

  const controlServer = new ControlServer.Server({
    port: config.control.port,
    logger: logger.push(LOG_ID.CONTROL),
    onRequestConfig: () => stateMachine.sendEvent({ type: 'REQUEST_CONNECTOR_CONFIG' }),
  });
  controlServer.registerInternalEvents();

  let uiApiServer: UIAPIServer;
  if (config.enableUiApiServer) {
    const db = await createMemoryCache({
      cacheUrl: config.cacheUrl,
      syncInterval: config.cacheSyncInterval,
      logger,
    });

    uiApiServer = await UIAPIServer.create({ config, vault, db, stateMachine, port: config.inboundPort });
    await uiApiServer.start();
  }

  let testServer: TestServer;
  if (config.enableTestAPI) {
    testServer = await TestServer.create({ config, stateMachine, port: config.testApiPort });
    await testServer.start();
  }

  // handle signals to exit gracefully
  ['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`${signal} received. Shutting down APIs...`);

      // eslint-disable-next-line
      await Promise.all([
        controlServer.stop(),
        uiApiServer?.stop(),
        testServer?.stop()
      ]);
      vault.disconnect();

      process.exit(0);
    });
  });
})();
