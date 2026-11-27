const { createHmac, randomUUID, timingSafeEqual } = require('node:crypto');
const { makeCheckout, parseCheckoutLink } = require('../scripts/asaasTrialSandbox');
const { projectTrialAccess, readAsaasWalletId } = require('./subscriptionRollout');
const { getOfferPrices } = require('./subscriptionOffer');

const PROVIDER = 'asaas_trial_v2';
const SANDBOX_API = 'https://api-sandbox.asaas.com/v3';
const PRODUCTION_API = 'https://api.asaas.com/v3';
const PILOT_CONSENT = 'asaas-pilot-v1';
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const ID = /^[A-Za-z0-9_-]{1,120}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EVENT = /^(CHECKOUT_(CREATED|PAID|CANCELED|EXPIRED)|SUBSCRIPTION_(CREATED|UPDATED|INACTIVATED|DELETED)|PAYMENT_(CREATED|UPDATED|CONFIRMED|RECEIVED|OVERDUE|DELETED|RESTORED|REFUNDED|PARTIALLY_REFUNDED|CHARGEBACK_\w+|CREDIT_CARD_CAPTURE_REFUSED|.*RISK_ANALYSIS))$/;
const saoPaulo = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
const SELECT_TRIAL = `SELECT idata.*, to_char(first_due_on, 'YYYY-MM-DD') AS first_due_on,
  to_char(pro_until, 'YYYY-MM-DD') AS pro_until FROM asaas_managed_trials AS idata`;

function getManagedTrialConfig(env) {
  // Neither a preview flag nor Sandbox credentials may create a real charge.
  const isTest = env.VERCEL ? env.VERCEL_ENV === 'preview' : ['development', 'test'].includes(env.NODE_ENV);
  if (!isTest || env.VERCEL_ENV === 'production' || env.ASAAS_MANAGED_TRIAL_SANDBOX !== 'true' ||
      env.ASAAS_MANAGED_TRIAL_ISOLATED_DB !== 'true') return null;
  const apiKey = env.ASAAS_TRIAL_SANDBOX_API_KEY;
  const webhookToken = env.ASAAS_MANAGED_TRIAL_WEBHOOK_TOKEN;
  const accountId = env.ASAAS_MANAGED_TRIAL_ACCOUNT_ID;
  const identityKey = env.ASAAS_MANAGED_TRIAL_IDENTITY_KEY;
  if (!/^\$aact_hmlg_[A-Za-z0-9_+/=-]{12,}$/.test(apiKey || '') ||
      !/^[!-~]{32,255}$/.test(webhookToken || '') || apiKey === webhookToken ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId || '') ||
      !/^[a-f0-9]{64}$/i.test(identityKey || '')) return null;
  let returnUrl;
  try { returnUrl = new URL(env.ASAAS_MANAGED_TRIAL_RETURN_ORIGIN); } catch { return null; }
  if (returnUrl.protocol !== 'https:' || returnUrl.username || returnUrl.password ||
      returnUrl.href !== returnUrl.origin + '/' ||
      ['instalarpro.com.br', 'www.instalarpro.com.br', 'instalar-sigma.vercel.app', 'app.instalarpro.com.br'].includes(returnUrl.hostname)) return null;
  return { environment: 'sandbox', apiKey, webhookToken, accountId, identityKey, returnOrigin: returnUrl.origin };
}

