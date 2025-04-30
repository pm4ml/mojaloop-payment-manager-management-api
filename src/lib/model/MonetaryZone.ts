/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2020 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Damián García - damian.garcia@modusbox.com                       *
 **************************************************************************/

import { MonetaryZoneModel } from '@pm4ml/mcm-client';
import Logger from '../logger';

class MonetaryZone {
  private _requests: MonetaryZoneModel;
  private _logger: Logger;
  /**
   *
   * @param props {object}
   * @param props.logger {object}
   * @param props.mcmServerEndpoint {string}
   */
  constructor(props) {
    this._requests = new MonetaryZoneModel({
      logger: props.logger,
      hubEndpoint: props.mcmServerEndpoint,
    });
    this._logger = props.logger;
  }

  /**
   * Returns the monetary zones supported
   */
  getMonetaryZones() {
    return this._requests.getMonetaryZones();
  }
}

export default MonetaryZone;
