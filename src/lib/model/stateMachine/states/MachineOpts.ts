/**************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 **************************************************************************/

import SDK from '@mojaloop/sdk-standard-components';
import { DFSPCertificateModel, DFSPEndpointModel, HubCertificateModel, HubEndpointModel } from '@pm4ml/mcm-client';
import Vault from '../../../../lib/vault';
import * as ControlServer from '../../../../ControlServer';
import { IConfig } from '../../../../config';
import { CertManager } from '../../../../lib/model';

export interface MachineOpts {
  logger: SDK.Logger.Logger;
  vault: Vault;
  refreshIntervalSeconds: number;
  dfspCertificateModel: DFSPCertificateModel;
  dfspEndpointModel: DFSPEndpointModel;
  hubCertificateModel: HubCertificateModel;
  hubEndpointModel: HubEndpointModel;
  ControlServer: typeof ControlServer;
  port: number;
  config: IConfig;
  certManager?: CertManager;
}
