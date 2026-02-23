export const HealthStatus = {
  OK: 'OK',
  DOWN: 'DOWN',
} as const;
export type THealthStatusValue = (typeof HealthStatus)[keyof typeof HealthStatus];

export const RedisHealthStatus = {
  ...HealthStatus,
  NA: 'N/A',
} as const;
export type TRedisHealthStatusValue = (typeof RedisHealthStatus)[keyof typeof RedisHealthStatus];
