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
import Vault from '@app/lib/vault';
import { DFSPCertificateModel, DFSPEndpointModel, HubCertificateModel, HubEndpointModel } from '@pm4ml/mcm-client';
import * as ControlServer from '@app/ControlServer';
import { IConfig } from '@app/config';
import { CertManager } from '@app/lib/model';

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
