const crypto = require('crypto');
const pool = require('../config/database');
const { notifyOperationalAlert } = require('../services/operationalAlerts');
const { captureException } = require('../services/sentry');
const { redactDiagnostic, diagnosticRoute } = require('./monitoringPrivacy');

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
      const name = cleanText(key, 60);
      if (!name || ['__proto__', 'prototype', 'constructor'].includes(name)) return;
      result[name] = typeof value === 'string' ? redactDiagnostic(value, 300) : value;
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
  notifyExternally = true,
}) {
  const route = diagnosticRoute(req);
  const safeMessage = redactDiagnostic(message) || 'Erro sem mensagem';
  const safeStack = redactDiagnostic(stack, 8000);
  const shouldNotify = notifyExternally && String(severity).toLowerCase() !== 'info';
  const sentryContext = {
    level: String(severity || 'error').toLowerCase(),
    method: cleanText(req?.method, 12),
    route,
    source: cleanText(source, 30) || 'backend',
    statusCode: Number(statusCode) || 500,
  };

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
        safeMessage,
        route || null,
        cleanText(req?.method, 12) || null,
        Number.isFinite(Number(statusCode)) ? Number(statusCode) : 500,
        Number.isFinite(Number(req?.userId)) ? Number(req.userId) : null,
        hash(safeStack || safeMessage),
        JSON.stringify(safeMetadata(metadata)),
      ]
    );
    if (shouldNotify) {
      void captureException(Object.assign(new Error(safeMessage), { stack: safeStack || undefined }), sentryContext);
      void notifyOperationalAlert({
        severity: String(severity || 'error').toLowerCase(),
        source: cleanText(source, 30) || 'backend',
        message: safeMessage.slice(0, 700),
        metadata: {
          route,
          method: cleanText(req?.method, 12),
          status_code: Number(statusCode) || 500,
        },
      });
    }
  } catch (monitoringError) {
    if (shouldNotify) {
      void captureException(Object.assign(new Error(safeMessage), { stack: safeStack || undefined }), sentryContext);
    }
    console.error('Falha ao registrar erro da aplicação:', redactDiagnostic(monitoringError.message, 200));
  }
}

module.exports = { logApplicationError, cleanText, safeMetadata };
