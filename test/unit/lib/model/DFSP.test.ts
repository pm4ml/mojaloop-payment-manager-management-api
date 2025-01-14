import 'jest';
import DFSP from '../../../../src/lib/model/DFSP';
import { DFSPConfigModel, DFSPEndpointModel } from '@pm4ml/mcm-client';
import SDKStandardComponents from '@mojaloop/sdk-standard-components';
import Logger = SDKStandardComponents.Logger.Logger;

describe('DFSP Class', () => {
  const logger = new Logger({ stringify: true });
  const dfspId = 'test-dfsp';
  const mcmServerEndpoint = 'http://mock-endpoint';

  let dfsp: DFSP;

  beforeEach(() => {
    dfsp = new DFSP({ logger, dfspId, mcmServerEndpoint });
    jest.clearAllMocks();
  });

  it('should initialize correctly', () => {
    expect(dfsp).toBeInstanceOf(DFSP);
    expect(dfsp._dfspId).toBe(dfspId);
    expect(dfsp._mcmDFSPConfigModel).toBeInstanceOf(DFSPConfigModel);
    expect(dfsp._endpointModel).toBeInstanceOf(DFSPEndpointModel);
  });

  test('getDfspStatus', async () => {
    const mockStatus = { status: 'active' };
    DFSPConfigModel.prototype.findStatus = jest.fn().mockResolvedValue(mockStatus);

    dfsp = new DFSP({
      logger: console,
      dfspId: 'test-dfsp',
      mcmServerEndpoint: 'http://localhost:3000',
    });

    const result = await dfsp.getDfspStatus();
    expect(result).toEqual(mockStatus);
    expect(DFSPConfigModel.prototype.findStatus).toHaveBeenCalled();
  });

  describe('getDfspStatus', () => {
    it('should call findStatus on DFSPConfigModel', async () => {
      const mockFindStatus = jest.spyOn(dfsp._mcmDFSPConfigModel, 'findStatus').mockResolvedValueOnce('Active');

      const result = await dfsp.getDfspStatus();

      expect(mockFindStatus).toHaveBeenCalledTimes(1);
      expect(result).toBe('Active');
    });
  });

  describe('getDfspDetails', () => {
    it('should return the DFSP details for the given dfspId', async () => {
      const mockGetDFSPList = jest
        .spyOn(dfsp._mcmDFSPConfigModel, 'getDFSPList')
        .mockResolvedValueOnce([{ id: dfspId }, { id: 'another-dfsp' }]);

      const result = await dfsp.getDfspDetails();

      expect(mockGetDFSPList).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ id: dfspId });
    });
  });

  describe('getAllDfsps', () => {
    it('should return the list of all DFSPS', async () => {
      const mockGetDFSPList = jest
        .spyOn(dfsp._mcmDFSPConfigModel, 'getDFSPList')
        .mockResolvedValueOnce([{ id: 'dfsp1' }, { id: 'dfsp2' }]);

      const result = await dfsp.getAllDfsps();

      expect(mockGetDFSPList).toHaveBeenCalledTimes(1);
      expect(result).toEqual([{ id: 'dfsp1' }, { id: 'dfsp2' }]);
    });
  });

  describe('getDfspsByMonetaryZone', () => {
    it('should return DFSPS for a given monetary zone', async () => {
      const opts = { monetaryZoneId: 'zone1' };
      const mockGetDFSPListByMonetaryZone = jest
        .spyOn(dfsp._mcmDFSPConfigModel, 'getDFSPListByMonetaryZone')
        .mockResolvedValueOnce([{ id: 'dfsp1' }]);

      const result = await dfsp.getDfspsByMonetaryZone(opts);

      expect(mockGetDFSPListByMonetaryZone).toHaveBeenCalledWith(opts);
      expect(result).toEqual([{ id: 'dfsp1' }]);
    });
  });

  describe('Endpoints Operations', () => {
    describe('getEndpoints', () => {
      it('should return a list of endpoints', async () => {
        const opts = { direction: 'INGRESS' };
        const mockFindAll = jest.spyOn(dfsp._endpointModel, 'findAll').mockResolvedValueOnce([{ id: 'endpoint1' }]);

        const result = await dfsp.getEndpoints(opts);

        expect(mockFindAll).toHaveBeenCalledWith(opts);
        expect(result).toEqual([{ id: 'endpoint1' }]);
      });
    });

    describe('createEndpoints', () => {
      it('should create a new endpoint', async () => {
        const opts = { direction: 'INGRESS', type: 'IP', address: '127.0.0.1' };
        const mockCreate = jest.spyOn(dfsp._endpointModel, 'create').mockResolvedValueOnce({ id: 'endpoint1' });

        const result = await dfsp.createEndpoints(opts);

        expect(mockCreate).toHaveBeenCalledWith(opts);
        expect(result).toEqual({ id: 'endpoint1' });
      });
    });

    describe('updateEndpoint', () => {
      it('should update an endpoint', async () => {
        const opts = { direction: 'INGRESS', type: 'IP', address: '127.0.0.1' };
        const mockUpdate = jest.spyOn(dfsp._endpointModel, 'update').mockResolvedValueOnce({ id: 'endpoint1' });

        const result = await dfsp.updateEndpoint(opts);

        expect(mockUpdate).toHaveBeenCalledWith(opts);
        expect(result).toEqual({ id: 'endpoint1' });
      });
    });

    describe('deleteEndpoint', () => {
      it('should delete an endpoint', async () => {
        const opts = { direction: 'INGRESS', type: 'IP', address: '127.0.0.1' };
        const mockDelete = jest.spyOn(dfsp._endpointModel, 'delete').mockResolvedValueOnce(true);

        const result = await dfsp.deleteEndpoint(opts);

        expect(mockDelete).toHaveBeenCalledWith(opts);
        expect(result).toBe(true);
      });
    });
  });
});
