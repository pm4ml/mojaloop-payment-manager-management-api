import env from 'env-var';
require('dotenv').config();

export default {
  host: env.get('DATABASE_HOST').default('localhost').asString(),
  port: env.get('DATABASE_PORT').default('3306').asPortNumber(),
  user: env.get('DATABASE_USER').default('root').asString(),
  password: env.get('DATABASE_PASSWORD').default('mgmt').asString(),
  database: env.get('DATABASE_DATABASE').default('mgmt').asString(),
};
