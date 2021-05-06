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
    Environment
} = require('@internal/model');


const healthCheck = async(ctx) => {
    ctx.body = JSON.stringify({'status':'ok'});
};

const getEnvironmentDfspStatus = async (ctx) => {
    const envId = ctx.params.envId;
    const dfspId = ctx.params.dfspId;
    const { mcmServerEndpoint } = ctx.state.conf;
    const environment = new Environment({
        envId: ctx.params.envId,
        dfspId: ctx.params.dfspId,
        logger: ctx.state.logger,
        mcmServerEndpoint
    });
    ctx.body = await environment.getEnvironmentDfspStatus(envId, dfspId);
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
        envId: ctx.params.envId,
        dfspId,
        mcmServerEndpoint,
        logger: ctx.state.logger,
    });
    ctx.body = await dfsp.getDfspDetails();
};

const getAllDfsps = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const dfsp = new DFSP({
        envId: ctx.params.envId,
        dfspId,
        mcmServerEndpoint,
        logger: ctx.state.logger,
    });
    ctx.body = await dfsp.getAllDfsps();
};


const getAllEnvironments = async(ctx) => {
    const { mcmServerEndpoint } = ctx.state.conf;
    
    const HubModel = new Hub({
        mcmServerEndpoint,
        logger: ctx.state.logger,
    });
    
    ctx.response.status = 200;
    const responseData = await HubModel.getEnvironments();
    ctx.body = responseData;
};

const getDFSPSByMonetaryZone = async(ctx) => {
    const { envId, dfspId, mcmServerEndpoint } = ctx.state.conf;
    const dfsp = new DFSP({
        envId,
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
        envId: ctx.params.envId,
        logger: ctx.state.logger,
    });
    ctx.body = await dfsp.getEndpoints({ direction, type, state });
};

const createDFSPEndpoints = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const dfsp = new DFSP({
        dfspId,
        mcmServerEndpoint,
        envId: ctx.params.envId,
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
        envId: ctx.params.envId,
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
        envId: ctx.params.envId,
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
        envId: ctx.params.envId,
        logger: ctx.state.logger,
    });
    ctx.body = await hub.getEndpoints({ direction, state });
};

const uploadClientCSR = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const certModel = new CertificatesModel({
        dfspId,
        mcmServerEndpoint,
        envId: ctx.params.envId,
        logger: ctx.state.logger,
    });
    ctx.body = await certModel.uploadClientCSR(ctx.request.body.clientCSR);
};

const createClientCSR = async(ctx) => {
    
    const { dfspId, mcmServerEndpoint, privateKeyLength, privateKeyAlgorithm, 
        dfspClientCsrParameters } = ctx.state.conf;

    const certModel = new CertificatesModel({
        dfspId,
        mcmServerEndpoint,
        envId: ctx.params.envId,
        logger: ctx.state.logger,
        storage: ctx.state.storage,
    });

    const csrParameters = {
        privateKeyAlgorithm: privateKeyAlgorithm,
        privateKeyLength: privateKeyLength,
        parameters: dfspClientCsrParameters
    };

    const createdCSR = await certModel.createCSR(csrParameters);
    ctx.body = await certModel.uploadClientCSR(createdCSR.csr);

    // save the enrollment id in the cache to process later
    const cache = ctx.state.db.redisCache;
    await cache.set(`inboundEnrollmentId_${ctx.params.envId}`, ctx.body.id);
    // FIXME: aslo persist the private key (in the future will be in Vault)
    await cache.set(`clientPrivateKey_${ctx.params.envId}`, createdCSR.key.toString('utf8'));
};

const getClientCertificates = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const certModel = new CertificatesModel({
        dfspId,
        mcmServerEndpoint,
        envId: ctx.params.envId,
        logger: ctx.state.logger,
    });
    ctx.body = await certModel.getCertificates();
};

const getDFSPCA = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const certModel = new CertificatesModel({
        dfspId,
        mcmServerEndpoint,
        envId: ctx.params.envId,
        logger: ctx.state.logger,
    });
    ctx.body = await certModel.getDFSPCA();
};

const uploadDFSPCA = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const certModel = new CertificatesModel({
        dfspId,
        mcmServerEndpoint,
        envId: ctx.params.envId,
        logger: ctx.state.logger,
    });
    ctx.body = await certModel.uploadDFSPCA(ctx.request.body);
};

const getHubCAS = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const hub = new Hub({
        dfspId,
        mcmServerEndpoint,
        envId: ctx.params.envId,
        logger: ctx.state.logger,
    });
    ctx.body = await hub.getHubCAS();
};

const getRootHubCA = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const hub = new Hub({
        dfspId,
        mcmServerEndpoint,
        envId: ctx.params.envId,
        logger: ctx.state.logger,
    });
    ctx.body = await hub.getRootHubCA();
};

/**
 * Get DFSP Server Certificates
 * @param {*} ctx
 */
const getDFSPServerCertificates = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const certModel = new CertificatesModel({
        dfspId,
        mcmServerEndpoint,
        envId: ctx.params.envId,
        logger: ctx.state.logger,
    });
    ctx.body = await certModel.getDFSPServerCertificates();
};

const getAllJWSCertificates = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const certModel = new CertificatesModel({
        dfspId,
        mcmServerEndpoint,
        envId: ctx.params.envId,
        logger: ctx.state.logger,
    });
    ctx.body = await certModel.getAllJWSCertificates();
};

const getJWSCertificates = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const certModel = new CertificatesModel({
        dfspId,
        mcmServerEndpoint,
        envId: ctx.params.envId,
        logger: ctx.state.logger,
    });
    ctx.body = await certModel.getDFSPJWSCertificates();
};

