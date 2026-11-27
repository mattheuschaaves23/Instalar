const test = require('node:test');
const assert = require('node:assert/strict');
const { createTrialCheckout, checkNextAccount } = require('../services/subscriptionRollout');
const { getOfferPreview, legacyCheckoutBlocked } = require('../services/subscriptionOffer');

const sandbox = {
  NODE_ENV: 'development',
  SUBSCRIPTION_TRIAL_SANDBOX_ENABLED: 'true',
  ASAAS_TRIAL_SANDBOX_API_KEY: '$aact_hmlg_credencial_ficticia',
};
const noRequest = () => assert.fail('não deve chamar a rede');

test('produção bloqueia as duas entradas de novas assinaturas', async () => {
  for (const env of [
    { ...sandbox, NODE_ENV: 'production' },
    { ...sandbox, VERCEL: '1', VERCEL_ENV: 'production' },
    { ...sandbox, VERCEL: '1' },
  ]) {
    assert.equal(legacyCheckoutBlocked(env), true);
    assert.equal(getOfferPreview(env, 49.9, true).checkout_available, false);
    const result = await createTrialCheckout({
      env, isAdmin: true, plan: 'monthly', accepted: true, fetchImpl: noRequest,
    });
    assert.equal(result.status, 503);
  }
});

test('somente administrador com chave de teste válida pode usar o Sandbox', async () => {
  for (const [env, isAdmin] of [
    [sandbox, false],
    [{ ...sandbox, ASAAS_TRIAL_SANDBOX_API_KEY: '$aact_prod_credencial_ficticia' }, true],
    [{ ...sandbox, SUBSCRIPTION_TRIAL_SANDBOX_ENABLED: 'false' }, true],
  ]) {
    assert.equal(getOfferPreview(env, 49.9, isAdmin)?.checkout_available || false, false);
    const result = await createTrialCheckout({
      env, isAdmin, plan: 'yearly', accepted: true, fetchImpl: noRequest,
    });
    assert.equal(result.status, 503);
  }
});

test('checkout de teste valida escolha e consentimento antes de contatar o Asaas', async () => {
  for (const [plan, accepted] of [[['yearly'], true], ['free', true], ['yearly', false], ['monthly', 'true']]) {
    const result = await createTrialCheckout({
      env: sandbox, isAdmin: true, plan, accepted, fetchImpl: noRequest,
    });
    assert.equal(result.status, 400);
  }
});

test('a escolha anual usa o preço do servidor, cartão e apenas a URL de teste', async () => {
  const env = { ...sandbox, VERCEL: '1', VERCEL_ENV: 'preview', NODE_ENV: 'production' };
  assert.equal(getOfferPreview(env, 49.9, true).checkout_available, true);
  const result = await createTrialCheckout({
    env, isAdmin: true, plan: 'yearly', accepted: true, monthlyPrice: 49.9,
    fetchImpl: async (url, options) => {
      assert.equal(url.href, 'https://api-sandbox.asaas.com/v3/checkouts');
      assert.equal(options.method, 'POST');
      assert.equal(options.redirect, 'error');
      const body = JSON.parse(options.body);
      assert.deepEqual(body.billingTypes, ['CREDIT_CARD']);
      assert.equal(body.items[0].value, 538.92);
      assert.equal(body.subscription.cycle, 'YEARLY');
      assert.match(body.subscription.nextDueDate, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(!body.customer && !body.customerData);
      return Response.json({ id: 'test-sandbox-id', ignoredField: 'privado' });
    },
  });
  assert.equal(result.status, 201);
  assert.equal(result.data.url, 'https://sandbox.asaas.com/checkoutSession/show?id=test-sandbox-id');
  assert.equal(result.data.amount, 538.92);
  assert.equal('ignoredField' in result.data, false);
});

test('a conta nova só é consultada por leitura e nunca usa a chave do checkout antigo', async () => {
  const env = { ASAAS_API_KEY: '$aact_prod_antigo', ASAAS_NEXT_API_KEY: '$aact_prod_destino_ficticio' };
  assert.equal(await checkNextAccount({ ASAAS_API_KEY: env.ASAAS_API_KEY }, noRequest), 'not_configured');
  assert.equal(await checkNextAccount(env, async (url, options) => {
    assert.equal(url, 'https://api.asaas.com/v3/myAccount/status/');
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.access_token, env.ASAAS_NEXT_API_KEY);
    return Response.json({ general: 'APPROVED', privateField: 'privado' });
  }), 'approved');
  assert.equal(await checkNextAccount(env, async () => Response.json({}, { status: 401 })), 'verification_failed');
});

test('a aprovação cadastral não confunde uma carteira de produção diferente com a de destino', async () => {
  const wallet = '11111111-1111-4111-8111-111111111111';
  const env = {
    ASAAS_NEXT_API_KEY: '$aact_prod_destino_ficticio',
    ASAAS_NEXT_EXPECTED_WALLET_ID: wallet,
  };
  for (const [actualWallet, want] of [[wallet, 'verified_destination'], ['22222222-2222-4222-8222-222222222222', 'wrong_destination']]) {
    assert.equal(await checkNextAccount(env, async (url, options) => {
      assert.equal(options.method, 'GET');
      assert.equal(options.headers.access_token, env.ASAAS_NEXT_API_KEY);
      return url.endsWith('/wallets/') ? Response.json({ walletId: actualWallet }) : Response.json({ general: 'APPROVED' });
    }), want);
  }
});
