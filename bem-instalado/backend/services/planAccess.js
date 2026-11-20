const pool = require('../config/database');
const { buildPlanAccess, isProSubscription } = require('../utils/planAccess');

async function getLatestSubscription(userId, db = pool) {
  const result = await db.query(
    `
      SELECT *
      FROM subscriptions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function ensureFreeSubscription(userId, db = pool) {
  const existing = await getLatestSubscription(userId, db);

  if (!existing) {
    const created = await db.query(
      `
        INSERT INTO subscriptions (user_id, plan, status, expires_at)
        VALUES ($1, 'free', 'active', NULL)
        RETURNING *
      `,
      [userId]
    );
    return created.rows[0];
  }

  const normalizedPlan = String(existing.plan || '').trim().toLowerCase();
  const shouldDowngrade =
    normalizedPlan === 'trial'
    || existing.status !== 'active'
    || (['pro', 'monthly'].includes(normalizedPlan) && !isProSubscription(existing));
  const shouldRepairFree = normalizedPlan === 'free' && (existing.status !== 'active' || existing.expires_at);

  if (!shouldDowngrade && !shouldRepairFree) return existing;

  const updated = await db.query(
    `
      UPDATE subscriptions
      SET plan = 'free', status = 'active', expires_at = NULL, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [existing.id]
  );
  return updated.rows[0];
}

async function getInstallerPlanAccess(userId, db = pool, options = {}) {
  const includeUsage = options.includeUsage !== false;
  const [userResult, subscription] = await Promise.all([
    db.query(
      `
        SELECT
          is_admin,
          CASE
            WHEN jsonb_typeof(COALESCE(installation_gallery, '[]'::jsonb)) = 'array'
              THEN jsonb_array_length(COALESCE(installation_gallery, '[]'::jsonb))
            ELSE 0
          END::int AS portfolio_photos
        FROM users
        WHERE id = $1 AND deleted_at IS NULL
        LIMIT 1
      `,
      [userId]
    ),
    ensureFreeSubscription(userId, db),
  ]);
  const user = userResult.rows[0];

  if (!user) {
    const error = new Error('Usuário não encontrado.');
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  let usage = { portfolio_photos: Number(user.portfolio_photos || 0) };

  if (includeUsage) {
    const usageResult = await db.query(
      `
        SELECT
          (SELECT COUNT(*)::int FROM clients WHERE user_id = $1) AS clients,
          (
            SELECT COUNT(*)::int
            FROM budgets
            WHERE user_id = $1
              AND status IS DISTINCT FROM 'draft'
              AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)
              AND created_at < date_trunc('month', CURRENT_TIMESTAMP) + INTERVAL '1 month'
          ) AS monthly_budgets,
          (
            SELECT COUNT(*)::int
            FROM service_request_interests sri
            JOIN service_requests sr ON sr.id = sri.request_id
            WHERE sri.installer_id = $1 AND sr.direct_installer_id IS NULL
              AND sri.created_at >= date_trunc('month', CURRENT_TIMESTAMP)
              AND sri.created_at < date_trunc('month', CURRENT_TIMESTAMP) + INTERVAL '1 month'
          ) AS monthly_interests,
          (
            SELECT COUNT(*)::int
            FROM installer_availability_slots
            WHERE user_id = $1
              AND is_active = TRUE
              AND slot_date >= CURRENT_DATE
          ) AS availability_slots
      `,
      [userId]
    );
    usage = { ...usage, ...usageResult.rows[0] };
  }

  return buildPlanAccess({
    subscription,
    usage,
    isAdmin: Boolean(user.is_admin),
    launchAccess: false,
  });
}

function isLimitReached(planAccess, usageKey) {
  const limit = planAccess?.limits?.[usageKey];
  if (limit === null || limit === undefined) return false;
  return Number(planAccess?.usage?.[usageKey] || 0) >= Number(limit);
}

function upgradeRequired(res, {
  code,
  error,
  planAccess,
  feature = null,
}) {
  return res.status(403).json({
    error,
    code,
    feature,
    upgrade_required: true,
    plan_access: planAccess,
  });
}

module.exports = {
  ensureFreeSubscription,
  getInstallerPlanAccess,
  getLatestSubscription,
  isLimitReached,
  upgradeRequired,
};
