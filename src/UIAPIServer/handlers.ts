/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Murthy Kakarlamudi - murthy@modusbox.com                         *
 **************************************************************************/

import { DFSP, MonetaryZone, Transfer } from '../lib/model';
import { statusResponseDto } from '../lib/dto';
import { HealthStatus, RedisHealthStatus, TRedisHealthStatusValue } from "../constants";

let failedChecks = 0; // in a row

const healthCheck = async (ctx) => {
  try {
    const [vaultHealthCheck, controlServerHealthCheck] = await Promise.all([
      ctx.state.vault.healthCheck(),
      ctx.state.controlServer.healthCheck(),
    ]);

    let redisHealth: TRedisHealthStatusValue = RedisHealthStatus.NA;
    if (ctx.state.cache) {
      const isOk = await ctx.state.cache.redisCache.ping();
      redisHealth = isOk ? RedisHealthStatus.OK : RedisHealthStatus.DOWN;
      // todo: create cache.healthCheck() method
    }

    /* prettier-ignore */
    const status = (vaultHealthCheck?.status !== HealthStatus.DOWN
      && controlServerHealthCheck.server.running
      && redisHealth !== HealthStatus.DOWN
    )
      ? HealthStatus.OK
      : HealthStatus.DOWN;

    ctx.status = status === HealthStatus.OK ? 200 : 503;
    ctx.body = {
      status,
      vault: vaultHealthCheck,
      controlServer: controlServerHealthCheck,
      redis: redisHealth,
    };
    if (status === HealthStatus.DOWN) {
      failedChecks += 1;
      ctx.state.logger?.warn(`failed healthCheck [in a row: ${failedChecks}]`);
    } else failedChecks = 0;
  } catch (err: unknown) {
    failedChecks += 1;
    ctx.state.logger?.warn(`error in healthCheck [in a row: ${failedChecks}]: `, err);
    ctx.status = 503;
    ctx.body = {
      status: HealthStatus.DOWN,
      error: (err as Error)?.message || 'Unknown error',
    };
  }
};

const getStates = async (ctx) => {
  const states = ctx.state.stateMachine.getState();
  const formattedStatesResponse = Object.entries(states).reduce((acc, [key, value]) => {
    // Disabling these states temporarily as UPLOAD_PEER_JWS is not relevant for DFSPs and HUB_CA is showing always inProgress
    if (key === 'UPLOAD_PEER_JWS' || key === 'HUB_CA') {
      return acc;
    }
    const { status, stateDescription, lastUpdated, error } = value as {
      status: string;
      stateDescription: string;
      lastUpdated: string;
      error: string;
    };
    acc[key] = {
      status: status,
      stateDescription: stateDescription,
      lastUpdated: new Date(lastUpdated).toISOString(),
      errorDescription: error ? `${error}` : ``,
    };

    return acc;
  }, {});

  ctx.body = formattedStatesResponse;
};

const reonboard = async (ctx) => {
  ctx.state.logger.info(`Reonboarded by x-user ${ctx.request.header['x-user']}`);
  ctx.state.logger.info(`Reason for reonboarding is ${ctx.request.body.reason}`);
  await ctx.state.stateMachine.restart();
  ctx.body = statusResponseDto();
};

const recreateCerts = async (ctx) => {
  const securityType = ctx.params.SecurityType;
  ctx.state.logger.info(`Reason for recreating is ${ctx.request.body.reason}`);
  if (securityType === 'outboundTLS') {
    ctx.state.stateMachine.sendEvent('CREATE_DFSP_CLIENT_CERT');
  }
  if (securityType === 'JWS') ctx.state.stateMachine.sendEvent('CREATE_JWS');
  ctx.body = statusResponseDto();
};

const getDfspStatus = async (ctx) => {
  const dfspId = ctx.params.dfspId;
  const { mcmServerEndpoint } = ctx.state.conf;
  const dfsp = new DFSP({
    dfspId,
    mcmServerEndpoint,
    logger: ctx.state.logger,
  });
  ctx.body = await dfsp.getDfspStatus();
};

const getTransfers = async (ctx) => {
  const {
    id,
    startTimestamp,
    endTimestamp,
    senderIdType,
    senderIdValue,
    senderIdSubValue,
    recipientIdType,
    recipientIdValue,
    recipientIdSubValue,
    direction,
    institution,
    status,
    batchId,
    limit,
    offset,
  } = ctx.query;
  const transfer = new Transfer({
    db: ctx.state.cache.db,
  });
  ctx.body = await transfer.findAll({
    id,
    startTimestamp,
    endTimestamp,
    senderIdType,
    senderIdValue,
    senderIdSubValue,
    recipientIdType,
    recipientIdValue,
    recipientIdSubValue,
    direction,
    institution,
    status,
    batchId,
    limit,
    offset,
  });
};

const getTransfer = async (ctx) => {
  const transfer = new Transfer({
    db: ctx.state.cache.db,
  });
  ctx.body = await transfer.findOne(ctx.params.transferId);
};

const getTransferErrors = async (ctx) => {
  const transfer = new Transfer({
    db: ctx.state.cache.db,
  });
  ctx.body = await transfer.findErrors();
};

const getTransferDetail = async (ctx) => {
  const transfer = new Transfer({
    db: ctx.state.cache.db,
  });

  const res = await transfer.findOneDetail(ctx.params.transferId);
  if (res) {
    ctx.body = res;
  } else {
    ctx.status = 404;
  }
};

