const crypto = require('crypto');
const pool = require('../config/database');

function cleanText(value, maxLength = 1000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function hash(value) {
  return value ? crypto.createHash('sha256').update(String(value)).digest('hex') : null;
}

function safeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  const result = {};
  const blocked = /token|password|authorization|cookie|document|phone|email/i;

  Object.entries(metadata).slice(0, 20).forEach(([key, value]) => {
    if (blocked.test(key)) return;
    if (['string', 'number', 'boolean'].includes(typeof value)) {
      result[cleanText(key, 60)] = typeof value === 'string' ? cleanText(value, 300) : value;
    }
  });

  return result;
}

async function logApplicationError({
  source = 'backend',
  severity = 'error',
  message,
  stack,
  req,
  statusCode = 500,
  metadata = {},
}) {
  try {
    await pool.query(
      `
        INSERT INTO application_errors (
          source, severity, message, route, method, status_code,
          user_id, stack_hash, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      `,
      [
        cleanText(source, 30) || 'backend',
        cleanText(severity, 20) || 'error',
        cleanText(message, 1200) || 'Erro sem mensagem',
        cleanText(req?.originalUrl || req?.path, 240) || null,
        cleanText(req?.method, 12) || null,
        Number.isFinite(Number(statusCode)) ? Number(statusCode) : 500,
        Number.isFinite(Number(req?.userId)) ? Number(req.userId) : null,
        hash(stack || message),
        JSON.stringify(safeMetadata(metadata)),
      ]
    );
  } catch (monitoringError) {
    console.error('Falha ao registrar erro da aplicacao:', monitoringError.message);
  }
}

module.exports = { logApplicationError, cleanText, safeMetadata };
