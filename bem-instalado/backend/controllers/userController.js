const pool = require('../config/database');
const {
  decodeAssetKey,
  deleteProfileAssetsForUser,
  isObjectStorageConfigured,
  protectedAssetUrl,
  publicAssetUrl,
  storeProfileAsset,
  streamStoredAsset,
} = require('../services/objectStorage');
const {
  cancelRecurringSubscription,
  deleteAsaasCustomer,
} = require('../services/asaas');
const forwardGeocode = require('../utils/forwardGeocode');
const { buildAvailableDates, normalizeInstallationDays } = require('../utils/installerAvailability');
const { validateUploadFile } = require('../utils/uploadValidation');
const {
  getInstallerPlanAccess,
  isLimitReached,
  upgradeRequired,
} = require('../services/planAccess');
const { sendMarketplaceEmail } = require('../services/email');
const { sendPushToUser } = require('../services/push');

const PDF_BRANDING_DEFAULTS = Object.freeze({
  brand_name: '',
  document_title: 'Proposta comercial de instalação',
  accent_color: '#CDA349',
  intro_text: '',
  closing_text: '',
  show_logo: true,
  show_installer_photo: true,
  show_contact: true,
});

const PDF_ACCENT_COLORS = new Set([
  '#CDA349', '#0F8798', '#2956A8', '#5B3FA3', '#2E8B57', '#B84372',
]);

function cleanPdfBrandingText(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizePdfBranding(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const requestedColor = cleanPdfBrandingText(source.accent_color, 7).toUpperCase();

  return {
    brand_name: cleanPdfBrandingText(source.brand_name, 80),
    document_title: cleanPdfBrandingText(source.document_title, 100) || PDF_BRANDING_DEFAULTS.document_title,
    accent_color: PDF_ACCENT_COLORS.has(requestedColor) ? requestedColor : PDF_BRANDING_DEFAULTS.accent_color,
    intro_text: cleanPdfBrandingText(source.intro_text, 320),
    closing_text: cleanPdfBrandingText(source.closing_text, 320),
    show_logo: source.show_logo === undefined ? PDF_BRANDING_DEFAULTS.show_logo : Boolean(source.show_logo),
    show_installer_photo: source.show_installer_photo === undefined
      ? PDF_BRANDING_DEFAULTS.show_installer_photo
      : Boolean(source.show_installer_photo),
    show_contact: source.show_contact === undefined ? PDF_BRANDING_DEFAULTS.show_contact : Boolean(source.show_contact),
  };
}

function normalizeStringList(values, maxItems = 8) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeGallery(value) {
  if (Array.isArray(value)) {
    return normalizeStringList(value, 10);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return normalizeStringList(parsed, 10);
    } catch (_error) {
      return [];
    }
  }

  if (value && typeof value === 'object') {
    if (Array.isArray(value.items)) {
      return normalizeStringList(value.items, 10);
    }
  }

  return [];
}

function normalizeCertificateReference(value) {
  if (value === undefined) return undefined;
  const reference = String(value || '').trim().slice(0, 2000);
  if (!reference) return '';
  return reference.startsWith('/api/users/uploads/file/') ? reference : null;
}

function calculateProfileCompleteness(profile) {
  const checkpoints = [
    profile.business_name,
    profile.phone,
    profile.logo,
    profile.installer_photo,
    profile.city,
    profile.state,
    profile.service_region,
    profile.bio,
    profile.installation_method,
    Array.isArray(profile.installation_days) && profile.installation_days.length > 0,
    Number(profile.base_service_cost || 0) > 0,
    Number(profile.default_price_per_roll || 0) > 0,
    Array.isArray(profile.installation_gallery) && profile.installation_gallery.length > 0,
    profile.certificate_file,
    profile.document_type,
    profile.document_id,
    Number(profile.warranty_days || 0) > 0,
  ];

  const completed = checkpoints.filter(Boolean).length;
  return Math.round((completed / checkpoints.length) * 100);
}

exports.deleteOwnAccount = async (req, res) => {
  const confirmation = String(req.body?.confirmation || '').trim().toUpperCase();

  if (confirmation !== 'EXCLUIR') {
    return res.status(400).json({
      error: 'Digite EXCLUIR para confirmar a remoção definitiva da conta.',
      code: 'ACCOUNT_DELETE_CONFIRMATION_REQUIRED',
    });
  }

  let db;

  try {
    const [userResult, subscriptionResult] = await Promise.all([
      pool.query(
        `
          SELECT id, is_admin, asaas_customer_id
          FROM users
          WHERE id = $1 AND deleted_at IS NULL
          LIMIT 1
        `,
        [req.userId]
      ),
      pool.query(
        `
          SELECT DISTINCT provider_subscription_id
          FROM subscriptions
          WHERE user_id = $1
            AND provider = 'asaas'
            AND COALESCE(provider_subscription_id, '') <> ''
        `,
        [req.userId]
      ),
    ]);
    const account = userResult.rows[0];

    if (!account) {
      return res.status(404).json({
        error: 'Conta não encontrada.',
        code: 'ACCOUNT_NOT_FOUND',
      });
    }

    if (account.is_admin) {
      return res.status(409).json({
        error: 'Contas administrativas precisam transferir a administração antes da exclusão.',
        code: 'ACCOUNT_ADMIN_TRANSFER_REQUIRED',
      });
    }

    for (const subscription of subscriptionResult.rows) {
      await cancelRecurringSubscription(subscription.provider_subscription_id);
    }

    if (account.asaas_customer_id) {
      try {
        await deleteAsaasCustomer(account.asaas_customer_id);
      } catch (error) {
        // A Asaas pode precisar manter registros financeiros por obrigação legal.
        // A conta local ainda pode ser removida depois que toda recorrência foi cancelada.
        console.warn('Não foi possível remover o cadastro do cliente na Asaas.', error?.code || error?.status);
      }
    }

    await deleteProfileAssetsForUser(req.userId);

    db = await pool.connect();
    await db.query('BEGIN');
    await db.query('DELETE FROM service_requests WHERE client_user_id = $1', [req.userId]);
    await db.query('DELETE FROM installer_reviews WHERE reviewer_user_id = $1', [req.userId]);
    await db.query('DELETE FROM audit_logs WHERE actor_user_id = $1', [req.userId]);
    await db.query('DELETE FROM application_errors WHERE user_id = $1', [req.userId]);
    const deletionResult = await db.query(
      'DELETE FROM users WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [req.userId]
    );

    if (!deletionResult.rows[0]) {
      await db.query('ROLLBACK');
      return res.status(404).json({
        error: 'Conta não encontrada.',
        code: 'ACCOUNT_NOT_FOUND',
      });
    }

    await db.query('COMMIT');
    return res.json({
      success: true,
      message: 'Sua conta e os dados associados foram excluídos.',
    });
  } catch (error) {
    if (db) {
      await db.query('ROLLBACK').catch(() => null);
    }

    if (error?.code?.startsWith('ASAAS_')) {
      return res.status(502).json({
        error: 'Não foi possível cancelar a cobrança recorrente. Tente novamente ou fale com o suporte.',
        code: 'ACCOUNT_DELETE_BILLING_CLEANUP_FAILED',
      });
    }

    console.error('Falha ao excluir conta do usuário.');
    console.error(error);
    return res.status(500).json({
      error: 'Não foi possível excluir a conta agora. Tente novamente.',
      code: 'ACCOUNT_DELETE_FAILED',
    });
  } finally {
    db?.release();
  }
};

