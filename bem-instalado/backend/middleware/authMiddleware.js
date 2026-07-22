const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');
const pool = require('../config/database');

function normalizeAccountType(value) {
  return String(value || '').trim().toLowerCase() === 'client' ? 'client' : 'installer';
}

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: 'Token nao informado.', code: 'AUTH_TOKEN_MISSING' });
  }

  const [scheme, token] = header.split(' ');

  if (!/^Bearer$/i.test(scheme) || !token) {
    return res.status(401).json({ error: 'Token mal formatado.', code: 'AUTH_TOKEN_MALFORMED' });
  }

  let decoded;

  try {
    decoded = jwt.verify(token, jwtSecret);
  } catch (_error) {
    return res.status(401).json({ error: 'Token invalido.', code: 'AUTH_TOKEN_INVALID' });
  }

  try {
    const { rows } = await pool.query(
      `
        SELECT id, account_type, is_admin, auth_version
        FROM users
        WHERE id = $1 AND deleted_at IS NULL
        LIMIT 1
      `,
      [decoded.id]
    );
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Usuario nao autenticado.', code: 'AUTH_USER_NOT_FOUND' });
    }

    if (Number(decoded.v ?? 0) !== Number(user.auth_version ?? 0)) {
      return res.status(401).json({ error: 'Sessao expirada.', code: 'AUTH_SESSION_REVOKED' });
    }

    req.userId = user.id;
    req.user = {
      id: user.id,
      account_type: normalizeAccountType(user.account_type),
      is_admin: Boolean(user.is_admin),
    };

    return next();
  } catch (_error) {
    return res.status(503).json({
      error: 'Nao foi possivel validar sua sessao agora. Tente novamente.',
      code: 'AUTH_SERVICE_UNAVAILABLE',
    });
  }
};
