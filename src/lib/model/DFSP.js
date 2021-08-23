/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Murthy Kakarlamudi - murthy@modusbox.com                   *
 **************************************************************************/

const { DFSPConfigModel, DFSPEndpointModel } = require('@modusbox/mcm-client');

class DFSP {
    constructor(opts) {
        this._logger = opts.logger;
        this._dfspId = opts.dfspId;
        this._mcmDFSPConfigModel = new DFSPConfigModel({
            dfspId: opts.dfspId,
            logger: opts.logger,
            hubEndpoint: opts.mcmServerEndpoint,
        });
        this._endpointModel = new DFSPEndpointModel({
            dfspId: opts.dfspId,
            logger: opts.logger,
            hubEndpoint: opts.mcmServerEndpoint,
        });
    }

    static _convertToApiFormat(dfsp) {
        return {
            id: dfsp.dfsp_id,
        };
    }

    async getDfspStatus() {
        return this._mcmDFSPConfigModel.findStatus({
            dfspId: this._dfspId
        });
    }

    /**
     *
     */
    async getDfspDetails() {
        const fspList = await this._mcmDFSPConfigModel.getDFSPList();
        return fspList.filter(fsp => fsp.id === this._dfspId)[0];
    }

    /**
     *
     */
    async getAllDfsps() {
        return this._mcmDFSPConfigModel.getDFSPList();
    }


    /**
     *
     * @param [opts.monetaryZoneId] {string}
     */
    async getDfspsByMonetaryZone(opts) {
        return this._mcmDFSPConfigModel.getDFSPListByMonetaryZone({
            ...opts
        });
    }

    /**
     *
     * @param opts {Object}
     * @param [opts.direction] {string}
     * @param [opts.type] {string}
     * @param [opts.state] {string}
     */
    async getEndpoints(opts) {
        return this._endpointModel.findAll({
            ...opts,
        });
    }

    /**
     * Creates dfsp endpoint item
     *
     * @param opts {Object}
     * @param opts.direction {Enum 'INGRESS' or 'EGRESS'}
     * @param opts.type {Enum 'IP' or 'URL'}
     * @param [opts.ports] {Array<number>}
     * @param opts.address {string}
     */
    async createEndpoints(opts) {
        return this._endpointModel.create({
            ...opts,
        });
    }

    /**
     * Update dfsp endpoint item
     *
     * @param opts {Object}
     * @param opts.direction {Enum 'INGRESS' or 'EGRESS'}
     * @param opts.type {Enum 'IP' or 'URL'}
     * @param [opts.ports] {Array<number>}
     * @param opts.address {string}
     */
    async updateEndpoint(opts) {
        return this._endpointModel.update({
            ...opts,
        });
    }

    /**
     * Delete dfsp endpoint item
     *
     * @param opts {Object}
     * @param opts.direction {Enum 'INGRESS' or 'EGRESS'}
     * @param opts.type {Enum 'IP' or 'URL'}
     * @param [opts.ports] {Array<number>}
     * @param opts.address {string}
     */
    async deleteEndpoint(opts) {
        return this._endpointModel.delete({
            ...opts,
        });
    }

}

module.exports = DFSP;
