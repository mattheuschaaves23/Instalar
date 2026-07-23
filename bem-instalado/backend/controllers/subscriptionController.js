const crypto = require('crypto');
const pool = require('../config/database');
const { generatePix, getPixConfig } = require('../utils/pix');
const { logAudit } = require('../utils/auditLog');
const { isLaunchAccessEnabled } = require('../utils/subscriptionAccess');
const {
  getSubscriptionTrialDays,
  getTrialDaysRemaining,
  isActiveTrial,
  isTrialSubscription,
} = require('../utils/subscriptionTrial');
const {
  createPixPayment,
  findOrCreateCustomer,
  findPaymentByExternalId,
  getPixPayment,
  isAsaasConfigured,
  isAsaasWebhookConfigured,
  validateWebhookToken,
} = require('../services/asaas');
const {
  isReversalStatus,
  resolvePaymentStatusTransition,
} = require('../utils/paymentState');

const SUBSCRIPTION_AMOUNT = Number(process.env.SUBSCRIPTION_PRICE || 49.9);

function getPlanBenefits() {
  return [
    'Dashboard completo com métricas comerciais.',
    'Agenda visual com confirmação de instalação.',
    'Orçamentos em PDF prontos para enviar ao cliente.',
    'Perfil público com avaliações e vitrine para clientes.',
    'Suporte interno com o administrador.',
  ];
}

function isManualConfirmationEnabled() {
  return process.env.ALLOW_MANUAL_SUBSCRIPTION_CONFIRMATION === 'true' && process.env.NODE_ENV !== 'production';
}

function getPaymentMode(complimentaryAccess = false) {
  if (complimentaryAccess) return 'complimentary';
  if (isAsaasConfigured()) return 'asaas';
  if (isManualConfirmationEnabled()) return 'manual';
  return 'disabled';
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
  if (!payment?.provider_payload) return {};

  if (typeof payment.provider_payload === 'string') {
    try {
      return JSON.parse(payment.provider_payload);
    } catch (_error) {
      return {};
    }
  }

  return payment.provider_payload;
}

function providerPayload(paymentData, previousPayload = {}) {
  return {
    ...previousPayload,
    providerStatus: paymentData.providerStatus,
    statusDetail: paymentData.statusDetail,
    ticketUrl: paymentData.ticketUrl,
    expirationDate: paymentData.expirationDate,
    currency: paymentData.currency,
    customerId: paymentData.customerId,
    syncedAt: new Date().toISOString(),
  };
}

function serializeStoredPayment(payment) {
  const payload = getProviderPayload(payment);
  const pixConfig = getPixConfig();
  const automaticConfirmation = payment.provider === 'asaas';

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
    pixKey: automaticConfirmation ? '' : pixConfig.pixKey,
    recipientName: payload.recipientName || (automaticConfirmation ? 'Asaas' : pixConfig.recipientName),
    city: payload.city || (automaticConfirmation ? '' : pixConfig.city),
    description: payload.description || pixConfig.description,
    ticketUrl: payload.ticketUrl || '',
    expirationDate: payload.expirationDate || null,
    manualConfirmation: !automaticConfirmation,
    automaticConfirmation,
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
  if (existing) return existing;
  const trialDays = getSubscriptionTrialDays();

  const created = await db.query(
    `
      INSERT INTO subscriptions (user_id, plan, status, expires_at)
      VALUES ($1, 'trial', 'active', NOW() + ($2::int * INTERVAL '1 day'))
      RETURNING *
    `,
    [userId, trialDays]
  );

  return created.rows[0];
}

