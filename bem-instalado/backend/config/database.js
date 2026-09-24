const { Pool } = require('pg');
require('dotenv').config();
const { firstEnvValue } = require('./env');

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

const connectionString = normalizeConnectionString(
  firstEnvValue(
    'DATABASE_URL',
    'POSTGRES_URL',
    'POSTGRES_PRISMA_URL',
    'URL_PRISMA_POSTGRES',
    'BANCO DE DADOS POSTGRES',
    'BANCO_DE_DADOS_POSTGRES',
    'POSTGRES_URL_NO_SSL'
  )
);
const hasCompleteDiscreteConfig = Boolean(process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER);

function positiveIntegerEnv(name, fallback, minimum = 1) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= minimum ? value : fallback;
}

const shouldUseSsl =
  firstEnvValue('DATABASE_SSL', 'BANCO_DE_DADOS_SSL') === 'true' ||
  (process.env.NODE_ENV === 'production' && Boolean(connectionString) && firstEnvValue('DATABASE_SSL', 'BANCO_DE_DADOS_SSL') !== 'false');

// Vercel functions are short-lived and may be created in parallel. A large
// default pool keeps Neon compute active unnecessarily, so production uses a
// single reusable connection unless the provider explicitly overrides it.
const poolTuning = {
  max: positiveIntegerEnv('DB_POOL_MAX', process.env.VERCEL ? 1 : 10),
  idleTimeoutMillis: positiveIntegerEnv('DB_IDLE_TIMEOUT_MS', process.env.VERCEL ? 5000 : 10000),
  connectionTimeoutMillis: positiveIntegerEnv('DB_CONNECTION_TIMEOUT_MS', 8000),
};

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
    ? withOptionalSsl({ connectionString, ...poolTuning })
    : hasCompleteDiscreteConfig
      ? withOptionalSsl({
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          host: process.env.DB_HOST,
          port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
          database: process.env.DB_NAME,
          ...poolTuning,
        })
      : withOptionalSsl({
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          host: process.env.DB_HOST,
          port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
          database: process.env.DB_NAME,
          ...poolTuning,
        })
);

module.exports = pool;
