/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Murthy Kakarlamudi - murthy@modusbox.com                   *
 **************************************************************************/

const { EnvironmentModel } = require('@modusbox/mcm-client');

class Environment {
    constructor(opts) {
        this._logger = opts.logger;
        this._envId = opts.envId;
        this._dfspId = opts.dfspId;
        this._mcmEnvironmentModel = new EnvironmentModel({
            dfspId: opts.dfspId,
            logger: opts.logger,
            hubEndpoint: opts.mcmServerEndpoint,
        });
    }

    /**
     *
     * @param envId {string}
     * @param dfspId {string}
     */
    async getEnvironmentDfspStatus(envId, dfspId) {

        let environmentDfspStatus = this._mcmEnvironmentModel.findStatus(envId, dfspId);

        return environmentDfspStatus;
    }

}

module.exports = Environment;
