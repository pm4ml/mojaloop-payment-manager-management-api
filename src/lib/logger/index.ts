import SDK from '@mojaloop/sdk-standard-components';

class Logger extends SDK.Logger.Logger {
  constructor() {
    super({
      ctx: {
        app: 'mojaloop-payment-manager-management-api-service',
      },
    });
  }
}

export default Logger;
