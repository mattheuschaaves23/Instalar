const crypto = require('crypto');
const { firstEnvValue } = require('../config/env');

function suppliedToken(req) {
  const authorization = String(req.get('authorization') || '');
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  return String(req.get('x-operations-token') || bearer || '').trim();
}

function hasExpectedToken(received, expected) {
  if (!expected || !received) return false;

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function hasOperationsAccess(req) {
  const received = suppliedToken(req);
  const acceptedTokens = [
    firstEnvValue('OPERATIONS_TOKEN', 'TOKEN_DE_OPERAÇÕES'),
    firstEnvValue('CRON_SECRET'),
  ]
    .filter(Boolean);

  return acceptedTokens.some((expected) => hasExpectedToken(received, expected));
}

function requireOperationsAccess(req, res, next) {
  if (!hasOperationsAccess(req)) {
    return res.status(401).json({ error: 'Credencial operacional inválida.' });
  }
  return next();
}

module.exports = { hasOperationsAccess, requireOperationsAccess };
