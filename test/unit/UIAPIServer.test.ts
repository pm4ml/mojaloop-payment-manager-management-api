/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 * Eugen Klymniuk <eugen.klymniuk@infitx.com>

 --------------
 ******/

import 'dotenv/config';

import { type Server } from 'node:http';
import request from 'supertest';

import UIAPIServer, { UIAPIServerOptions } from '@app/UIAPIServer';
import config from '@app/config';
import { logger } from '@app/lib/logger';
import { statusResponseDto } from '@app/lib/dto';
import { payloads } from './fixtures';

jest.setTimeout(10_000);

const createMockOpts = ({
  // todo: add all mock impl.
  vault = {},
  db = {} as any,
  stateMachine = { sendEvent: jest.fn() },
  controlServer = {},
  port = 12345,
}: Partial<UIAPIServerOptions> = {}): UIAPIServerOptions => ({
  config,
  port,
  vault,
  db,
  stateMachine,
  controlServer,
});

describe('UIAPIServer Tests -->', () => {
  let uiApiServer: UIAPIServer;
  let opts: UIAPIServerOptions;

  let server: Server;

  beforeAll(async () => {
    logger.info('before uiAPIServer');
    opts = createMockOpts();
    uiApiServer = await UIAPIServer.create(opts);
    await uiApiServer.start();
    /* eslint-disable-next-line */
    server = uiApiServer['server']; // http.createServer(api.callback())
    logger.info('uiAPIServer started');
  });

  afterAll(async () => {
    await uiApiServer?.stop();
    logger.info('uiAPIServer stopped');
  });

  it('should create http server', async () => {
    expect(uiApiServer).toBeInstanceOf(UIAPIServer);
    expect(server).toBeDefined();
  });

  it('should emit correct stateMachine events per route', async () => {
    expect.hasAssertions();
    const { stateMachine } = opts;

    type RouteEventTuple = [METHOD: string, path: string, body: object | null, eventName: string];

    const ROUTES_EVENTS: RouteEventTuple[] = [
      ['POST', '/dfsp/ca', payloads.createDFSPCA(), 'CREATE_INT_CA'],
      ['PUT', '/dfsp/ca', payloads.setDFSPCA(), 'CREATE_EXT_CA'],
      ['POST', '/dfsp/jwscerts', null, 'CREATE_JWS'],
      ['POST', '/dfsp/servercerts', null, 'CREATE_DFSP_SERVER_CERT'],
    ];

    for (const [METHOD, path, body, EVENT_NAME] of ROUTES_EVENTS) {
      stateMachine.sendEvent = jest.fn();

      const res = await request(server)
        [METHOD.toLowerCase()](path)
        .type('json')
        .send(body || {});

      expect(res.status).toBe(200);
      expect(res.body).toEqual(statusResponseDto());
      expect(stateMachine.sendEvent).toHaveBeenCalledTimes(1);

      const [event] = stateMachine.sendEvent.mock.lastCall;
      const eventType = typeof event === 'string' ? event : event.type;
      expect(eventType).toBe(EVENT_NAME);
    }
  });
});
