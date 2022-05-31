/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Murthy Kakarlamudi - murthy@modusbox.com                         *
 **************************************************************************/

import { DFSP, MonetaryZone, Transfer } from '@app/lib/model';

const healthCheck = async (ctx) => {
  ctx.body = { status: 'ok' };
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
    db: ctx.state.db,
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
    db: ctx.state.db,
  });
  ctx.body = await transfer.findOne(ctx.params.transferId);
};

const getTransferErrors = async (ctx) => {
  const transfer = new Transfer({
    db: ctx.state.db,
  });
  ctx.body = await transfer.findErrors();
};

const getTransferDetail = async (ctx) => {
  const transfer = new Transfer({
    db: ctx.state.db,
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
    db: ctx.state.db,
  });
  ctx.body = await transfer.statusSummary({ startTimestamp, endTimestamp });
};

const getHourlyFlow = async (ctx) => {
  const { hoursPrevious } = ctx.query;
  const transfer = new Transfer({
    db: ctx.state.db,
  });
  ctx.body = await transfer.hourlyFlow({ hoursPrevious });
};

const getTransfersSuccessRate = async (ctx) => {
  const { minutePrevious } = ctx.query;
  const transfer = new Transfer({
    db: ctx.state.db,
  });
  ctx.body = await transfer.successRate({ minutePrevious });
};

const getTransfersAvgResponseTime = async (ctx) => {
  const { minutePrevious } = ctx.query;
  const transfer = new Transfer({
    db: ctx.state.db,
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

const createDFSPCA = async (ctx) => {
  ctx.stateMachine.sendEvent({ type: 'CREATE_INT_CA', subject: ctx.request.body });
};

const setDFSPCA = async (ctx) => {
  ctx.stateMachine.sendEvent({ type: 'CREATE_EXT_CA', ...ctx.request.body });
};

const createJWSCertificates = async (ctx) => {
  ctx.stateMachine.sendEvent('CREATE_JWS');
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
  ctx.stateMachine.sendEvent({ type: 'CREATE_DFSP_SERVER_CERT', csr: ctx.state.conf.dfspServerCsrParameters });
};

export const createHandlers = () => ({
  '/health': {
    get: healthCheck,
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
  '/monetaryzones': {
    get: getMonetaryZones,
  },
  '/monetaryzones/{monetaryZoneId}/dfsps': {
    get: getDFSPSByMonetaryZone,
  },
});
