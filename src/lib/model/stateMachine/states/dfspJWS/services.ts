import stringify from 'json-stringify-deterministic';
import forge from 'node-forge';

export const downloadPeerJWS = async () => {
  const jwsCerts = await this._mcmClientDFSPCertModel.getAllJWSCertificates();

  // Check if this set of certs differs from the ones in vault.
  // If so, store them then broadcast them to the connectors.
  const oldJwsCerts = await this._vault.getPeerJWS();
  if (jwsCerts && stringify(oldJwsCerts) !== stringify(jwsCerts)) {
    await this._vault.setPeerJWS(jwsCerts);
    this._logger.push(jwsCerts).log('Exchanged JWS certs');
    if (Array.isArray(jwsCerts) && jwsCerts.length) {
      await this._certificatesModel.exchangeJWSConfiguration(jwsCerts);
    }
  }
}

export const createJWS = () => {
  const keypair = forge.rsa.generateKeyPair({ bits: 2048 });
  return {
    publicKey: forge.pki.publicKeyToPem(keypair.publicKey, 72),
    privateKey: forge.pki.privateKeyToPem(keypair.privateKey, 72),
  };
};
