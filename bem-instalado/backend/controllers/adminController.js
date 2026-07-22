const pool = require('../config/database');
const ADMIN_MUTATION_LOCK_ID = 19772402;

function parseLimit(value, fallback = 20) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), 100);
}

function parseBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  }

  return null;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseInteger(value, fallback = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.trunc(parsed);
}

async function countAdmins(db = pool) {
  const result = await db.query('SELECT COUNT(*)::int AS total FROM users WHERE is_admin = TRUE AND deleted_at IS NULL');
  return Number(result.rows[0]?.total || 0);
}

function normalizeHttpUrl(value, { required = false } = {}) {
  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return required ? null : '';
  }

  try {
    const url = new URL(rawValue);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString().slice(0, 2000) : null;
  } catch (_error) {
    return null;
  }
}

async function withAdminMutationLock(callback) {
  const db = await pool.connect();

  try {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock($1)', [ADMIN_MUTATION_LOCK_ID]);
    const result = await callback(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    db.release();
  }
}

function parsePage(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1;
}

function buildPagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    total_pages: Math.max(1, Math.ceil(total / limit)),
  };
}

exports.listApplicationErrors = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 30);
    const includeResolved = parseBoolean(req.query.include_resolved) === true;
    const { rows } = await pool.query(
      `
        SELECT id, source, severity, message, route, method, status_code,
          stack_hash, metadata, resolved_at, created_at
        FROM application_errors
        WHERE ($1::boolean = TRUE OR resolved_at IS NULL)
        ORDER BY created_at DESC
        LIMIT $2
      `,
      [includeResolved, limit]
    );

    return res.json({ errors: rows });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao carregar monitoramento.' });
  }
};

