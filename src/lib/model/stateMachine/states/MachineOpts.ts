import SDK from '@mojaloop/sdk-standard-components';
import Vault from '@app/lib/vault';
import { AuthModel, DFSPCertificateModel, HubCertificateModel, HubEndpointModel } from '@pm4ml/mcm-client';
import ConnectorManager from '@app/lib/model/ConnectorManager';
import * as ControlServer from '@app/ControlServer';

export interface MachineOpts {
  logger: SDK.Logger.Logger;
  vault: Vault;
  keyLength: number;
  refreshIntervalSeconds: number;
  controlServer: string;
  dfspCertificateModel: DFSPCertificateModel;
  hubCertificateModel: HubCertificateModel;
  hubEndpointModel: HubEndpointModel;
  ControlServer: typeof ControlServer;
}