// LGPD: the export is generated on demand and is never kept as a second copy.
// Authentication secrets, password hashes, reset tokens and internal security
// telemetry are deliberately excluded from this response.
exports.exportOwnData = async (req, res) => {
  try {
    const results = await Promise.all([
      pool.query(
        `SELECT id, name, email, account_type, email_verified_at, phone, logo,
          installer_photo, installation_gallery, certificate_file, certificate_name,
          certification_verified, certification_status, featured_installer, document_type,
          document_id, emergency_contact, emergency_phone, safety_notes,
          accepts_service_contract, provides_warranty, warranty_days,
          default_price_per_roll, default_removal_price, latitude, longitude,
          service_radius_km, business_name, city, state, service_region, bio,
          installation_method, service_hours, installation_days, public_profile,
          years_experience, created_at, updated_at
         FROM users WHERE id = $1 LIMIT 1`,
        [req.userId]
      ),
      pool.query('SELECT * FROM clients WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]),
      pool.query('SELECT * FROM budgets WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]),
      pool.query('SELECT * FROM schedules WHERE user_id = $1 ORDER BY date DESC', [req.userId]),
      pool.query('SELECT * FROM service_requests WHERE client_user_id = $1 ORDER BY created_at DESC', [req.userId]),
      pool.query(
        `SELECT sp.*
         FROM service_proposals sp
         JOIN service_requests sr ON sr.id = sp.service_request_id
         WHERE sr.client_user_id = $1
         ORDER BY sp.created_at DESC`,
        [req.userId]
      ),
      pool.query(
        `SELECT sb.*
         FROM service_bookings sb
         JOIN service_requests sr ON sr.id = sb.service_request_id
         WHERE sr.client_user_id = $1
         ORDER BY sb.scheduled_start DESC`,
        [req.userId]
      ),
      pool.query('SELECT * FROM service_proposals WHERE installer_id = $1 ORDER BY created_at DESC', [req.userId]),
      pool.query('SELECT * FROM service_bookings WHERE installer_id = $1 ORDER BY scheduled_start DESC', [req.userId]),
      pool.query('SELECT id, title, message, type, read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]),
      pool.query('SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]),
      pool.query('SELECT id, subscription_id, amount, method, status, external_id, provider, provider_payment_id, created_at, updated_at FROM payments WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]),
    ]);

    const [account, clients, budgets, schedules, requests, clientProposals, clientBookings, proposals, bookings, notifications, subscriptions, payments] = results;
    const filenameDate = new Date().toISOString().slice(0, 10);
    const exportPayload = {
      format: 'InstalaPro data export v1',
      generated_at: new Date().toISOString(),
      account: account.rows[0] || null,
      clients: clients.rows,
      budgets: budgets.rows,
      schedules: schedules.rows,
      service_requests: requests.rows,
      client_service_proposals: clientProposals.rows,
      client_service_bookings: clientBookings.rows,
      service_proposals: proposals.rows,
      service_bookings: bookings.rows,
      notifications: notifications.rows,
      subscriptions: subscriptions.rows,
      payments: payments.rows,
      omitted_for_security: [
        'password hash',
        'two-factor secret and recovery codes',
        'session, verification and password-reset tokens',
        'internal audit and error telemetry',
      ],
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="instalapro-meus-dados-${filenameDate}.json"`);
    res.setHeader('Cache-Control', 'no-store, private');
    return res.json(exportPayload);
  } catch (error) {
    console.error('Falha ao exportar dados do titular.', error);
    return res.status(500).json({ error: 'Não foi possível preparar sua cópia de dados agora.' });
  }
};

function buildMotivationalNotes(metrics) {
  const notes = [];

  if (metrics.goal_progress >= 100) {
    notes.push({
      title: 'Meta batida',
      description: 'Seu faturamento do mês já passou da meta. Hora de subir ticket médio e reputação.',
    });
  } else if (metrics.goal_progress >= 65) {
    notes.push({
      title: 'Você está perto',
      description: 'Confira os orçamentos em aberto que ainda podem ser aprovados neste mês.',
    });
  } else {
    notes.push({
      title: 'Acelere a prospecção',
      description: 'Use as datas disponíveis e o PDF para transformar conversas em aprovações.',
    });
  }

  if (metrics.average_rating >= 4.7 && metrics.review_count >= 2) {
    notes.push({
      title: 'Avaliações do perfil',
      description: 'Sua nota está alta. Destaque isso nas conversas e no perfil público.',
    });
  } else {
    notes.push({
      title: 'Busque novas avaliações',
      description: 'Cada avaliação positiva melhora seu posicionamento no ranking de instaladores.',
    });
  }

  if (metrics.available_dates.length <= 2) {
    notes.push({
      title: 'Agenda aquecida',
      description: 'Poucas datas livres. Hora de elevar margem e priorizar clientes com decisão rápida.',
    });
  } else {
    notes.push({
      title: 'Espaços para vender',
      description: 'Você ainda tem boas janelas na agenda. Aproveite para puxar novas propostas.',
    });
  }

  return notes;
}

function dateKey(date) {
  const safeDate = new Date(date);
  const month = `${safeDate.getMonth() + 1}`.padStart(2, '0');
  const day = `${safeDate.getDate()}`.padStart(2, '0');
  return `${safeDate.getFullYear()}-${month}-${day}`;
}

function normalizeMonthKey(value) {
  const raw = String(value || '').trim();

  if (!raw) {
    return '';
  }

  const match = raw.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return '';
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return '';
  }

  return `${year}-${String(month).padStart(2, '0')}`;
}

function getMonthRange(monthKey) {
  const baseMonth = normalizeMonthKey(monthKey) || dateKey(new Date()).slice(0, 7);
  const [year, month] = baseMonth.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  return {
    month: baseMonth,
    startDate: dateKey(start),
    endDate: dateKey(end),
  };
}

function normalizeDateInput(value) {
  const raw = String(value || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return '';
  }

  const parsed = new Date(`${raw}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return dateKey(parsed) === raw ? raw : '';
}

function normalizeTimeInput(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!match) {
    return '';
  }

  return `${match[1]}:${match[2]}`;
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || '00:00')
    .split(':')
    .map((part) => Number(part));
  return hours * 60 + minutes;
}

function serializeAvailabilitySlot(slot) {
  const safeDate = slot.slot_date instanceof Date
    ? dateKey(slot.slot_date)
    : String(slot.slot_date || '').slice(0, 10);
  const start = String(slot.start_time || '').slice(0, 5);
  const end = String(slot.end_time || '').slice(0, 5);

  return {
    id: slot.id,
    slot_date: safeDate,
    start_time: start,
    end_time: end,
  };
}

async function getTopInstallers(limit = 5) {
  const { rows } = await pool.query(
    `
      WITH ranked_installers AS (
        SELECT
          u.id,
          COALESCE(NULLIF(u.business_name, ''), u.name) AS display_name,
          u.city,
          u.state,
          COALESCE(reviews.average_rating, 0) AS average_rating,
          COALESCE(reviews.review_count, 0)::int AS review_count,
          COALESCE(budget_stats.approved_jobs, 0)::int AS approved_jobs,
          COALESCE(budget_stats.unique_clients_served, 0)::int AS unique_clients_served,
          COALESCE(schedule_stats.completed_jobs, 0)::int AS completed_jobs,
          COALESCE(schedule_stats.completed_unique_clients, 0)::int AS completed_unique_clients,
          LEAST(
            COALESCE(schedule_stats.completed_unique_clients, 0),
            COALESCE(reviews.review_count, 0) * 3 + 2
          )::int AS trusted_clients_score,
          LEAST(
            COALESCE(budget_stats.unique_clients_served, 0),
            COALESCE(reviews.review_count, 0) * 3 + 2
          )::int AS trusted_sales_score,
          RANK() OVER (
            ORDER BY
              COALESCE(reviews.average_rating, 0) DESC,
              COALESCE(reviews.review_count, 0) DESC,
              LEAST(
                COALESCE(schedule_stats.completed_unique_clients, 0),
                COALESCE(reviews.review_count, 0) * 3 + 2
              ) DESC,
              LEAST(
                COALESCE(budget_stats.unique_clients_served, 0),
                COALESCE(reviews.review_count, 0) * 3 + 2
              ) DESC,
              u.created_at ASC
          )::int AS ranking_position
        FROM users u
        LEFT JOIN (
          SELECT installer_id, AVG(rating) AS average_rating, COUNT(*) AS review_count
          FROM installer_reviews
          GROUP BY installer_id
        ) reviews ON reviews.installer_id = u.id
        LEFT JOIN (
          SELECT
            user_id,
            COUNT(*) FILTER (WHERE status = 'approved') AS approved_jobs,
            COUNT(DISTINCT client_id) FILTER (WHERE status = 'approved') AS unique_clients_served
          FROM budgets
          GROUP BY user_id
        ) budget_stats ON budget_stats.user_id = u.id
        LEFT JOIN (
          SELECT
            user_id,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed_jobs,
            COUNT(DISTINCT client_id) FILTER (WHERE status = 'completed') AS completed_unique_clients
          FROM schedules
          GROUP BY user_id
        ) schedule_stats ON schedule_stats.user_id = u.id
        WHERE COALESCE(u.account_type, 'installer') = 'installer'
          AND COALESCE(u.public_profile, false) = true
          AND COALESCE(u.certification_verified, false) = true
          AND (
            COALESCE(reviews.review_count, 0) > 0
            OR COALESCE(schedule_stats.completed_unique_clients, 0) > 0
            OR COALESCE(budget_stats.unique_clients_served, 0) > 0
          )
      )
      SELECT *
      FROM ranked_installers
      ORDER BY ranking_position ASC
      LIMIT $1
    `,
    [limit]
  );

  return rows;
}

exports.getProfile = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT
          id,
          COALESCE(account_type, 'installer') AS account_type,
          name,
          email,
          email_verified_at,
          phone,
          logo,
          installer_photo,
          COALESCE(pdf_branding, '{}'::jsonb) AS pdf_branding,
          COALESCE(installation_gallery, '[]'::jsonb) AS installation_gallery,
          certificate_file,
          certificate_name,
          certification_verified,
          certification_status,
          certificate_submitted_at,
          certificate_reviewed_at,
          certificate_rejection_reason,
          featured_installer,
          business_name,
          city,
          state,
          latitude,
          longitude,
          service_radius_km,
          service_region,
          bio,
          installation_method,
          service_hours,
          COALESCE(installation_days, ARRAY[]::TEXT[]) AS installation_days,
          default_price_per_roll,
          default_removal_price,
          is_admin,
          base_service_cost,
          travel_fee,
          monthly_goal,
          public_profile,
          years_experience,
          wallpaper_store_recommended,
          document_type,
          document_id,
          emergency_contact,
          emergency_phone,
          safety_notes,
          accepts_service_contract,
          provides_warranty,
          warranty_days
        FROM users
        WHERE id = $1
      `,
      [req.userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const profile = {
      ...rows[0],
      // O front-end usa esta propriedade para decidir se mostra o aviso de
      // confirmação. A sessão continua válida depois do clique no link, então
      // o perfil recarregado precisa refletir a confirmação imediatamente.
      email_verified: Boolean(rows[0]?.email_verified_at),
      installation_gallery: normalizeGallery(rows[0]?.installation_gallery),
      pdf_branding: normalizePdfBranding(rows[0]?.pdf_branding),
    };
    return res.json(profile);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao carregar perfil.' });
  }
};

exports.getPdfBranding = async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT COALESCE(pdf_branding, '{}'::jsonb) AS pdf_branding FROM users WHERE id = $1",
      [req.userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    return res.json({ branding: normalizePdfBranding(rows[0].pdf_branding) });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao carregar a personalização do PDF.' });
  }
};

exports.updatePdfBranding = async (req, res) => {
  try {
    const planAccess = req.planAccess || await getInstallerPlanAccess(req.userId);

    if (!planAccess.features.custom_pdf_branding) {
      return upgradeRequired(res, {
        code: 'PDF_BRANDING_PRO_REQUIRED',
        error: 'A personalização do PDF é exclusiva do plano Pro.',
        planAccess,
        feature: 'custom_pdf_branding',
      });
    }

    const branding = normalizePdfBranding(req.body);
    await pool.query(
      'UPDATE users SET pdf_branding = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [JSON.stringify(branding), req.userId]
    );

    return res.json({ branding });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao salvar a personalização do PDF.' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const {
      name,
      phone,
      logo,
      installer_photo,
      installation_gallery,
      certificate_file,
      certificate_name,
      business_name,
      city,
      state,
      service_radius_km,
      service_region,
      bio,
      installation_method,
      service_hours,
      installation_days,
      default_price_per_roll,
      default_removal_price,
      base_service_cost,
      travel_fee,
      monthly_goal,
      public_profile,
      years_experience,
      wallpaper_store_recommended,
      document_type,
      document_id,
      emergency_contact,
      emergency_phone,
      safety_notes,
      accepts_service_contract,
      provides_warranty,
      warranty_days,
    } = req.body;

    const normalizedCertificateFile = normalizeCertificateReference(certificate_file);

    if (certificate_file !== undefined && normalizedCertificateFile === null) {
      return res.status(400).json({ error: 'Envie o certificado pelo campo de upload antes de salvar.' });
    }

    const currentCertificate = await pool.query(
      'SELECT certificate_file FROM users WHERE id = $1 LIMIT 1',
      [req.userId]
    );
    const certificateChanged = Boolean(
      normalizedCertificateFile
      && normalizedCertificateFile !== String(currentCertificate.rows[0]?.certificate_file || '')
    );

    const normalizedDays = normalizeInstallationDays(installation_days);
    const normalizedGallery = normalizeGallery(installation_gallery);
    const planAccess = await getInstallerPlanAccess(req.userId);
    const galleryLimit = planAccess.limits.portfolio_photos;

    if (
      Array.isArray(installation_gallery)
      && galleryLimit !== null
      && normalizedGallery.length > galleryLimit
      && normalizedGallery.length > Number(planAccess.usage.portfolio_photos || 0)
    ) {
      return upgradeRequired(res, {
        code: 'FREE_PORTFOLIO_LIMIT',
        error: `O plano Grátis permite até ${galleryLimit} fotos no portfólio. No Pro, você pode publicar até 10.`,
        planAccess,
        feature: 'expanded_portfolio',
      });
    }
    const normalizedRadius = service_radius_km === undefined
      ? null
      : Math.min(Math.max(Number(service_radius_km) || 80, 10), 250);
    let locationCoordinates = null;

    if (String(city || '').trim() && String(state || '').trim()) {
      try {
        const locations = await forwardGeocode(`${city}, ${state}, Brasil`, 1);
        if (locations[0]) {
          locationCoordinates = {
            latitude: Number(locations[0].latitude),
            longitude: Number(locations[0].longitude),
          };
        }
      } catch (_error) {
        locationCoordinates = null;
      }
    }

    const { rows } = await pool.query(
      `
        UPDATE users
        SET
          name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          logo = COALESCE($3, logo),
          installer_photo = COALESCE($4, installer_photo),
          installation_gallery = CASE WHEN $5::jsonb IS NULL THEN installation_gallery ELSE $5::jsonb END,
          certificate_file = COALESCE($6, certificate_file),
          certificate_name = COALESCE($7, certificate_name),
          business_name = COALESCE($8, business_name),
          city = COALESCE($9, city),
          state = COALESCE($10, state),
          service_region = COALESCE($11, service_region),
          bio = COALESCE($12, bio),
          installation_method = COALESCE($13, installation_method),
          service_hours = COALESCE($14, service_hours),
          installation_days = CASE WHEN $15::TEXT[] IS NULL THEN installation_days ELSE $15::TEXT[] END,
          default_price_per_roll = COALESCE($16, default_price_per_roll),
          default_removal_price = COALESCE($17, default_removal_price),
          base_service_cost = COALESCE($18, base_service_cost),
          travel_fee = COALESCE($19, travel_fee),
          monthly_goal = COALESCE($20, monthly_goal),
          public_profile = COALESCE($21, public_profile),
          years_experience = COALESCE($22, years_experience),
          wallpaper_store_recommended = COALESCE($23, wallpaper_store_recommended),
          document_type = COALESCE($24, document_type),
          document_id = COALESCE($25, document_id),
          emergency_contact = COALESCE($26, emergency_contact),
          emergency_phone = COALESCE($27, emergency_phone),
          safety_notes = COALESCE($28, safety_notes),
          accepts_service_contract = COALESCE($29, accepts_service_contract),
          provides_warranty = COALESCE($30, provides_warranty),
          warranty_days = COALESCE($31, warranty_days),
          latitude = COALESCE($32, latitude),
          longitude = COALESCE($33, longitude),
          service_radius_km = COALESCE($34, service_radius_km),
          updated_at = NOW()
        WHERE id = $35
        RETURNING
          id,
          COALESCE(account_type, 'installer') AS account_type,
          name,
          email,
          phone,
          logo,
          installer_photo,
          COALESCE(installation_gallery, '[]'::jsonb) AS installation_gallery,
          certificate_file,
          certificate_name,
          certification_verified,
          featured_installer,
          business_name,
          city,
          state,
          latitude,
          longitude,
          service_radius_km,
          service_region,
          bio,
          installation_method,
          service_hours,
          COALESCE(installation_days, ARRAY[]::TEXT[]) AS installation_days,
          default_price_per_roll,
          default_removal_price,
          is_admin,
          base_service_cost,
          travel_fee,
          monthly_goal,
          public_profile,
          years_experience,
          wallpaper_store_recommended,
          document_type,
          document_id,
          emergency_contact,
          emergency_phone,
          safety_notes,
          accepts_service_contract,
          provides_warranty,
          warranty_days
      `,
      [
        name ?? null,
        phone ?? null,
        logo ?? null,
        installer_photo ?? null,
        Array.isArray(installation_gallery) ? JSON.stringify(normalizedGallery) : null,
        normalizedCertificateFile ?? null,
        certificate_name ?? null,
        business_name ?? null,
        city ?? null,
        state ?? null,
        service_region ?? null,
        bio ?? null,
        installation_method ?? null,
        service_hours ?? null,
        Array.isArray(installation_days) ? normalizedDays : null,
        default_price_per_roll ?? null,
        default_removal_price ?? null,
        base_service_cost ?? null,
        travel_fee ?? null,
        monthly_goal ?? null,
        null,
        years_experience ?? null,
        wallpaper_store_recommended ?? null,
        document_type ?? null,
        document_id ?? null,
        emergency_contact ?? null,
        emergency_phone ?? null,
        safety_notes ?? null,
        accepts_service_contract ?? null,
        provides_warranty ?? null,
        warranty_days ?? null,
        locationCoordinates?.latitude ?? null,
        locationCoordinates?.longitude ?? null,
        normalizedRadius,
        req.userId,
      ]
    );

    let profile = {
      ...rows[0],
      installation_gallery: normalizeGallery(rows[0]?.installation_gallery),
    };

    if (certificateChanged) {
      const statusResult = await pool.query(
        `UPDATE users
         SET certification_verified = FALSE,
             public_profile = FALSE,
             certification_status = 'pending',
             certificate_submitted_at = NOW(),
             certificate_reviewed_at = NULL,
             certificate_reviewed_by = NULL,
             certificate_rejection_reason = NULL,
             updated_at = NOW()
         WHERE id = $1
         RETURNING certification_verified, public_profile, certification_status, certificate_submitted_at,
                   certificate_reviewed_at, certificate_rejection_reason`,
        [req.userId]
      );
      profile = { ...profile, ...statusResult.rows[0] };

      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, read)
         SELECT id, 'Novo certificado para análise', $1, 'info', FALSE
         FROM users
         WHERE is_admin = TRUE AND deleted_at IS NULL`,
        [`${profile.business_name || profile.name || 'Um instalador'} enviou um certificado para validação.`]
      );

      const admins = await pool.query(
        'SELECT id, email FROM users WHERE is_admin = TRUE AND deleted_at IS NULL'
      );
      await Promise.all(admins.rows.map((admin) => sendMarketplaceEmail({
        to: admin.email,
        subject: 'Novo certificado aguardando análise - InstalaPro',
        title: 'Novo certificado para análise',
        body: `${profile.business_name || profile.name || 'Um instalador'} enviou um certificado. Abra o painel administrativo para aprovar ou recusar.`,
        actionLabel: 'Abrir fila de verificação',
        actionUrl: `${String(process.env.FRONTEND_URL || process.env.APP_URL || '').replace(/\/+$/, '')}/admin`,
      }).catch(() => null)));
      await Promise.all(admins.rows.map((admin) => sendPushToUser({
        userId: admin.id,
        title: 'Novo certificado para análise',
        body: `${profile.business_name || profile.name || 'Um instalador'} enviou um documento.`,
        data: { route: '/admin' },
      }).catch(() => null)));
    }

    return res.json(profile);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao atualizar perfil.' });
  }
};

exports.getUploadCapabilities = (_req, res) => {
  return res.json({ object_storage: isObjectStorageConfigured() });
};

exports.uploadProfileAsset = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Selecione um arquivo para enviar.' });
    }

    const kind = String(req.body?.kind || '').trim().toLowerCase();
    const allowedKinds = new Set(['logo', 'installer-photo', 'gallery', 'certificate']);

    if (!allowedKinds.has(kind)) {
      return res.status(400).json({ error: 'Destino do arquivo inválido.' });
    }

    const validation = validateUploadFile(req.file, { allowPdf: kind === 'certificate' });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error, code: validation.code });
    }

    req.file.mimetype = validation.mimeType;

    const stored = await storeProfileAsset({ userId: req.userId, kind, file: req.file });
    return res.status(201).json({
      ...stored,
      url: kind === 'certificate' ? protectedAssetUrl(stored.pathname) : publicAssetUrl(stored.pathname),
    });
  } catch (error) {
    if (error.code === 'OBJECT_STORAGE_NOT_CONFIGURED') {
      return res.status(503).json({ error: error.message, code: error.code });
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'O arquivo excede o limite de 4MB.' });
    }
    return res.status(500).json({ error: 'Não foi possível armazenar o arquivo.' });
  }
};

