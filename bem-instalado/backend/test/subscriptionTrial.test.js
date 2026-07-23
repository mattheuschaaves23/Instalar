const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_TRIAL_DAYS,
  getSubscriptionTrialDays,
  getTrialDaysRemaining,
  isActiveTrial,
  isTrialSubscription,
} = require('../utils/subscriptionTrial');

test('teste grátis usa sete dias por padrão e aceita configuração segura', () => {
  const previousTrialDays = process.env.SUBSCRIPTION_TRIAL_DAYS;

  delete process.env.SUBSCRIPTION_TRIAL_DAYS;
  assert.equal(getSubscriptionTrialDays(), DEFAULT_TRIAL_DAYS);

  process.env.SUBSCRIPTION_TRIAL_DAYS = '14';
  assert.equal(getSubscriptionTrialDays(), 14);

  process.env.SUBSCRIPTION_TRIAL_DAYS = '0';
  assert.equal(getSubscriptionTrialDays(), DEFAULT_TRIAL_DAYS);

  process.env.SUBSCRIPTION_TRIAL_DAYS = '90';
  assert.equal(getSubscriptionTrialDays(), DEFAULT_TRIAL_DAYS);

  if (previousTrialDays === undefined) delete process.env.SUBSCRIPTION_TRIAL_DAYS;
  else process.env.SUBSCRIPTION_TRIAL_DAYS = previousTrialDays;
});

test('identifica teste ativo e calcula os dias restantes', () => {
  const now = new Date('2026-07-23T12:00:00.000Z');
  const activeTrial = {
    plan: 'trial',
    status: 'active',
    expires_at: '2026-07-30T12:00:00.000Z',
  };

  assert.equal(isTrialSubscription(activeTrial), true);
  assert.equal(isActiveTrial(activeTrial, now), true);
  assert.equal(getTrialDaysRemaining(activeTrial, now), 7);
  assert.equal(isActiveTrial({ ...activeTrial, expires_at: now.toISOString() }, now), false);
  assert.equal(isActiveTrial({ ...activeTrial, plan: 'monthly' }, now), false);
});
