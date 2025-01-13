import DFSP from '../../../../src/lib/model/DFSP';
import 'jest';
import { DFSPConfigModel, DFSPEndpointModel } from '@pm4ml/mcm-client';

jest.mock('@pm4ml/mcm-client');

describe('DFSP', () => {
  let dfsp;
  const mockLogger = { log: jest.fn() };
  const mockDfspId = 'dfsp-id';
  const mockMcmServerEndpoint = 'http://mcm-server';

  beforeEach(() => {
    dfsp = new DFSP({
      logger: mockLogger,
      dfspId: mockDfspId,
      mcmServerEndpoint: mockMcmServerEndpoint,
    });
  });

  test('constructor initializes properties correctly', () => {
    expect(dfsp._logger).toBe(mockLogger);
    expect(dfsp._dfspId).toBe(mockDfspId);
    expect(dfsp._mcmDFSPConfigModel).toBeInstanceOf(DFSPConfigModel);
    expect(dfsp._endpointModel).toBeInstanceOf(DFSPEndpointModel);
    expect(dfsp._mcmDFSPConfigModel.dfspId).toBe(mockDfspId);
    expect(dfsp._mcmDFSPConfigModel.logger).toBe(mockLogger);
    expect(dfsp._mcmDFSPConfigModel.hubEndpoint).toBe(mockMcmServerEndpoint);
    expect(dfsp._endpointModel.dfspId).toBe(mockDfspId);
    expect(dfsp._endpointModel.logger).toBe(mockLogger);
    expect(dfsp._endpointModel.hubEndpoint).toBe(mockMcmServerEndpoint);
  });

  test('getDfspStatus', async () => {
      const mockStatus = { status: 'active' };
      DFSPConfigModel.prototype.findStatus = jest.fn().mockResolvedValue(mockStatus);
  
      dfsp = new DFSP({
          logger: console,
          dfspId: 'test-dfsp',
          mcmServerEndpoint: 'http://localhost:3000'
      });
  
      const result = await dfsp.getDfspStatus();
      expect(result).toEqual(mockStatus);
      expect(DFSPConfigModel.prototype.findStatus).toHaveBeenCalled();
  });

  test('getDfspDetails', async () => {
    const mockDfspList = [{ id: mockDfspId, name: 'DFSP Name' }];
    DFSPConfigModel.prototype.getDFSPList = jest.fn().mockResolvedValue(mockDfspList);

    const result = await dfsp.getDfspDetails();
    expect(result).toEqual(mockDfspList);
    expect(DFSPConfigModel.prototype.getDFSPList).toHaveBeenCalled();
  });

  // Add more tests for other methods
  test('getAllDfsps', async () => {
    const mockDfsps = [{ id: 'dfsp1' }, { id: 'dfsp2' }];
    DFSPConfigModel.prototype.getAllDfsps = jest.fn().mockResolvedValue(mockDfsps);

    const result = await dfsp.getAllDfsps();
    expect(result).toEqual(mockDfsps);
    expect(DFSPConfigModel.prototype.getAllDfsps).toHaveBeenCalled();
  });

  test('getDfspsByMonetaryZone', async () => {
    const mockZone = 'zone1';
    const mockDfsps = [{ id: 'dfsp1' }];
    DFSPConfigModel.prototype.getDfspsByMonetaryZone = jest.fn().mockResolvedValue(mockDfsps);

    const result = await dfsp.getDfspsByMonetaryZone(mockZone);
    expect(result).toEqual(mockDfsps);
    expect(DFSPConfigModel.prototype.getDfspsByMonetaryZone).toHaveBeenCalledWith(mockZone);
  });

  test('getEndpoints', async () => {
    const mockEndpoints = [{ id: 'endpoint1' }];
    DFSPEndpointModel.prototype.getEndpoints = jest.fn().mockResolvedValue(mockEndpoints);

    const result = await dfsp.getEndpoints();
    expect(result).toEqual(mockEndpoints);
    expect(DFSPEndpointModel.prototype.getEndpoints).toHaveBeenCalled();
  });

  test('createEndpoints', async () => {
    const mockEndpoint = { id: 'endpoint1' };
    DFSPEndpointModel.prototype.createEndpoint = jest.fn().mockResolvedValue(mockEndpoint);

    const result = await dfsp.createEndpoints(mockEndpoint);
    expect(result).toEqual(mockEndpoint);
    expect(DFSPEndpointModel.prototype.createEndpoint).toHaveBeenCalledWith(mockEndpoint);
  });

  test('updateEndpoint', async () => {
    const mockEndpoint = { id: 'endpoint1' };
    DFSPEndpointModel.prototype.updateEndpoint = jest.fn().mockResolvedValue(mockEndpoint);

    const result = await dfsp.updateEndpoint(mockEndpoint);
    expect(result).toEqual(mockEndpoint);
    expect(DFSPEndpointModel.prototype.updateEndpoint).toHaveBeenCalledWith(mockEndpoint);
  });

  test('deleteEndpoint', async () => {
    const mockEndpointId = 'endpoint1';
    DFSPEndpointModel.prototype.deleteEndpoint = jest.fn().mockResolvedValue(true);

    const result = await dfsp.deleteEndpoint(mockEndpointId);
    expect(result).toBe(true);
    expect(DFSPEndpointModel.prototype.deleteEndpoint).toHaveBeenCalledWith(mockEndpointId);
  });
});