const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');
const pool = require('../config/database');

function normalizeAccountType(value) {
  return String(value || '').trim().toLowerCase() === 'client' ? 'client' : 'installer';
}

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: 'Token nao informado.' });
  }

  const [scheme, token] = header.split(' ');

  if (!/^Bearer$/i.test(scheme) || !token) {
    return res.status(401).json({ error: 'Token mal formatado.' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const { rows } = await pool.query(
      `
        SELECT id, account_type, is_admin
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [decoded.id]
    );
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Usuario nao autenticado.' });
    }

    req.userId = user.id;
    req.user = {
      id: user.id,
      account_type: normalizeAccountType(user.account_type),
      is_admin: Boolean(user.is_admin),
    };

    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Token invalido.' });
  }
};
