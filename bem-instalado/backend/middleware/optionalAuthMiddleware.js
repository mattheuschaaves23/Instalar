const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');
const pool = require('../config/database');

function normalizeAccountType(value) {
  return String(value || '').trim().toLowerCase() === 'client' ? 'client' : 'installer';
}

module.exports = async (req, _res, next) => {
  const header = String(req.headers.authorization || '').trim();

  if (!header) {
    return next();
  }

  const [scheme, token] = header.split(' ');

  if (!/^Bearer$/i.test(scheme) || !token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const { rows } = await pool.query(
      `
        SELECT id, account_type, is_admin
        FROM users
        WHERE id = $1 AND deleted_at IS NULL
        LIMIT 1
      `,
      [decoded.id]
    );
    const user = rows[0];

    if (user) {
      req.userId = user.id;
      req.user = {
        id: user.id,
        account_type: normalizeAccountType(user.account_type),
        is_admin: Boolean(user.is_admin),
      };
    }
  } catch (_error) {
    // Rotas publicas continuam anonimas quando um token antigo ou invalido e enviado.
  }

  return next();
};
