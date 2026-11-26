const test = require('node:test');
const assert = require('node:assert/strict');
const { getOfferPrices, getOfferPreview } = require('../services/subscriptionOffer');

test('o desconto anual usa 12 mensalidades e calcula tudo em centavos', () => {
  assert.deepEqual(getOfferPrices(), {
    monthlyCents: 4990,
    yearlyCents: 53892,
    yearlySavingsCents: 5988,
  });
  assert.deepEqual(getOfferPrices(10.01), {
    monthlyCents: 1001,
    yearlyCents: 10811,
    yearlySavingsCents: 1201,
  });
  for (const invalid of [0, -1, NaN, Infinity]) {
    assert.throws(() => getOfferPrices(invalid), /Preço mensal inválido/);
  }
});

test('a oferta fica visível em produção, mas sem checkout', () => {
  assert.equal(getOfferPreview({ NODE_ENV: 'development' }), null);
  assert.equal(getOfferPreview({
    NODE_ENV: 'production', SUBSCRIPTION_TRIAL_PREVIEW_ENABLED: 'true',
  }).checkout_available, false);
});

test('prévia retorna condições e preços do servidor, sem checkout', () => {
  const offer = getOfferPreview({
    NODE_ENV: 'development', SUBSCRIPTION_TRIAL_PREVIEW_ENABLED: 'true',
  }, 49.9);
  assert.deepEqual(offer, {
    checkout_available: false,
    destination_check_available: false,
    trial_days: 7,
    payment_method: 'credit_card',
    annual_discount_percent: 10,
    options: { monthly: { amount: 49.9 }, yearly: { amount: 538.92, savings: 59.88 } },
  });
});
