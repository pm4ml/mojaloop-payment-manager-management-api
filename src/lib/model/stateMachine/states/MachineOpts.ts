import SDK from '@mojaloop/sdk-standard-components';
import Vault from '@app/lib/vault';
import { AuthModel, DFSPCertificateModel, HubCertificateModel, HubEndpointModel } from '@pm4ml/mcm-client';
import CertificatesModel from '@app/lib/model/CertificatesModel';
import { Knex } from 'knex';
import ConnectorManager from '@app/lib/model/ConnectorManager';

export interface MachineOpts {
  logger: SDK.Logger.Logger;
  dfspId: string;
  mojaloopConnectorFQDN: string;
  vault: Vault;
  keyLength: string;
  refreshIntervalSeconds: number;
  tlsServerPrivateKey: string;
  controlServer: string;
  dfspCertificateModel: DFSPCertificateModel;
  hubCertificateModel: HubCertificateModel;
  hubEndpointModel: HubEndpointModel;
  authModel: AuthModel;
  connectorManager: ConnectorManager;
  certificatesModel: CertificatesModel;
  port: number;
}
