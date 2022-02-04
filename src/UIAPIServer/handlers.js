/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Murthy Kakarlamudi - murthy@modusbox.com                         *
 **************************************************************************/

const {
    Transfer,
    Balances,
    DFSP,
    Hub,
    CertificatesModel,
    MonetaryZone,
} = require('@internal/model');

const certModelFromContext = (ctx, overrides) => new CertificatesModel({
    wsUrl: ctx.state.conf.wsUrl,
    wsPort: ctx.state.conf.wsPort,
    db: ctx.state.db,
    dfspId: ctx.state.conf.dfspId,
    mcmServerEndpoint: ctx.state.conf.mcmServerEndpoint,
    logger: ctx.state.logger,
    vault: ctx.state.vault,
    ...overrides,
});


const healthCheck = async(ctx) => {
    ctx.body = { status : 'ok' };
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
    const { id, startTimestamp, endTimestamp, institution, status, batchId, limit, offset } = ctx.query;
    const transfer = new Transfer({
        db: ctx.state.db,
        logger: ctx.state.logger,
    });
    ctx.body = await transfer.findAll({ id, startTimestamp, endTimestamp, institution, status, batchId, limit, offset });
};

const getTransfer = async (ctx) => {
    const transfer = new Transfer({
        db: ctx.state.db,
        logger: ctx.state.logger,
    });
    ctx.body = await transfer.findOne(ctx.params.transferId);
};

const getTransferErrors = async(ctx) => {
    const transfer = new Transfer({
        db: ctx.state.db,
        logger: ctx.state.logger,
    });
    ctx.body = await transfer.findErrors();
};

const getTransferDetail = async (ctx) => {
    const transfer = new Transfer({
        db: ctx.state.db,
        logger: ctx.state.logger,
    });

    const res = await transfer.findOneDetail(ctx.params.transferId);
    if(res) {
        ctx.body = res;
    }
    else {
        ctx.status = 404;
    }
};

const getTransferStatusSummary = async (ctx) => {
    const { startTimestamp, endTimestamp } = ctx.query;
    const transfer = new Transfer({
        db: ctx.state.db,
        logger: ctx.state.logger,
    });
    ctx.body = await transfer.statusSummary({ startTimestamp, endTimestamp });
};

const getHourlyFlow = async (ctx) => {
    const { hoursPrevious } = ctx.query;
    const transfer = new Transfer({
        db: ctx.state.db,
        logger: ctx.state.logger,
        conf: ctx.state.conf,
    });
    ctx.body = await transfer.hourlyFlow({ hoursPrevious });
};

const getTransfersSuccessRate = async (ctx) => {
    const { minutePrevious } = ctx.query;
    const transfer = new Transfer({
        db: ctx.state.db,
        logger: ctx.state.logger,
        conf: ctx.state.conf,
    });
    ctx.body = await transfer.successRate({ minutePrevious });
};

const getTransfersAvgResponseTime = async (ctx) => {
    const { minutePrevious } = ctx.query;
    const transfer = new Transfer({
        db: ctx.state.db,
        logger: ctx.state.logger,
        conf: ctx.state.conf,
    });
    ctx.body = await transfer.avgResponseTime({ minutePrevious });
};

const getBalances = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const balances = new Balances({
        dfspId,
        mcmServerEndpoint,
        logger: ctx.state.logger,
    });
    ctx.body = await balances.findBalances(ctx.request.query);
};

const getDFSPDetails = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const dfsp = new DFSP({
        dfspId,
        mcmServerEndpoint,
        logger: ctx.state.logger,
    });
    ctx.body = await dfsp.getDfspDetails();
};

const getAllDfsps = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const dfsp = new DFSP({
        dfspId,
        mcmServerEndpoint,
        logger: ctx.state.logger,
    });
    ctx.body = await dfsp.getAllDfsps();
};


const getDFSPSByMonetaryZone = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const dfsp = new DFSP({
        dfspId,
        mcmServerEndpoint,
        logger: ctx.state.logger,
    });
    ctx.body = await dfsp.getDfspsByMonetaryZone({monetaryZoneId: ctx.params.monetaryZoneId});
};



const getDFSPEndpoints = async(ctx) => {
    const { direction, type, state } = ctx.query;
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const dfsp = new DFSP({
        dfspId,
        mcmServerEndpoint,
        logger: ctx.state.logger,
    });
    ctx.body = await dfsp.getEndpoints({ direction, type, state });
};

const createDFSPEndpoints = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const dfsp = new DFSP({
        dfspId,
        mcmServerEndpoint,
        logger: ctx.state.logger,
    });
    ctx.body = await dfsp.createEndpoints(ctx.request.body);
};

/**
 * Update an existing DFSP endpoint
 * @param {*} ctx
 */
const updateDFSPEndpoint = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const { epId } = ctx.params;
    const dfsp = new DFSP({
        dfspId,
        mcmServerEndpoint,
        logger: ctx.state.logger,
    });
    ctx.body = await dfsp.updateEndpoint({ epId, ...ctx.request.body });
};

/**
 * Update an existing DFSP endpoint
 * @param {*} ctx
 */
const deleteDFSPEndpoint = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const { epId } = ctx.params;
    const dfsp = new DFSP({
        dfspId,
        mcmServerEndpoint,
        logger: ctx.state.logger,
    });
    ctx.body = await dfsp.deleteEndpoint({ epId });
};

const getHubEndpoints = async(ctx) => {
    const { direction, state } = ctx.query;
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const hub = new Hub({
        dfspId,
        mcmServerEndpoint,
        logger: ctx.state.logger,
    });
    ctx.body = await hub.getEndpoints({ direction, state });
};

