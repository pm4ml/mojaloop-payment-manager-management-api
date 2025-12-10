import { MonetaryZoneModel } from '@mojaloop/mcm-client';
import { logger } from '@app/lib/logger';
import MonetaryZone from '../../../../src/lib/model/MonetaryZone';

jest.mock('@mojaloop/mcm-client');

describe('MonetaryZone', () => {
  let mockLogger;
  let mockMcmServerEndpoint;
  let monetaryZone;

  beforeEach(() => {
    mockLogger = logger;
    mockMcmServerEndpoint = 'http://mock-endpoint';
    monetaryZone = new MonetaryZone({
      logger: mockLogger,
      mcmServerEndpoint: mockMcmServerEndpoint,
    });
  });

  test('should initialize correctly', () => {
    expect(monetaryZone).toBeInstanceOf(MonetaryZone);
    expect(monetaryZone._logger).toBe(mockLogger);
    expect(monetaryZone._requests).toBeInstanceOf(MonetaryZoneModel);
    expect(MonetaryZoneModel).toHaveBeenCalledWith({
      logger: mockLogger,
      hubEndpoint: mockMcmServerEndpoint,
    });
  });

  test('getMonetaryZones should call getMonetaryZones on MonetaryZoneModel', async () => {
    const mockGetMonetaryZones = jest.fn().mockResolvedValue(['USD', 'EUR']);
    monetaryZone._requests.getMonetaryZones = mockGetMonetaryZones;

    const result = await monetaryZone.getMonetaryZones();

    expect(mockGetMonetaryZones).toHaveBeenCalled();
    expect(result).toEqual(['USD', 'EUR']);
  });
});
