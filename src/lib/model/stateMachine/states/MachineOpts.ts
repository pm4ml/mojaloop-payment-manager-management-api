import SDK from '@mojaloop/sdk-standard-components';
import Vault from '@app/lib/vault';
import { DFSPCertificateModel, DFSPEndpointModel, HubCertificateModel, HubEndpointModel } from '@pm4ml/mcm-client';
import * as ControlServer from '@app/ControlServer';
import { IConfig } from '@app/config';

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
}
