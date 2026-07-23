const DEFAULT_TRIAL_DAYS = 7;
const MAX_TRIAL_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function getSubscriptionTrialDays() {
  const configured = Number.parseInt(process.env.SUBSCRIPTION_TRIAL_DAYS, 10);

  if (!Number.isInteger(configured) || configured < 1 || configured > MAX_TRIAL_DAYS) {
    return DEFAULT_TRIAL_DAYS;
  }

  return configured;
}

function isTrialSubscription(subscription) {
  return String(subscription?.plan || '').trim().toLowerCase() === 'trial';
}

function isActiveTrial(subscription, now = new Date()) {
  if (!isTrialSubscription(subscription) || subscription?.status !== 'active' || !subscription?.expires_at) {
    return false;
  }

  return new Date(subscription.expires_at).getTime() > now.getTime();
}

function getTrialDaysRemaining(subscription, now = new Date()) {
  if (!isActiveTrial(subscription, now)) {
    return 0;
  }

  return Math.max(1, Math.ceil((new Date(subscription.expires_at).getTime() - now.getTime()) / DAY_IN_MS));
}

module.exports = {
  DEFAULT_TRIAL_DAYS,
  getSubscriptionTrialDays,
  getTrialDaysRemaining,
  isActiveTrial,
  isTrialSubscription,
};