function getBillingConfig(env) {
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'production' || env.NODE_ENV !== 'production') {
    return getManagedTrialConfig(env);
  }
  const { ASAAS_NEXT_API_KEY: apiKey, ASAAS_NEXT_EXPECTED_WALLET_ID: walletId,
    ASAAS_PILOT_ACCOUNT_ID: accountId, ASAAS_PILOT_WEBHOOK_TOKEN: webhookToken,
    ASAAS_PILOT_IDENTITY_KEY: identityKey, ASAAS_PILOT_INSTALLER_ID: rawInstallerId } = env;

  if (env.ASAAS_PILOT_RECEIVER_ENABLED !== 'true' ||
      !/^\$aact_prod_[A-Za-z0-9_+/=-]{12,}$/.test(apiKey || '') ||
      apiKey === env.ASAAS_API_KEY ||
      !UUID.test(walletId || '') || !UUID.test(accountId || '') ||
      !/^[!-~]{32,255}$/.test(webhookToken || '') || apiKey === webhookToken ||
      webhookToken === env.ASAAS_WEBHOOK_TOKEN || webhookToken === env.ASAAS_MANAGED_TRIAL_WEBHOOK_TOKEN ||
      !/^[a-f0-9]{64}$/i.test(identityKey || '') || identityKey.toLowerCase() === env.ASAAS_MANAGED_TRIAL_IDENTITY_KEY?.toLowerCase()) return null;
  const installerId = /^[1-9]\d{0,9}$/.test(rawInstallerId || '') && Number(rawInstallerId) <= 2147483647
    ? Number(rawInstallerId) : null;
  return {
    environment: 'production', apiKey, walletId, accountId, webhookToken, identityKey,
    returnOrigin: 'https://instalarpro.com.br',
    installerId,
    enrollment: installerId !== null && env.ASAAS_PILOT_ENROLLMENT_ENABLED === 'true' &&
      env.ASAAS_PILOT_SANDBOX_VERIFIED === 'true' && env.ASAAS_PILOT_WEBHOOK_VERIFIED === 'true',
  };
}

function canStartManagedTrial(config, userId) {
  return Boolean(config && (config.environment !== 'production' ||
    (config.enrollment && Number(userId) === config.installerId)));
}

async function assertProductionDestination(config, request) {
  if (config.environment !== 'production') return;
  if (readAsaasWalletId(await request('GET', '/wallets/')) !== config.walletId.toLowerCase()) {
    throw new BillingError(503, 'Carteira do Asaas diferente da esperada. Contratação pausada.');
  }
  const status = await request('GET', '/myAccount/status/');
  if (status?.general !== 'APPROVED') throw new BillingError(503, 'A conta de recebimento ainda não está aprovada.');
}

function isTrustedBillingEvent(config, token, event) {
  if (!config || typeof token !== 'string' || token.length > 255 || !event ||
      event.account?.id !== config.accountId || !/^[A-Za-z0-9_&-]{1,180}$/.test(event.id || '')) return false;
  const actual = Buffer.from(token);
  const expected = Buffer.from(config.webhookToken);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function identityDigest(config, cpf) {
  if (typeof cpf !== 'string' || !/^\d{11}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cpf)) {
    throw new BillingError(422, 'Documento inválido para a conferência.');
  }
  const digits = cpf.replace(/\D/g, '');
  if (/^(\d)\1{10}$/.test(digits)) throw new BillingError(422, 'Documento inválido para a conferência.');
  for (const n of [9, 10]) {
    const sum = [...digits.slice(0, n)].reduce((acc, digit, idx) => acc + Number(digit) * (n + 1 - idx), 0);
    if ((sum * 10 % 11) % 10 !== Number(digits[n])) throw new BillingError(422, 'Documento inválido para a conferência.');
  }
  const namespace = config.environment === 'production' ? 'production' : 'sandbox';
  return createHmac('sha256', Buffer.from(config.identityKey, 'hex')).update('asaas-' + namespace + ':cpf:' + digits).digest('hex');
}

function validateCheckoutCustomer(config, customer, customerId, expectedDigest) {
  if (customer?.id !== customerId || customer.deleted || identityDigest(config, customer.cpfCnpj) !== expectedDigest) {
    throw new BillingError(422, 'O cadastro no Asaas diverge da identidade conferida pelo operador.');
  }
  const filled = (value) => typeof value === 'string' && value.trim().length > 0;
  const missing = [];
  if (!filled(customer.name)) missing.push('nome');
  if (!filled(customer.email) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email.trim())) missing.push('e-mail');
  // Asaas already normalizes phone numbers; the linked checkout requires
  // this field to be present, not a second local format rule.
  if (!filled(customer.phone)) missing.push('telefone');
  if (!filled(customer.address) || !filled(customer.addressNumber) || !filled(customer.province) ||
      !filled(customer.postalCode) || !/^\d{8}$/.test(customer.postalCode.replace(/\D/g, '')) ||
      !Number.isSafeInteger(customer.city) || customer.city <= 0) missing.push('endereço completo');
  if (missing.length) throw new BillingError(422, 'Complete no Asaas os dados do cadastro: ' + missing.join(', ') + '.');
}