async function getPendingPayment(userId, db = pool) {
  const result = await db.query(
    `
      SELECT *
      FROM payments
      WHERE user_id = $1
        AND status = 'pending'
        AND created_at > NOW() - INTERVAL '2 days'
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

function assertProviderPaymentMatches(localPayment, providerPayment) {
  const expectedAmount = Number(localPayment.amount);
  const receivedAmount = Number(providerPayment.amount);

  if (
    providerPayment.externalId !== localPayment.external_id ||
    !Number.isFinite(receivedAmount) ||
    Math.abs(expectedAmount - receivedAmount) > 0.009 ||
    (providerPayment.currency && providerPayment.currency !== 'BRL')
  ) {
    const error = new Error('Os dados retornados pelo provedor não correspondem à cobrança criada.');
    error.code = 'PAYMENT_PROVIDER_MISMATCH';
    throw error;
  }
}

async function activateSubscription(paymentId, req, paymentData = null) {
  const db = await pool.connect();
  let activated = false;
  let updatedPayment;

  try {
    await db.query('BEGIN');
    const paymentResult = await db.query('SELECT * FROM payments WHERE id = $1 FOR UPDATE', [paymentId]);
    const payment = paymentResult.rows[0];

    if (!payment) {
      const error = new Error('Pagamento local não encontrado.');
      error.code = 'PAYMENT_NOT_FOUND';
      throw error;
    }

    if (payment.status === 'paid') {
      if (paymentData) {
        const payload = providerPayload(paymentData, getProviderPayload(payment));
        const refreshedPayment = await db.query(
          `
            UPDATE payments
            SET
              provider_payment_id = COALESCE($2, provider_payment_id),
              pix_qr_code = COALESCE($3, pix_qr_code),
              pix_copy_paste = COALESCE($4, pix_copy_paste),
              provider_payload = $5::jsonb,
              updated_at = NOW()
            WHERE id = $1
            RETURNING *
          `,
          [
            payment.id,
            paymentData.providerPaymentId || null,
            paymentData.qrCodeImage || null,
            paymentData.copyPaste || null,
            JSON.stringify(payload),
          ]
        );
        updatedPayment = refreshedPayment.rows[0];
      }
      await db.query('COMMIT');
      return updatedPayment || payment;
    }

    const payload = paymentData
      ? providerPayload(paymentData, getProviderPayload(payment))
      : getProviderPayload(payment);
    const updatedPaymentResult = await db.query(
      `
        UPDATE payments
        SET
          status = 'paid',
          provider_payment_id = COALESCE($2, provider_payment_id),
          pix_qr_code = COALESCE($3, pix_qr_code),
          pix_copy_paste = COALESCE($4, pix_copy_paste),
          provider_payload = $5::jsonb,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        payment.id,
        paymentData?.providerPaymentId || null,
        paymentData?.qrCodeImage || null,
        paymentData?.copyPaste || null,
        JSON.stringify(payload),
      ]
    );
    updatedPayment = updatedPaymentResult.rows[0];

    await db.query(
      `
        UPDATE subscriptions
        SET
          plan = 'monthly',
          status = 'active',
          expires_at = GREATEST(COALESCE(expires_at, NOW()), NOW()) + INTERVAL '1 month',
          updated_at = NOW()
        WHERE id = $1
      `,
      [payment.subscription_id]
    );

    await db.query(
      `
        INSERT INTO notifications (user_id, title, message, type, read)
        VALUES ($1, $2, $3, 'success', false)
      `,
      [payment.user_id, 'Pagamento confirmado', 'Sua assinatura foi ativada com sucesso.']
    );

    await db.query('COMMIT');
    activated = true;

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
    if (!activated) await db.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    db.release();
  }
}