const createClientCSR = async(ctx) => {
    const certModel = certModelFromContext(ctx);

    const createdCSR = await certModel.createCSR(
        ctx.state.conf.dfspClientCsrParameters,
        ctx.state.conf.keyLength);

    ctx.body = await certModel.uploadClientCSR(createdCSR.csr);
    ctx.state.logger.push(ctx.body).log('uploadClientCSR');

    await ctx.state.vault.setClientCert({
        id: ctx.body.id,
        privateKey: createdCSR.privateKey,
    });
};

const getClientCertificates = async(ctx) => {
    const certModel = certModelFromContext(ctx);
    ctx.body = await certModel.getCertificates();
};

const getDFSPCA = async(ctx) => {
    const certModel = certModelFromContext(ctx);
    ctx.body = await certModel.getDFSPCA();
};

const createDFSPCA = async(ctx) => {
    const certModel = certModelFromContext(ctx);
    ctx.body = await certModel.createInternalDFSPCA(ctx.request.body);
};

const setDFSPCA = async(ctx) => {
    const certModel = certModelFromContext(ctx);
    ctx.body = await certModel.createExternalDFSPCA(ctx.request.body);
};

const getHubCA = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const hub = new Hub({
        dfspId,
        mcmServerEndpoint,
        logger: ctx.state.logger,
    });
    ctx.body = await hub.getHubCA();
};

/**
 * Get DFSP Server Certificates
 * @param {*} ctx
 */
const getDFSPServerCertificates = async(ctx) => {
    const certModel = certModelFromContext(ctx);
    ctx.body = await certModel.getDFSPServerCertificates();
};

const getAllJWSCertificates = async(ctx) => {
    const certModel = certModelFromContext(ctx);
    ctx.body = await certModel.getAllJWSCertificates();
};

const getJWSCertificates = async(ctx) => {
    const certModel = certModelFromContext(ctx);
    ctx.body = await certModel.getDFSPJWSCertificates();
};

const createJWSCertificates = async(ctx) => {
    const certModel = certModelFromContext(ctx);
    const jws = certModel.createJWS();
    await certModel.storeJWS(jws);
    ctx.body = await certModel.uploadJWS({ publicKey: jws.publicKey });
};

const setJWSCertificates = async(ctx) => {
    const certModel = certModelFromContext(ctx);
    const jws = ctx.request.body;
    try {
        certModel.validateJWSKeyPair(jws);
    } catch (e) {
        ctx.body = { error: e.message };
        ctx.status = 400;
        return;
    }
    await certModel.storeJWS(jws);
    ctx.body = await certModel.uploadJWS({ publicKey: jws.publicKey });
};

const deleteJWSCertificates = async(ctx) => {
    const certModel = certModelFromContext(ctx);
    ctx.body = await certModel.deleteJWS();
};

const getHubServerCertificates = async(ctx) => {
    const { direction, type, state } = ctx.query;
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const hub = new Hub({
        dfspId,
        mcmServerEndpoint,
        logger: ctx.state.logger,
    });
    ctx.body = await hub.getServerCertificates({ direction, type, state });
};


const getMonetaryZones = async(ctx) => {
    const { mcmServerEndpoint } = ctx.state.conf;

    const monetaryZone = new MonetaryZone({
        mcmServerEndpoint,
        logger: ctx.state.logger,
    });
    ctx.response.status = 200;
    ctx.body = await monetaryZone.getMonetaryZones();
};

const generateAllCerts = async(ctx) => {
    await createClientCSR(ctx);
    await generateDfspServerCerts(ctx);
    await createJWSCertificates(ctx);

    //FIXME: return something relevant when doing https://modusbox.atlassian.net/browse/MP-2135
    ctx.body = '';
};

const generateDfspServerCerts = async(ctx) => {
    const certModel = certModelFromContext(ctx);
    ctx.body = await certModel.createDfspServerCert(ctx.state.conf.dfspServerCsrParameters, ctx.state.conf.keyLength);
    ctx.state.logger.push(ctx.body).log('createDfspServerCert');
};


module.exports = {
    '/health': {
        get: healthCheck
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
    '/balances': {
        get: getBalances,
    },
    '/dfsp': {
        get: getDFSPDetails,
    },
    '/dfsp/endpoints': {
        get: getDFSPEndpoints,
        post: createDFSPEndpoints,
    },
    '/dfsps': {
        get: getAllDfsps,
    },
    '/dfsp/endpoints/{epId}': {
        put: updateDFSPEndpoint,
        delete: deleteDFSPEndpoint,
    },
    '/hub/endpoints': {
        get: getHubEndpoints,
    },
    '/dfsp/servercerts': {
        get: getDFSPServerCertificates,
        // post: uploadServerCertificates,
        post: generateDfspServerCerts,
    },
    '/dfsp/alljwscerts': {
        get: getAllJWSCertificates,
    },
    '/dfsp/jwscerts': {
        get: getJWSCertificates,
        post: createJWSCertificates,
        put: setJWSCertificates,
        delete: deleteJWSCertificates,
    },
    '/dfsp/clientcerts': {
        get: getClientCertificates,
    },
    '/dfsp/clientcerts/csr': {
        post: createClientCSR,
    },
    '/dfsp/ca': {
        get: getDFSPCA,
        post: createDFSPCA,
        put: setDFSPCA,
    },
    '/hub/ca': {
        get: getHubCA,
    },
    '/hub/servercerts': {
        get: getHubServerCertificates,
    },
    '/monetaryzones': {
        get: getMonetaryZones
    },
    '/monetaryzones/{monetaryZoneId}/dfsps':{
        get: getDFSPSByMonetaryZone
    },
    '/dfsp/allcerts':{
        post: generateAllCerts
    }
};