exports.getStoredProfileAsset = async (req, res) => {
  const pathname = decodeAssetKey(req.params.assetKey);
  const ownerId = Number(String(pathname || '').split('/')[1]);

  if (!pathname || (!req.user?.is_admin && ownerId !== Number(req.userId))) {
    return res.status(404).json({ error: 'Arquivo não encontrado.' });
  }

  try {
    const isCertificate = String(pathname).split('/')[2] === 'certificate';
    const found = await streamStoredAsset(pathname, res, {
      contentDisposition: isCertificate ? 'attachment' : 'inline',
    });
    if (!found) return res.status(404).json({ error: 'Arquivo não encontrado.' });
    return undefined;
  } catch (_error) {
    return res.status(503).json({ error: 'Arquivo temporariamente indisponível.' });
  }
};

exports.getAvailabilitySlots = async (req, res) => {
  try {
    if (req.query.month && !normalizeMonthKey(req.query.month)) {
      return res.status(400).json({ error: 'Mês inválido. Use o formato YYYY-MM.' });
    }

    const range = getMonthRange(req.query.month);
    const { rows } = await pool.query(
      `
        SELECT
          id,
          slot_date,
          start_time::text AS start_time,
          end_time::text AS end_time
        FROM installer_availability_slots
        WHERE user_id = $1
          AND is_active = TRUE
          AND slot_date >= $2::date
          AND slot_date < $3::date
        ORDER BY slot_date ASC, start_time ASC
      `,
      [req.userId, range.startDate, range.endDate]
    );

    return res.json({
      month: range.month,
      slots: rows.map(serializeAvailabilitySlot),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao carregar horários vagos.' });
  }
};

exports.createAvailabilitySlot = async (req, res) => {
  try {
    const slotDate = normalizeDateInput(req.body.slot_date);
    const startTime = normalizeTimeInput(req.body.start_time);
    const endTime = normalizeTimeInput(req.body.end_time);
    const today = dateKey(new Date());

    if (!slotDate || !startTime || !endTime) {
      return res.status(400).json({ error: 'Data e horários válidos são obrigatórios.' });
    }

    if (slotDate < today) {
      return res.status(400).json({ error: 'Não é possível criar horário em data passada.' });
    }

    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      return res.status(400).json({ error: 'O horário final deve ser maior que o inicial.' });
    }

    const [overlapResult, scheduledResult] = await Promise.all([
      pool.query(
        `
          SELECT id
          FROM installer_availability_slots
          WHERE user_id = $1
            AND is_active = TRUE
            AND slot_date = $2::date
            AND start_time < $4::time
            AND end_time > $3::time
          LIMIT 1
        `,
        [req.userId, slotDate, startTime, endTime]
      ),
      pool.query(
        `
          SELECT id
          FROM schedules
          WHERE user_id = $1
            AND status <> 'canceled'
            AND DATE(date) = $2::date
            AND date::time >= $3::time
            AND date::time < $4::time
          LIMIT 1
        `,
        [req.userId, slotDate, startTime, endTime]
      ),
    ]);

    if (overlapResult.rowCount > 0) {
      return res.status(409).json({ error: 'Já existe horário vago nesse intervalo.' });
    }

    if (scheduledResult.rowCount > 0) {
      return res.status(409).json({ error: 'Esse intervalo já está ocupado por um agendamento.' });
    }

    const planAccess = await getInstallerPlanAccess(req.userId);
    if (isLimitReached(planAccess, 'availability_slots')) {
      return upgradeRequired(res, {
        code: 'FREE_AVAILABILITY_LIMIT',
        error: `O plano Grátis permite até ${planAccess.limits.availability_slots} horários futuros. Exclua um horário ou assine o Pro para adicionar sem limite.`,
        planAccess,
        feature: 'unlimited_availability',
      });
    }

    const { rows } = await pool.query(
      `
        INSERT INTO installer_availability_slots (
          user_id,
          slot_date,
          start_time,
          end_time
        )
        VALUES ($1, $2::date, $3::time, $4::time)
        RETURNING
          id,
          slot_date,
          start_time::text AS start_time,
          end_time::text AS end_time
      `,
      [req.userId, slotDate, startTime, endTime]
    );

    return res.status(201).json(serializeAvailabilitySlot(rows[0]));
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao salvar horário vago.' });
  }
};

exports.deleteAvailabilitySlot = async (req, res) => {
  try {
    const slotId = Number(req.params.id);

    if (!Number.isInteger(slotId) || slotId <= 0) {
      return res.status(400).json({ error: 'Horário inválido.' });
    }

    const { rowCount } = await pool.query(
      `
        DELETE FROM installer_availability_slots
        WHERE id = $1
          AND user_id = $2
      `,
      [slotId, req.userId]
    );

    if (!rowCount) {
      return res.status(404).json({ error: 'Horário não encontrado.' });
    }

    return res.json({ success: true });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao excluir horário vago.' });
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const planAccess = await getInstallerPlanAccess(req.userId);
    const [profileResult, budgetResult, scheduleResult, reviewResult, rankingResult, topInstallers] =
      await Promise.all([
        pool.query(
          `
            SELECT
              id,
              name,
              business_name,
              city,
              state,
              service_region,
              logo,
              installer_photo,
              COALESCE(installation_gallery, '[]'::jsonb) AS installation_gallery,
              certificate_file,
              certificate_name,
              certification_verified,
              featured_installer,
              monthly_goal,
              public_profile,
              wallpaper_store_recommended,
              document_type,
              document_id,
              warranty_days,
              COALESCE(installation_days, ARRAY[]::TEXT[]) AS installation_days,
              default_price_per_roll,
              base_service_cost,
              bio,
              installation_method,
              service_hours,
              phone
            FROM users
            WHERE id = $1
          `,
          [req.userId]
        ),
        pool.query(
          `
            SELECT
              COALESCE(SUM(total_amount) FILTER (
                WHERE status = 'approved'
                  AND DATE_TRUNC('month', COALESCE(approved_date, created_at)) = DATE_TRUNC('month', CURRENT_DATE)
              ), 0) AS monthly_revenue,
              COUNT(*) FILTER (
                WHERE status = 'approved'
                  AND DATE_TRUNC('month', COALESCE(approved_date, created_at)) = DATE_TRUNC('month', CURRENT_DATE)
              )::int AS approved_this_month,
              COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_budgets
            FROM budgets
            WHERE user_id = $1
          `,
          [req.userId]
        ),
        pool.query(
          `
            SELECT
              COUNT(*) FILTER (
                WHERE date >= DATE_TRUNC('week', CURRENT_DATE)
                  AND date < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'
              )::int AS week_installations,
              COUNT(*) FILTER (
                WHERE status = 'completed'
                  AND date >= DATE_TRUNC('week', CURRENT_DATE)
                  AND date < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'
              )::int AS completed_this_week,
              ARRAY_REMOVE(
                ARRAY_AGG(date ORDER BY date ASC) FILTER (
                  WHERE date >= CURRENT_DATE
                    AND date < CURRENT_DATE + INTERVAL '35 days'
                    AND status <> 'canceled'
                ),
                NULL
              ) AS busy_dates
            FROM schedules
            WHERE user_id = $1
          `,
          [req.userId]
        ),
        pool.query(
          `
            SELECT
              COALESCE(AVG(rating), 0) AS average_rating,
              COUNT(*)::int AS review_count
            FROM installer_reviews
            WHERE installer_id = $1
          `,
          [req.userId]
        ),
        pool.query(
          `
            WITH ranked_installers AS (
              SELECT
                u.id,
                RANK() OVER (
                  ORDER BY
                    COALESCE(reviews.average_rating, 0) DESC,
                    COALESCE(reviews.review_count, 0) DESC,
                    LEAST(
                      COALESCE(schedule_stats.completed_unique_clients, 0),
                      COALESCE(reviews.review_count, 0) * 3 + 2
                    ) DESC,
                    LEAST(
                      COALESCE(budget_stats.unique_clients_served, 0),
                      COALESCE(reviews.review_count, 0) * 3 + 2
                    ) DESC,
                    u.created_at ASC
                )::int AS ranking_position
              FROM users u
              LEFT JOIN (
                SELECT installer_id, AVG(rating) AS average_rating, COUNT(*) AS review_count
                FROM installer_reviews
                GROUP BY installer_id
              ) reviews ON reviews.installer_id = u.id
              LEFT JOIN (
                SELECT
                  user_id,
                  COUNT(*) FILTER (WHERE status = 'approved') AS approved_jobs,
                  COUNT(DISTINCT client_id) FILTER (WHERE status = 'approved') AS unique_clients_served
                FROM budgets
                GROUP BY user_id
              ) budget_stats ON budget_stats.user_id = u.id
              LEFT JOIN (
                SELECT
                  user_id,
                  COUNT(*) FILTER (WHERE status = 'completed') AS completed_jobs,
                  COUNT(DISTINCT client_id) FILTER (WHERE status = 'completed') AS completed_unique_clients
                FROM schedules
                GROUP BY user_id
              ) schedule_stats ON schedule_stats.user_id = u.id
              WHERE COALESCE(u.account_type, 'installer') = 'installer'
                AND COALESCE(u.public_profile, false) = true
                AND COALESCE(u.certification_verified, false) = true
                AND (
                  COALESCE(reviews.review_count, 0) > 0
                  OR COALESCE(schedule_stats.completed_unique_clients, 0) > 0
                  OR COALESCE(budget_stats.unique_clients_served, 0) > 0
                )
            )
            SELECT ranking_position
            FROM ranked_installers
            WHERE id = $1
          `,
          [req.userId]
        ),
        getTopInstallers(5),
      ]);

    const profile = profileResult.rows[0];

    if (!profile) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const budgetMetrics = budgetResult.rows[0] || {};
    const scheduleMetrics = scheduleResult.rows[0] || {};
    const reviewMetrics = reviewResult.rows[0] || {};
    const monthlyRevenue = Number(budgetMetrics.monthly_revenue || 0);
    const monthlyGoal = Number(profile.monthly_goal || 0);
    const goalProgress = monthlyGoal > 0 ? Math.min(100, Math.round((monthlyRevenue / monthlyGoal) * 100)) : 0;
    const availableDates = buildAvailableDates(profile.installation_days, scheduleMetrics.busy_dates || [], 5);
    const averageRating = Number(reviewMetrics.average_rating || 0);

    const metrics = {
      monthly_revenue: monthlyRevenue,
      installations_this_week: Number(scheduleMetrics.week_installations || 0),
      completed_this_week: Number(scheduleMetrics.completed_this_week || 0),
      available_dates: availableDates,
      ranking_position: rankingResult.rows[0]?.ranking_position || null,
      average_rating: averageRating,
      review_count: Number(reviewMetrics.review_count || 0),
      approved_this_month: Number(budgetMetrics.approved_this_month || 0),
      pending_budgets: Number(budgetMetrics.pending_budgets || 0),
      monthly_goal: monthlyGoal,
      goal_progress: goalProgress,
      public_profile: Boolean(profile.public_profile),
      profile_completeness: calculateProfileCompleteness(profile),
    };

    return res.json({
      profile: {
        name: profile.name,
        business_name: profile.business_name,
        city: profile.city,
        state: profile.state,
        service_region: profile.service_region,
        public_profile: profile.public_profile,
      },
      metrics,
      motivation: planAccess.is_pro ? buildMotivationalNotes(metrics) : [],
      ranking: planAccess.is_pro ? topInstallers : [],
      plan_access: planAccess,
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao montar o dashboard.' });
  }
};

exports.getReviewsSummary = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT
          COUNT(*)::int AS review_count,
          COALESCE(AVG(rating), 0) AS average_rating
        FROM installer_reviews
        WHERE installer_id = $1
      `,
      [req.userId]
    );

    const summary = rows[0] || {};

    return res.json({
      review_count: Number(summary.review_count || 0),
      average_rating: Number(summary.average_rating || 0),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao carregar resumo das avaliações.' });
  }
};

exports.getReviewsDashboard = async (req, res) => {
  try {
    const planAccess = await getInstallerPlanAccess(req.userId);
    const [profileResult, summaryResult, distributionResult, monthlyResult, reviewsResult] = await Promise.all([
      pool.query(
        `
          SELECT
            id,
            COALESCE(NULLIF(business_name, ''), name) AS display_name,
            COALESCE(public_profile, false) AS public_profile
          FROM users
          WHERE id = $1
        `,
        [req.userId]
      ),
      pool.query(
        `
          SELECT
            COUNT(*)::int AS review_count,
            COALESCE(AVG(rating), 0) AS average_rating,
            COUNT(*) FILTER (
              WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
            )::int AS current_month_count,
            COUNT(*) FILTER (
              WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
                AND created_at < DATE_TRUNC('month', CURRENT_DATE)
            )::int AS previous_month_count,
            COUNT(*) FILTER (
              WHERE created_at >= NOW() - INTERVAL '3 days'
            )::int AS recent_3_count,
            COUNT(*) FILTER (
              WHERE NULLIF(TRIM(COALESCE(comment, '')), '') IS NOT NULL
            )::int AS commented_count,
            MAX(created_at) AS last_review_at
          FROM installer_reviews
          WHERE installer_id = $1
        `,
        [req.userId]
      ),
      pool.query(
        `
          SELECT rating, COUNT(*)::int AS review_count
          FROM installer_reviews
          WHERE installer_id = $1
          GROUP BY rating
          ORDER BY rating DESC
        `,
        [req.userId]
      ),
      pool.query(
        `
          SELECT
            TO_CHAR(series.month_start, 'YYYY-MM') AS month,
            COUNT(reviews.id)::int AS review_count,
            COALESCE(AVG(reviews.rating), 0) AS average_rating
          FROM GENERATE_SERIES(
            DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
            DATE_TRUNC('month', CURRENT_DATE),
            INTERVAL '1 month'
          ) AS series(month_start)
          LEFT JOIN installer_reviews reviews
            ON reviews.installer_id = $1
            AND reviews.created_at >= series.month_start
            AND reviews.created_at < series.month_start + INTERVAL '1 month'
          GROUP BY series.month_start
          ORDER BY series.month_start ASC
        `,
        [req.userId]
      ),
      pool.query(
        `
          SELECT
            id,
            reviewer_name,
            reviewer_region,
            rating,
            comment,
            created_at
          FROM installer_reviews
          WHERE installer_id = $1
          ORDER BY created_at DESC
          LIMIT 30
        `,
        [req.userId]
      ),
    ]);

    const profile = profileResult.rows[0];

    if (!profile) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const rawSummary = summaryResult.rows[0] || {};
    const reviewCount = Number(rawSummary.review_count || 0);
    const currentMonthCount = Number(rawSummary.current_month_count || 0);
    const previousMonthCount = Number(rawSummary.previous_month_count || 0);
    const commentedCount = Number(rawSummary.commented_count || 0);
    const distributionByRating = new Map(
      distributionResult.rows.map((row) => [Number(row.rating), Number(row.review_count || 0)])
    );

    return res.json({
      profile: {
        id: profile.id,
        display_name: profile.display_name,
        public_profile: Boolean(profile.public_profile),
      },
      summary: {
        review_count: reviewCount,
        average_rating: Number(rawSummary.average_rating || 0),
        current_month_count: planAccess.is_pro ? currentMonthCount : null,
        previous_month_count: planAccess.is_pro ? previousMonthCount : null,
        recent_3_count: planAccess.is_pro ? Number(rawSummary.recent_3_count || 0) : null,
        commented_count: planAccess.is_pro ? commentedCount : null,
        comment_rate: planAccess.is_pro && reviewCount > 0 ? Math.round((commentedCount / reviewCount) * 100) : null,
        monthly_delta: planAccess.is_pro
          ? (
          previousMonthCount > 0
            ? Math.round(((currentMonthCount - previousMonthCount) / previousMonthCount) * 100)
            : currentMonthCount > 0
              ? 100
              : 0
          )
          : null,
        last_review_at: rawSummary.last_review_at,
      },
      rating_distribution: planAccess.is_pro ? [5, 4, 3, 2, 1].map((rating) => {
        const count = distributionByRating.get(rating) || 0;
        return {
          rating,
          review_count: count,
          percentage: reviewCount > 0 ? Math.round((count / reviewCount) * 100) : 0,
        };
      }) : [],
      monthly_series: planAccess.is_pro ? monthlyResult.rows.map((row) => ({
        month: row.month,
        review_count: Number(row.review_count || 0),
        average_rating: Number(row.average_rating || 0),
      })) : [],
      reviews: planAccess.is_pro ? reviewsResult.rows : reviewsResult.rows.slice(0, 10),
      plan_access: planAccess,
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao carregar painel de avaliações.' });
  }
};
