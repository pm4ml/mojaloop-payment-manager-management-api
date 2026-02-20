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
import { AuthModel, Vault } from '@mojaloop/mcm-client';

import { name, version } from '../package.json';
import config, { getSanitizedConfig } from './config';
import TestServer from './TestServer';
import UIAPIServer from './UIAPIServer';
import { createStateMachine } from './lib/stateMachine';
import { createControlServer } from './lib/controlServer';
import { createMetricsServer, MetricsServer } from './lib/metrics';
import { CacheDatabase, createMemoryCache } from './lib/cacheDatabase';
import { logger } from './lib/logger';

const start = async () => {
  const startTime = Date.now();
  // Log config with sensitive fields removed
  logger.verbose('sanitized config: ', { config: getSanitizedConfig() });

  const authModel = new AuthModel({
    logger,
    auth: config.auth,
    hubIamProviderUrl: config.hubIamProviderUrl,
  });

  try {
    await authModel.login();
  } catch (err) {
    logger.info('authModel.login() failed: ', err);
  }

  const vault = new Vault({
    ...config.vault,
    commonName: config.mojaloopConnectorFQDN,
    logger,
  });
  await vault.connect();

  const stateMachine = createStateMachine({ config, logger, vault });
  await stateMachine.start();
  logger.verbose('stateMachine started');

  const controlServer = createControlServer({ config, logger, stateMachine });

  let uiApiServer: UIAPIServer;
  let cache: CacheDatabase | undefined;

  if (config.enableUiApiServer) {
    if (!config.disableUIApiCache) {
      cache = await createMemoryCache({
        cacheUrl: config.cacheUrl,
        syncInterval: config.cacheSyncInterval,
        logger,
      });
    }

    uiApiServer = await UIAPIServer.create({
      config,
      port: config.inboundPort,
      vault,
      cache,
      stateMachine,
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
      logger.info(`signal received [${signal}], shutting down APIs...`);

      // eslint-disable-next-line
      await Promise.all([
        controlServer.stop(),
        uiApiServer?.stop(),
        testServer?.stop(),
        metricsServer?.stop()
      ]);
      await cache?.destroy();
      vault.disconnect();

      logger.info(`exiting the process...`);
      process.exit(0);
    });
  });

  logger.info(`service is started  [${name}@${version},  duration.s: ${(Date.now() - startTime) / 1000}]`);
};

start().catch((err) => {
  logger.error('failed to start the service: ', err);
  process.exit(1);
});