const uploadJWSCertificates = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const certModel = new CertificatesModel({
        dfspId,
        mcmServerEndpoint,
        envId: ctx.params.envId,
        logger: ctx.state.logger,
    });
    ctx.body = await certModel.uploadJWS(ctx.request.body);
};

const updateJWSCertificates = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const certModel = new CertificatesModel({
        dfspId,
        mcmServerEndpoint,
        envId: ctx.params.envId,
        logger: ctx.state.logger,
    });
    ctx.body = await certModel.updateJWS(ctx.request.body);
};

const deleteJWSCertificates = async(ctx) => {
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const certModel = new CertificatesModel({
        dfspId,
        mcmServerEndpoint,
        envId: ctx.params.envId,
        logger: ctx.state.logger,
    });
    ctx.body = await certModel.deleteJWS();
};

const getHubServerCertificates = async(ctx) => {
    const { direction, type, state } = ctx.query;
    const { dfspId, mcmServerEndpoint } = ctx.state.conf;
    const hub = new Hub({
        dfspId,
        mcmServerEndpoint,
        envId: ctx.params.envId,
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
    const responseData = await monetaryZone.getMonetaryZones();
    ctx.body = responseData;
};

const generateAllCerts = async(ctx) => {
    
    const { dfspId, mcmServerEndpoint, privateKeyLength, privateKeyAlgorithm, 
        dfspServerCsrParameters, wsUrl, wsPort } = ctx.state.conf;

    const certModel = new CertificatesModel({
        dfspId,
        mcmServerEndpoint,
        envId: ctx.params.envId,
        logger: ctx.state.logger,
        storage: ctx.state.storage,
        wsUrl: wsUrl,
        wsPort: wsPort,
        db: ctx.state.db
    });

    const csrParameters = {
        privateKeyAlgorithm: privateKeyAlgorithm,
        privateKeyLength: privateKeyLength,
        parameters: dfspServerCsrParameters
    };

    const createdCSR = await certModel.createCSR(csrParameters);

    //Exchange inbound configuration
    await certModel.uploadClientCSR(createdCSR);

    //FIXME: return something relevant when doing https://modusbox.atlassian.net/browse/MP-2135
    ctx.body = '';
};

const generateDfspServerCerts = async(ctx) => {
    
    const { dfspId, mcmServerEndpoint, privateKeyLength, privateKeyAlgorithm, 
        dfspServerCsrParameters, dfspCaPath, wsUrl, wsPort } = ctx.state.conf;

    const certModel = new CertificatesModel({
        dfspId,
        mcmServerEndpoint,
        envId: ctx.params.envId,
        logger: ctx.state.logger,
        storage: ctx.state.storage,
        wsUrl: wsUrl,
        wsPort: wsPort,
        db: ctx.state.db
    });

    const csrParameters = {
        privateKeyAlgorithm: privateKeyAlgorithm,
        privateKeyLength: privateKeyLength,
        parameters: dfspServerCsrParameters
    };

    const createdCSR = await certModel.createCSR(csrParameters);

    //Exchange inbound configuration
    await certModel.process(createdCSR, dfspCaPath);

    //FIXME: return something relevant when doing https://modusbox.atlassian.net/browse/MP-2135
    ctx.body = '';
};


module.exports = {
    '/health': {
        get: healthCheck
    },
    '/environments/{envId}/dfsps/{dfspId}/status': {
        get: getEnvironmentDfspStatus,
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
    '/environments/{envId}/dfsp': {
        get: getDFSPDetails,
    },
    '/environments': {
        get: getAllEnvironments,
    },
    '/environments/{envId}/dfsp/endpoints': {
        get: getDFSPEndpoints,
        post: createDFSPEndpoints,
    },
    '/environments/{envId}/dfsps': {
        get: getAllDfsps,
    },    
    '/environments/{envId}/dfsp/endpoints/{epId}': {
        put: updateDFSPEndpoint,
        delete: deleteDFSPEndpoint,
    },
    '/environments/{envId}/hub/endpoints': {
        get: getHubEndpoints,
    },
    '/environments/{envId}/dfsp/servercerts': {
        get: getDFSPServerCertificates,
        // post: uploadServerCertificates,
        post: generateDfspServerCerts,
    },
    '/environments/{envId}/dfsp/alljwscerts': {
        get: getAllJWSCertificates,
    },
    '/environments/{envId}/dfsp/jwscerts': {
        get: getJWSCertificates,
        post: uploadJWSCertificates,
        put: updateJWSCertificates,
        delete: deleteJWSCertificates,
    },
    '/environments/{envId}/dfsp/clientcerts': {
        get: getClientCertificates,
        post: uploadClientCSR,
    },
    '/environments/{envId}/dfsp/clientcerts/csr': {
        post: createClientCSR,
    },
    '/environments/{envId}/dfsp/ca': {
        get: getDFSPCA,
        post: uploadDFSPCA,
    },
    '/environments/{envId}/hub/cas': {
        get: getHubCAS,
    },
    '/environments/{envId}/ca/rootCert': {
        get: getRootHubCA,
    },
    '/environments/{envId}/hub/servercerts': {
        get: getHubServerCertificates,
    },
    '/monetaryzones': {
        get: getMonetaryZones
    },
    '/environments/{envId}/monetaryzones/{monetaryZoneId}/dfsps':{
        get: getDFSPSByMonetaryZone
    },
    '/environments/{envId}/dfsp/allcerts':{
        post: generateAllCerts
    } 
};
