const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/database');

const MAX_ATTEMPTS = Number(process.env.DB_INIT_MAX_ATTEMPTS || 20);
const RETRY_DELAY_MS = Number(process.env.DB_INIT_RETRY_DELAY_MS || 3000);
const RETRYABLE_CODES = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN']);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(error) {
  return RETRYABLE_CODES.has(error?.code) || error?.errno === -3008;
}

async function initDatabase() {
  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const schema = (await fs.readFile(schemaPath, 'utf8')).replace(/^\uFEFF/, '');

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        await pool.query(schema);
        console.log('Schema do banco validado com sucesso.');
        return;
      } catch (error) {
        if (attempt >= MAX_ATTEMPTS || !shouldRetry(error)) {
          throw error;
        }

        console.log(
          `Banco indisponivel (${error.code || error.message}). Nova tentativa ${attempt + 1}/${MAX_ATTEMPTS} em ${RETRY_DELAY_MS}ms.`
        );
        await wait(RETRY_DELAY_MS);
      }
    }
  } finally {
    await pool.end();
  }
}

initDatabase().catch((error) => {
  console.error('Falha ao inicializar o banco de dados.');
  console.error(error);
  process.exit(1);
});
