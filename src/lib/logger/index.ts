import SDK from '@mojaloop/sdk-standard-components';

class Logger extends SDK.Logger.SdkLogger {
  constructor() {
    super({
      ctx: {
        app: 'mojaloop-payment-manager-management-api-service',
      },
    });
  }
}

export default Logger;
