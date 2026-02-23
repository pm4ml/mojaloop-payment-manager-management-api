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

import { config as dotenv } from 'dotenv';
dotenv({ path: '.env.example' });

import { type Server } from 'node:http';
import request from 'supertest';

import UIAPIServer, { UIAPIServerOptions } from '@app/UIAPIServer';
import config from '@app/config';
import { HealthStatus, RedisHealthStatus } from '@app/constants';
import { statusResponseDto } from '@app/lib/dto';

import { payloads } from './fixtures';
import * as mocks from './mocks';

jest.setTimeout(10_000);

const createMockDeps = ({
  vault = mocks.mockVaultFactory(),
  cache = mocks.mockCacheFactory(),
  stateMachine = mocks.mockStateMachineFactory(),
  controlServer = mocks.mockControlServerFactory(),
  port = 12345,
}: Partial<UIAPIServerOptions> = {}): UIAPIServerOptions => ({
  config,
  port,
  vault,
  cache,
  stateMachine,
  controlServer,
});

describe('UIAPIServer Tests -->', () => {
  let uiApiServer: UIAPIServer;
  let deps: UIAPIServerOptions;

  let server: Server;

  beforeEach(async () => {
    deps = createMockDeps();
    uiApiServer = await UIAPIServer.create(deps);
    await uiApiServer.start();
    /* eslint-disable-next-line */
    server = uiApiServer['server']; // http.createServer(api.callback())
  });

  afterEach(async () => {
    await uiApiServer?.stop();
  });

  it('should create http server', async () => {
    expect(uiApiServer).toBeInstanceOf(UIAPIServer);
    expect(server).toBeDefined();
  });

  it('should emit correct stateMachine events per route', async () => {
    expect.hasAssertions();
    const { stateMachine } = deps;

    type RouteEventTuple = [
      METHOD: string, path: string, body: object | null, statusCode: number, eventName: string
    ];
    const ROUTES_EVENTS: RouteEventTuple[] = [
      ['POST', '/dfsp/ca', payloads.createDFSPCA(), 200, 'CREATE_INT_CA'],
      ['PUT', '/dfsp/ca', payloads.setDFSPCA(), 200, 'CREATE_EXT_CA'],
      ['POST', '/dfsp/jwscerts', null, 200, 'CREATE_JWS'],
      ['POST', '/dfsp/servercerts', null, 200, 'CREATE_DFSP_SERVER_CERT'],
    ];

    for (const [METHOD, path, body, statusCode, EVENT_NAME] of ROUTES_EVENTS) {
      stateMachine.sendEvent = jest.fn();

      const res = await request(server)
        [METHOD.toLowerCase()](path)
        .type('json')
        .send(body || {});

      expect(res.status).toBe(statusCode);
      expect(res.body).toEqual(statusResponseDto());
      expect(stateMachine.sendEvent).toHaveBeenCalledTimes(1);

      const [event] = stateMachine.sendEvent.mock.lastCall;
      const eventType = typeof event === 'string' ? event : event.type;
      expect(eventType).toBe(EVENT_NAME);
    }
  });

  describe('UIAPIServer healthChecks -->', () => {
    describe('Redis healthChecks Tests', () => {
      it('should include redis: OK when ping succeeds', async () => {
        const res = await request(server).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(HealthStatus.OK);
        expect(res.body.redis).toBe(RedisHealthStatus.OK);
      });

      it('should include redis: DOWN when ping fails, and overall status is DOWN', async () => {
        deps.cache = mocks.mockCacheFactory({ pingResponse: false });
        const res = await request(server).get('/health');
        expect(res.status).toBe(503);
        expect(res.body.status).toBe(HealthStatus.DOWN);
        expect(res.body.redis).toBe(RedisHealthStatus.DOWN);
      });

      it('should include redis: N/A when cache is disabled', async () => {
        deps.cache = undefined;
        const res = await request(server).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(HealthStatus.OK);
        expect(res.body.redis).toBe(RedisHealthStatus.NA);
      });
    });
  });

  describe('UIAPIServer /transfer* guard when cache disabled -->', () => {
    beforeEach(() => {
      deps.cache = undefined;
    })

    it(`should return 500 for /transfers* paths`, async () => {
      const transferPaths = [
        '/transfers',
        '/transferStatusSummary',
        '/transferErrors',
      ];

      await Promise.all(transferPaths.map(async (path) => {
        const res = await request(server).get(path);
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Transfer cache is not available');
      }))
    });

    it('should not block non-transfer endpoints', async () => {
      const res = await request(server).get('/health');
      expect(res.status).toBe(200);
    });
  });
});
