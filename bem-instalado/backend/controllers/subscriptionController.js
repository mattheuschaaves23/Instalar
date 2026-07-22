const crypto = require('crypto');
const pool = require('../config/database');
const { generatePix, getPixConfig } = require('../utils/pix');
const { logAudit } = require('../utils/auditLog');
const { isLaunchAccessEnabled } = require('../utils/subscriptionAccess');

const SUBSCRIPTION_AMOUNT = Number(process.env.SUBSCRIPTION_PRICE || 40);

function getPlanBenefits() {
  return [
    'Dashboard completo com metricas comerciais.',
    'Agenda visual com confirmacao de instalacao.',
    'Orcamentos profissionais com PDF premium.',
    'Perfil publico com avaliacoes e vitrine para clientes.',
    'Suporte interno com o administrador.',
  ];
}

function isManualConfirmationEnabled() {
  return process.env.ALLOW_MANUAL_SUBSCRIPTION_CONFIRMATION === 'true' && process.env.NODE_ENV !== 'production';
}

function getSubscriptionAccessState(subscription) {
  const isExpired = Boolean(subscription?.expires_at && new Date(subscription.expires_at) < new Date());
  const canUseApp = Boolean(subscription && subscription.status === 'active' && !isExpired);

  return {
    canUseApp,
    isExpired,
    requiresPayment: !canUseApp,
  };
}

function getProviderPayload(payment) {
  if (!payment?.provider_payload) {
    return {};
  }

  if (typeof payment.provider_payload === 'string') {
    try {
      return JSON.parse(payment.provider_payload);
    } catch (_error) {
      return {};
    }
  }

  return payment.provider_payload;
}

function serializeStoredPayment(payment) {
  const payload = getProviderPayload(payment);
  const pixConfig = getPixConfig();

  return {
    payment: {
      id: payment.id,
      external_id: payment.external_id,
      amount: payment.amount,
      status: payment.status,
      created_at: payment.created_at,
      provider: payment.provider || 'manual',
      provider_payment_id: payment.provider_payment_id || '',
      status_detail: payload.statusDetail || '',
    },
    qrCodeImage: payment.pix_qr_code,
    copyPaste: payment.pix_copy_paste,
    pixKey: pixConfig.pixKey,
    recipientName: payload.recipientName || pixConfig.recipientName,
    city: payload.city || pixConfig.city,
    description: payload.description || pixConfig.description,
    ticketUrl: payload.ticketUrl || '',
    expirationDate: payload.expirationDate || null,
    manualConfirmation: true,
    automaticConfirmation: false,
    provider: payment.provider || 'manual',
  };
}

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

async function ensureSubscription(userId, db = pool) {
  const existing = await getLatestSubscription(userId, db);

  if (existing) {
    return existing;
  }

  const created = await db.query(
    `
      INSERT INTO subscriptions (user_id, plan, status)
      VALUES ($1, 'monthly', 'inactive')
      RETURNING *
    `,
    [userId]
  );

  return created.rows[0];
}

async function getPendingPayment(userId, db = pool) {
  if (!isManualConfirmationEnabled()) {
    return null;
  }

  const result = await db.query(
    `
      SELECT *
      FROM payments
      WHERE user_id = $1
        AND status = 'pending'
        AND provider = 'manual'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function getPaymentByExternalId(externalId, userId, db = pool) {
  const result = await db.query(
    `
      SELECT *
      FROM payments
      WHERE external_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [externalId, userId]
  );

  return result.rows[0] || null;
}

