const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const { firstEnvValue } = require('../config/env');

function getSecret() {
  return firstEnvValue('TURNSTILE_SECRET_KEY', 'CHAVE SECRETA DA CATRACA');
}

function isTurnstileEnabled() {
  return Boolean(getSecret());
}

function getClientIp(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || '';
}

async function requireTurnstile(req, res, next) {
  const secret = getSecret();
  if (!secret) return next();

  const token = String(req.body?.turnstile_token || '').trim();
  if (!token) {
    return res.status(403).json({ error: 'Confirme que você é uma pessoa antes de continuar.', code: 'TURNSTILE_REQUIRED' });
  }

  const payload = new URLSearchParams({ secret, response: token });
  const remoteIp = getClientIp(req);
  if (remoteIp) payload.set('remoteip', remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload,
      signal: controller.signal,
    });
    const verification = await response.json().catch(() => null);
    if (!response.ok || !verification?.success) {
      return res.status(403).json({ error: 'A verificação de segurança expirou. Tente novamente.', code: 'TURNSTILE_INVALID' });
    }
    return next();
  } catch (_error) {
    return res.status(503).json({ error: 'Não foi possível concluir a verificação de segurança. Tente novamente.', code: 'TURNSTILE_UNAVAILABLE' });
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { getClientIp, isTurnstileEnabled, requireTurnstile };
