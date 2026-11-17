const FREE_PLAN_LIMITS = Object.freeze({
  monthly_interests: 5,
  clients: 15,
  monthly_budgets: 5,
  environments_per_budget: 1,
  portfolio_photos: 3,
  availability_slots: 3,
});

const PRO_PLAN_LIMITS = Object.freeze({
  monthly_interests: null,
  clients: null,
  monthly_budgets: null,
  environments_per_budget: null,
  portfolio_photos: 10,
  availability_slots: null,
});

const FREE_FEATURES = Object.freeze({
  advanced_dashboard: false,
  advanced_reviews: false,
  multi_environment_budgets: false,
  installment_budgets: true,
  custom_pdf_branding: false,
  custom_accent: false,
  compact_density: false,
});

const PRO_FEATURES = Object.freeze(
  Object.fromEntries(Object.keys(FREE_FEATURES).map((key) => [key, true]))
);

function isSubscriptionCurrent(subscription, now = new Date()) {
  if (!subscription || subscription.status !== 'active') return false;
  if (!subscription.expires_at) return true;
  return new Date(subscription.expires_at).getTime() > now.getTime();
}

function isProSubscription(subscription, now = new Date()) {
  const plan = String(subscription?.plan || '').trim().toLowerCase();
  return ['pro', 'monthly'].includes(plan) && isSubscriptionCurrent(subscription, now);
}

function buildRemaining(limits, usage) {
  return Object.fromEntries(
    Object.entries(limits).map(([key, limit]) => [
      key,
      limit === null ? null : Math.max(0, Number(limit) - Number(usage[key] || 0)),
    ])
  );
}

function buildPlanAccess({
  subscription = null,
  usage = {},
  isAdmin = false,
  launchAccess = false,
} = {}) {
  const isPro = isAdmin || launchAccess || isProSubscription(subscription);
  const limits = isPro ? PRO_PLAN_LIMITS : FREE_PLAN_LIMITS;
  const normalizedUsage = {
    monthly_interests: Number(usage.monthly_interests || 0),
    clients: Number(usage.clients || 0),
    monthly_budgets: Number(usage.monthly_budgets || 0),
    environments_per_budget: 0,
    portfolio_photos: Number(usage.portfolio_photos || 0),
    availability_slots: Number(usage.availability_slots || 0),
  };

  return {
    plan: isPro ? 'pro' : 'free',
    plan_label: isPro ? 'InstalarPro Pro' : 'InstalarPro Grátis',
    is_pro: isPro,
    can_use_app: true,
    can_use_premium: isPro,
    access_mode: isAdmin ? 'admin' : launchAccess ? 'launch' : isPro ? 'pro' : 'free',
    limits,
    usage: normalizedUsage,
    remaining: buildRemaining(limits, normalizedUsage),
    features: isPro ? PRO_FEATURES : FREE_FEATURES,
  };
}

module.exports = {
  FREE_FEATURES,
  FREE_PLAN_LIMITS,
  PRO_FEATURES,
  PRO_PLAN_LIMITS,
  buildPlanAccess,
  isProSubscription,
  isSubscriptionCurrent,
};
