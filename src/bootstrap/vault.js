const Vault = require('@internal/vault');
const config = require('../config');
const { Logger } = require('@mojaloop/sdk-standard-components');

(async () => {
    const logger = new Logger.Logger({
        context: {
            app: 'mojaloop-payment-manager-management-api-service'
        },
        stringify: Logger.buildStringify({ space: this._conf.logIndent }),
    });
    const vault = new Vault({
        ...config.vault,
        logger,
    });
    await vault.connect();
    await vault.mountAll();
    await vault.createPkiRoles();
})();