exports.resolveApplicationError = async (req, res) => {
  try {
    const id = parseInteger(req.params.id, 0);
    const { rows } = await pool.query(
      `UPDATE application_errors SET resolved_at = NOW() WHERE id = $1 RETURNING id, resolved_at`,
      [id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Registro não encontrado.' });
    return res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar monitoramento.' });
  }
};

async function setSubscriptionStatus(userId, status, expiresAt = null, specificSubscriptionId = null, db = pool) {
  let targetSubscriptionId = specificSubscriptionId;

  if (!targetSubscriptionId) {
    const latestResult = await db.query(
      `
        SELECT id
        FROM subscriptions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [userId]
    );

    targetSubscriptionId = latestResult.rows[0]?.id || null;
  }

  if (targetSubscriptionId) {
    const updateResult = await db.query(
      `
        UPDATE subscriptions
        SET
          status = $1,
          expires_at = $2,
          updated_at = NOW()
        WHERE id = $3
        RETURNING id, user_id, plan, status, expires_at, updated_at
      `,
      [status, expiresAt, targetSubscriptionId]
    );

    if (updateResult.rows[0]) {
      return updateResult.rows[0];
    }
  }

  const insertResult = await db.query(
    `
      INSERT INTO subscriptions (user_id, plan, status, expires_at)
      VALUES ($1, 'monthly', $2, $3)
      RETURNING id, user_id, plan, status, expires_at, updated_at
    `,
    [userId, status, expiresAt]
  );

  return insertResult.rows[0];
}

exports.getOverview = async (_req, res) => {
  try {
    const [metricsResult, usersResult, paymentsResult, budgetsResult, requestsResult] = await Promise.all([
      pool.query(`
        WITH latest_subscriptions AS (
          SELECT DISTINCT ON (user_id)
            user_id,
            status,
            expires_at
          FROM subscriptions
          ORDER BY user_id, created_at DESC
        )
        SELECT
          (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL) AS total_users,
          (SELECT COUNT(*)::int FROM users WHERE is_admin = TRUE AND deleted_at IS NULL) AS total_admins,
          (SELECT COUNT(*)::int FROM users WHERE COALESCE(public_profile, FALSE) = TRUE AND deleted_at IS NULL) AS public_installers,
          (SELECT COUNT(*)::int FROM users WHERE COALESCE(featured_installer, FALSE) = TRUE AND deleted_at IS NULL) AS featured_installers,
          (SELECT COUNT(*)::int FROM users WHERE COALESCE(certification_verified, FALSE) = TRUE AND deleted_at IS NULL) AS certified_installers,
          (SELECT COUNT(*)::int FROM users WHERE account_type = 'client' AND deleted_at IS NULL) AS total_clients,
          (SELECT COUNT(*)::int FROM clients) AS total_legacy_clients,
          (SELECT COUNT(*)::int FROM budgets) AS total_budgets,
          (SELECT COUNT(*)::int FROM budgets WHERE status = 'pending') AS pending_budgets,
          (SELECT COUNT(*)::int FROM budgets WHERE status = 'approved') AS approved_budgets,
          (
            SELECT COALESCE(SUM(total_amount), 0)
            FROM budgets
            WHERE status = 'approved'
              AND DATE_TRUNC('month', COALESCE(approved_date, created_at)) = DATE_TRUNC('month', CURRENT_DATE)
          ) AS monthly_revenue,
          (
            SELECT COUNT(*)::int
            FROM latest_subscriptions
            WHERE status = 'active'
              AND (expires_at IS NULL OR expires_at > NOW())
          ) AS active_subscriptions,
          (
            SELECT COUNT(*)::int
            FROM latest_subscriptions
            WHERE status <> 'active'
              OR (expires_at IS NOT NULL AND expires_at <= NOW())
          ) AS inactive_subscriptions,
          (SELECT COUNT(*)::int FROM payments WHERE status = 'pending') AS pending_payments,
          (SELECT COUNT(*)::int FROM service_requests) AS total_service_requests,
          (SELECT COUNT(*)::int FROM service_requests WHERE status = 'open') AS open_service_requests,
          (SELECT COUNT(*)::int FROM service_requests WHERE status = 'selected') AS selected_service_requests,
          (
            SELECT COUNT(*)::int FROM service_requests
            WHERE created_at >= NOW() - INTERVAL '7 days'
          ) AS recent_service_requests,
          (
            SELECT COUNT(*)::int
            FROM payments
            WHERE status = 'paid'
              AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
          ) AS paid_this_month_count,
          (
            SELECT COALESCE(SUM(amount), 0)
            FROM payments
            WHERE status = 'paid'
              AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
          ) AS paid_this_month_total,
          (
            SELECT COUNT(*)::int
            FROM users
            WHERE created_at >= NOW() - INTERVAL '30 days'
          ) AS new_users_last_30_days,
          (SELECT COUNT(*)::int FROM support_conversations WHERE status = 'open') AS support_open_conversations,
          (
            SELECT COUNT(*)::int
            FROM support_ideas
            WHERE status IN ('new', 'reviewing')
          ) AS support_pending_ideas
      `),
      pool.query(`
        WITH latest_subscriptions AS (
          SELECT DISTINCT ON (user_id)
            user_id,
            status,
            expires_at
          FROM subscriptions
          ORDER BY user_id, created_at DESC
        )
        SELECT
          u.id,
          u.name,
          u.email,
          u.created_at,
          u.deleted_at,
          u.is_admin,
          u.featured_installer,
          u.certification_verified,
          u.certificate_file,
          (u.certificate_file IS NOT NULL AND LENGTH(TRIM(u.certificate_file)) > 0) AS has_certificate,
          COALESCE(ls.status, 'inactive') AS subscription_status,
          ls.expires_at
        FROM users u
        LEFT JOIN latest_subscriptions ls ON ls.user_id = u.id
        ORDER BY u.created_at DESC
        LIMIT 8
      `),
      pool.query(`
        SELECT
          p.id,
          p.amount,
          p.status,
          p.method,
          p.created_at,
          p.external_id,
          p.provider,
          u.id AS user_id,
          COALESCE(NULLIF(u.business_name, ''), u.name) AS user_name
        FROM payments p
        JOIN users u ON u.id = p.user_id
        ORDER BY p.created_at DESC
        LIMIT 8
      `),
      pool.query(`
        SELECT
          b.id,
          b.total_amount,
          b.status,
          b.created_at,
          b.approved_date,
          c.name AS client_name,
          u.id AS user_id,
          COALESCE(NULLIF(u.business_name, ''), u.name) AS installer_name
        FROM budgets b
        JOIN clients c ON c.id = b.client_id
        JOIN users u ON u.id = b.user_id
        ORDER BY b.created_at DESC
        LIMIT 8
      `),
      pool.query(`
        SELECT
          sr.id,
          sr.client_name,
          sr.service_label,
          sr.city,
          sr.state,
          sr.status,
          sr.created_at,
          COUNT(sri.id)::int AS interests_count,
          COALESCE(NULLIF(selected.business_name, ''), selected.name) AS selected_installer_name
        FROM service_requests sr
        LEFT JOIN service_request_interests sri ON sri.request_id = sr.id
        LEFT JOIN users selected ON selected.id = sr.selected_installer_id
        GROUP BY sr.id, selected.business_name, selected.name
        ORDER BY sr.created_at DESC
        LIMIT 8
      `),
    ]);

    return res.json({
      metrics: metricsResult.rows[0],
      recent_users: usersResult.rows,
      recent_payments: paymentsResult.rows,
      recent_budgets: budgetsResult.rows,
      recent_service_requests: requestsResult.rows,
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao carregar visão geral do administrador.' });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const search = String(req.query.q || '').trim();
    const status = String(req.query.status || 'all').trim().toLowerCase();
    const accountType = String(req.query.account_type || 'all').trim().toLowerCase();
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit, 20);
    const offset = (page - 1) * limit;

    const allowedStatuses = new Set(['all', 'active', 'inactive', 'canceled']);
    const safeStatus = allowedStatuses.has(status) ? status : 'all';
    const safeAccountType = ['all', 'installer', 'client'].includes(accountType) ? accountType : 'all';

    const { rows } = await pool.query(
      `
        WITH latest_subscriptions AS (
          SELECT DISTINCT ON (user_id)
            user_id,
            status,
            expires_at
          FROM subscriptions
          ORDER BY user_id, created_at DESC
        ),
        budget_stats AS (
          SELECT
            user_id,
            COUNT(*)::int AS budgets_count,
            COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_count
          FROM budgets
          GROUP BY user_id
        )
        SELECT
          u.id,
          u.account_type,
          u.name,
          u.email,
          u.phone,
          u.city,
          u.state,
          u.public_profile,
          u.is_admin,
          u.featured_installer,
          u.certification_verified,
          u.certificate_file,
          (u.certificate_file IS NOT NULL AND LENGTH(TRIM(u.certificate_file)) > 0) AS has_certificate,
          u.created_at,
          u.deleted_at,
          CASE
            WHEN COALESCE(ls.status, 'inactive') = 'active'
              AND (ls.expires_at IS NULL OR ls.expires_at > NOW())
            THEN 'active'
            WHEN COALESCE(ls.status, 'inactive') = 'canceled'
            THEN 'canceled'
            ELSE 'inactive'
          END AS subscription_status,
          ls.expires_at,
          COALESCE(bs.budgets_count, 0)::int AS budgets_count,
          COALESCE(bs.approved_count, 0)::int AS approved_count
          ,COUNT(*) OVER()::int AS total_count
        FROM users u
        LEFT JOIN latest_subscriptions ls ON ls.user_id = u.id
        LEFT JOIN budget_stats bs ON bs.user_id = u.id
        WHERE
          ($1 = '' OR u.name ILIKE ('%' || $1 || '%') OR u.email ILIKE ('%' || $1 || '%'))
          AND ($3 = 'all' OR u.account_type = $3)
          AND (
            $2 = 'all'
            OR (
              $2 = 'active'
              AND COALESCE(ls.status, 'inactive') = 'active'
              AND (ls.expires_at IS NULL OR ls.expires_at > NOW())
            )
            OR (
              $2 = 'inactive'
              AND (
                COALESCE(ls.status, 'inactive') <> 'active'
                OR (ls.expires_at IS NOT NULL AND ls.expires_at <= NOW())
              )
            )
            OR (
              $2 = 'canceled'
              AND COALESCE(ls.status, 'inactive') = 'canceled'
            )
          )
        ORDER BY u.created_at DESC
        LIMIT $4 OFFSET $5
      `,
      [search, safeStatus, safeAccountType, limit, offset]
    );

    const total = Number(rows[0]?.total_count || 0);
    return res.json({
      users: rows.map(({ total_count, ...user }) => user),
      pagination: buildPagination(page, limit, total),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao listar usuários para administração.' });
  }
};

exports.listPayments = async (req, res) => {
  try {
    const search = String(req.query.q || '').trim();
    const status = String(req.query.status || 'all').trim().toLowerCase();
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit, 20);
    const offset = (page - 1) * limit;
    const allowedStatuses = new Set(['all', 'pending', 'paid', 'failed', 'canceled']);
    const safeStatus = allowedStatuses.has(status) ? status : 'all';

    const { rows } = await pool.query(
      `
        SELECT
          p.id,
          p.user_id,
          p.subscription_id,
          p.amount,
          p.status,
          p.method,
          p.provider,
          p.external_id,
          p.provider_payment_id,
          p.created_at,
          p.updated_at,
          COALESCE(NULLIF(u.business_name, ''), u.name) AS user_name,
          u.email AS user_email,
          COUNT(*) OVER()::int AS total_count
        FROM payments p
        JOIN users u ON u.id = p.user_id
        WHERE
          ($1 = '' OR u.name ILIKE ('%' || $1 || '%') OR u.email ILIKE ('%' || $1 || '%') OR COALESCE(p.external_id, '') ILIKE ('%' || $1 || '%'))
          AND ($2 = 'all' OR p.status = $2)
        ORDER BY p.created_at DESC
        LIMIT $3 OFFSET $4
      `,
      [search, safeStatus, limit, offset]
    );

    const total = Number(rows[0]?.total_count || 0);
    return res.json({
      payments: rows.map(({ total_count, ...payment }) => payment),
      pagination: buildPagination(page, limit, total),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao listar pagamentos para administração.' });
  }
};

exports.listServiceRequests = async (req, res) => {
  try {
    const search = String(req.query.q || '').trim();
    const status = String(req.query.status || 'all').trim().toLowerCase();
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit, 20);
    const offset = (page - 1) * limit;
    const safeStatus = ['all', 'open', 'selected', 'closed', 'canceled'].includes(status)
      ? status
      : 'all';

    const { rows } = await pool.query(
      `
        SELECT
          sr.id,
          sr.client_name,
          sr.client_email,
          sr.client_phone,
          sr.service,
          sr.service_label,
          sr.city,
          sr.state,
          sr.neighborhood,
          sr.urgency,
          sr.urgency_label,
          sr.status,
          sr.created_at,
          sr.updated_at,
          sr.selected_installer_id,
          owner.email AS account_email,
          COALESCE(NULLIF(selected.business_name, ''), selected.name) AS selected_installer_name,
          COUNT(sri.id)::int AS interests_count,
          COUNT(*) OVER()::int AS total_count
        FROM service_requests sr
        LEFT JOIN users owner ON owner.id = sr.client_user_id
        LEFT JOIN users selected ON selected.id = sr.selected_installer_id
        LEFT JOIN service_request_interests sri ON sri.request_id = sr.id
        WHERE
          ($1 = 'all' OR sr.status = $1)
          AND (
            $2 = ''
            OR sr.client_name ILIKE ('%' || $2 || '%')
            OR COALESCE(sr.client_email, '') ILIKE ('%' || $2 || '%')
            OR COALESCE(sr.client_phone, '') ILIKE ('%' || $2 || '%')
            OR COALESCE(sr.service_label, sr.service, '') ILIKE ('%' || $2 || '%')
            OR COALESCE(sr.city, '') ILIKE ('%' || $2 || '%')
          )
        GROUP BY sr.id, owner.email, selected.business_name, selected.name
        ORDER BY sr.created_at DESC
        LIMIT $3 OFFSET $4
      `,
      [safeStatus, search, limit, offset]
    );

    const total = Number(rows[0]?.total_count || 0);
    return res.json({
      requests: rows.map(({ total_count, ...request }) => request),
      pagination: buildPagination(page, limit, total),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao listar pedidos de clientes.' });
  }
};

exports.updateServiceRequestStatus = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const status = String(req.body.status || '').trim().toLowerCase();

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ error: 'Pedido inválido.' });
    }

    if (!['open', 'closed', 'canceled'].includes(status)) {
      return res.status(400).json({ error: 'Status do pedido inválido.' });
    }

    const { rows } = await pool.query(
      `
        UPDATE service_requests
        SET status = $1, updated_at = NOW()
        WHERE id = $2
          AND ($1 <> 'open' OR selected_installer_id IS NULL)
        RETURNING id, status, updated_at
      `,
      [status, requestId]
    );

    if (!rows[0]) {
      return res.status(409).json({
        error: 'Pedido não encontrado ou já possui um instalador selecionado.',
      });
    }

    return res.json({ request: rows[0] });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao atualizar o pedido.' });
  }
};

exports.updateUserSubscription = async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);
    const status = String(req.body.status || '').trim().toLowerCase();
    const allowedStatuses = new Set(['active', 'inactive', 'canceled']);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: 'Usuário inválido.' });
    }

    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: 'Status de assinatura inválido.' });
    }

    const targetResult = await pool.query('SELECT id, account_type FROM users WHERE id = $1', [targetUserId]);

    if (targetResult.rowCount === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (targetResult.rows[0].account_type !== 'installer') {
      return res.status(400).json({ error: 'Contas de cliente não possuem assinatura de instalador.' });
    }

    let expiresAt = parseDate(req.body.expires_at);

    if (!expiresAt && status === 'active') {
      expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    const subscription = await setSubscriptionStatus(targetUserId, status, expiresAt);

    await pool.query(
      `
        INSERT INTO notifications (user_id, title, message, type)
        VALUES ($1, $2, $3, $4)
      `,
      [
        targetUserId,
        'Assinatura atualizada pelo administrador',
        `Seu plano foi atualizado para o status "${status}".`,
        status === 'active' ? 'success' : 'warning',
      ]
    );

    return res.json({ subscription });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao atualizar assinatura do usuário.' });
  }
};

exports.updateUserPublicProfile = async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);
    const nextPublicProfile = parseBoolean(req.body.public_profile);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: 'Usuário inválido.' });
    }

    if (nextPublicProfile === null) {
      return res.status(400).json({ error: 'Informe public_profile como true ou false.' });
    }

    if (nextPublicProfile) {
      const trustResult = await pool.query(
        `SELECT account_type, certification_verified, certificate_file FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [targetUserId]
      );
      const trust = trustResult.rows[0];

      if (!trust) return res.status(404).json({ error: 'Usuário não encontrado.' });
      if (trust.account_type !== 'installer') {
        return res.status(400).json({ error: 'A visibilidade pública é exclusiva para instaladores.' });
      }
      if (!trust.certification_verified || !String(trust.certificate_file || '').trim()) {
        return res.status(400).json({
          error: 'Valide o certificado antes de liberar este profissional na busca.',
          code: 'CERTIFICATION_REQUIRED',
        });
      }
    }

    const { rows } = await pool.query(
      `
        UPDATE users
        SET public_profile = $1, updated_at = NOW()
        WHERE id = $2 AND account_type = 'installer' AND deleted_at IS NULL
        RETURNING id, name, email, public_profile, updated_at
      `,
      [nextPublicProfile, targetUserId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    await pool.query(
      `
        INSERT INTO notifications (user_id, title, message, type, read)
        VALUES ($1, $2, $3, $4, FALSE)
      `,
      [
        targetUserId,
        nextPublicProfile ? 'Perfil aprovado para a busca' : 'Perfil removido da busca',
        nextPublicProfile
          ? 'A análise administrativa foi concluída e seu perfil agora pode aparecer para clientes.'
          : 'Seu perfil foi retirado temporariamente da busca pública. Revise os dados ou fale com o suporte.',
        nextPublicProfile ? 'success' : 'info',
      ]
    );

    return res.json({ user: rows[0] });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao atualizar visibilidade pública do usuário.' });
  }
};

exports.updateUserTrust = async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);
    const nextFeaturedInstaller = parseBoolean(req.body.featured_installer);
    const nextCertificationVerified = parseBoolean(req.body.certification_verified);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: 'Usuário inválido.' });
    }

    if (nextFeaturedInstaller === null && nextCertificationVerified === null) {
      return res.status(400).json({
        error: 'Informe featured_installer ou certification_verified como true ou false.',
      });
    }

    const targetResult = await pool.query(
      `
        SELECT id, name, email, account_type, certificate_file, certification_verified
        FROM users
        WHERE id = $1 AND deleted_at IS NULL
        LIMIT 1
      `,
      [targetUserId]
    );

    const target = targetResult.rows[0];

    if (!target) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (target.account_type !== 'installer') {
      return res.status(400).json({ error: 'Verificação e destaque são exclusivos para instaladores.' });
    }

    if (
      nextCertificationVerified === true &&
      (!target.certificate_file || !String(target.certificate_file).trim())
    ) {
      return res.status(400).json({
        error: 'Este usuário não enviou certificado. Não é possível marcar como verificado.',
      });
    }

    if (
      nextFeaturedInstaller === true &&
      nextCertificationVerified !== true &&
      !target.certification_verified
    ) {
      return res.status(400).json({
        error: 'Valide o certificado antes de destacar este instalador.',
        code: 'CERTIFICATION_REQUIRED',
      });
    }

    const { rows } = await pool.query(
      `
        UPDATE users
        SET
          certification_verified = COALESCE($2, certification_verified),
          public_profile = CASE WHEN $2::boolean = FALSE THEN FALSE ELSE public_profile END,
          featured_installer = CASE WHEN $2::boolean = FALSE THEN FALSE ELSE COALESCE($1, featured_installer) END,
          updated_at = NOW()
        WHERE id = $3 AND deleted_at IS NULL
        RETURNING
          id,
          name,
          email,
          featured_installer,
          certification_verified,
          public_profile,
          is_admin,
          updated_at
      `,
      [nextFeaturedInstaller, nextCertificationVerified, targetUserId]
    );

    const updatedUser = rows[0];

    if (nextCertificationVerified !== null) {
      await pool.query(
        `
          INSERT INTO notifications (user_id, title, message, type, read)
          VALUES ($1, $2, $3, $4, FALSE)
        `,
        [
          targetUserId,
          nextCertificationVerified ? 'Certificado aprovado' : 'Status do certificado atualizado',
          nextCertificationVerified
            ? 'Seu certificado foi validado pelo administrador e agora aparece como verificado.'
            : 'O status de certificação do seu perfil foi atualizado pelo administrador.',
          nextCertificationVerified ? 'success' : 'info',
        ]
      );
    }

    if (nextFeaturedInstaller === true) {
      await pool.query(
        `
          INSERT INTO notifications (user_id, title, message, type, read)
          VALUES ($1, $2, $3, 'success', FALSE)
        `,
        [
          targetUserId,
          'Perfil destacado na vitrine',
          'Seu perfil foi destacado pela administração e receberá maior visibilidade.',
        ]
      );
    }

    return res.json({ user: updatedUser });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao atualizar status de confiança do usuário.' });
  }
};

