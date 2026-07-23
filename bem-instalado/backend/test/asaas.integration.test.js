const test = require('node:test');
const assert = require('node:assert/strict');

const enabled = Boolean(process.env.TEST_DATABASE_URL);

async function requestJson(fetchImpl, baseUrl, path, options = {}) {
  const response = await fetchImpl(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

test('Asaas cria checkout mensal, ativa assinatura e reverte acesso após estorno', { skip: !enabled }, async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DATABASE_SSL = 'false';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'asaas-integration-test-secret-with-at-least-32-characters';
  process.env.ASAAS_API_KEY = 'asaas-integration-test-key';
  process.env.ASAAS_WEBHOOK_TOKEN = 'asaas-integration-webhook-token-with-32-characters';
  process.env.ASAAS_ENVIRONMENT = 'sandbox';
  process.env.SUBSCRIPTION_LAUNCH_ACCESS = 'false';
  process.env.FRONTEND_URL = 'http://127.0.0.1:3000';

  const realFetch = global.fetch;
  let providerStatus = 'PENDING';
  let externalReference = '';
  let checkoutAmount = 0;
  const providerPaymentId = `pay_test_${Date.now()}`;
  const checkoutId = `checkout_test_${Date.now()}`;

  global.fetch = async (url, options = {}) => {
    const requestUrl = String(url);
    if (!requestUrl.startsWith('https://api-sandbox.asaas.com/v3')) {
      return realFetch(url, options);
    }

    if (requestUrl.includes('/customers?externalReference=')) {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }
    if (requestUrl.includes('/customers?cpfCnpj=')) {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }
    if (requestUrl.endsWith('/customers') && options.method === 'POST') {
      return new Response(JSON.stringify({ id: 'cus_integration_test' }), { status: 200 });
    }
    if (requestUrl.endsWith('/checkouts') && options.method === 'POST') {
      const body = JSON.parse(options.body);
      externalReference = body.externalReference;
      checkoutAmount = body.items[0].value;
      return new Response(
        JSON.stringify({
          id: checkoutId,
          link: `https://sandbox.asaas.com/checkoutSession/show/${checkoutId}`,
          customer: body.customer,
          status: 'ACTIVE',
          billingTypes: body.billingTypes,
          chargeTypes: body.chargeTypes,
          externalReference,
          items: body.items,
          subscription: body.subscription,
        }),
        { status: 200 }
      );
    }
    if (requestUrl.endsWith(`/payments/${providerPaymentId}/pixQrCode`)) {
      return new Response(
        JSON.stringify({
          encodedImage: 'integration-qr-image',
          payload: 'integration-pix-copy-paste',
          expirationDate: '2026-07-30T23:59:59Z',
        }),
        { status: 200 }
      );
    }
    if (requestUrl.endsWith(`/payments/${providerPaymentId}`)) {
      return new Response(
        JSON.stringify({
          id: providerPaymentId,
          customer: 'cus_integration_test',
          subscription: 'sub_integration_test',
          checkoutSession: checkoutId,
          status: providerStatus,
          billingType: 'PIX',
          externalReference,
          value: checkoutAmount,
          invoiceUrl: `https://sandbox.asaas.com/i/${providerPaymentId}`,
        }),
        { status: 200 }
      );
    }

    return new Response(JSON.stringify({ errors: [{ description: 'Rota Asaas simulada não encontrada.' }] }), {
      status: 404,
    });
  };

  const pool = require('../config/database');
  const { app, ensureRuntimeSchema } = require('../server');
  await ensureRuntimeSchema();

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `asaas-${suffix}@example.test`;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  let installerId = null;

  try {
    const registration = await requestJson(realFetch, baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Instalador Asaas Teste',
        email,
        password: 'TesteSeguro123!',
        phone: '48999999999',
        business_name: 'Integração Asaas',
      }),
    });
    assert.equal(registration.response.status, 201, JSON.stringify(registration.body));
    installerId = registration.body.user.id;
    const authHeaders = { Authorization: `Bearer ${registration.body.token}` };

    await pool.query(
      'UPDATE users SET document_id = $2 WHERE id = $1',
      [installerId, '24971563792']
    );
    const trialSubscription = await pool.query(
      'SELECT plan, status, expires_at FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [installerId]
    );
    assert.equal(trialSubscription.rows[0].plan, 'trial');
    assert.equal(trialSubscription.rows[0].status, 'active');
    assert.ok(trialSubscription.rows[0].expires_at);

    const payment = await requestJson(realFetch, baseUrl, '/api/subscriptions/pay', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    assert.equal(payment.response.status, 200, JSON.stringify(payment.body));
    assert.equal(payment.body.provider, 'asaas_checkout');
    assert.equal(payment.body.payment.provider_payment_id, checkoutId);
    assert.match(payment.body.ticketUrl, /checkoutSession/);

    providerStatus = 'RECEIVED';
    const paidWebhook = await requestJson(realFetch, baseUrl, '/api/subscriptions/webhooks/asaas', {
      method: 'POST',
      headers: { 'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN },
      body: JSON.stringify({
        id: `evt_paid_${suffix}`,
        event: 'PAYMENT_RECEIVED',
        payment: { id: providerPaymentId },
      }),
    });
    assert.equal(paidWebhook.response.status, 200, JSON.stringify(paidWebhook.body));
    assert.equal(paidWebhook.body.matched, true);

    const activeSubscription = await pool.query(
      'SELECT plan, status, expires_at, provider, provider_subscription_id, billing_method FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [installerId]
    );
    assert.equal(activeSubscription.rows[0].plan, 'monthly');
    assert.equal(activeSubscription.rows[0].status, 'active');
    assert.ok(activeSubscription.rows[0].expires_at);
    assert.equal(activeSubscription.rows[0].provider, 'asaas');
    assert.equal(activeSubscription.rows[0].provider_subscription_id, 'sub_integration_test');
    assert.equal(activeSubscription.rows[0].billing_method, 'pix');

    providerStatus = 'REFUNDED';
    const refundEventId = `evt_refund_${suffix}`;
    const refundedWebhook = await requestJson(realFetch, baseUrl, '/api/subscriptions/webhooks/asaas', {
      method: 'POST',
      headers: { 'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN },
      body: JSON.stringify({
        id: refundEventId,
        event: 'PAYMENT_REFUNDED',
        payment: { id: providerPaymentId },
      }),
    });
    assert.equal(refundedWebhook.response.status, 200, JSON.stringify(refundedWebhook.body));
    assert.equal(refundedWebhook.body.matched, true);

    const reversedSubscription = await pool.query(
      'SELECT plan, status, expires_at FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [installerId]
    );
    assert.equal(reversedSubscription.rows[0].plan, 'trial');
    assert.equal(reversedSubscription.rows[0].status, 'active');
    assert.equal(
      new Date(reversedSubscription.rows[0].expires_at).getTime(),
      new Date(trialSubscription.rows[0].expires_at).getTime()
    );

    const duplicateWebhook = await requestJson(realFetch, baseUrl, '/api/subscriptions/webhooks/asaas', {
      method: 'POST',
      headers: { 'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN },
      body: JSON.stringify({
        id: refundEventId,
        event: 'PAYMENT_REFUNDED',
        payment: { id: providerPaymentId },
      }),
    });
    assert.equal(duplicateWebhook.response.status, 200, JSON.stringify(duplicateWebhook.body));
    assert.equal(duplicateWebhook.body.duplicate, true);

    const paymentRow = await pool.query(
      'SELECT status FROM payments WHERE provider_payment_id = $1',
      [providerPaymentId]
    );
    assert.equal(paymentRow.rows[0].status, 'refunded');
  } finally {
    if (installerId) await pool.query('DELETE FROM users WHERE id = $1', [installerId]);
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
    global.fetch = realFetch;
  }
});
