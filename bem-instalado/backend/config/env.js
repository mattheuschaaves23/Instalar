/**
 * Resolve an environment variable from the canonical name and any legacy
 * aliases that may have been used during the first production setup.
 *
 * Keeping this fallback in one place lets us accept an already-configured
 * deployment without weakening validation or exposing secret values.
 */
function firstEnvValue(...names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
  }

  return '';
}

const ENV_ALIASES = {
  DATABASE_URL: [
    'POSTGRES_URL',
    'POSTGRES_PRISMA_URL',
    'URL_PRISMA_POSTGRES',
    'BANCO DE DADOS POSTGRES',
    'BANCO_DE_DADOS_POSTGRES',
    'POSTGRES_URL_NO_SSL',
  ],
  APP_URL: ['URL_DO_APLICATIVO'],
  FRONTEND_URL: ['URL_FRONTEND'],
  SMTP_USER: ['USUÁRIO SMTP'],
  SMTP_PORT: ['PORTA_SMTP'],
  SMTP_SECURE: ['SMTP_SEGURO'],
  SENTRY_DSN: ['SENTINELA_DSN'],
  TURNSTILE_SECRET_KEY: ['CHAVE SECRETA DA CATRACA'],
  OPERATIONS_TOKEN: ['TOKEN_DE_OPERAÇÕES'],
  TWO_FACTOR_ENCRYPTION_KEY: ['CHAVE DE CRIPTOGRAFIA DE DOIS FATORES'],
  DATABASE_SSL: ['BANCO_DE_DADOS_SSL'],
};

function applyEnvironmentAliases() {
  for (const [canonical, aliases] of Object.entries(ENV_ALIASES)) {
    if (!String(process.env[canonical] || '').trim()) {
      const value = firstEnvValue(...aliases);
      if (value) process.env[canonical] = value;
    }
  }
}

applyEnvironmentAliases();

module.exports = { applyEnvironmentAliases, firstEnvValue };
