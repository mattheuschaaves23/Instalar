const assert = require('node:assert/strict');
const test = require('node:test');
const lifecycle = require('../services/subscriptionRollout');
const managed = require('../services/managedAsaasTrial');

const intent = {
  customer_id: 'cus_homologacao', subscription_id: 'sub_homologacao', first_due_on: '2026-12-04',
  plan: 'monthly', amount_cents: 4990, trial_confirmed: false,
};
const providerSub = {
  id: 'sub_homologacao', customer: 'cus_homologacao', status: 'ACTIVE', deleted: false,
  billingType: 'CREDIT_CARD', value: 49.90, cycle: 'MONTHLY', nextDueDate: '2026-12-04',
};
const first = {
  id: 'pay_primeira', customer: providerSub.customer, subscription: providerSub.id,
  billingType: 'CREDIT_CARD', value: 49.90, originalDueDate: '2026-12-04',
  dueDate: '2026-12-04', status: 'CONFIRMED', confirmedDate: '2026-12-04',
};

test('a confirmação do checkout sozinha não concede Pro; uma assinatura verificada libera o teste até o vencimento', () => {
  assert.equal(typeof lifecycle.projectTrialAccess, 'function', 'A projeção de acesso ainda não existe');
  assert.deepEqual(lifecycle.projectTrialAccess(intent, null, [], '2026-11-28'), {
    state: 'pending', trialConfirmed: false, proUntil: null,
  });
  assert.deepEqual(lifecycle.projectTrialAccess(intent, providerSub, [], '2026-11-28'), {
    state: 'trial', trialConfirmed: true, proUntil: '2026-12-04',
  });
});

test('cobrança pendente, recusada, anterior ao vencimento ou de outra assinatura não estende Pro', () => {
  const started = { ...intent, trial_confirmed: true };
  for (const invalid of [
    { ...first, status: 'PENDING' },
    { ...first, status: 'OVERDUE' },
    { ...first, confirmedDate: '2026-12-03' },
    { ...first, confirmedDate: null },
    { ...first, value: 49.91 },
    { ...first, billingType: 'PIX' },
    { ...first, subscription: 'sub_outra' },
  ]) {
    assert.deepEqual(lifecycle.projectTrialAccess(started, providerSub, [invalid], '2026-12-05'),
      { state: 'unpaid', trialConfirmed: true, proUntil: null });
  }
});

test('débito confirmado libera o ciclo certo; nunca soma duas vezes o mesmo pagamento', () => {
  assert.deepEqual(lifecycle.projectTrialAccess(intent, providerSub, [first, first], '2026-12-04'),
    { state: 'paid', trialConfirmed: true, proUntil: '2027-01-04' });
  const renew = { ...first, id: 'pay_segunda', originalDueDate: '2027-01-04', confirmedDate: '2027-01-04' };
  const next = { ...providerSub, nextDueDate: '2027-02-04' };
  assert.deepEqual(lifecycle.projectTrialAccess({ ...intent, trial_confirmed: true }, next, [renew, first], '2027-01-04'),
    { state: 'paid', trialConfirmed: true, proUntil: '2027-02-04' });
});

test('cancelamento sem débito encerra o teste; com débito mantém só o ciclo quitado; estorno retira o ciclo', () => {
  const started = { ...intent, trial_confirmed: true };
  const cancelled = { ...providerSub, deleted: true, status: 'EXPIRED' };
  assert.deepEqual(lifecycle.projectTrialAccess(started, cancelled, [], '2026-11-28'),
    { state: 'cancelled', trialConfirmed: true, proUntil: null });
  assert.deepEqual(lifecycle.projectTrialAccess(started, cancelled, [first], '2026-12-05'),
    { state: 'cancelled', trialConfirmed: true, proUntil: '2027-01-04' });
  assert.deepEqual(lifecycle.projectTrialAccess(started, cancelled, [{ ...first, status: 'REFUNDED' }], '2026-12-05'),
    { state: 'cancelled', trialConfirmed: true, proUntil: null });
});

test('ciclo anual usa uma cobrança de R$ 538,92 e acerta fevereiro bissexto', () => {
  const annual = { ...intent, plan: 'yearly', amount_cents: 53892, first_due_on: '2028-02-29' };
  const subscription = { ...providerSub, value: 538.92, cycle: 'YEARLY', nextDueDate: '2028-02-29' };
  const payment = { ...first, value: 538.92, originalDueDate: '2028-02-29', confirmedDate: '2028-02-29' };
  assert.deepEqual(lifecycle.projectTrialAccess(annual, subscription, [payment], '2028-02-29'),
    { state: 'paid', trialConfirmed: true, proUntil: '2029-02-28' });
});

