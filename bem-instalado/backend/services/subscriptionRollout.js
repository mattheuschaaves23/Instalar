const { makeCheckout, parseCheckoutLink, sandboxClient } = require('../scripts/asaasTrialSandbox');
const { sandboxCheckoutAllowed } = require('./subscriptionOffer');

const UNAVAILABLE = 'A contratação ainda não foi liberada.';

async function createTrialCheckout({ env, isAdmin, plan, accepted, monthlyPrice, fetchImpl }) {
  if (!sandboxCheckoutAllowed(env, isAdmin)) {
    return { status: 503, data: { error: UNAVAILABLE, code: 'TRIAL_CHECKOUT_UNAVAILABLE' } };
  }
  const plans = { monthly: 'mensal', yearly: 'anual' };
  if (typeof plan !== 'string' || !Object.hasOwn(plans, plan) || accepted !== true) {
    return { status: 400, data: { error: 'Escolha um plano e confirme que este é um teste.' } };
  }
  const request = sandboxClient(env.ASAAS_TRIAL_SANDBOX_API_KEY, fetchImpl);
  const payload = makeCheckout(plans[plan], undefined, undefined, monthlyPrice);
  const checkout = await request('/checkouts', payload);
  return {
    status: 201,
    data: {
      url: parseCheckoutLink(checkout),
      first_charge_on: payload.subscription.nextDueDate,
      amount: payload.items[0].value,
    },
  };
}

// This deliberately cannot create payments; until the trial lifecycle lands,
// the new production credential is only consumed by an admin preflight.
async function checkNextAccount(env, fetchImpl = fetch) {
  const key = env.ASAAS_NEXT_API_KEY || '';
  if (!/^\$aact_prod_[A-Za-z0-9_+/=-]{12,}$/.test(key)) return 'not_configured';
  const options = {
    method: 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
    headers: {
      accept: 'application/json',
      'user-agent': 'InstalarPro-Account-Verification/1.0',
      access_token: key,
    },
  };
  try {
    const response = await fetchImpl('https://api.asaas.com/v3/myAccount/status/', options);
    if (!response.ok) return 'verification_failed';
    const data = await response.json();
    return data?.general === 'APPROVED' ? 'approved' : 'not_approved';
  } catch {
    return 'verification_failed';
  }
}

module.exports = { createTrialCheckout, checkNextAccount };
