/**************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 **************************************************************************/

import 'tsconfig-paths/register';

import Vault from '@app/lib/vault';
import config from './config';
import * as MCMClient from '@pm4ml/mcm-client';
import * as ControlServer from '@app/ControlServer';
import SDKStandardComponents from '@mojaloop/sdk-standard-components';

jest.mock('@app/lib/vault');
jest.mock('@pm4ml/mcm-client');
jest.mock('@app/ControlServer');
jest.mock('@mojaloop/sdk-standard-components');

export const createMachineOpts = () => {
  const vaultObj = new Vault({
    ...config.vault,
    commonName: config.mojaloopConnectorFQDN,
    logger: new SDKStandardComponents.Logger.Logger(),
  });
  const vault = jest.mocked(vaultObj);

  const modelOpts = {
    dfspId: config.dfspId,
    hubEndpoint: config.mcmServerEndpoint,
    logger: new SDKStandardComponents.Logger.Logger(),
  };

  const ctx = {
    dfspCertificateModel: jest.mocked(new MCMClient.DFSPCertificateModel(modelOpts)),
    hubCertificateModel: jest.mocked(new MCMClient.HubCertificateModel(modelOpts)),
    hubEndpointModel: jest.mocked(new MCMClient.HubEndpointModel(modelOpts)),
    dfspEndpointModel: jest.mocked(new MCMClient.DFSPEndpointModel(modelOpts)),
  };

  const cfg = JSON.parse(JSON.stringify(config)) as typeof config;

  return {
    ...cfg,
    config: cfg,
    port: config.stateMachineDebugPort,
    ...ctx,
    logger: new SDKStandardComponents.Logger.Logger(),
    vault,
    ControlServer: jest.mocked(ControlServer),
    certManager: undefined,
  };
};

export const createTestConfigState = (onConfigChange: typeof jest.fn) => ({
  initial: 'idle',
  on: {
    UPDATE_CONNECTOR_CONFIG: { target: '.updatingConfig', internal: false },
  },
  states: {
    idle: {},
    updatingConfig: {
      invoke: {
        src: async (ctx, event: any) => {
          return onConfigChange(event.config);
        },
        onDone: 'idle',
      },
    },
  },
});
