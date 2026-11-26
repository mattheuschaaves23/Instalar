const TRIAL_DAYS = 7;
const DEFAULT_MONTHLY_PRICE = 49.9;
const ANNUAL_DISCOUNT_PERCENT = 10;

function getOfferPrices(monthlyPrice = DEFAULT_MONTHLY_PRICE) {
  const monthlyCents = Math.round(monthlyPrice * 100);
  if (!Number.isSafeInteger(monthlyCents * 1200) || monthlyCents < 1) {
    throw new Error('Preço mensal inválido.');
  }
  const yearlyWithoutDiscountCents = monthlyCents * 12;
  const yearlyCents = Math.round(
    yearlyWithoutDiscountCents * (100 - ANNUAL_DISCOUNT_PERCENT) / 100
  );
  return {
    monthlyCents,
    yearlyCents,
    yearlySavingsCents: yearlyWithoutDiscountCents - yearlyCents,
  };
}

// Só uma apresentação de oferta, sem URL, token ou permissão para cobrar.
function legacyCheckoutBlocked(env) {
  return env.NODE_ENV === 'production' || env.VERCEL === '1' ||
    env.SUBSCRIPTION_TRIAL_PREVIEW_ENABLED === 'true' ||
    env.SUBSCRIPTION_TRIAL_SANDBOX_ENABLED === 'true';
}

function sandboxCheckoutAllowed(env, isAdmin) {
  const sandboxEnvironment = env.VERCEL === '1'
    ? env.VERCEL_ENV === 'preview'
    : env.NODE_ENV === 'development' && env.VERCEL_ENV !== 'production';
  return isAdmin === true && sandboxEnvironment &&
    env.SUBSCRIPTION_TRIAL_SANDBOX_ENABLED === 'true' &&
    /^\$aact_hmlg_[A-Za-z0-9_+/=-]{12,}$/.test(env.ASAAS_TRIAL_SANDBOX_API_KEY || '');
}

function getOfferPreview(env, monthlyPrice, isAdmin = false) {
  if (!legacyCheckoutBlocked(env)) {
    return null;
  }
  const prices = getOfferPrices(monthlyPrice);
  return {
    checkout_available: sandboxCheckoutAllowed(env, isAdmin),
    destination_check_available: isAdmin === true,
    trial_days: TRIAL_DAYS,
    payment_method: 'credit_card',
    annual_discount_percent: ANNUAL_DISCOUNT_PERCENT,
    options: {
      monthly: { amount: prices.monthlyCents / 100 },
      yearly: { amount: prices.yearlyCents / 100, savings: prices.yearlySavingsCents / 100 },
    },
  };
}

module.exports = {
  DEFAULT_MONTHLY_PRICE, TRIAL_DAYS, getOfferPrices, getOfferPreview,
  legacyCheckoutBlocked, sandboxCheckoutAllowed,
};
