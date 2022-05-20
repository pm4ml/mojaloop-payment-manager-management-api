/* eslint-disable */
// TODO: Remove previous line and work through linting issues at next edit

/** ************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Matt Kingston - matt.kingston@modusbox.com                       *
 ************************************************************************* */
import ws from 'ws';
import jsonPatch from 'fast-json-patch';
import randomPhrase from '@app/lib/randomphrase';
import SDKStandardComponents from '@mojaloop/sdk-standard-components';
import Logger = SDKStandardComponents.Logger.Logger;

/** ************************************************************************
 * The message protocol messages, verbs, and errors
 ************************************************************************ */
enum MESSAGE {
  CONFIGURATION = 'CONFIGURATION',
  ERROR = 'ERROR',
}

enum VERB {
  READ = 'READ',
  NOTIFY = 'NOTIFY',
  PATCH = 'PATCH',
}

enum ERROR {
  UNSUPPORTED_MESSAGE = 'UNSUPPORTED_MESSAGE',
  UNSUPPORTED_VERB = 'UNSUPPORTED_VERB',
  JSON_PARSE_ERROR = 'JSON_PARSE_ERROR',
}

/** ************************************************************************
 * Events emitted by the control server
 ************************************************************************ */
enum EVENT {
  RECONFIGURE = 'RECONFIGURE',
}

/** ************************************************************************
 * Private convenience functions
 ************************************************************************ */
const serialise = JSON.stringify;
const deserialise = JSON.parse;
const buildMsg = (verb, msg, data, id = randomPhrase()) => serialise({
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
  ...(
    req.headers['x-forwarded-for']
      ? req.headers['x-forwarded-for'].split(/\s*,\s*/)
      : []
  ),
];

/** ************************************************************************
 * build
 *
 * Public object exposing an API to build valid protocol messages.
 * It is not the only way to build valid messages within the protocol.
 ************************************************************************ */
const build = {
  CONFIGURATION: {
    PATCH: buildPatchConfiguration,
    READ: (id) => buildMsg(VERB.READ, MESSAGE.CONFIGURATION, {}, id),
    NOTIFY: (config, id) => buildMsg(VERB.NOTIFY, MESSAGE.CONFIGURATION, config, id),
  },
  ERROR: {
    NOTIFY: {
      UNSUPPORTED_MESSAGE: (id) => buildMsg(VERB.NOTIFY, MESSAGE.ERROR, ERROR.UNSUPPORTED_MESSAGE, id),
      UNSUPPORTED_VERB: (id) => buildMsg(VERB.NOTIFY, MESSAGE.ERROR, ERROR.UNSUPPORTED_VERB, id),
      JSON_PARSE_ERROR: (id) => buildMsg(VERB.NOTIFY, MESSAGE.ERROR, ERROR.JSON_PARSE_ERROR, id),
    },
  },
};

/** ************************************************************************
 * Client
 *
 * The Control Client. Client for the websocket control API.
 * Used to hot-restart the SDK.
 *
 * logger    - Logger- see SDK logger used elsewhere
 * address   - address of control server
 * port      - port of control server
 ************************************************************************ */
class Client extends ws {
  private _logger: Logger;

  constructor({ address = 'localhost', port, logger }) {
    super(`ws://${address}:${port}`);
    this._logger = logger;
  }

  // Really only exposed so that a user can import only the client for convenience
  get Build() {
    return build;
  }

  static async Create({ address = 'localhost', port, logger }) {
    const result = new Client({ address, port, logger });
    await new Promise((resolve, reject) => {
      result.on('open', resolve);
      result.on('error', reject);
    });
    return result;
  }

  async send(msg) {
    const data = typeof msg === 'string' ? msg : serialise(msg);
    this._logger.log('Send msg as a client through websocket : ', data);
    this._logger.log('Websocket client information : ', this.url);
    return new Promise((resolve) => super.send.call(this, data, resolve));
  }

  // Receive a single message
  async receive() {
    return new Promise((resolve) => this.once('message', (data) => {
      const deserialiseMessage = deserialise(data);
      resolve(deserialiseMessage);
    }));
  }
}



module.exports = {
  Client,
  build,
  MESSAGE,
  VERB,
  ERROR,
  EVENT,
};
