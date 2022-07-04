/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Matt Kingston - matt.kingston@modusbox.com                       *
 **************************************************************************/

import ws from 'ws';
import jsonPatch from 'fast-json-patch';
import randomPhrase from '@app/lib/randomphrase';
import { getInternalEventEmitter, INTERNAL_EVENTS } from './events';
import { Logger } from '@mojaloop/sdk-standard-components';

const ControlServerEventEmitter = getInternalEventEmitter();

/**************************************************************************
 * The message protocol messages, verbs, and errors
 *************************************************************************/
const MESSAGE = {
  CONFIGURATION: 'CONFIGURATION',
  ERROR: 'ERROR',
};

const VERB = {
  READ: 'READ',
  NOTIFY: 'NOTIFY',
  PATCH: 'PATCH',
};

const ERROR = {
  UNSUPPORTED_MESSAGE: 'UNSUPPORTED_MESSAGE',
  UNSUPPORTED_VERB: 'UNSUPPORTED_VERB',
  JSON_PARSE_ERROR: 'JSON_PARSE_ERROR',
};

/**************************************************************************
 * Private convenience functions
 *************************************************************************/
const serialise = JSON.stringify;
const deserialise = (msg: any) => {
  //reviver function
  return JSON.parse(msg.toString(), (k, v) => {
    if (
      v !== null &&
      typeof v === 'object' &&
      'type' in v &&
      v.type === 'Buffer' &&
      'data' in v &&
      Array.isArray(v.data)
    ) {
      return Buffer.from(v.data);
    }
    return v;
  });
};

const buildMsg = (verb, msg, data, id = randomPhrase()) =>
  serialise({
    verb,
    msg,
    data,
    id,
  });

const buildPatchConfiguration = (oldConf, newConf, id) => {
  const patches = jsonPatch.compare(oldConf, newConf);
  return buildMsg(VERB.PATCH, MESSAGE.CONFIGURATION, patches, id);
};

const getWsIp = (req) => [
  req.socket.remoteAddress,
  ...(req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(/\s*,\s*/) : []),
];

/**************************************************************************
 * build
 *
 * Public object exposing an API to build valid protocol messages.
 * It is not the only way to build valid messages within the protocol.
 *************************************************************************/
const build = {
  CONFIGURATION: {
    PATCH: buildPatchConfiguration,
    READ: (id?: string) => buildMsg(VERB.READ, MESSAGE.CONFIGURATION, {}, id),
    NOTIFY: (config, id?: string) => buildMsg(VERB.NOTIFY, MESSAGE.CONFIGURATION, config, id),
  },
  ERROR: {
    NOTIFY: {
      UNSUPPORTED_MESSAGE: (id) => buildMsg(VERB.NOTIFY, MESSAGE.ERROR, ERROR.UNSUPPORTED_MESSAGE, id),
      UNSUPPORTED_VERB: (id) => buildMsg(VERB.NOTIFY, MESSAGE.ERROR, ERROR.UNSUPPORTED_VERB, id),
      JSON_PARSE_ERROR: (id?: string) => buildMsg(VERB.NOTIFY, MESSAGE.ERROR, ERROR.JSON_PARSE_ERROR, id),
    },
  },
};

/**************************************************************************
 * Server
 *
 * The Control Server. Exposes a websocket control API.
 * Used to hot-restart the SDK.
 *
 * logger    - Logger- see SDK logger used elsewhere
 * port      - HTTP port to host on
 * appConfig - The configuration for the entire application- supplied here as this class uses it to
 *             validate reconfiguration requests- it is not used for configuration here, however
 * server    - optional HTTP/S server on which to serve the websocket
 *************************************************************************/

export interface ServerOpts {
  logger: Logger.Logger;
  port: number;
  onRequestConfig: (client: unknown) => void;
}

class Server extends ws.Server {
  private _logger: Logger.Logger;
  private _clientData: Map<any, any>;
  private onRequestConfig: (client: unknown) => void;

  constructor(opts: ServerOpts) {
    super({ clientTracking: true, port: opts.port });

    this._logger = opts.logger;
    this._clientData = new Map();
    this.onRequestConfig = opts.onRequestConfig;

    this.on('error', (err) => {
      this._logger.push({ err }).log('Unhandled websocket error occurred. Shutting down.');
      process.exit(1);
    });

    this.on('connection', (socket, req) => {
      const logger = this._logger.push({
        url: req.url,
        ip: getWsIp(req),
        remoteAddress: req.socket.remoteAddress,
      });
      logger.log('Websocket connection received');
      this._clientData.set(socket, { ip: req.connection.remoteAddress, logger });

      socket.on('close', (code, reason) => {
        logger.push({ code, reason }).log('Websocket connection closed');
        this._clientData.delete(socket);
      });

      socket.on('message', this._handle(socket, logger));
    });
    this._logger.push(this.address()).log('running on');
  }

  // Close the server then wait for all the client sockets to close
  async stop() {
    const closing = new Promise((resolve) => this.close(resolve));
    for (const client of this.clients) {
      client.terminate();
    }
    await closing;
    this._logger.log('Control server shutdown complete');
  }

  _handle(client, logger: Logger.Logger) {
    return (data: any) => {
      // TODO: json-schema validation of received message- should be pretty straight-forward
      // and will allow better documentation of the API
      let msg;
      try {
        msg = deserialise(data);
      } catch (err) {
        logger.push({ data }).log("Couldn't parse received message");
        client.send(build.ERROR.NOTIFY.JSON_PARSE_ERROR());
      }
      logger.push({ msg }).log('Handling received message');
      switch (msg.msg) {
        case MESSAGE.CONFIGURATION:
          switch (msg.verb) {
            case VERB.READ:
              this.onRequestConfig(client);
              break;
            default:
              client.send(build.ERROR.NOTIFY.UNSUPPORTED_VERB(msg.id));
              break;
          }
          break;
        default:
          client.send(build.ERROR.NOTIFY.UNSUPPORTED_MESSAGE(msg.id));
          break;
      }
    };
  }

  /**
   * Register this server instance to receive internal server messages
   * from other modules.
   */
  registerInternalEvents() {
    ControlServerEventEmitter.on(INTERNAL_EVENTS.SERVER.BROADCAST_CONFIG_CHANGE, (params) =>
      this.broadcastConfigChange(params)
    );
  }

  /**
   * Broadcast configuration change to all connected clients.
   */
  broadcastConfigChange(updatedConfig) {
    const updateConfMsg = build.CONFIGURATION.NOTIFY(updatedConfig, randomPhrase());
    return this.broadcast(updateConfMsg);
  }

  /**
   * Broadcasts a protocol message to all connected clients.
   *
   * @param {string} msg
   */
  broadcast(msg: string) {
    this.clients.forEach((client) => {
      if (client.readyState === ws.WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }
}

export { Server, build, MESSAGE, VERB, ERROR };