exports.updateUserAdmin = async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);
    const nextIsAdmin = parseBoolean(req.body.is_admin);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: 'Usuário inválido.' });
    }

    if (nextIsAdmin === null) {
      return res.status(400).json({ error: 'Informe is_admin como true ou false.' });
    }

    if (targetUserId === req.userId && !nextIsAdmin) {
      return res.status(400).json({ error: 'Você não pode remover seu próprio acesso administrativo.' });
    }

    const outcome = await withAdminMutationLock(async (db) => {
      const targetResult = await db.query(
        `SELECT id, email, name, is_admin FROM users WHERE id = $1 AND deleted_at IS NULL`,
        [targetUserId]
      );
      const target = targetResult.rows[0];

      if (!target) {
        return { status: 404, body: { error: 'Usuário não encontrado.' } };
      }

      if (!nextIsAdmin && target.is_admin && (await countAdmins(db)) <= 1) {
        return {
          status: 400,
          body: { error: 'Não é possível remover o último administrador do sistema.' },
        };
      }

      const updateResult = await db.query(
        `
          UPDATE users
          SET is_admin = $1, updated_at = NOW()
          WHERE id = $2 AND deleted_at IS NULL
          RETURNING id, name, email, is_admin, updated_at
        `,
        [nextIsAdmin, targetUserId]
      );

      return { status: 200, body: { user: updateResult.rows[0] } };
    });

    return res.status(outcome.status).json(outcome.body);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao atualizar privilégio administrativo.' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: 'Usuário inválido.' });
    }

    if (targetUserId === req.userId) {
      return res.status(400).json({ error: 'Você não pode excluir sua própria conta de administrador.' });
    }

    const outcome = await withAdminMutationLock(async (db) => {
      const targetResult = await db.query(
        `SELECT id, email, name, is_admin FROM users WHERE id = $1 AND deleted_at IS NULL`,
        [targetUserId]
      );
      const target = targetResult.rows[0];

      if (!target) {
        return { status: 404, body: { error: 'Usuário não encontrado.' } };
      }

      if (target.is_admin && (await countAdmins(db)) <= 1) {
        return {
          status: 400,
          body: { error: 'Não é possível remover o último administrador do sistema.' },
        };
      }

      await db.query(
        `
          UPDATE users
          SET
            deleted_at = NOW(),
            public_profile = FALSE,
            featured_installer = FALSE,
            certification_verified = FALSE,
            is_admin = FALSE,
            auth_version = auth_version + 1,
            updated_at = NOW()
          WHERE id = $1 AND deleted_at IS NULL
        `,
        [targetUserId]
      );

      return { status: 200, body: { success: true, archived_user: target } };
    });

    return res.status(outcome.status).json(outcome.body);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao remover usuário.' });
  }
};

