/** ************************************************************************
 *  (C) Copyright Mojaloop Foundation 2022                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 ************************************************************************* */

import * as k8s from '@kubernetes/client-node';
import { Logger } from '@mojaloop/sdk-standard-components';

export interface CertManagerOpts {
  logger: Logger.Logger;
  serverCertSecretName: string;
  serverCertSecretNamespace: string;
}

class CertManager {
  private logger: Logger.Logger;
  private serverCertSecretName: string;
  private serverCertSecretNamespace: string;
  private kc: k8s.KubeConfig;
  private k8sApi: k8s.CoreV1Api;

  constructor(config: CertManagerOpts) {
    this.logger = config.logger;
    this.serverCertSecretName = config.serverCertSecretName;
    this.serverCertSecretNamespace = config.serverCertSecretNamespace;

    if (!this.logger || !this.serverCertSecretName || !this.serverCertSecretNamespace) {
      throw new Error('Missing one of the props: logger, serverCertSecretName, serverCertSecretNamespace');
    }

    this.kc = new k8s.KubeConfig();
    this.kc.loadFromDefault();

    this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
  }

  async renewServerCert() {
    const patch = [
      {
        op: 'replace',
        path: '/metadata/annotations',
        value: {
          'cert-manager.io/issuer-name': 'force-renewal-triggered',
        },
      },
    ];
    const options = { headers: { 'Content-type': k8s.PatchUtils.PATCH_FORMAT_JSON_PATCH } };

    return this.k8sApi
      .patchNamespacedSecret(
        this.serverCertSecretName,
        this.serverCertSecretNamespace,
        patch,
        undefined,
        undefined,
        undefined,
        undefined,
        options
      )
      .then(() => {
        this.logger.log('Server cert renewal successful');
      })
      .catch((err) => {
        this.logger.log('Error renewing server cert: ', err);
      });
  }
}

export default CertManager;
