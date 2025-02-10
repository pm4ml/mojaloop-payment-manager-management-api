/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-shadow */
const NodeVault = require('node-vault');
const Vault = require('../../../src/lib/vault/index').default;
const MAX_TIMEOUT = Math.pow(2, 31) / 2 - 1;
import { AssertionError } from 'assert';

jest.mock('node-vault');
describe('Vault', () => {
  let vaultInstance;
  let mockVault;
  const mockEndpoint = 'http://127.0.0.1:8200';
  const mockToken = 'mock-token';
  const mockRoleId = 'mock-role-id';
  const mockSecretId = 'mock-secret-id';
  const mockLogger = {
    push: jest.fn().mockReturnValue({
      log: jest.fn(),
    }),
  };

  const mockKey = 'mock-key';
  const mockValue = { key: 'value' };

  let mockClient;

  beforeEach(() => {
    mockVault = {
      unwrap: jest.fn(),
      approleLogin: jest.fn(),
      kubernetesLogin: jest.fn(),
      read: jest.fn(),
      write: jest.fn(),
      delete: jest.fn(),
      request: jest.fn(),
    };

    NodeVault.mockReturnValue(mockVault);

    vaultInstance = new Vault({
      endpoint: mockEndpoint,
      token: mockToken,
      roleId: mockRoleId,
      logger: mockLogger,
      mounts: {
        pki: 'pki-mount',
        kv: 'kv-mount',
      },
      pkiServerRole: 'server-role',
      pkiClientRole: 'client-role',
      signExpiryHours: '24',
      keyLength: 2048,
      keyAlgorithm: 'rsa',
      commonName: 'test-certificate',
      auth: {
        appRole: {
          roleId: mockRoleId,
          roleSecretId: mockSecretId,
        },
        k8s: {
          role: 'k8s-role',
          token: 'jwt-token',
        },
      },
    });

    mockClient = {
      read: jest.fn().mockResolvedValueOnce({ data: mockValue }),
    };

    vaultInstance.client = mockClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.clearAllTimers();
  });

  describe('constructor', () => {
    it('should initialize with the provided options', () => {
      expect(vaultInstance.opts).toEqual({
        endpoint: mockEndpoint,
        token: mockToken,
        roleId: mockRoleId,
        logger: mockLogger,
        mounts: {
          pki: 'pki-mount',
          kv: 'kv-mount',
        },
        pkiServerRole: 'server-role',
        pkiClientRole: 'client-role',
        signExpiryHours: '24',
        keyLength: 2048,
        keyAlgorithm: 'rsa',
        commonName: 'test-certificate',
        auth: {
          appRole: {
            roleId: mockRoleId,
            roleSecretId: mockSecretId,
          },
          k8s: {
            role: 'k8s-role',
            token: 'jwt-token',
          },
        },
      });
    });
  });

  describe('setStateMachineState', () => {
    it('should call _setSecret with the correct arguments', async () => {
      const mockValue = { state: 'active' };
      const mockSetSecret = jest.spyOn(vaultInstance, '_setSecret').mockResolvedValue(true);
      await vaultInstance.setStateMachineState(mockValue);

      expect(mockSetSecret).toHaveBeenCalledWith('state-machine-state', mockValue);
    });

    it('should throw an error if _setSecret fails', async () => {
      const mockValue = { state: 'inactive' };
      const mockSetSecret = jest
        .spyOn(vaultInstance, '_setSecret')
        .mockRejectedValue(new Error('Failed to set secret'));

      await expect(vaultInstance.setStateMachineState(mockValue)).rejects.toThrow('Failed to set secret');
      expect(mockSetSecret).toHaveBeenCalledWith('state-machine-state', mockValue);
    });
  });

  describe('getStateMachineState', () => {
    it('should call _getSecret and return the state machine state', async () => {
      const mockState = { state: 'active' };
      const mockGetSecret = jest.spyOn(vaultInstance, '_getSecret').mockResolvedValue(mockState);
      const result = await vaultInstance.getStateMachineState();

      expect(mockGetSecret).toHaveBeenCalledWith('state-machine-state');
      expect(result).toEqual(mockState);
    });

    it('should throw an error if _getSecret fails', async () => {
      const mockGetSecret = jest
        .spyOn(vaultInstance, '_getSecret')
        .mockRejectedValue(new Error('Failed to get secret'));

      await expect(vaultInstance.getStateMachineState()).rejects.toThrow('Failed to get secret');
      expect(mockGetSecret).toHaveBeenCalledWith('state-machine-state');
    });
  });

  describe('_getSecret', () => {
    it('should retrieve secret data successfully', async () => {
      const result = await vaultInstance._getSecret(mockKey);

      expect(mockClient.read).toHaveBeenCalledWith('kv-mount/mock-key');
      expect(result).toEqual(mockValue);
    });

    it('should call the client read method with the correct path', async () => {
      const path = `kv-mount/mock-key`;
      await vaultInstance._getSecret(mockKey);

      expect(mockClient.read).toHaveBeenCalledWith(path);
    });

    it('should return undefined if 404 error is thrown', async () => {
      const mockError = {
        response: {
          statusCode: 404,
        },
      };

      mockClient = {
        read: jest.fn().mockRejectedValueOnce(mockError),
      };
      vaultInstance.client = mockClient;
      const result = await vaultInstance._getSecret(mockKey);

      expect(mockClient.read).toHaveBeenCalledWith('kv-mount/mock-key');
      expect(result).toBeUndefined();
    });

    it('should throw an error if any other error is thrown', async () => {
      mockClient = {
        read: jest.fn().mockRejectedValueOnce(new Error('Some error occurred')),
      };
      vaultInstance.client = mockClient;

      await expect(vaultInstance._getSecret(mockKey)).rejects.toThrow('Some error occurred');
    });
  });

  describe('_setSecret', () => {
    it('should call the client write method with the correct path and value', async () => {
      const mockWrite = jest.fn().mockResolvedValueOnce({ data: mockValue });
      vaultInstance.client = { write: mockWrite };

      await vaultInstance._setSecret(mockKey, mockValue);

      const path = `kv-mount/mock-key`;
      expect(mockWrite).toHaveBeenCalledWith(path, mockValue);
    });

    it('should throw an error if the key is null or undefined', async () => {
      const mockWrite = jest.fn().mockResolvedValueOnce({ data: mockValue });
      vaultInstance.client = { write: mockWrite };

      try {
        await vaultInstance._setSecret(null, mockValue);
      } catch (error) {
        if (error instanceof Error) {
          expect(error).toBeInstanceOf(AssertionError);
          expect(error.message).toBe('Cannot set key: [null]');
        }
      }

      try {
        await vaultInstance._setSecret(undefined, mockValue);
      } catch (error) {
        if (error instanceof Error) {
          expect(error).toBeInstanceOf(AssertionError);
          expect(error.message).toBe('Cannot set key: [undefined]');
        }
      }
    });

    it('should throw an error if the client is null or undefined', async () => {
      const mockValue = { key: 'value' };
      vaultInstance.client = null;

      try {
        await vaultInstance._setSecret(mockKey, mockValue);
      } catch (error) {
        if (error instanceof Error) {
          expect(error).toBeInstanceOf(AssertionError);
          expect(error.message).toBe(
            "The expression evaluated to a falsy value:\n\n  loggerWithContext.log('Connecting to Vault')\n"
          );
        }
      }
      vaultInstance.client = undefined;

      try {
        await vaultInstance._setSecret(mockKey, mockValue);
      } catch (error) {
        if (error instanceof Error) {
          expect(error).toBeInstanceOf(AssertionError);
          expect(error.message).toBe(
            "The expression evaluated to a falsy value:\n\n  loggerWithContext.log('Connecting to Vault')\n"
          );
        }
      }
    });

    it('should successfully set the secret and return the result', async () => {
      const mockWrite = jest.fn().mockResolvedValueOnce({ data: mockValue });
      vaultInstance.client = { write: mockWrite };

      const result = await vaultInstance._setSecret(mockKey, mockValue);

      expect(mockWrite).toHaveBeenCalledWith('kv-mount/mock-key', mockValue);
      expect(result).toEqual({ data: mockValue });
    });

    it('should throw an error if the client write method fails', async () => {
      const mockWrite = jest.fn().mockRejectedValueOnce(new Error('Failed to set secret'));
      vaultInstance.client = { write: mockWrite };

      await expect(vaultInstance._setSecret(mockKey, mockValue)).rejects.toThrow('Failed to set secret');
    });
  });

  describe('mountAll', () => {
    it('should throw an error if the client is null or undefined', async () => {
      vaultInstance.client = null;

      try {
        await vaultInstance.mountAll();
      } catch (error) {
        if (error instanceof Error) {
          expect(error).toBeInstanceOf(AssertionError);
          expect(error.message).toBe('null == true');
        }
      }

      vaultInstance.client = undefined;

      try {
        await vaultInstance.mountAll();
      } catch (error) {
        if (error instanceof Error) {
          expect(error).toBeInstanceOf(AssertionError);
          expect(error.message).toBe('undefined == true');
        }
      }
    });

    it('should call client.mount with correct arguments for pki and kv mounts', async () => {
      const mockMount = jest.fn().mockResolvedValueOnce('success');
      vaultInstance.client = { mount: mockMount };

      await vaultInstance.mountAll();

      expect(mockMount).toHaveBeenCalledTimes(2);
      expect(mockMount).toHaveBeenCalledWith({ type: 'pki', prefix: `${vaultInstance.cfg.mounts.pki}` });
      expect(mockMount).toHaveBeenCalledWith({ type: 'kv', prefix: `${vaultInstance.cfg.mounts.kv}` });
    });

    it('should return a resolved promise when both mounts succeed', async () => {
      const mockMount = jest.fn().mockResolvedValueOnce('success').mockResolvedValueOnce('success');
      vaultInstance.client = { mount: mockMount };

      const result = await vaultInstance.mountAll();

      expect(result).toEqual(['success', 'success']);
    });

    it('should throw an error if one of the mounts fails', async () => {
      const mockMount = jest
        .fn()
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('Failed to mount kv'));

      vaultInstance.client = { mount: mockMount };

      await expect(vaultInstance.mountAll()).rejects.toThrow('Failed to mount kv');
    });
  });

  describe('_deleteSecret', () => {
    it('should throw an error if the client is null or undefined', async () => {
      vaultInstance.client = null;

      try {
        await vaultInstance._deleteSecret('test-key');
      } catch (error) {
        if (error instanceof Error) {
          expect(error).toBeInstanceOf(AssertionError);
          expect(error.message).toBe('null == true');
        }
      }

      vaultInstance.client = undefined;

      try {
        await vaultInstance._deleteSecret('test-key');
      } catch (error) {
        if (error instanceof Error) {
          expect(error).toBeInstanceOf(AssertionError);
          expect(error.message).toBe('undefined == true');
        }
      }
    });

    it('should call client.delete with the correct path', async () => {
      const mockDelete = jest.fn().mockResolvedValueOnce('success');
      vaultInstance.client = { delete: mockDelete };
      vaultInstance.cfg = { mounts: { kv: 'mock-kv' } };

      await vaultInstance._deleteSecret('test-key');

      expect(mockDelete).toHaveBeenCalledWith('mock-kv/test-key');
    });

    it('should throw an error if client.delete rejects', async () => {
      const mockDelete = jest.fn().mockRejectedValueOnce(new Error('Deletion failed'));
      vaultInstance.client = { delete: mockDelete };
      vaultInstance.cfg = { mounts: { kv: 'mock-kv' } };

      await expect(vaultInstance._deleteSecret('test-key')).rejects.toThrow('Deletion failed');
    });
  });

  describe('deleteCA', () => {
    it('should throw an error if the client is null or undefined', async () => {
      vaultInstance.client = null;

      try {
        await vaultInstance.deleteCA();
      } catch (error) {
        if (error instanceof Error) {
          expect(error).toBeInstanceOf(AssertionError);
          expect(error.message).toBe('null == true');
        }
      }

      vaultInstance.client = undefined;

      try {
        await vaultInstance.deleteCA();
      } catch (error) {
        if (error instanceof Error) {
          expect(error).toBeInstanceOf(AssertionError);
          expect(error.message).toBe('undefined == true');
        }
      }
    });

    it('should call client.request with the correct parameters', async () => {
      const mockRequest = jest.fn().mockResolvedValueOnce('success');
      vaultInstance.client = { request: mockRequest };
      vaultInstance.cfg = { mounts: { pki: 'mock-pki' } };

      await vaultInstance.deleteCA();

      expect(mockRequest).toHaveBeenCalledWith({
        path: '/mock-pki/root',
        method: 'DELETE',
      });
    });

    it('should throw an error if client.request rejects', async () => {
      const mockRequest = jest.fn().mockRejectedValueOnce(new Error('Request failed'));
      vaultInstance.client = { request: mockRequest };
      vaultInstance.cfg = { mounts: { pki: 'mock-pki' } };

      await expect(vaultInstance.deleteCA()).rejects.toThrow('Request failed');
    });
  });

  describe('createCA', () => {
    const mockSubject = {
      CN: 'Common Name',
      OU: 'Organizational Unit',
      O: 'Organization',
      L: 'Locality',
      C: 'Country',
      ST: 'Province',
    };

    it('should throw an error if the client is null or undefined', async () => {
      vaultInstance.client = null;

      try {
        await vaultInstance.createCA(mockSubject);
      } catch (error) {
        if (error instanceof Error) {
          expect(error).toBeInstanceOf(AssertionError);
          expect(error.message).toBe('null == true');
        }
      }

      vaultInstance.client = undefined;

      try {
        await vaultInstance.createCA(mockSubject);
      } catch (error) {
        if (error instanceof Error) {
          expect(error).toBeInstanceOf(AssertionError);
          expect(error.message).toBe('undefined == true');
        }
      }
    });

    it('should call deleteCA before creating a new CA', async () => {
      const mockDeleteCA = jest.fn().mockResolvedValueOnce(undefined);
      vaultInstance.deleteCA = mockDeleteCA;

      const mockRequest = jest.fn().mockResolvedValueOnce({
        data: { certificate: 'mock-cert', private_key: 'mock-key' },
      });

      vaultInstance.client = { request: mockRequest };
      vaultInstance.cfg = { mounts: { pki: 'mock-pki' }, keyAlgorithm: 'RSA', keyLength: 2048 };

      const result = await vaultInstance.createCA(mockSubject);

      expect(mockDeleteCA).toHaveBeenCalled();
      expect(mockRequest).toHaveBeenCalledWith({
        path: '/mock-pki/root/generate/exported',
        method: 'POST',
        json: {
          common_name: mockSubject.CN,
          ou: mockSubject.OU,
          organization: mockSubject.O,
          locality: mockSubject.L,
          country: mockSubject.C,
          province: mockSubject.ST,
          key_type: 'RSA',
          key_bits: 2048,
        },
      });
      expect(result).toEqual({ cert: 'mock-cert', key: 'mock-key' });
    });

    //   it('should throw an error if client.request rejects', async () => {
    //     const mockRequest = jest.fn().mockRejectedValueOnce(new Error('Request failed'));
    //     vaultInstance.client = { request: mockRequest };
    //     vaultInstance.cfg = { mounts: { pki: 'mock-pki' }, keyAlgorithm: 'RSA', keyLength: 2048 };

    //     await expect(vaultInstance.createCA(mockSubject)).rejects.toThrow('Request failed');
    //   });
  });

  describe('getCA', () => {
    it('should return CA certificate when the request is successful', async () => {
      const mockRequest = jest.fn().mockResolvedValueOnce({
        data: 'mock-cert-data',
      });
      vaultInstance.client = { request: mockRequest };
      vaultInstance.cfg = { mounts: { pki: 'mock-pki' } };

      const result = await vaultInstance.getCA();

      expect(mockRequest).toHaveBeenCalledWith({
        path: '/mock-pki/ca/pem',
        method: 'GET',
      });
      expect(result.data).toBe('mock-cert-data');
    });

    it('should throw an error if the client.request fails', async () => {
      const mockRequest = jest.fn().mockRejectedValueOnce(new Error('Request failed'));
      vaultInstance.client = { request: mockRequest };
      vaultInstance.cfg = { mounts: { pki: 'mock-pki' } };

      await expect(vaultInstance.getCA()).rejects.toThrow('Request failed');
    });
  });

  describe('createDFSPServerCert', () => {
    const mockCsrParams = {
      subject: {
        CN: 'example.com',
      },
      extensions: {
        subjectAltName: {
          dns: ['example.com', 'www.example.com'],
          ips: ['192.168.1.1'],
        },
      },
    };

    it('should return certificates and private key when request is successful', async () => {
      const mockRequest = jest.fn().mockResolvedValueOnce({
        data: {
          ca_chain: 'mock-ca-chain',
          issuing_ca: 'mock-issuing-ca',
          certificate: 'mock-cert',
          private_key: 'mock-key',
        },
      });

      vaultInstance.client = { request: mockRequest };
      vaultInstance.cfg = { mounts: { pki: 'mock-pki' }, pkiServerRole: 'server-role' };
      vaultInstance.logger.push = jest.fn().mockReturnThis();
      vaultInstance.logger.log = jest.fn();

      const result = await vaultInstance.createDFSPServerCert(mockCsrParams);

      expect(mockRequest).toHaveBeenCalledWith({
        path: '/mock-pki/issue/server-role',
        method: 'POST',
        json: {
          common_name: 'example.com',
          alt_names: 'example.com,www.example.com',
          ip_sans: '192.168.1.1',
        },
      });

      expect(result).toEqual({
        intermediateChain: 'mock-ca-chain',
        rootCertificate: 'mock-issuing-ca',
        serverCertificate: 'mock-cert',
        privateKey: 'mock-key',
      });
    });

    it('should throw an error if the client.request fails', async () => {
      const mockRequest = jest.fn().mockRejectedValueOnce(new Error('Request failed'));

      vaultInstance.client = { request: mockRequest };
      vaultInstance.cfg = { mounts: { pki: 'mock-pki' }, pkiServerRole: 'server-role' };

      await expect(vaultInstance.createDFSPServerCert(mockCsrParams)).rejects.toThrow('Request failed');
    });
  });

  describe('signHubCSR', () => {
    const mockCsr = 'mock-csr';

    it('should return signed certificate when request is successful', async () => {
      const mockRequest = jest.fn().mockResolvedValueOnce({
        data: {
          certificate: 'mock-signed-cert',
        },
      });

      vaultInstance.client = { request: mockRequest };
      vaultInstance.cfg = { mounts: { pki: 'mock-pki' }, pkiClientRole: 'client-role', commonName: 'example.com' };
      vaultInstance.logger.push = jest.fn().mockReturnThis();
      vaultInstance.logger.log = jest.fn();

      const result = await vaultInstance.signHubCSR(mockCsr);

      expect(mockRequest).toHaveBeenCalledWith({
        path: '/mock-pki/sign/client-role',
        method: 'POST',
        json: {
          common_name: 'example.com',
          csr: mockCsr,
        },
      });

      expect(result).toEqual({
        certificate: 'mock-signed-cert',
      });
    });

    it('should throw an error if the client.request fails', async () => {
      const mockRequest = jest.fn().mockRejectedValueOnce(new Error('Request failed'));

      vaultInstance.client = { request: mockRequest };
      vaultInstance.cfg = { mounts: { pki: 'mock-pki' }, pkiClientRole: 'client-role', commonName: 'example.com' };

      await expect(vaultInstance.signHubCSR(mockCsr)).rejects.toThrow('Request failed');
    });
  });

  describe('setDFSPCaCertChain', () => {
    const mockCertChainPem = 'mock-cert-chain';
    const mockPrivateKeyPem = 'mock-private-key';

    it('should send a request to set the DFSP CA cert chain successfully', async () => {
      const mockRequest = jest.fn().mockResolvedValueOnce(undefined);

      vaultInstance.client = { request: mockRequest };
      vaultInstance.cfg = { mounts: { pki: 'mock-pki' } };

      await vaultInstance.setDFSPCaCertChain(mockCertChainPem, mockPrivateKeyPem);

      expect(mockRequest).toHaveBeenCalledWith({
        path: '/mock-pki/config/ca',
        method: 'POST',
        json: {
          pem_bundle: `${mockPrivateKeyPem}\n${mockCertChainPem}`,
        },
      });
    });

    it('should throw an error if client.request fails', async () => {
      const mockRequest = jest.fn().mockRejectedValueOnce(new Error('Request failed'));

      vaultInstance.client = { request: mockRequest };
      vaultInstance.cfg = { mounts: { pki: 'mock-pki' } };

      await expect(vaultInstance.setDFSPCaCertChain(mockCertChainPem, mockPrivateKeyPem)).rejects.toThrow(
        'Request failed'
      );
    });
  });

  describe('getDFSPCaCertChain', () => {
    it('should send a request to get the DFSP CA cert chain successfully', async () => {
      const mockRequest = jest.fn().mockResolvedValueOnce({
        data: {
          cert_chain: 'mock-cert-chain',
        },
      });

      vaultInstance.client = { request: mockRequest };
      vaultInstance.cfg = { mounts: { pki: 'mock-pki' } };

      const result = await vaultInstance.getDFSPCaCertChain();

      expect(mockRequest).toHaveBeenCalledWith({
        path: '/mock-pki/ca_chain',
        method: 'GET',
      });
      expect(result).toEqual({
        data: {
          cert_chain: 'mock-cert-chain',
        },
      });
    });

    it('should throw an error if client.request fails', async () => {
      const mockRequest = jest.fn().mockRejectedValueOnce(new Error('Request failed'));

      vaultInstance.client = { request: mockRequest };
      vaultInstance.cfg = { mounts: { pki: 'mock-pki' } };

      await expect(vaultInstance.getDFSPCaCertChain()).rejects.toThrow('Request failed');
    });
  });

  describe('connect()', () => {
    beforeEach(() => {  
      jest.useFakeTimers();
    });
    let vaultAuthInstance = {
      endpoint: mockEndpoint,
      token: mockToken,
      roleId: mockRoleId,
      logger: mockLogger,
      mounts: {
        pki: 'pki-mount',
        kv: 'kv-mount',
      },
      pkiServerRole: 'server-role',
      pkiClientRole: 'client-role',
      signExpiryHours: '24',
      keyLength: 2048,
      keyAlgorithm: 'rsa',
      commonName: 'test-certificate',
      auth: {},
    };

    afterEach(() => {
      jest.useRealTimers();
      jest.clearAllMocks();
      jest.restoreAllMocks();
    });

    it('should connect to Vault using AppRole auth method', async () => {
      let vaultApploginAuthInstance = new Vault({
        ...vaultAuthInstance,
        auth: {
          appRole: {
            roleId: mockRoleId,
            roleSecretId: mockSecretId,
          },
        },
      });
      const mockCreds = {
        auth: {
          client_token: 'mock-token',
          lease_duration: 60,
        },
      };
      mockVault.approleLogin.mockReturnValueOnce(Promise.resolve(mockCreds));
      jest.spyOn(global, 'setTimeout');
      await vaultApploginAuthInstance.connect();
      expect(mockLogger.push).toHaveBeenCalledWith({ endpoint: mockEndpoint });
      const tokenRefreshMs = Math.min((mockCreds.auth.lease_duration - 10) * 1000, MAX_TIMEOUT);
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), tokenRefreshMs);
      jest.advanceTimersByTime(1000);
      expect(mockLogger.push().log).toHaveBeenCalledWith('Connecting to Vault');
      expect(mockLogger.push().log).toHaveBeenCalledWith(`Connected to Vault  [reconnect after: ${tokenRefreshMs} ms]`);


      expect(mockVault.approleLogin).toHaveBeenCalledWith({
        role_id: mockRoleId,
        secret_id: mockSecretId,
      });
      expect(NodeVault).toHaveBeenCalledWith({
        endpoint: mockEndpoint,
        token: mockCreds.auth.client_token,
      });
    });

    it('should connect to Vault using K8s auth method', async () => {
      let vaultK8sAuthInstance = new Vault({
        ...vaultAuthInstance,
        auth: {
          k8s: {
            role: 'k8s-role',
            token: 'jwt-token',
          },
        },
      });
      const mockCreds = {
        auth: {
          client_token: 'mock-token',
          lease_duration: 6,
        },
      };
      mockVault.kubernetesLogin.mockReturnValueOnce(Promise.resolve(mockCreds));
      await vaultK8sAuthInstance.connect();
      expect(mockLogger.push).toHaveBeenCalledWith({ endpoint: mockEndpoint });
      expect(mockLogger.push().log).toHaveBeenCalledWith('Connecting to Vault');
      const tokenRefreshMs = Math.min((mockCreds.auth.lease_duration - 10) * 1000, MAX_TIMEOUT);
      expect(mockLogger.push().log).toHaveBeenCalledWith(`Connected to Vault  [reconnect after: ${tokenRefreshMs} ms]`);
      expect(mockVault.kubernetesLogin).toHaveBeenCalledWith({
        role: 'k8s-role',
        jwt: 'jwt-token',
      });
      expect(NodeVault).toHaveBeenCalledWith({
        endpoint: mockEndpoint,
        token: mockCreds.auth.client_token,
      });
    });
    it('should throw an error for unsupported auth method', async () => {
      const vaultInstance = new Vault(vaultAuthInstance);
      await expect(vaultInstance.connect()).rejects.toThrow('Unsupported auth method');
    });
  });

  describe('disconnect method', () => {
    it('should clear reconnectTimer if set', () => {
      const mockClearTimeout = jest.fn();
      global.clearTimeout = mockClearTimeout;
      vaultInstance.reconnectTimer = 12345;

      vaultInstance.disconnect();
      expect(mockClearTimeout).toHaveBeenCalledWith(vaultInstance.reconnectTimer);
    });

    it('should not call clearTimeout if reconnectTimer is not set', () => {
      const mockClearTimeout = jest.fn();
      global.clearTimeout = mockClearTimeout;
      vaultInstance.reconnectTimer = null;

      vaultInstance.disconnect();
      expect(mockClearTimeout).not.toHaveBeenCalled();
    });
  });

  it('should handle createPkiRoles', async () => {
    // The createPkiRoles method is currently empty with the code commented out,
    // so it is expected to return `undefined`.
    // This test acts as a placeholder so that if the method is implemented in the future,
    // the test will fail, alerting us to update the test case accordingly.
    const result = await vaultInstance.createPkiRoles();
    expect(result).toBeUndefined();
  });
});