async function activateSubscription(payment, req) {
  const db = await pool.connect();
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  try {
    await db.query('BEGIN');

    const updatedPaymentResult = await db.query(
      `UPDATE payments SET status = 'paid', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [payment.id]
    );
    const updatedPayment = updatedPaymentResult.rows[0];

    await db.query(
      `
        UPDATE subscriptions
        SET status = 'active', expires_at = $1, updated_at = NOW()
        WHERE id = $2
      `,
      [expiresAt, payment.subscription_id]
    );

    await db.query(
      `
        INSERT INTO notifications (user_id, title, message, type, read)
        VALUES ($1, $2, $3, 'success', false)
      `,
      [payment.user_id, 'Pagamento confirmado', 'Sua assinatura foi ativada com sucesso.']
    );

    await db.query('COMMIT');

    await logAudit({
      actorUserId: req?.userId || null,
      action: 'subscription.payment_activated',
      entityType: 'payment',
      entityId: payment.id,
      metadata: {
        userId: payment.user_id,
        subscriptionId: payment.subscription_id,
        provider: payment.provider || 'manual',
      },
      req,
    });

    return updatedPayment;
  } catch (error) {
    await db.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    db.release();
  }
}

exports.getSubscription = async (req, res) => {
  try {
    const pendingPayment = await getPendingPayment(req.userId);
    const subscription = await getLatestSubscription(req.userId);
    const accessState = getSubscriptionAccessState(subscription);
    const launchAccess = isLaunchAccessEnabled();

    return res.json({
      ...(subscription || { status: 'inactive', plan: 'monthly' }),
      can_use_app: accessState.canUseApp || launchAccess,
      is_expired: accessState.isExpired,
      requires_payment: accessState.requiresPayment && !launchAccess,
      access_mode: launchAccess && !accessState.canUseApp ? 'launch' : 'subscription',
      pricing: {
        amount: SUBSCRIPTION_AMOUNT,
        currency: 'BRL',
        period: 'mensal',
        label: 'Plano instalador',
      },
      plan_benefits: getPlanBenefits(),
      payment_mode: launchAccess ? 'launch' : isManualConfirmationEnabled() ? 'manual' : 'disabled',
      provider_error: null,
      payment_notice: launchAccess
        ? 'Acesso de lancamento liberado sem cobranca enquanto o pagamento definitivo e preparado.'
        : isManualConfirmationEnabled()
        ? 'Pagamento manual habilitado apenas para desenvolvimento.'
        : 'Pagamento temporariamente indisponivel. Um novo metodo sera configurado futuramente.',
      pending_payment: pendingPayment && pendingPayment.status === 'pending'
        ? serializeStoredPayment(pendingPayment)
        : null,
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao buscar assinatura.' });
  }
};

exports.createPayment = async (req, res) => {
  let db;
  try {
    if (!isManualConfirmationEnabled()) {
      return res.status(503).json({
        error: 'Pagamento temporariamente indisponivel. Um novo metodo sera configurado futuramente.',
        code: 'PAYMENT_PROVIDER_DISABLED',
      });
    }

    db = await pool.connect();
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock($1)', [Number(req.userId)]);

    const pendingPayment = await getPendingPayment(req.userId, db);

    if (pendingPayment?.status === 'pending') {
      await db.query('COMMIT');
      return res.json(serializeStoredPayment(pendingPayment));
    }

    const subscription = await ensureSubscription(req.userId, db);
    const manualPix = await generatePix(SUBSCRIPTION_AMOUNT, crypto.randomBytes(12).toString('hex'));
    const paymentResult = await db.query(
      `
        INSERT INTO payments (
          user_id,
          subscription_id,
          amount,
          method,
          status,
          external_id,
          provider,
          pix_qr_code,
          pix_copy_paste,
          provider_payload
        )
        VALUES ($1, $2, $3, 'pix', 'pending', $4, 'manual', $5, $6, $7::jsonb)
        RETURNING *
      `,
      [
        req.userId,
        subscription.id,
        SUBSCRIPTION_AMOUNT,
        manualPix.externalId,
        manualPix.qrCodeImage,
        manualPix.copyPaste,
        JSON.stringify({
          provider: 'manual',
          description: manualPix.description,
          recipientName: manualPix.recipientName,
          city: manualPix.city,
        }),
      ]
    );

    await db.query('COMMIT');

    await logAudit({
      actorUserId: req.userId,
      action: 'subscription.payment_created_manual',
      entityType: 'payment',
      entityId: paymentResult.rows[0].id,
      metadata: {
        provider: 'manual',
        externalId: manualPix.externalId,
        status: paymentResult.rows[0].status,
      },
      req,
    });

    return res.json(serializeStoredPayment(paymentResult.rows[0]));
  } catch (error) {
    await db?.query('ROLLBACK').catch(() => null);
    console.error('Erro ao gerar pagamento manual.');
    console.error(error);
    return res.status(500).json({ error: 'Erro ao gerar pagamento.' });
  } finally {
    db?.release();
  }
};

exports.checkPayment = async (req, res) => {
  try {
    const payment = await getPaymentByExternalId(req.params.externalId, req.userId);

    if (!payment) {
      return res.status(404).json({ error: 'Pagamento nao encontrado.' });
    }

    return res.json({ status: payment.status, ...serializeStoredPayment(payment) });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao verificar pagamento.' });
  }
};

exports.confirmPayment = async (req, res) => {
  try {
    if (!isManualConfirmationEnabled()) {
      return res.status(403).json({ error: 'Confirmacao manual desativada neste ambiente.' });
    }

    const payment = await getPaymentByExternalId(req.params.externalId, req.userId);

    if (!payment) {
      return res.status(404).json({ error: 'Pagamento nao encontrado.' });
    }

    if (payment.status !== 'paid') {
      await activateSubscription(payment, req);
    }

    await logAudit({
      actorUserId: req.userId,
      action: 'subscription.payment_confirmed_manual',
      entityType: 'payment',
      entityId: payment.id,
      metadata: {
        provider: payment.provider || 'manual',
        externalId: payment.external_id,
      },
      req,
    });

    return res.json({ status: 'paid' });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao confirmar pagamento.' });
  }
};
