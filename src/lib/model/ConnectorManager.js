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

const { INTERNAL_EVENTS, getInternalEventEmitter } = require('../../ControlServer/events');

const ControlServerEventEmitter = getInternalEventEmitter();

class ConnectorManager {
    constructor(opts) {
        this._vault = opts.vault;
        this._logger = opts.logger;
        this._tlsServerPrivateKey = opts.tlsServerPrivateKey;
    }

    async reconfigureInboundSdk(csrPrivateKey, inServerCert, dfspCA) {
        // Broadcast inbound configuration changes to connectors.
        const changedConfig = {
            inbound: {
                tls: {
                    creds: {
                        ca: [Buffer.from(dfspCA)],
                        cert: Buffer.from(inServerCert),
                        key: Buffer.from(csrPrivateKey),

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
                        ca: Buffer.from(rootHubCA, 'utf8'),
                        cert: Buffer.from(certificate, 'utf8'),
                        key: Buffer.from(key, 'utf8'),
                    },
                },
            },
        };
        ControlServerEventEmitter.emit(INTERNAL_EVENTS.SERVER.BROADCAST_CONFIG_CHANGE, changedConfig);
    }

    async reconfigureOutboundSdkForJWS(peerJWSPublicKeys) {
        // Broadcast JWS keys for outbound server to connectors
        const changedConfig = {
            peerJWSKeys: peerJWSPublicKeys,
        };

        ControlServerEventEmitter.emit(INTERNAL_EVENTS.SERVER.BROADCAST_CONFIG_CHANGE, changedConfig);
    }
}

module.exports = ConnectorManager;
