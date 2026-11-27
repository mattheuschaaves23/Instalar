const assert = require('node:assert/strict');
const test = require('node:test');
const { buildManagedCheckout, getBillingConfig, providerClient, startTrial } = require('../services/managedAsaasTrial');

const walletId = '11111111-1111-4111-8111-111111111111';
const env = {
  VERCEL: '1', VERCEL_ENV: 'production', NODE_ENV: 'production',
  ASAAS_NEXT_API_KEY: '$aact_prod_fixture_key_test_only',
  ASAAS_NEXT_EXPECTED_WALLET_ID: walletId,
  ASAAS_PILOT_RECEIVER_ENABLED: 'true',
  ASAAS_PILOT_ACCOUNT_ID: '33333333-3333-4333-8333-333333333333',
  ASAAS_PILOT_WEBHOOK_TOKEN: 'valid_pilot_fixture_token_at_least_32_chars',
  ASAAS_PILOT_IDENTITY_KEY: 'a'.repeat(64),
  ASAAS_PILOT_INSTALLER_ID: '42',
  ASAAS_PILOT_ENROLLMENT_ENABLED: 'true',
  ASAAS_PILOT_SANDBOX_VERIFIED: 'true',
  ASAAS_PILOT_WEBHOOK_VERIFIED: 'true',
};
const sale = { plan: 'yearly', reference: 'instalapro-fixture', customer_id: 'cus_fixture' };
const noPool = new Proxy({}, { get() { assert.fail('nenhuma consulta ao banco esperada'); } });
const noProvider = async () => assert.fail('nenhuma requisição ao provedor esperada');
const consent = { accepted: true, consent_version: 'asaas-pilot-v1', amount_cents: 53892 };

test('piloto de produção é isolado do Preview e bloqueia chaves de teste ou do contrato antigo', () => {
  assert.equal(typeof getBillingConfig, 'function', 'Configuração de piloto ainda não existe');
  assert.equal(getBillingConfig(env)?.environment, 'production');
  assert.equal(getBillingConfig({ ...env, VERCEL_ENV: 'preview' }), null);
  assert.equal(getBillingConfig({ ...env, ASAAS_NEXT_API_KEY: '$aact_hmlg_fixture_key_test_only' }), null);
  assert.equal(getBillingConfig({ ...env, ASAAS_API_KEY: env.ASAAS_NEXT_API_KEY }), null);
  assert.equal(getBillingConfig({ ...env, ASAAS_PILOT_RECEIVER_ENABLED: 'false' }), null);
});

test('sem aprovação da homologação, webhook continua ativo mas nenhum checkout real começa', async () => {
  const config = getBillingConfig({ ...env, ASAAS_PILOT_SANDBOX_VERIFIED: 'false' });
  assert.equal(config.environment, 'production');
  await assert.rejects(startTrial(noPool, config, 42, 'yearly', consent, 49.9, noProvider), { status: 503 });
});

test('produção exige o instalador autorizado e aceite do valor e da recorrência antes de consultar o Asaas', async () => {
  const config = getBillingConfig(env);
  await assert.rejects(startTrial(noPool, config, 43, 'yearly', consent, 49.9, noProvider), { status: 403 });
  await assert.rejects(startTrial(noPool, config, 42, 'yearly', { ...consent, amount_cents: 4990 }, 49.9, noProvider), { status: 409 });
  await assert.rejects(startTrial(noPool, config, 42, 'yearly', true, 49.9, noProvider), { status: 409 });
});

test('a carteira esperada é conferida antes de qualquer tentativa; uma chave de outra conta não pode cobrar', async () => {
  const config = getBillingConfig(env);
  await assert.rejects(startTrial(noPool, config, 42, 'yearly', consent, 49.9, async (method, path) => {
    assert.equal(method, 'GET');
    assert.equal(path, '/wallets/');
    return { walletId: '22222222-2222-4222-8222-222222222222' };
  }), { status: 503 });
});

test('checkout real do piloto usa nome e retorno oficiais, valores do servidor e endpoint de produção', async () => {
  const config = getBillingConfig(env);
  const payload = buildManagedCheckout(config, sale, new Date('2026-11-26T15:00:00Z'), 49.9);
  assert.equal(payload.items[0].name, 'InstalarPro Pro anual');
  assert.equal(payload.items[0].value, 538.92);
  assert.equal(new URL(payload.callback.successUrl).origin, 'https://instalarpro.com.br');
  const request = providerClient(config, async (url, options) => {
    assert.equal(url, 'https://api.asaas.com/v3/wallets/');
    assert.equal(options.headers.access_token, env.ASAAS_NEXT_API_KEY);
    return Response.json({ walletId });
  });
  assert.deepEqual(await request('GET', '/wallets/'), { walletId });
});