const getTransferStatusSummary = async (ctx) => {
  const { startTimestamp, endTimestamp } = ctx.query;
  const transfer = new Transfer({
    db: ctx.state.cache.db,
  });
  ctx.body = await transfer.statusSummary({ startTimestamp, endTimestamp });
};

const getHourlyFlow = async (ctx) => {
  const { hoursPrevious } = ctx.query;
  const transfer = new Transfer({
    db: ctx.state.cache.db,
  });
  ctx.body = await transfer.hourlyFlow({ hoursPrevious });
};

const getTransfersSuccessRate = async (ctx) => {
  const { minutePrevious } = ctx.query;
  const transfer = new Transfer({
    db: ctx.state.cache.db,
  });
  ctx.body = await transfer.successRate({ minutePrevious });
};

const getTransfersAvgResponseTime = async (ctx) => {
  const { minutePrevious } = ctx.query;
  const transfer = new Transfer({
    db: ctx.state.cache.db,
  });
  ctx.body = await transfer.avgResponseTime({ minutePrevious });
};

const getDFSPDetails = async (ctx) => {
  const { dfspId, mcmServerEndpoint } = ctx.state.conf;
  const dfsp = new DFSP({
    dfspId,
    mcmServerEndpoint,
    logger: ctx.state.logger,
  });
  ctx.body = await dfsp.getDfspDetails();
};

const getAllDfsps = async (ctx) => {
  const { dfspId, mcmServerEndpoint } = ctx.state.conf;
  const dfsp = new DFSP({
    dfspId,
    mcmServerEndpoint,
    logger: ctx.state.logger,
  });
  ctx.body = await dfsp.getAllDfsps();
};

const getDFSPSByMonetaryZone = async (ctx) => {
  const { dfspId, mcmServerEndpoint } = ctx.state.conf;
  const dfsp = new DFSP({
    dfspId,
    mcmServerEndpoint,
    logger: ctx.state.logger,
  });
  ctx.body = await dfsp.getDfspsByMonetaryZone({ monetaryZoneId: ctx.params.monetaryZoneId });
};

const getDFSPEndpoint = async (ctx) => {
  const { dfspId, mcmServerEndpoint } = ctx.state.conf;
  const dfsp = new DFSP({
    dfspId,
    mcmServerEndpoint,
    logger: ctx.state.logger,
  });
  const { direction, type, state } = ctx.query;
  ctx.body = await dfsp.getEndpoints({ direction, type, state });
};

const createDFSPCA = async (ctx) => {
  ctx.state.stateMachine.sendEvent({
    type: 'CREATE_INT_CA',
    subject: ctx.request.body,
  });
  ctx.body = statusResponseDto();
};

const setDFSPCA = async (ctx) => {
  ctx.state.stateMachine.sendEvent({
    type: 'CREATE_EXT_CA',
    ...ctx.request.body,
  });
  ctx.body = statusResponseDto();
};

const createJWSCertificates = async (ctx) => {
  ctx.state.stateMachine.sendEvent('CREATE_JWS');
  ctx.body = statusResponseDto();
};

const getMonetaryZones = async (ctx) => {
  const { mcmServerEndpoint } = ctx.state.conf;

  const monetaryZone = new MonetaryZone({
    mcmServerEndpoint,
    logger: ctx.state.logger,
  });
  ctx.response.status = 200;
  ctx.body = await monetaryZone.getMonetaryZones();
};

const generateDfspServerCerts = async (ctx) => {
  ctx.state.stateMachine.sendEvent({
    type: 'CREATE_DFSP_SERVER_CERT',
    csr: ctx.state.conf.dfspServerCsrParameters,
  });
  ctx.body = statusResponseDto();
};

export const createHandlers = () => ({
  '/health': {
    get: healthCheck,
  },
  '/states': {
    get: getStates,
  },
  '/reonboard': {
    post: reonboard,
  },
  '/recreate/{SecurityType}': {
    post: recreateCerts,
  },
  '/dfsps/{dfspId}/status': {
    get: getDfspStatus,
  },
  '/transfers': {
    get: getTransfers,
  },
  '/transfers/{transferId}': {
    get: getTransfer,
  },
  '/transfers/{transferId}/details': {
    get: getTransferDetail,
  },
  '/transferStatusSummary': {
    get: getTransferStatusSummary,
  },
  '/transferErrors': {
    get: getTransferErrors,
  },
  '/hourlyFlow': {
    get: getHourlyFlow,
  },
  '/minuteSuccessfulTransferPerc': {
    get: getTransfersSuccessRate,
  },
  '/minuteAverageTransferResponseTime': {
    get: getTransfersAvgResponseTime,
  },
  '/dfsp': {
    get: getDFSPDetails,
  },
  '/dfsps': {
    get: getAllDfsps,
  },
  '/dfsp/servercerts': {
    post: generateDfspServerCerts,
  },
  '/dfsp/jwscerts': {
    post: createJWSCertificates,
  },
  '/dfsp/ca': {
    post: createDFSPCA,
    put: setDFSPCA,
  },
  '/dfsp/endpoints': {
    get: getDFSPEndpoint,
  },
  '/monetaryzones': {
    get: getMonetaryZones,
  },
  '/monetaryzones/{monetaryZoneId}/dfsps': {
    get: getDFSPSByMonetaryZone,
  },
});
