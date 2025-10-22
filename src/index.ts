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
import { AuthModel, Vault } from '@pm4ml/mcm-client';

import config, { getSanitizedConfig } from './config';
import TestServer from './TestServer';
import UIAPIServer from './UIAPIServer';
import { createStateMachine } from './lib/stateMachine';
import { createControlServer } from './lib/controlServer';
import { createMetricsServer, MetricsServer } from './lib/metrics';
import { createMemoryCache } from './lib/cacheDatabase';
import { logger } from './lib/logger';

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

  const stateMachine = createStateMachine({ config, logger, vault });
  await stateMachine.start();

  const controlServer = await createControlServer({ config, logger, stateMachine });

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