async function applyPaymentReversal(localPayment, providerPayment, req, nextStatus) {
  const db = await pool.connect();
  let reversedSubscription = false;

  try {
    await db.query('BEGIN');
    const lockedPaymentResult = await db.query(
      'SELECT * FROM payments WHERE id = $1 FOR UPDATE',
      [localPayment.id]
    );
    const lockedPayment = lockedPaymentResult.rows[0];

    if (!lockedPayment) {
      const error = new Error('Pagamento local não encontrado.');
      error.code = 'PAYMENT_NOT_FOUND';
      throw error;
    }

    const payload = providerPayload(providerPayment, getProviderPayload(lockedPayment));
    const updatedPaymentResult = await db.query(
      `
        UPDATE payments
        SET
          status = $2,
          provider_payment_id = COALESCE($3, provider_payment_id),
          pix_qr_code = COALESCE($4, pix_qr_code),
          pix_copy_paste = COALESCE($5, pix_copy_paste),
          provider_payload = $6::jsonb,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        lockedPayment.id,
        nextStatus,
        providerPayment.providerPaymentId || null,
        providerPayment.qrCodeImage || null,
        providerPayment.copyPaste || null,
        JSON.stringify(payload),
      ]
    );

    if (lockedPayment.status === 'paid' && lockedPayment.subscription_id) {
      const originalPlan = String(payload.subscriptionPlan || '').trim();
      const originalStatus = String(payload.subscriptionStatus || '').trim();
      const originalExpiresAt = payload.subscriptionExpiresAt || null;

      if (originalPlan && originalStatus) {
        await db.query(
          `
            UPDATE subscriptions
            SET
              plan = $2,
              status = $3,
              expires_at = $4,
              updated_at = NOW()
            WHERE id = $1
          `,
          [lockedPayment.subscription_id, originalPlan, originalStatus, originalExpiresAt]
        );
      } else {
        await db.query(
          `
            UPDATE subscriptions
            SET
              expires_at = CASE
                WHEN expires_at IS NULL THEN NOW()
                ELSE GREATEST(NOW(), expires_at - INTERVAL '1 month')
              END,
              status = CASE
                WHEN expires_at IS NULL OR expires_at - INTERVAL '1 month' <= NOW()
                  THEN 'inactive'
                ELSE 'active'
              END,
              updated_at = NOW()
            WHERE id = $1
          `,
          [lockedPayment.subscription_id]
        );
      }
      await db.query(
        `
          INSERT INTO notifications (user_id, title, message, type, read)
          VALUES ($1, $2, $3, 'warning', false)
        `,
        [
          lockedPayment.user_id,
          'Pagamento revertido',
          'A Asaas informou um estorno ou cancelamento. A validade da assinatura foi atualizada.',
        ]
      );
      reversedSubscription = true;
    }

    await db.query('COMMIT');

    if (reversedSubscription) {
      await logAudit({
        actorUserId: req?.userId || null,
        action: 'subscription.payment_reversed',
        entityType: 'payment',
        entityId: lockedPayment.id,
        metadata: {
          userId: lockedPayment.user_id,
          subscriptionId: lockedPayment.subscription_id,
          provider: lockedPayment.provider,
          status: nextStatus,
        },
        req,
      });
    }

    return updatedPaymentResult.rows[0];
  } catch (error) {
    await db.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    db.release();
  }
}

async function updatePaymentFromProvider(localPayment, providerPayment, req) {
  assertProviderPaymentMatches(localPayment, providerPayment);

  if (providerPayment.status === 'paid') {
    return activateSubscription(localPayment.id, req, providerPayment);
  }

  const nextStatus = resolvePaymentStatusTransition(localPayment.status, providerPayment.status);
  if (isReversalStatus(nextStatus)) {
    return applyPaymentReversal(localPayment, providerPayment, req, nextStatus);
  }

  const payload = providerPayload(providerPayment, getProviderPayload(localPayment));
  const result = await pool.query(
    `
      UPDATE payments
      SET
        status = $2,
        provider_payment_id = COALESCE($3, provider_payment_id),
        pix_qr_code = COALESCE($4, pix_qr_code),
        pix_copy_paste = COALESCE($5, pix_copy_paste),
        provider_payload = $6::jsonb,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      localPayment.id,
      nextStatus,
      providerPayment.providerPaymentId || null,
      providerPayment.qrCodeImage || null,
      providerPayment.copyPaste || null,
      JSON.stringify(payload),
    ]
  );

  return result.rows[0];
}

async function syncAsaasPayment(localPayment, req) {
  if (localPayment.provider !== 'asaas' || !localPayment.provider_payment_id) {
    return localPayment;
  }

  const providerPayment = await getPixPayment(localPayment.provider_payment_id, {
    includePixQrCode: !localPayment.pix_copy_paste,
  });
  return updatePaymentFromProvider(localPayment, providerPayment, req);
}

