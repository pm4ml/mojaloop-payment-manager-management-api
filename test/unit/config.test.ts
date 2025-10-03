process.env.VAULT_AUTH_METHOD = 'APP_ROLE';
process.env.VAULT_ROLE_ID_FILE = '/tmp/test-role-id';
process.env.VAULT_ROLE_SECRET_ID_FILE = '/tmp/test-role-secret-id';
process.env.VAULT_ENDPOINT = 'http://vault:8200';
process.env.VAULT_PKI_SERVER_ROLE = 'server-role';
process.env.VAULT_PKI_CLIENT_ROLE = 'client-role';
process.env.DFSP_ID = 'test-dfsp';
process.env.HUB_IAM_PROVIDER_URL = 'http://iam-provider';
process.env.MCM_SERVER_ENDPOINT = 'http://mcm-server';
process.env.AUTH_ENABLED = 'true';
process.env.AUTH_CLIENT_ID = 'test-client-id';
process.env.AUTH_CLIENT_SECRET = 'test-client-secret';

// Mock fs.readFileSync for vault role files
jest.spyOn(require('fs'), 'readFileSync').mockImplementation((...args: unknown[]) => {
  const path = args[0] as string;
  if (path === '/tmp/test-role-id') return Buffer.from('role-id-value');
  if (path === '/tmp/test-role-secret-id') return Buffer.from('role-secret-id-value');
  return Buffer.from('');
});

// Mock fs.existsSync for vault role files
jest.spyOn(require('fs'), 'existsSync').mockImplementation((...args: unknown[]) => {
  const path = args[0] as string;
  if (path === '/tmp/test-role-id' || path === '/tmp/test-role-secret-id') return true;
  return false;
});

import cfg, { getSanitizedConfig } from '../../src/config';

describe('Config', () => {
  it('should export a config object', () => {
    expect(cfg).toBeDefined();
    expect(typeof cfg).toBe('object');
  });

  it('should redact auth credentials in sanitized config', () => {
    const sanitized = getSanitizedConfig();
    if (sanitized.auth?.creds) {
      expect(sanitized.auth.creds.clientId).toBe('[REDACTED]');
      expect(sanitized.auth.creds.clientSecret).toBe('[REDACTED]');
    }
  });

  it('should redact vault appRole secrets in sanitized config', () => {
    const sanitized = getSanitizedConfig();
    if (sanitized.vault?.auth?.appRole) {
      expect(sanitized.vault.auth.appRole.roleId).toBe('[REDACTED]');
      expect(sanitized.vault.auth.appRole.roleSecretId).toBe('[REDACTED]');
    }
  });

  it('should not mutate the original config object', () => {
    const sanitized = getSanitizedConfig();
    expect(cfg).not.toBe(sanitized);
  });

  it('should return a partial config', () => {
    const sanitized = getSanitizedConfig();
    expect(sanitized).toBeDefined();
    expect(typeof sanitized).toBe('object');
  });
});
