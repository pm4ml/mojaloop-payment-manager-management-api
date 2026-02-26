
const mockCacheFactory = ({
  pingResponse = true,
} = {}) => ({
  db: {} as any,
  redisCache: {
    ping: jest.fn().mockResolvedValue(pingResponse),
    disconnect: jest.fn()
  },
  destroy: jest.fn(),
} as any); // todo: remove any with TCachedDb

const mockVaultFactory = ({
                            healthCheckResponse = { status: 'OK' },
                          } = {}) => ({
  healthCheck: jest.fn().mockResolvedValue(healthCheckResponse)
} as any); // todo: remove any

const mockControlServerFactory = ({
                                    healthCheckResponse = { server: { running: true } },
                                  } = {}) => ({
  healthCheck: jest.fn().mockResolvedValue(healthCheckResponse)
} as any); // todo: remove any


const mockStateMachineFactory = () => ({ sendEvent: jest.fn() })

export {
  mockCacheFactory,
  mockVaultFactory,
  mockControlServerFactory,
  mockStateMachineFactory
}