async function approveVerifiedTrial(db, config, userId, customerId, verifiedCpf, request = providerClient(config)) {
  if (!Number.isSafeInteger(userId) || userId < 1 || !providerId(customerId, 'cus_')) {
    throw new BillingError(400, 'Identificador de instalador ou cliente de teste inválido.');
  }
  if (config.environment === 'production') {
    if (userId !== config.installerId) throw new BillingError(403, 'Apenas o instalador autorizado pode aderir ao piloto.');
    await assertProductionDestination(config, request);
  }
  const digest = identityDigest(config, verifiedCpf);
  const customer = await request('GET', '/customers/' + customerId);
  validateCheckoutCustomer(config, customer, customerId, digest);
  const { rowCount } = await db.query(`INSERT INTO asaas_managed_trials (account_id, user_id, identity_digest, customer_id)
    SELECT $1, id, $3, $4 FROM users WHERE id = $2 AND account_type = 'installer' AND deleted_at IS NULL AND NOT is_admin
    ON CONFLICT DO NOTHING`, [config.accountId, userId, digest, customerId]);
  if (!rowCount) throw new BillingError(409, 'Identidade ou cadastro já reservado, ou instalador de teste não encontrado.');
}

function buildManagedCheckout(config, trial, now, monthlyPrice) {
  if (!['monthly', 'yearly'].includes(trial.plan) || !/^cus_[A-Za-z0-9_-]{1,115}$/.test(trial.customer_id)) {
    throw new BillingError(422, 'Dados do checkout de teste inválidos.');
  }
  const payload = makeCheckout(trial.plan === 'yearly' ? 'anual' : 'mensal', now, trial.reference, monthlyPrice);
  if (config.environment === 'production') {
    payload.items[0].name = trial.plan === 'yearly' ? 'InstalarPro Pro anual' : 'InstalarPro Pro mensal';
  }
  payload.customer = trial.customer_id;
  payload.callback = Object.fromEntries(['success', 'cancel', 'expired'].map((state) => [
    state + 'Url', new URL('/subscription?trial_checkout=' + state, config.returnOrigin).href,
  ]));
  return payload;
}