test('contrato divergente do preço, ciclo, titular ou primeiro vencimento fica em revisão sem Pro', () => {
  for (const bad of [
    { ...providerSub, nextDueDate: '2026-12-03' },
    { ...providerSub, value: 1 },
    { ...providerSub, cycle: 'YEARLY' },
    { ...providerSub, customer: 'cus_outro' },
  ]) {
    assert.deepEqual(lifecycle.projectTrialAccess(intent, bad, [], '2026-11-28'),
      { state: 'review', trialConfirmed: false, proUntil: null });
  }
});

test('a revisão bloqueia acesso quando o Asaas adianta o vencimento de um teste já ativo', () => {
  const started = { ...intent, trial_confirmed: true };
  const early = { ...providerSub, nextDueDate: '2026-12-02' };
  assert.deepEqual(lifecycle.projectTrialAccess(started, early, [], '2026-11-28'),
    { state: 'review', trialConfirmed: true, proUntil: null });
});

const configEnv = {
  VERCEL: '1', VERCEL_ENV: 'preview', NODE_ENV: 'production',
  ASAAS_MANAGED_TRIAL_SANDBOX: 'true',
  ASAAS_MANAGED_TRIAL_ISOLATED_DB: 'true',
  ASAAS_TRIAL_SANDBOX_API_KEY: '$aact_hmlg_fixture_key_for_tests_only',
  ASAAS_MANAGED_TRIAL_WEBHOOK_TOKEN: 'fixture_token_for_tests_at_least_32_chars',
  ASAAS_MANAGED_TRIAL_ACCOUNT_ID: '11111111-1111-4111-8111-111111111111',
  ASAAS_MANAGED_TRIAL_IDENTITY_KEY: 'c'.repeat(64),
  ASAAS_MANAGED_TRIAL_RETURN_ORIGIN: 'https://instalapro-fixture.vercel.app',
};

test('checkout de homologação não usa credencial de produção nem é habilitado no site oficial', () => {
  assert.equal(typeof managed.getManagedTrialConfig, 'function', 'Falta a trava do ambiente');
  assert.equal(managed.getManagedTrialConfig(configEnv)?.environment, 'sandbox');
  assert.equal(managed.getManagedTrialConfig({ ...configEnv, VERCEL_ENV: 'production' }), null);
  assert.equal(managed.getManagedTrialConfig({ ...configEnv, ASAAS_TRIAL_SANDBOX_API_KEY: '$aact_prod_fixture_for_tests_only' }), null);
  assert.equal(managed.getManagedTrialConfig({ ...configEnv, ASAAS_MANAGED_TRIAL_ACCOUNT_ID: '' }), null);
  assert.equal(managed.getManagedTrialConfig({ ...configEnv, ASAAS_MANAGED_TRIAL_RETURN_ORIGIN: 'https://instalarpro.com.br' }), null);
});

test('aviso da conta nova precisa ter token e conta esperada; payload antigo não autoriza nada', () => {
  const config = managed.getManagedTrialConfig(configEnv);
  const event = { id: 'evt_exemplo&1982', event: 'PAYMENT_CONFIRMED', account: { id: config.accountId } };
  assert.equal(managed.isTrustedBillingEvent(config, config.webhookToken, event), true);
  assert.equal(managed.isTrustedBillingEvent(config, 'token_errado', event), false);
  assert.equal(managed.isTrustedBillingEvent(config, config.webhookToken, { ...event, account: { id: 'outra' } }), false);
});

test('checkout pré-associa o cadastro conferido, preserva o preço anual e só retorna para o Preview', () => {
  const config = managed.getManagedTrialConfig(configEnv);
  const checkout = managed.buildManagedCheckout(config, {
    plan: 'yearly', reference: 'instalapro-fixture', customer_id: 'cus_homologacao',
  }, new Date('2026-11-26T15:00:00Z'));
  assert.equal(checkout.customer, 'cus_homologacao');
  assert.deepEqual(checkout.billingTypes, ['CREDIT_CARD']);
  assert.deepEqual(checkout.subscription, { cycle: 'YEARLY', nextDueDate: '2026-12-04' });
  assert.equal(checkout.items[0].value, 538.92);
  assert.equal(new URL(checkout.callback.successUrl).origin, 'https://instalapro-fixture.vercel.app');
});
