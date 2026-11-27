const { makeCheckout, parseCheckoutLink, sandboxClient } = require('../scripts/asaasTrialSandbox');
const { sandboxCheckoutAllowed } = require('./subscriptionOffer');

const UNAVAILABLE = 'A contratação ainda não foi liberada.';
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function readAsaasWalletId(payload) {
  const id = payload?.object === 'list'
    ? (payload.hasMore === false && payload.totalCount === 1 && Array.isArray(payload.data) &&
      payload.data.length === 1 && payload.data[0]?.object === 'wallet' ? payload.data[0].id : null)
    : payload?.walletId;
  return typeof id === 'string' && UUID.test(id) ? id.toLowerCase() : null;
}

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
    const expected = env.ASAAS_NEXT_EXPECTED_WALLET_ID;
    if (expected) {
      if (!UUID.test(expected)) return 'not_configured';
      const wallet = await fetchImpl('https://api.asaas.com/v3/wallets/', options);
      if (!wallet.ok) return 'verification_failed';
      if (readAsaasWalletId(await wallet.json()) !== expected.toLowerCase()) return 'wrong_destination';
    }
    const response = await fetchImpl('https://api.asaas.com/v3/myAccount/status/', options);
    if (!response.ok) return 'verification_failed';
    const data = await response.json();
    return data?.general === 'APPROVED' ? (expected ? 'verified_destination' : 'approved') : 'not_approved';
  } catch {
    return 'verification_failed';
  }
}

// The provider owns the financial state. Checkout callbacks never call this
// with their own data: callers must read the bound subscription and payments.
function billingDate(value) {
  if (typeof value !== 'string') return null;
  const text = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : null;
}

function endOfPaidCycle(date, yearly) {
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + (yearly ? 12 : 1), 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

function sameAmount(value, cents) {
  return typeof value === 'number' && Number.isFinite(value) &&
    Math.abs(value * 100 - cents) < 0.000001;
}

function projectTrialAccess(intent, subscription, payments, today) {
  const firstDue = billingDate(intent.first_due_on);
  const confirmed = intent.trial_confirmed === true;
  const result = (state, trialConfirmed = confirmed, proUntil = null) => ({ state, trialConfirmed, proUntil });
  if (!firstDue || !billingDate(today) || !['monthly', 'yearly'].includes(intent.plan)) return result('review');
  if (!subscription) return result('pending');
  const yearly = intent.plan === 'yearly';
  const cancelled = subscription.deleted === true || ['INACTIVE', 'EXPIRED'].includes(subscription.status);
  if (!intent.subscription_id || subscription.id !== intent.subscription_id || subscription.customer !== intent.customer_id ||
      subscription.billingType !== 'CREDIT_CARD' || subscription.cycle !== (yearly ? 'YEARLY' : 'MONTHLY') ||
      !sameAmount(subscription.value, intent.amount_cents) || (!cancelled && subscription.status !== 'ACTIVE')) {
    return result('review');
  }

  const boundPayments = payments.filter((payment) => payment?.subscription === subscription.id &&
    payment.deleted !== true && payment.customer === intent.customer_id);
  const relevant = boundPayments.filter((payment) => payment.billingType === 'CREDIT_CARD' &&
    sameAmount(payment.value, intent.amount_cents));
  const dueOn = (payment) => billingDate(payment.originalDueDate || payment.dueDate);
  const nextDue = billingDate(subscription.nextDueDate);
  if (!cancelled && nextDue && nextDue < firstDue) return result('review');
  const scheduledFirst = relevant.some((payment) => payment.status === 'PENDING' &&
    dueOn(payment) === firstDue && billingDate(payment.dueDate) === firstDue &&
    !payment.clientPaymentDate && !payment.paymentDate && !payment.confirmedDate);
  if (!cancelled && today < firstDue && boundPayments.some((payment) =>
    [dueOn(payment), billingDate(payment.dueDate), billingDate(payment.clientPaymentDate),
      billingDate(payment.paymentDate), billingDate(payment.confirmedDate)].some((date) => date && date < firstDue))) {
    return result('review');
  }
  const validAgreement = confirmed || nextDue === firstDue ||
    (nextDue > firstDue && scheduledFirst) ||
    (today >= firstDue && relevant.some((payment) => dueOn(payment) === firstDue));
  if (!validAgreement) return result('review');

  let paidUntil = null;
  for (const payment of relevant) {
    if (!['CONFIRMED', 'RECEIVED'].includes(payment.status)) continue;
    const due = dueOn(payment);
    // creditDate is a transfer/availability date, not proof of the debit.
    const debit = billingDate(payment.confirmedDate || payment.paymentDate);
    if (!due || !debit || due < firstDue || due > today || debit < firstDue || debit > today) continue;
    const end = endOfPaidCycle(due, yearly);
    if (end > today && (!paidUntil || end > paidUntil)) paidUntil = end;
  }
  if (cancelled) return result('cancelled', true, paidUntil);
  if (paidUntil) return result('paid', true, paidUntil);
  if (today < firstDue) return result('trial', true, firstDue);
  return result('unpaid', true);
}

module.exports = { createTrialCheckout, checkNextAccount, projectTrialAccess, readAsaasWalletId };
