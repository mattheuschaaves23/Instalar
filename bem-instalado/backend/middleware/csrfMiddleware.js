const crypto = require('crypto');

const SESSION_COOKIE_NAME = 'instalapro_session';
const CSRF_COOKIE_NAME = 'instalapro_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function readCookie(req, name) {
  const raw = String(req.headers.cookie || '');
  const entry = raw
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));

  if (!entry) return '';

  try {
    return decodeURIComponent(entry.slice(name.length + 1));
  } catch (_error) {
    return '';
  }
}

function hasBearerToken(req) {
  return /^Bearer\s+\S+$/i.test(String(req.headers.authorization || '').trim());
}

function createCsrfToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function setCsrfCookie(res, token) {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

function issueCsrfToken(_req, res) {
  const token = createCsrfToken();
  setCsrfCookie(res, token);
  return res.json({ csrf_token: token });
}

function clearCsrfCookie(res) {
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

function tokensMatch(first, second) {
  const firstBuffer = Buffer.from(String(first || ''));
  const secondBuffer = Buffer.from(String(second || ''));
  return firstBuffer.length > 0 && firstBuffer.length === secondBuffer.length && crypto.timingSafeEqual(firstBuffer, secondBuffer);
}

function requireCsrfForCookieSession(req, res, next) {
  if (SAFE_METHODS.has(String(req.method || '').toUpperCase()) || hasBearerToken(req)) {
    return next();
  }

  const sessionToken = readCookie(req, SESSION_COOKIE_NAME);
  if (!sessionToken) {
    return next();
  }

  const cookieToken = readCookie(req, CSRF_COOKIE_NAME);
  const headerToken = String(req.headers['x-csrf-token'] || '').trim();

  if (!tokensMatch(cookieToken, headerToken)) {
    return res.status(403).json({
      error: 'Não foi possível validar a proteção da sua sessão. Atualize a página e tente novamente.',
      code: 'CSRF_INVALID',
    });
  }

  return next();
}

module.exports = {
  clearCsrfCookie,
  issueCsrfToken,
  requireCsrfForCookieSession,
  setCsrfCookie,
};
