const pool = require('../config/database');

function isSubscriptionActive(subscription) {
  if (!subscription) {
    return false;
  }

  const isExpired = Boolean(subscription.expires_at && new Date(subscription.expires_at) < new Date());
  return subscription.status === 'active' && !isExpired;
}

async function isAdmin(userId) {
  const result = await pool.query(
    `
      SELECT is_admin
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  return Boolean(result.rows[0]?.is_admin);
}

module.exports = async (req, res, next) => {
  try {
    if (req.user?.account_type === 'client') {
      return res.status(403).json({
        error: 'Acesso restrito a instaladores.',
        code: 'ACCOUNT_TYPE_FORBIDDEN',
        account_type: 'client',
        required_account_type: 'installer',
      });
    }

    if (await isAdmin(req.userId)) {
      return next();
    }

    const subscriptionResult = await pool.query(
      `
        SELECT *
        FROM subscriptions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [req.userId]
    );

    if (isSubscriptionActive(subscriptionResult.rows[0] || null)) {
      return next();
    }

    return res.status(403).json({ error: 'Assinatura inativa.', code: 'SUBSCRIPTION_INACTIVE' });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao validar assinatura.' });
  }
};
