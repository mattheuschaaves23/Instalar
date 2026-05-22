const { Pool } = require('pg');
require('dotenv').config();

function normalizeConnectionString(value) {
  if (!value) {
    return value;
  }

  try {
    const url = new URL(value);

    if (['prefer', 'require', 'verify-ca'].includes(url.searchParams.get('sslmode'))) {
      url.searchParams.delete('sslmode');
    }

    return url.toString();
  } catch (error) {
    return value;
  }
}

const connectionString = normalizeConnectionString(process.env.DATABASE_URL);
const hasCompleteDiscreteConfig = Boolean(process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER);

const shouldUseSsl =
  process.env.DATABASE_SSL === 'true' ||
  (process.env.NODE_ENV === 'production' && Boolean(connectionString) && process.env.DATABASE_SSL !== 'false');

function withOptionalSsl(config) {
  return shouldUseSsl
    ? {
        ...config,
        ssl: { rejectUnauthorized: false },
      }
    : config;
}

const pool = new Pool(
  connectionString
    ? withOptionalSsl({ connectionString })
    : hasCompleteDiscreteConfig
      ? withOptionalSsl({
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          host: process.env.DB_HOST,
          port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
          database: process.env.DB_NAME,
        })
      : withOptionalSsl({
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          host: process.env.DB_HOST,
          port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
          database: process.env.DB_NAME,
        })
);

module.exports = pool;
