const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { approveVerifiedTrial, getBillingConfig, getTrial, handleManagedEvent, refreshTrial, startTrial } = require('../services/managedAsaasTrial');

for (const environment of ['sandbox', 'production']) {
test(`${environment}: identidade única, replay, débito posterior, estorno e cancelamento sem tocar o plano legado`,
  { skip: !process.env.TEST_PGLITE_MODULE }, async () => {
    const { PGlite } = require(process.env.TEST_PGLITE_MODULE);
    const db = new PGlite();
    const query = async (sql, args) => {
      const result = await db.query(sql, args);
      return { ...result, rowCount: result.rows.length || result.affectedRows || 0 };
    };
    const pool = { query, connect: async () => ({ query, release() {} }) };
    try {
      await db.exec(`
        CREATE TABLE users (id serial PRIMARY KEY, account_type text NOT NULL, deleted_at timestamptz, is_admin boolean NOT NULL);
        CREATE TABLE subscriptions (id serial PRIMARY KEY, user_id int NOT NULL REFERENCES users(id), plan text,
         status text, provider text, billing_method text, expires_at timestamptz, updated_at timestamptz);
        INSERT INTO users(account_type, is_admin) VALUES ('installer',false), ('installer',false);
        INSERT INTO subscriptions(user_id, plan, status) VALUES (1,'free','active');
      `);
      await db.exec(readFileSync(path.join(__dirname, '../db/migrations/030_asaas_managed_trial.sql'), 'utf8'));

      const accountId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      const walletId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
      const webhookToken = 't'.repeat(40);
      const identityKey = 'a'.repeat(64);
      const production = environment === 'production';
      const liveEnv = {
        VERCEL: '1', VERCEL_ENV: 'production', NODE_ENV: 'production',
        ASAAS_NEXT_API_KEY: '$aact_prod_integration_fixture_only',
        ASAAS_NEXT_EXPECTED_WALLET_ID: walletId, ASAAS_PILOT_ACCOUNT_ID: accountId,
        ASAAS_PILOT_RECEIVER_ENABLED: 'true', ASAAS_PILOT_ENROLLMENT_ENABLED: 'true',
        ASAAS_PILOT_SANDBOX_VERIFIED: 'true', ASAAS_PILOT_WEBHOOK_VERIFIED: 'true',
        ASAAS_PILOT_INSTALLER_ID: '1', ASAAS_PILOT_WEBHOOK_TOKEN: webhookToken, ASAAS_PILOT_IDENTITY_KEY: identityKey,
      };
      const config = production ? getBillingConfig(liveEnv) : {
        environment, accountId, webhookToken, identityKey, returnOrigin: 'https://preview.example.com',
      };
      const consent = production ? { accepted: true, consent_version: 'asaas-pilot-v1', amount_cents: 4990 } : true;
      // CPF generated for this fixture, not a customer record. Never call an external provider here.
      const cpf = '00000000191';
      let createCount = 0;
      let subscription = null;
      let payments = [];
      let lastPayload;
      const request = async (method, url, payload) => {
        if (method === 'GET' && url === '/wallets/') return { walletId };
        if (method === 'GET' && url === '/myAccount/status/') return { general: 'APPROVED' };
        if (method === 'GET' && url.startsWith('/customers/')) return { id: url.split('/').at(-1), cpfCnpj: cpf };
        if (method === 'POST' && url === '/checkouts') {
          createCount++;
          lastPayload = payload;
          return { id: 'co_fixture' };
        }
        if (method === 'GET' && url.startsWith('/subscriptions?')) return { data: subscription ? [subscription] : [] };
        if (method === 'GET' && url.startsWith('/subscriptions/sub_fixture/payments?')) return { data: payments };
        if (method === 'GET' && url.startsWith('/payments?')) return { data: payments };
        if (method === 'DELETE' && url === '/subscriptions/sub_fixture') {
          subscription = { ...subscription, deleted: true, status: 'EXPIRED' };
          return { id: 'sub_fixture', deleted: true };
        }
        assert.fail('unexpected provider call: ' + method + ' ' + url);
      };
      await approveVerifiedTrial(pool, config, 1, 'cus_fixture', cpf, request);
      await assert.rejects(approveVerifiedTrial(pool, config, 2, 'cus_outra_ficha', cpf, request), { status: production ? 403 : 409 });
      const checkout = await startTrial(pool, config, 1, 'monthly', consent, 49.9, request);
      assert.equal(checkout.url, `https://${production ? '' : 'sandbox.'}asaas.com/checkoutSession/show?id=co_fixture`);
      await assert.rejects(startTrial(pool, config, 1, 'monthly', consent, 49.9, request), { status: 409 });
      assert.equal(createCount, 1);

      const event = (id, type, data) => ({ id, event: type, account: { id: config.accountId }, ...data });
      const checkoutNotice = event('evt_checkout', 'CHECKOUT_PAID', { checkout: { id: 'co_fixture', customer: 'cus_fixture' } });
      await assert.rejects(handleManagedEvent(pool, config, 'wrong', checkoutNotice, request), { status: 401 });
      await handleManagedEvent(pool, config, config.webhookToken, checkoutNotice, request);
      assert.equal((await getTrial(pool, config, 1)).state, 'pending');
      assert.equal((await query("SELECT id FROM subscriptions WHERE plan = 'pro'")).rowCount, 0);

      subscription = { id: 'sub_fixture', customer: 'cus_fixture', status: 'ACTIVE', cycle: 'MONTHLY',
        externalReference: lastPayload.externalReference, nextDueDate: checkout.first_charge_on, billingType: 'CREDIT_CARD', value: 49.90 };
      const created = event('evt_created', 'SUBSCRIPTION_CREATED', { subscription });
      // Avoid treating legacy checkout confirmation as grant and process the exact same event twice.
      await handleManagedEvent(pool, config, config.webhookToken, created, request);
      await handleManagedEvent(pool, config, config.webhookToken, created, request);
      assert.equal((await getTrial(pool, config, 1)).state, 'trial');
      assert.equal((await query("SELECT id FROM subscriptions WHERE plan = 'pro'")).rowCount, 1);
      assert.equal((await query("SELECT event_id FROM asaas_managed_trial_events WHERE event_id = 'evt_created'")).rowCount, 1);

      const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' }).format(new Date());
      assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
      // Time-travel fixture: move the local first due to today so the real
      // reconciler can process a confirmed debit, with no external calls.
      await query('UPDATE asaas_managed_trials SET first_due_on = $1', [today]);
      subscription = { ...subscription, nextDueDate: today };
      payments = [{ id: 'pay_fixture', subscription: subscription.id, customer: subscription.customer, status: 'CONFIRMED',
        value: 49.90, billingType: 'CREDIT_CARD', dueDate: today, confirmedDate: today }];
      const paymentNotice = event('evt_paid', 'PAYMENT_CONFIRMED', { payment: payments[0] });
      await handleManagedEvent(pool, config, config.webhookToken, paymentNotice, request);
      assert.equal((await getTrial(pool, config, 1)).state, 'paid');
      payments[0] = { ...payments[0], status: 'REFUNDED' };
      await handleManagedEvent(pool, config, config.webhookToken, event('evt_refund', 'PAYMENT_REFUNDED', { payment: payments[0] }), request);
      await handleManagedEvent(pool, config, config.webhookToken, { ...paymentNotice, id: 'evt_late_confirm' }, request);
      assert.equal((await getTrial(pool, config, 1)).state, 'unpaid');
      assert.equal((await query("SELECT id FROM subscriptions WHERE plan = 'pro'")).rowCount, 0);
      const paused = production ? getBillingConfig({ ...liveEnv, ASAAS_PILOT_ENROLLMENT_ENABLED: 'false' }) : config;
      if (production) await assert.rejects(startTrial(pool, paused, 1, 'monthly', consent, 49.9, request), { status: 503 });
      const cancelled = await refreshTrial(pool, paused, 1, { cancel: true, request });
      assert.equal(cancelled.state, 'cancelled');
      assert.equal((await query("SELECT id FROM subscriptions WHERE provider IS NULL AND plan = 'free'")).rowCount, 1);
    } finally { await db.close(); }
  });
}