exports.restoreUser = async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: 'Usuário inválido.' });
    }

    const { rows } = await pool.query(
      `
        UPDATE users
        SET
          deleted_at = NULL,
          is_admin = FALSE,
          public_profile = FALSE,
          featured_installer = FALSE,
          certification_verified = FALSE,
          updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NOT NULL
        RETURNING id, name, email, account_type, deleted_at, updated_at
      `,
      [targetUserId]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Usuário arquivado não encontrado.' });
    return res.json({ user: rows[0] });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao restaurar usuário.' });
  }
};

exports.broadcastAnnouncement = async (req, res) => {
  try {
    const title = String(req.body.title || '').trim().slice(0, 150);
    const message = String(req.body.message || '').trim().slice(0, 1000);
    const type = String(req.body.type || 'info').trim().toLowerCase();
    const allowedTypes = new Set(['info', 'warning', 'success']);

    if (!title || !message) {
      return res.status(400).json({ error: 'Título e mensagem são obrigatórios para enviar comunicado.' });
    }

    if (!allowedTypes.has(type)) {
      return res.status(400).json({ error: 'Tipo de comunicado inválido.' });
    }

    const result = await pool.query(
      `
        INSERT INTO notifications (user_id, title, message, type, read)
        SELECT id, $1, $2, $3, FALSE
        FROM users
        WHERE deleted_at IS NULL
      `,
      [title, message, type]
    );

    return res.json({ delivered_count: result.rowCount || 0 });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao enviar comunicado global.' });
  }
};

