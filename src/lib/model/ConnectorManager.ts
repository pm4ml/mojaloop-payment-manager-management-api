/* eslint-disable */
// TODO: Remove previous line and work through linting issues at next edit

/** ************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Murthy Kakarlamudi - murthy@modusbox.com                   *
 ************************************************************************* */
import { getInternalEventEmitter, INTERNAL_EVENTS } from '@app/ControlServer/events';
import Vault from '@app/lib/vault';
import { Logger } from '@mojaloop/sdk-standard-components';

const ControlServerEventEmitter = getInternalEventEmitter();

export interface ConnectorManagerOpts {
  vault: Vault;
  logger: Logger.Logger;
}

class ConnectorManager {
  private _vault: Vault;
  private _logger: Logger.Logger;

  constructor(opts: ConnectorManagerOpts) {
    this._vault = opts.vault;
    this._logger = opts.logger;
  }

  async reconfigureInboundSdk(csrPrivateKey, inServerCert, dfspCA) {
    // Broadcast inbound configuration changes to connectors.
    const changedConfig = {
      inbound: {
        tls: {
          creds: {
            ca: dfspCA,
            cert: inServerCert,
            key: csrPrivateKey,
          },
        },
      },
    };
    ControlServerEventEmitter.emit(INTERNAL_EVENTS.SERVER.BROADCAST_CONFIG_CHANGE, changedConfig);
  }

  async reconfigureOutboundSdk(rootHubCA, key, certificate) {
    // Broadcast outbound configuration changes to connectors
    const changedConfig = {
      outbound: {
        tls: {
          creds: {
            ca: rootHubCA,
            cert: certificate,
            key: key,
          },
        },
      },
    };
    ControlServerEventEmitter.emit(INTERNAL_EVENTS.SERVER.BROADCAST_CONFIG_CHANGE, changedConfig);
  }

  async reconfigureOutboundSdkForPeerJWS(peerJWSPublicKeys) {
    // Broadcast JWS keys for outbound server to connectors
    const changedConfig = {
      peerJWSKeys: peerJWSPublicKeys,
    };

    ControlServerEventEmitter.emit(INTERNAL_EVENTS.SERVER.BROADCAST_CONFIG_CHANGE, changedConfig);
  }

  async reconfigureOutboundSdkForJWS(key) {
    // Broadcast JWS key for outbound server to connectors
    const changedConfig = {
      jwsSigningKey: key,
    };

    ControlServerEventEmitter.emit(INTERNAL_EVENTS.SERVER.BROADCAST_CONFIG_CHANGE, changedConfig);
  }
}

export default ConnectorManager;
