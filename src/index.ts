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

import Vault from '@internal/vault';
import { Logger } from '@mojaloop/sdk-standard-components';
import ControlServer from './ControlServer';
import UIAPIServer from './UIAPIServer';
import initDatabase from '@app/database';
import { hostname } from 'os';
import config, { IConfig } from '@app/config';
import { interpret } from 'xstate';
import ConnectionStateMachine from '@app/lib/model/stateMachine/ConnectionStateMachine';
import { DFSPCertificateModel, HubCertificateModel, HubEndpointModel } from '@pm4ml/mcm-client';
import CertificatesModel from '@app/lib/model/CertificatesModel';

const LOG_ID = {
  CONTROL: { app: 'mojaloop-payment-manager-management-api-service-control-server' },
  CACHE: { component: 'cache' },
};

/**
 * Class that creates and manages http servers that expose the scheme adapter APIs.
 */
class Server {
  private controlServer?: ControlServer.Server;
  constructor(
    private conf: IConfig,
    private logger: Logger.Logger,
    private vault: Vault) {
    this.conf = conf;
    this.uiApiServer = new UIAPIServer(this.conf, vault);
    this.controlServer = null;
  }

  async start() {
    // Start up the control server (websocket server) for communicating with connectors.
    // We register this instance to receive events from internal modules.
    // Internal communication with this server is facilitated by its event emitter.
    // @see `ConnectorManager.getInternalEventEmitter()`
    this.controlServer = new ControlServer.Server({
      appConfig: this.conf,
      logger: this.logger.push(LOG_ID.CONTROL),
      vault: this.vault,
    });
    this.controlServer.registerInternalEvents();
    await Promise.all([this._startUIAPIServer()]);
  }

  async _startUIAPIServer() {
    await this.uiApiServer.setupApi();
    await this.uiApiServer.start();
  }

  stop() {
    return Promise.all([this.uiApiServer.stop(), this.controlServer.stop()]);
  }
}

if (require.main === module) {
  (async () => {
    // this module is main i.e. we were started as a server;
    // not used in unit test or "require" scenarios
    const logger = new Logger.Logger({
      context: {
        // If we're running from a Mojaloop helm chart deployment, we'll have a SIM_NAME
        simulator: process.env.SIM_NAME,
        hostname: hostname(),
      },
      stringify: Logger.buildStringify({ space: config.logIndent }),
    });

    const db = await initDatabase(config.database);

    const vault = new Vault({
      ...config.vault,
      logger,
    });
    await vault.connect();

    const opts = {
      logger,
      ...config,
    };
    const ctx = {
      dfspCertificateModel: new DFSPCertificateModel(opts),
      hubCertificateModel: new HubCertificateModel(opts),
      hubEndpointModel: new HubEndpointModel(opts),
      certificatesModel: new CertificatesModel(opts),
    };

    const stateMachine = new ConnectionStateMachine();

    const svr = new Server(config, logger, vault);

    // handle SIGTERM to exit gracefully
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received. Shutting down APIs...');

      await svr.stop();
      vault.disconnect();
      process.exit(0);
    });

    svr.start().catch((err) => {
      console.log(err);
      vault.disconnect();
      process.exit(1);
    });
  })();
}

// export things we want to expose e.g. for unit tests and users who dont want to use the entire
// scheme adapter as a service
module.exports = {
  Server: Server,
};
