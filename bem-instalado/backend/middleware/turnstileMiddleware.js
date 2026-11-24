const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const { firstEnvValue } = require('../config/env');

function getSecret() {
  return firstEnvValue('TURNSTILE_SECRET_KEY', 'CHAVE SECRETA DA CATRACA');
}

function isTurnstileEnabled() {
  return Boolean(getSecret());
}

function getClientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
}

async function verifyTurnstile(req, res, next, requiredAction) {
  const secret = getSecret();
  if (!secret) {
    // Pedido direto ao instalador (acao obrigatoria): sem chave, recusa em qualquer ambiente (regra do main).
    if (requiredAction) {
      return res.status(503).json({ error: 'A verificação de segurança está indisponível. Tente novamente mais tarde.', code: 'TURNSTILE_UNAVAILABLE' });
    }
    // Fora de produção (desenvolvimento local e testes) a chave é opcional.
    if (process.env.NODE_ENV !== 'production') return next();
    // Em produção, sem chave, falha fechado: antes o anti-robô era pulado em silêncio.
    console.error('Turnstile: TURNSTILE_SECRET_KEY ausente em produção; formulário protegido recusado.');
    return res.status(503).json({
      error: 'A verificação de segurança não está configurada no servidor. Tente novamente mais tarde ou fale com o suporte.',
      code: 'TURNSTILE_NOT_CONFIGURED',
    });
  }

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
    if (!response.ok || !verification?.success || (requiredAction && verification.action !== requiredAction)) {
      return res.status(403).json({ error: 'A verificação de segurança expirou. Tente novamente.', code: 'TURNSTILE_INVALID' });
    }
    return next();
  } catch (_error) {
    return res.status(503).json({ error: 'Não foi possível concluir a verificação de segurança. Tente novamente.', code: 'TURNSTILE_UNAVAILABLE' });
  } finally {
    clearTimeout(timeout);
  }
}

const requireTurnstile = (req, res, next) => verifyTurnstile(req, res, next);
const requireDirectRequestTurnstile = (req, res, next) => verifyTurnstile(req, res, next, 'direct_service_request');

module.exports = { getClientIp, isTurnstileEnabled, requireTurnstile, requireDirectRequestTurnstile };