class BillingError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function providerClient(config, fetchImpl = fetch) {
  const api = config.environment === 'production' ? PRODUCTION_API : SANDBOX_API;
  return async (method, path, body) => {
    const response = await fetchImpl(api + path, {
      method, redirect: 'error', signal: AbortSignal.timeout(6500),
      headers: { accept: 'application/json', 'content-type': 'application/json',
        'user-agent': 'InstalarPro-Trial/1.0', access_token: config.apiKey },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new BillingError(502, 'Não foi possível consultar o Asaas. Confira o status antes de repetir.');
    return response.json();
  };
}

async function transaction(pool, work) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const result = await work(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { db.release(); }
}

async function getTrial(db, config, userId) {
  const { rows } = await db.query(SELECT_TRIAL + ' WHERE account_id = $1 AND user_id = $2', [config.accountId, userId]);
  return rows[0] || null;
}

function summarizeTrial(trial, now = new Date(), config = null) {
  if (!trial) return null;
  let state = trial.state;
  if (['trial', 'paid'].includes(state) && (!trial.pro_until || trial.pro_until <= saoPaulo.format(now))) state = 'unpaid';
  return { state, plan: trial.plan, first_due_on: trial.first_due_on, pro_until: trial.pro_until,
    checkout_url: state === 'pending' && trial.checkout_id &&
      new Date(trial.consented_at).getTime() + 30 * 60_000 > now.getTime()
      ? parseCheckoutLink({ id: trial.checkout_id }, config?.environment === 'production') : null,
    can_cancel: Boolean(trial.subscription_id) && !['eligible', 'cancelled'].includes(state) };
}

async function startTrial(pool, config, userId, plan, accepted, monthlyPrice, request = providerClient(config)) {
  if (!['monthly', 'yearly'].includes(plan)) throw new BillingError(400, 'Escolha um plano válido.');
  if (config.environment === 'production') {
    if (!config.enrollment) throw new BillingError(503, 'Novas adesões ao piloto estão pausadas.');
    if (!canStartManagedTrial(config, userId)) throw new BillingError(403, 'Piloto restrito ao instalador autorizado.');
    const prices = getOfferPrices(monthlyPrice);
    const expectedCents = plan === 'yearly' ? prices.yearlyCents : prices.monthlyCents;
    if (accepted?.accepted !== true || accepted.consent_version !== PILOT_CONSENT || accepted.amount_cents !== expectedCents) {
      throw new BillingError(409, 'Confira o valor e aceite a cobrança recorrente antes de continuar.');
    }
    await assertProductionDestination(config, request);
  } else if (accepted !== true) {
    throw new BillingError(400, 'Escolha o plano e confirme o teste.');
  }
  // This GET cannot create a checkout. Keep it outside the transaction so a
  // slow provider does not occupy the production database connection.
  const candidate = await getTrial(pool, config, userId);
  if (!candidate) throw new BillingError(403, 'A identidade ainda não foi aprovada para este teste.');
  if (candidate.state !== 'eligible') throw new BillingError(409, 'Já existe uma tentativa para esta identidade. Confira o status ou fale com suporte.');
  const customer = await request('GET', '/customers/' + candidate.customer_id);
  validateCheckoutCustomer(config, customer, candidate.customer_id, candidate.identity_digest);
  const reservation = await transaction(pool, async (db) => {
    const allowed = await db.query("SELECT id FROM users WHERE id = $1 AND account_type = 'installer' AND deleted_at IS NULL AND NOT is_admin FOR UPDATE", [userId]);
    if (!allowed.rowCount) throw new BillingError(403, 'Use uma conta de instalador de teste, sem acesso administrativo.');
    const active = await db.query(`SELECT 1 FROM subscriptions WHERE user_id = $1 AND plan IN ('pro','monthly')
      AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`, [userId]);
    if (active.rowCount) throw new BillingError(409, 'Este instalador já tem acesso Pro ativo.');
    const trial = await getTrial(db, config, userId);
    if (!trial) throw new BillingError(403, 'A identidade ainda não foi aprovada para este teste.');
    if (trial.state !== 'eligible') throw new BillingError(409, 'Já existe uma tentativa para esta identidade. Confira o status ou fale com suporte.');
    if (trial.customer_id !== candidate.customer_id || trial.identity_digest !== candidate.identity_digest) {
      throw new BillingError(409, 'O cadastro aprovado mudou. Confira os dados antes de continuar.');
    }
    const reference = 'instalapro-managed-' + randomUUID();
    const payload = buildManagedCheckout(config, { ...trial, reference, plan }, new Date(), monthlyPrice);
    const { rowCount } = await db.query(`UPDATE asaas_managed_trials SET state = 'pending',
      reference = $3, plan = $4, amount_cents = $5, first_due_on = $6, consented_at = NOW()
      WHERE account_id = $1 AND user_id = $2 AND state = 'eligible'`,
      [config.accountId, userId, reference, plan, Math.round(payload.items[0].value * 100), payload.subscription.nextDueDate]);
    if (!rowCount) throw new BillingError(409, 'Já existe um checkout para esta identidade.');
    return { reference, payload };
  });
  // Don't retry automatically: a timeout can happen after Asaas creates it.
  const { reference, payload } = reservation;
  const checkout = await request('POST', '/checkouts', payload);
  const url = parseCheckoutLink(checkout, config.environment === 'production');
  await pool.query(`UPDATE asaas_managed_trials SET checkout_id = $2 WHERE reference = $1`, [reference, checkout.id]);
  return { url, first_charge_on: payload.subscription.nextDueDate, amount: payload.items[0].value };
}

function providerId(value, prefix) {
  return typeof value === 'string' && value.startsWith(prefix) && ID.test(value) ? value : null;
}

async function providerSnapshot(trial, request) {
  let id = trial.subscription_id;
  const list = (value) => {
    if (!Array.isArray(value?.data) || value.hasMore) throw new BillingError(502, 'Conciliação incompleta no Asaas.');
    return value.data;
  };
  let sub;
  async function subscriptions(extra) {
    const params = new URLSearchParams({ customer: trial.customer_id, includeDeleted: 'true', limit: '100', ...extra });
    return list(await request('GET', '/subscriptions?' + params));
  }
  if (!id) {
    const byRef = (await subscriptions({ externalReference: trial.reference })).filter((item) =>
      item.customer === trial.customer_id && item.externalReference === trial.reference);
    if (byRef.length > 1) throw new BillingError(409, 'Mais de uma assinatura vinculada. Acione o suporte.');
    if (byRef.length === 1) sub = byRef[0];
    else if (trial.checkout_id) {
      // Recurring charges can be missing from the checkout filter even though
      // their records include its ID. Scan the customer's pages and match both IDs.
      const ids = new Set();
      for (let offset = 0; offset <= 400; offset += 100) {
        const query = new URLSearchParams({ customer: trial.customer_id, limit: '100', offset: String(offset) });
        const page = await request('GET', '/payments?' + query);
        if (!Array.isArray(page?.data) || typeof page.hasMore !== 'boolean' || (page.hasMore && offset === 400)) {
          throw new BillingError(502, 'Conciliação incompleta no Asaas.');
        }
        for (const item of page.data) {
          if (item.checkoutSession !== trial.checkout_id || item.customer !== trial.customer_id) continue;
          const linkedId = providerId(item.subscription, 'sub_');
          if (linkedId) ids.add(linkedId);
        }
        if (!page.hasMore) break;
      }
      if (ids.size > 1) throw new BillingError(409, 'Mais de uma assinatura vinculada. Acione o suporte.');
      [id] = ids;
    }
  }
  if (!sub && id) sub = (await subscriptions({})).find((item) => item.id === id && item.customer === trial.customer_id);
  if (!sub) {
    if (id) throw new BillingError(502, 'O Asaas não devolveu a assinatura vinculada.');
    return null;
  }
  id = providerId(sub.id, 'sub_');
  if (!id) throw new BillingError(502, 'O Asaas não devolveu um identificador de assinatura válido.');
  const start = trial.first_due_on;
  if (!DATE.test(start || '')) throw new BillingError(409, 'Assinatura sem vencimento inicial confirmado.');
  // A missing page can hide a refund or confirmed payment. Fail closed.
  const payments = [];
  for (let offset = 0; offset <= 400; offset += 100) {
    const result = await request('GET', '/subscriptions/' + id + '/payments?' + new URLSearchParams({ limit: '100', offset: String(offset) }));
    if (!Array.isArray(result?.data)) throw new BillingError(502, 'Conciliação incompleta no Asaas.');
    payments.push(...result.data);
    if (!result.hasMore) return { sub, payments };
  }
  throw new BillingError(502, 'Conciliação incompleta no Asaas.');
}

async function saveProjection(db, trial, snapshot, now = new Date()) {
  if (!snapshot) return trial;
  const { sub, payments } = snapshot;
  const projection = projectTrialAccess({ ...trial, subscription_id: trial.subscription_id || sub.id },
    sub, payments, saoPaulo.format(now));
  await db.query(`UPDATE asaas_managed_trials SET subscription_id = $2, state = $3,
    trial_confirmed = $4, pro_until = $5, updated_at = NOW() WHERE reference = $1`,
    [trial.reference, sub.id, projection.state, projection.trialConfirmed, projection.proUntil]);
  if (trial.user_id && (projection.proUntil || trial.entitlement_id)) {
    const expiresAt = projection.proUntil ? projection.proUntil + 'T00:00:00-03:00' : null;
    if (trial.entitlement_id) {
      await db.query(`UPDATE subscriptions SET plan = $2, status = 'active', expires_at = $3, updated_at = NOW()
        WHERE id = $1 AND provider = $4`, [trial.entitlement_id, expiresAt ? 'pro' : 'free', expiresAt, PROVIDER]);
    } else {
      const created = await db.query(`INSERT INTO subscriptions (user_id, plan, status, expires_at, provider, billing_method)
        VALUES ($1, 'pro', 'active', $2, $3, 'credit_card') RETURNING id`, [trial.user_id, expiresAt, PROVIDER]);
      await db.query('UPDATE asaas_managed_trials SET entitlement_id = $2 WHERE reference = $1', [trial.reference, created.rows[0].id]);
    }
  }
  return { ...trial, state: projection.state, subscription_id: sub.id, pro_until: projection.proUntil };
}

async function refreshTrial(pool, config, userId, { cancel = false, request = providerClient(config) } = {}) {
  return transaction(pool, async (db) => {
    const { rows: [trial] } = await db.query(SELECT_TRIAL + ' WHERE account_id = $1 AND user_id = $2 FOR UPDATE', [config.accountId, userId]);
    if (!trial || !trial.plan) throw new BillingError(404, 'Assinatura de teste não encontrada.');
    let snapshot = await providerSnapshot(trial, request);
    if (cancel && !snapshot) throw new BillingError(409, 'A assinatura ainda não foi localizada. Procure o suporte se o checkout foi concluído.');
    if (cancel && !snapshot.sub.deleted) {
      const removed = await request('DELETE', '/subscriptions/' + snapshot.sub.id);
      if (removed?.deleted !== true || removed.id !== snapshot.sub.id) throw new BillingError(502, 'O Asaas ainda não confirmou o cancelamento.');
      // Re-read the payments: the first charge may have completed just before the cancellation.
      snapshot = await providerSnapshot({ ...trial, subscription_id: snapshot.sub.id }, request);
      if (!snapshot?.sub.deleted) throw new BillingError(502, 'Cancelamento solicitado; confirme a atualização no Asaas.');
    }
    return summarizeTrial(await saveProjection(db, trial, snapshot), new Date(), config);
  });
}

async function handleManagedEvent(pool, config, token, event, request = providerClient(config)) {
  if (!isTrustedBillingEvent(config, token, event)) throw new BillingError(401, 'Notificação não autorizada.');
  if (!EVENT.test(event.event || '')) return;
  const reference = [event.checkout?.externalReference, event.subscription?.externalReference, event.payment?.externalReference]
    .find((ref) => typeof ref === 'string' && /^instalapro-managed-[a-f0-9-]{36}$/.test(ref)) || null;
  const checkoutId = [event.checkout?.id, event.payment?.checkoutSession].find((id) => typeof id === 'string' && ID.test(id)) || null;
  const subId = providerId(event.subscription?.id || event.payment?.subscription, 'sub_');
  const customerId = providerId(event.subscription?.customer || event.payment?.customer || event.checkout?.customer, 'cus_');
  if (!reference && !checkoutId && !subId && !customerId) return;
  await transaction(pool, async (db) => {
    const { rows } = await db.query(`${SELECT_TRIAL} WHERE account_id = $1 AND reference IS NOT NULL
      AND (reference = $2 OR checkout_id = $3 OR subscription_id = $4 OR customer_id = $5) FOR UPDATE`,
      [config.accountId, reference, checkoutId, subId, customerId]);
    if (rows.length !== 1) return;
    const trial = rows[0];
    const { rowCount } = await db.query(`INSERT INTO asaas_managed_trial_events (account_id, event_id)
      VALUES ($1, $2) ON CONFLICT DO NOTHING`, [config.accountId, event.id]);
    if (!rowCount) return;
    // This only records a checkout ID when authenticated Asaas returns the
    // exact reference and customer we originally reserved.
    if (!trial.checkout_id && checkoutId && reference === trial.reference && customerId === trial.customer_id && event.checkout?.id === checkoutId) {
      await db.query('UPDATE asaas_managed_trials SET checkout_id = $2 WHERE reference = $1', [trial.reference, checkoutId]);
      trial.checkout_id = checkoutId;
    }
    const snapshot = await providerSnapshot(trial, request);
    if (snapshot) await saveProjection(db, trial, snapshot);
    else if (checkoutId && checkoutId === trial.checkout_id && ['CHECKOUT_CANCELED', 'CHECKOUT_EXPIRED'].includes(event.event)) {
      await db.query("UPDATE asaas_managed_trials SET state = 'abandoned', updated_at = NOW() WHERE reference = $1 AND subscription_id IS NULL", [trial.reference]);
    }
  });
}

module.exports = { BillingError, PILOT_CONSENT, PROVIDER, approveVerifiedTrial, buildManagedCheckout, canStartManagedTrial, getBillingConfig, getManagedTrialConfig, getTrial, handleManagedEvent,
  identityDigest, isTrustedBillingEvent, providerClient, refreshTrial, startTrial, summarizeTrial };