exports.listRecommendedStores = async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT
          id,
          name,
          description,
          image_url,
          link_url,
          cta_label,
          is_active,
          sort_order,
          created_at,
          updated_at
        FROM recommended_stores
        ORDER BY sort_order ASC, updated_at DESC, created_at DESC
      `
    );

    return res.json({ stores: rows });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao listar lojas recomendadas.' });
  }
};

exports.createRecommendedStore = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 160);
    const description = String(req.body.description || '').trim().slice(0, 500) || null;
    const rawImageUrl = String(req.body.image_url || '').trim();
    const rawLinkUrl = String(req.body.link_url || '').trim();
    const imageUrl = normalizeHttpUrl(rawImageUrl) || null;
    const linkUrl = normalizeHttpUrl(rawLinkUrl) || null;
    const ctaLabel = String(req.body.cta_label || '').trim().slice(0, 80) || 'Visitar loja';
    const sortOrder = parseInteger(req.body.sort_order, 0);
    const parsedIsActive = req.body.is_active === undefined ? true : parseBoolean(req.body.is_active);

    if (!name) {
      return res.status(400).json({ error: 'Informe o nome da loja recomendada.' });
    }

    if ((rawImageUrl && !imageUrl) || (rawLinkUrl && !linkUrl)) {
      return res.status(400).json({ error: 'Use apenas URLs válidas com http ou https.' });
    }

    if (parsedIsActive === null) {
      return res.status(400).json({ error: 'Informe is_active como true ou false.' });
    }

    const { rows } = await pool.query(
      `
        INSERT INTO recommended_stores (
          name,
          description,
          image_url,
          link_url,
          cta_label,
          is_active,
          sort_order,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING
          id,
          name,
          description,
          image_url,
          link_url,
          cta_label,
          is_active,
          sort_order,
          created_at,
          updated_at
      `,
      [name, description, imageUrl, linkUrl, ctaLabel, parsedIsActive, sortOrder]
    );

    return res.status(201).json({ store: rows[0] });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao criar loja recomendada.' });
  }
};

exports.updateRecommendedStore = async (req, res) => {
  try {
    const storeId = Number(req.params.id);

    if (!Number.isInteger(storeId) || storeId <= 0) {
      return res.status(400).json({ error: 'Loja recomendada inválida.' });
    }

    const updates = [];
    const values = [];
    let index = 1;

    if (req.body.name !== undefined) {
      const name = String(req.body.name || '').trim().slice(0, 160);
      if (!name) {
        return res.status(400).json({ error: 'Informe um nome válido para a loja.' });
      }
      updates.push(`name = $${index}`);
      values.push(name);
      index += 1;
    }

    if (req.body.description !== undefined) {
      updates.push(`description = $${index}`);
      values.push(String(req.body.description || '').trim().slice(0, 500) || null);
      index += 1;
    }

    if (req.body.image_url !== undefined) {
      const imageUrl = normalizeHttpUrl(req.body.image_url);
      if (String(req.body.image_url || '').trim() && !imageUrl) {
        return res.status(400).json({ error: 'Informe uma URL de imagem válida com http ou https.' });
      }
      updates.push(`image_url = $${index}`);
      values.push(imageUrl || null);
      index += 1;
    }

    if (req.body.link_url !== undefined) {
      const linkUrl = normalizeHttpUrl(req.body.link_url);
      if (String(req.body.link_url || '').trim() && !linkUrl) {
        return res.status(400).json({ error: 'Informe uma URL de destino válida com http ou https.' });
      }
      updates.push(`link_url = $${index}`);
      values.push(linkUrl || null);
      index += 1;
    }

    if (req.body.cta_label !== undefined) {
      updates.push(`cta_label = $${index}`);
      values.push(String(req.body.cta_label || '').trim().slice(0, 80) || 'Visitar loja');
      index += 1;
    }

    if (req.body.sort_order !== undefined) {
      updates.push(`sort_order = $${index}`);
      values.push(parseInteger(req.body.sort_order, 0));
      index += 1;
    }

    if (req.body.is_active !== undefined) {
      const parsedIsActive = parseBoolean(req.body.is_active);
      if (parsedIsActive === null) {
        return res.status(400).json({ error: 'Informe is_active como true ou false.' });
      }
      updates.push(`is_active = $${index}`);
      values.push(parsedIsActive);
      index += 1;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo válido foi enviado para atualização.' });
    }

    updates.push('updated_at = NOW()');
    values.push(storeId);

    const { rows } = await pool.query(
      `
        UPDATE recommended_stores
        SET ${updates.join(', ')}
        WHERE id = $${index}
        RETURNING
          id,
          name,
          description,
          image_url,
          link_url,
          cta_label,
          is_active,
          sort_order,
          created_at,
          updated_at
      `,
      values
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Loja recomendada não encontrada.' });
    }

    return res.json({ store: rows[0] });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao atualizar loja recomendada.' });
  }
};

exports.deleteRecommendedStore = async (req, res) => {
  try {
    const storeId = Number(req.params.id);

    if (!Number.isInteger(storeId) || storeId <= 0) {
      return res.status(400).json({ error: 'Loja recomendada inválida.' });
    }

    const { rows } = await pool.query(
      `
        DELETE FROM recommended_stores
        WHERE id = $1
        RETURNING id, name
      `,
      [storeId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Loja recomendada não encontrada.' });
    }

    return res.json({ success: true, store: rows[0] });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao excluir loja recomendada.' });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  let db;
  let transactionStarted = false;

  try {
    db = await pool.connect();
    const paymentId = Number(req.params.id);
    const status = String(req.body.status || '').trim().toLowerCase();
    const allowedStatuses = new Set(['pending', 'paid', 'failed', 'canceled']);

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return res.status(400).json({ error: 'Pagamento inválido.' });
    }

    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: 'Status de pagamento inválido.' });
    }

    await db.query('BEGIN');
    transactionStarted = true;

    const paymentResult = await db.query(
      `
        SELECT *
        FROM payments
        WHERE id = $1
        FOR UPDATE
      `,
      [paymentId]
    );

    const payment = paymentResult.rows[0];

    if (!payment) {
      await db.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ error: 'Pagamento não encontrado.' });
    }

    const updateResult = await db.query(
      `
        UPDATE payments
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [status, paymentId]
    );

    const updatedPayment = updateResult.rows[0];

    if (status === 'paid') {
      let expiresAt = parseDate(req.body.expires_at);

      if (!expiresAt) {
        expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }

      await setSubscriptionStatus(
        payment.user_id,
        'active',
        expiresAt,
        payment.subscription_id || null,
        db
      );

      await db.query(
        `
          INSERT INTO notifications (user_id, title, message, type, read)
          VALUES ($1, $2, $3, 'success', FALSE)
        `,
        [
          payment.user_id,
          'Pagamento confirmado pelo administrador',
          'Seu pagamento foi confirmado e a assinatura foi ativada.',
        ]
      );
    }

    if (status === 'failed' || status === 'canceled') {
      await setSubscriptionStatus(
        payment.user_id,
        'inactive',
        null,
        payment.subscription_id || null,
        db
      );

      await db.query(
        `
          INSERT INTO notifications (user_id, title, message, type, read)
          VALUES ($1, $2, $3, 'warning', FALSE)
        `,
        [
          payment.user_id,
          'Pagamento atualizado pelo administrador',
          status === 'failed'
            ? 'Seu pagamento foi marcado como falho e a assinatura ficou inativa.'
            : 'Seu pagamento foi cancelado e a assinatura ficou inativa.',
        ]
      );
    }

    await db.query('COMMIT');
    transactionStarted = false;
    return res.json({ payment: updatedPayment });
  } catch (_error) {
    if (transactionStarted) {
      await db.query('ROLLBACK').catch(() => null);
    }
    return res.status(500).json({ error: 'Erro ao atualizar status do pagamento.' });
  } finally {
    db?.release();
  }
};
