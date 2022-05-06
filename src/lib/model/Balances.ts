/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Murthy Kakarlamudi - murthy@modusbox.com                   *
 **************************************************************************/
import { IConfig } from '@app/config';
import { Logger, MojaloopRequests } from '@mojaloop/sdk-standard-components';

class Balances {
  private _logger: any;
  private _requests: MojaloopRequests;

  constructor(config: IConfig, logger: Logger.Logger) {
    this._logger = logger;
    this._requests = new MojaloopRequests({
      logger: logger,
      peerEndpoint: config.peerEndpoint,
      dfspId: config.dfspId,
      tls: config.tls,
      jwsSign: config.jwsSign,
      jwsSigningKey: config.jwsSigningKey,
      wso2Auth: config.wso2Auth,
    });
  }

  /**
   *
   * @param query {object}
   */
  async findBalances(query) {
    return this._requests.getCustom('/reports/balances.json', null, query);
  }
}

export default Balances;