exports.getSubscription = async (req, res) => {
  try {
    const pendingPayment = await getPendingPayment(req.userId);
    const subscription = await getLatestSubscription(req.userId);
    const accessState = getSubscriptionAccessState(subscription);
    const launchAccess = isLaunchAccessEnabled();
    const adminAccess = Boolean(req.user?.is_admin);
    const trialAccess = isActiveTrial(subscription);
    const complimentaryAccess = launchAccess || adminAccess || trialAccess;
    const paymentMode = getPaymentMode(complimentaryAccess);

    return res.json({
      ...(subscription || { status: 'inactive', plan: 'monthly' }),
      can_use_app: accessState.canUseApp || complimentaryAccess,
      is_expired: accessState.isExpired,
      requires_payment: accessState.requiresPayment && !complimentaryAccess,
      access_mode: adminAccess
        ? 'admin'
        : trialAccess
          ? 'trial'
          : launchAccess && !accessState.canUseApp
            ? 'launch'
            : 'subscription',
      trial: {
        active: trialAccess,
        days_total: getSubscriptionTrialDays(),
        days_remaining: getTrialDaysRemaining(subscription),
        ends_at: isTrialSubscription(subscription) ? subscription.expires_at : null,
      },
      pricing: {
        amount: SUBSCRIPTION_AMOUNT,
        currency: 'BRL',
        period: 'mês',
        label: 'Plano instalador',
      },
      plan_benefits: getPlanBenefits(),
      payment_mode: paymentMode,
      provider_error: paymentMode === 'disabled'
        ? 'O provedor de pagamento ainda não possui credenciais de produção.'
        : null,
      payment_notice: adminAccess
        ? 'Acesso administrativo liberado sem cobrança.'
        : trialAccess
          ? `Teste grátis ativo por mais ${getTrialDaysRemaining(subscription)} dia(s). Nenhuma cobrança será feita durante esse período.`
          : launchAccess
            ? 'Acesso de lançamento liberado sem cobrança.'
            : paymentMode === 'asaas'
              ? 'Pagamento Pix processado com segurança pela Asaas e confirmado automaticamente.'
              : paymentMode === 'manual'
                ? 'Pagamento manual habilitado apenas para desenvolvimento.'
                : 'Pagamento indisponível até a configuração das credenciais da Asaas.',
      pending_payment: pendingPayment ? serializeStoredPayment(pendingPayment) : null,
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao buscar assinatura.' });
  }
};

async function createManualPayment(req, subscription, db) {
  const manualPix = await generatePix(SUBSCRIPTION_AMOUNT, crypto.randomBytes(12).toString('hex'));
  const paymentResult = await db.query(
    `
      INSERT INTO payments (
        user_id, subscription_id, amount, method, status, external_id, provider,
        pix_qr_code, pix_copy_paste, provider_payload
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
        subscriptionPlan: subscription.plan,
        subscriptionStatus: subscription.status,
        subscriptionExpiresAt: subscription.expires_at,
      }),
    ]
  );

  return paymentResult.rows[0];
}

exports.createPayment = async (req, res) => {
  let db;
  let localPayment;
  const useAsaas = isAsaasConfigured();

  try {
    if (!useAsaas && !isManualConfirmationEnabled()) {
      return res.status(503).json({
        error: 'Pagamento indisponível até a configuração das credenciais da Asaas.',
        code: 'PAYMENT_PROVIDER_DISABLED',
      });
    }

    db = await pool.connect();
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock($1)', [Number(req.userId)]);

    const pendingPayment = await getPendingPayment(req.userId, db);
    if (pendingPayment) {
      await db.query('COMMIT');
      return res.json(serializeStoredPayment(pendingPayment));
    }

    const subscription = await ensureSubscription(req.userId, db);

    if (!useAsaas) {
      localPayment = await createManualPayment(req, subscription, db);
      await db.query('COMMIT');
    } else {
      const externalId = `instalapro_${req.userId}_${crypto.randomUUID()}`.slice(0, 64);
      const paymentResult = await db.query(
        `
          INSERT INTO payments (
            user_id, subscription_id, amount, method, status, external_id, provider, provider_payload
          )
          VALUES ($1, $2, $3, 'pix', 'pending', $4, 'asaas', $5::jsonb)
          RETURNING *
        `,
        [
          req.userId,
          subscription.id,
          SUBSCRIPTION_AMOUNT,
          externalId,
          JSON.stringify({
            providerStatus: 'creating',
            idempotencyKey: externalId,
            subscriptionPlan: subscription.plan,
            subscriptionStatus: subscription.status,
            subscriptionExpiresAt: subscription.expires_at,
          }),
        ]
      );
      localPayment = paymentResult.rows[0];
      await db.query('COMMIT');
    }
  } catch (error) {
    await db?.query('ROLLBACK').catch(() => null);
    console.error('Erro ao preparar pagamento.', error);
    return res.status(500).json({ error: 'Erro ao preparar pagamento.' });
  } finally {
    db?.release();
  }

  try {
    if (useAsaas) {
      const userResult = await pool.query(
        `
          SELECT name, email, phone, document_id, asaas_customer_id
          FROM users
          WHERE id = $1 AND deleted_at IS NULL
          LIMIT 1
        `,
        [req.userId]
      );
      const user = userResult.rows[0];
      if (!user) {
        const error = new Error('Usuário não encontrado para gerar a cobrança.');
        error.code = 'PAYMENT_CUSTOMER_REQUIRED';
        throw error;
      }

      let customerId = String(user.asaas_customer_id || '').trim();
      if (!customerId) {
        const customer = await findOrCreateCustomer({
          userId: req.userId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          cpfCnpj: user.document_id,
        });
        customerId = customer.id;
        await pool.query(
          `
            UPDATE users
            SET asaas_customer_id = $2, updated_at = NOW()
            WHERE id = $1
          `,
          [req.userId, customerId]
        );
      }

      let providerPayment;
      try {
        providerPayment = await createPixPayment({
          customerId,
          amount: SUBSCRIPTION_AMOUNT,
          externalId: localPayment.external_id,
        });
      } catch (creationError) {
        // A resposta pode se perder depois que a cobrança já foi criada.
        // A referência externa permite recuperar a cobrança sem duplicá-la.
        providerPayment = await findPaymentByExternalId(localPayment.external_id).catch(() => null);
        if (!providerPayment) throw creationError;
      }
      localPayment = await updatePaymentFromProvider(localPayment, providerPayment, req);
    }

    await logAudit({
      actorUserId: req.userId,
      action: `subscription.payment_created_${localPayment.provider}`,
      entityType: 'payment',
      entityId: localPayment.id,
      metadata: {
        provider: localPayment.provider,
        externalId: localPayment.external_id,
        providerPaymentId: localPayment.provider_payment_id || null,
        status: localPayment.status,
      },
      req,
    });

    return res.json(serializeStoredPayment(localPayment));
  } catch (error) {
    if (localPayment?.id) {
      await pool.query(
        `
          UPDATE payments
          SET status = 'failed',
              provider_payload = provider_payload || $2::jsonb,
              updated_at = NOW()
          WHERE id = $1
        `,
        [
          localPayment.id,
          JSON.stringify({
            providerStatus: 'creation_failed',
            errorCode: error.code || 'PAYMENT_CREATION_FAILED',
          }),
        ]
      ).catch(() => null);
    }

    console.error('Erro ao gerar pagamento no provedor.', error.code || error.message);
    const customerErrorCodes = new Set([
      'PAYMENT_CUSTOMER_REQUIRED',
      'PAYMENT_CUSTOMER_NAME_REQUIRED',
      'PAYMENT_CUSTOMER_DOCUMENT_REQUIRED',
    ]);
    const status = customerErrorCodes.has(error.code) ? 400 : 502;
    return res.status(status).json({
      error: customerErrorCodes.has(error.code)
        ? error.message
        : 'Não foi possível gerar o Pix na Asaas. Tente novamente.',
      code: error.code || 'PAYMENT_PROVIDER_ERROR',
    });
  }
};

exports.checkPayment = async (req, res) => {
  try {
    let payment = await getPaymentByExternalId(req.params.externalId, req.userId);

    if (!payment) {
      return res.status(404).json({ error: 'Pagamento não encontrado.' });
    }

    if (payment.provider === 'asaas' && payment.status === 'pending') {
      payment = await syncAsaasPayment(payment, req);
    }

    return res.json({ status: payment.status, ...serializeStoredPayment(payment) });
  } catch (error) {
    console.error('Erro ao verificar pagamento.', error.code || error.message);
    return res.status(502).json({ error: 'Não foi possível verificar o pagamento agora.' });
  }
};

exports.confirmPayment = async (req, res) => {
  try {
    if (!isManualConfirmationEnabled()) {
      return res.status(403).json({ error: 'Confirmação manual desativada neste ambiente.' });
    }

    const payment = await getPaymentByExternalId(req.params.externalId, req.userId);
    if (!payment) return res.status(404).json({ error: 'Pagamento não encontrado.' });
    if (payment.provider !== 'manual') {
      return res.status(403).json({ error: 'Este pagamento exige confirmação automática do provedor.' });
    }

    const updatedPayment = payment.status === 'paid'
      ? payment
      : await activateSubscription(payment.id, req);

    await logAudit({
      actorUserId: req.userId,
      action: 'subscription.payment_confirmed_manual',
      entityType: 'payment',
      entityId: payment.id,
      metadata: { provider: 'manual', externalId: payment.external_id },
      req,
    });

    return res.json({ status: updatedPayment.status });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao confirmar pagamento.' });
  }
};

exports.handleAsaasWebhook = async (req, res) => {
  const eventId = String(req.body?.id || '').trim().slice(0, 160);
  const eventType = String(req.body?.event || '').trim().slice(0, 60);
  const providerPaymentId = String(req.body?.payment?.id || '').trim().slice(0, 120);
  const webhookToken = String(req.headers['asaas-access-token'] || '').trim();

  if (!isAsaasWebhookConfigured()) {
    return res.status(503).json({ error: 'Token do webhook da Asaas não configurado.' });
  }

  if (!validateWebhookToken(webhookToken)) {
    return res.status(401).json({ error: 'Token do webhook inválido.' });
  }

  if (!eventId || !eventType || !providerPaymentId) {
    return res.status(400).json({ error: 'Notificação de pagamento inválida.' });
  }

  try {
    const eventResult = await pool.query(
      `
        INSERT INTO payment_webhook_events (
          provider, event_id, event_type, provider_payment_id, payload
        )
        VALUES ('asaas', $1, $2, $3, $4::jsonb)
        ON CONFLICT (provider, event_id)
        DO UPDATE SET
          event_type = EXCLUDED.event_type,
          provider_payment_id = EXCLUDED.provider_payment_id,
          payload = EXCLUDED.payload
        RETURNING *
      `,
      [eventId, eventType, providerPaymentId, JSON.stringify(req.body || {})]
    );
    const event = eventResult.rows[0];

    if (event.processed) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    const providerPayment = await getPixPayment(providerPaymentId);
    const paymentResult = await pool.query(
      `
        SELECT *
        FROM payments
        WHERE provider = 'asaas'
          AND (
            provider_payment_id = $1
            OR external_id = $2
          )
        LIMIT 1
      `,
      [providerPayment.providerPaymentId, providerPayment.externalId]
    );
    const localPayment = paymentResult.rows[0];

    if (!localPayment) {
      await pool.query(
        `
          UPDATE payment_webhook_events
          SET processed = TRUE, processed_at = NOW()
          WHERE id = $1
        `,
        [event.id]
      );
      return res.status(200).json({ received: true, matched: false });
    }

    await updatePaymentFromProvider(localPayment, providerPayment, req);
    await pool.query(
      `
        UPDATE payment_webhook_events
        SET processed = TRUE, processed_at = NOW()
        WHERE id = $1
      `,
      [event.id]
    );

    return res.status(200).json({ received: true, matched: true });
  } catch (error) {
    console.error('Erro ao processar webhook da Asaas.', error.code || error.message);
    return res.status(500).json({ error: 'Falha ao processar notificação.' });
  }
};
