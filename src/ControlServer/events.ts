/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *      Steven Oderayi - steven.oderayi@modusbox.com                       *
 **************************************************************************/

import { EventEmitter } from 'events';

/**************************************************************************
 * Internal events received by the control server via the exposed internal
 * event emitter.
 *************************************************************************/
export const INTERNAL_EVENTS = {
  SERVER: {
    BROADCAST_CONFIG_CHANGE: 'BROADCAST_CONFIG_CHANGE',
    BROADCAST_PEER_JWS_CHANGE: 'BROADCAST_PEER_JWS_CHANGE',
  },
};
const internalEventEmitter = new EventEmitter();

/**************************************************************************
 * getInternalEventEmitter
 *
 * Returns an EventEmmitter that can be used to exchange internal events with
 * either the control server or the client from other modules within this service.
 * This prevents the need to pass down references to either the server or the client
 * from one module to another in order to use their interfaces.
 *
 * @returns {events.EventEmitter}
 *************************************************************************/
export const getInternalEventEmitter = () => {
  return internalEventEmitter;
};

// TODO: Add connector config type
export const changeConfig = (config: any) => {
  internalEventEmitter.emit(INTERNAL_EVENTS.SERVER.BROADCAST_CONFIG_CHANGE, config);
};

export const notifyPeerJWS = (peerJWS: any) => {
  internalEventEmitter.emit(INTERNAL_EVENTS.SERVER.BROADCAST_PEER_JWS_CHANGE, peerJWS);
};
