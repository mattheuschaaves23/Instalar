const { randomUUID } = require('node:crypto');
const { TRIAL_DAYS, getOfferPrices } = require('../services/subscriptionOffer');

const API = 'https://api-sandbox.asaas.com/v3';
const API_ORIGIN = new URL(API).origin;
const CHECKOUT = 'https://sandbox.asaas.com';
const CHECKOUT_MINUTES = 30;
const TIMEOUT_MS = 15000;
const DAY_MS = 86400000;
const ID = /^[A-Za-z0-9_-]{1,120}$/;
const REFERENCE = /^instalapro-trial-sandbox-[a-f0-9-]{36}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

function getPlan(plan, monthlyPrice) {
  const { monthlyCents, yearlyCents } = getOfferPrices(monthlyPrice);
  if (plan === 'mensal') return { cycle: 'MONTHLY', cents: monthlyCents };
  if (plan === 'anual') return { cycle: 'YEARLY', cents: yearlyCents };
  throw new Error('Informe o plano mensal ou anual.');
}

function makeCheckout(plan, now = new Date(), reference = `instalapro-trial-sandbox-${randomUUID()}`, monthlyPrice) {
  const { cents, cycle } = getPlan(plan, monthlyPrice);
  // O Asaas pode executar em qualquer hora do dia informado. Avance para
  // o dia seguinte ao fim do teste mais tardio possível, no fuso da cobrança.
  const latestTrialEnd = now.getTime() + TIMEOUT_MS + CHECKOUT_MINUTES * 60000 + TRIAL_DAYS * DAY_MS;
  const firstChargeOn = dateFormatter.format(new Date(latestTrialEnd + DAY_MS));
  return {
    externalReference: reference,
    billingTypes: ['CREDIT_CARD'],
    chargeTypes: ['RECURRENT'],
    minutesToExpire: CHECKOUT_MINUTES,
    callback: {
      successUrl: 'https://example.com/?instalapro-sandbox=checkout-concluido',
      cancelUrl: 'https://example.com/?instalapro-sandbox=checkout-cancelado',
      expiredUrl: 'https://example.com/?instalapro-sandbox=checkout-expirado',
    },
    items: [{
      name: `InstalarPro ${plan} (teste)`,
      quantity: 1,
      value: cents / 100,
    }],
    subscription: { cycle, nextDueDate: firstChargeOn },
  };
}

function parseCheckoutLink(checkout, production = false) {
  if (typeof checkout?.id !== 'string' || !ID.test(checkout.id)) {
    throw new Error('Sandbox não retornou um identificador de checkout válido.');
  }
  const origin = production ? 'https://asaas.com' : CHECKOUT;
  const expected = new URL('/checkoutSession/show', origin);
  expected.searchParams.set('id', checkout.id);
  if (!checkout.link) return expected.href;
  let actual;
  try { actual = new URL(checkout.link); } catch { /* fail closed below */ }
  const allowedOrigin = actual?.origin === origin || (production && actual?.origin === 'https://www.asaas.com');
  if (!allowedOrigin || actual.username || actual.password) {
    throw new Error(production
      ? 'O checkout retornou um link fora do endereço Asaas de produção.'
      : 'O checkout retornou um link diferente do endereço esperado do Sandbox.');
  }
  // Use the documented route, verified in the Sandbox. The returned link can
  // have a different route or query string, neither of which we carry forward.
  return expected.href;
}

function sandboxClient(key, fetchImpl = fetch) {
  if (typeof key !== 'string' || !/^\$aact_hmlg_[a-zA-Z0-9_+/=-]+$/.test(key)) {
    throw new Error('Use uma chave nova da API do Sandbox (prefixo $aact_hmlg_).');
  }
  return async (path, body) => {
    const url = new URL(`${API}${path}`);
    if (url.origin !== API_ORIGIN || !url.pathname.startsWith('/v3/')) {
      throw new Error('Endereço fora do Sandbox.');
    }
    let response;
    try {
      response = await fetchImpl(url, {
        method: body ? 'POST' : 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          accept: 'application/json',
          ...(body ? { 'content-type': 'application/json' } : {}),
          'user-agent': 'InstalarPro-Sandbox/1.0',
          access_token: key,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new Error('Falha de conexão com a API Sandbox. Se tentou criar, confira no painel antes de repetir.');
    }
    if (!response.ok) {
      // A mensagem do provedor pode conter dados do pagador. Use apenas HTTP.
      throw new Error(`Sandbox respondeu HTTP ${response.status}. Confira a chave e os registros no painel Sandbox.`);
    }
    try { return await response.json(); } catch { throw new Error('Resposta inválida do Sandbox.'); }
  };
}

function readDate(value) {
  if (typeof value !== 'string') return null;
  const date = value.slice(0, 10);
  if (!DATE.test(date)) return null;
  const parsed = new Date(date);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(date) ? date : null;
}

async function inspect(request, checkoutId, reference, firstChargeOn, plan) {
  if (!checkoutId || !ID.test(checkoutId) || (reference !== null && (!reference || !REFERENCE.test(reference))) ||
      !firstChargeOn || firstChargeOn !== readDate(firstChargeOn)) {
    throw new Error('Informe CheckoutId, Referencia e PrimeiroDebito conforme a saída de Criar.');
  }
  const { cents, cycle } = getPlan(plan);
  const [byCheckout, byReference] = await Promise.all([
    request(`/payments?${new URLSearchParams({ checkoutSession: checkoutId, limit: '100' })}`),
    reference ? request(`/subscriptions?${new URLSearchParams({ externalReference: reference, limit: '100' })}`) :
      Promise.resolve({ data: [] }),
  ]);
  if (!Array.isArray(byCheckout?.data) || !Array.isArray(byReference?.data)) {
    throw new Error('O Sandbox não devolveu o formato esperado de listagem.');
  }
  const subs = new Set(byReference.data
    .filter((sub) => sub.externalReference === reference)
    .map((sub) => sub.id));
  const matchedPayments = byCheckout.data.filter((pay) => pay.checkoutSession === checkoutId);
  for (const pay of matchedPayments) if (pay.subscription) subs.add(pay.subscription);
  if (subs.size > 1) throw new Error('Há mais de uma assinatura associada ao teste. Revise no painel.');
  const [subscriptionId] = subs;
  let subscription = null;
  let payments = matchedPayments;
  let limited = Boolean(byCheckout.hasMore || byReference.hasMore);
  if (typeof subscriptionId === 'string' && ID.test(subscriptionId)) {
    const [detail, list] = await Promise.all([
      request(`/subscriptions/${subscriptionId}`),
      request(`/subscriptions/${subscriptionId}/payments?limit=100`),
    ]);
    if (detail?.id !== subscriptionId || !Array.isArray(list?.data)) {
      throw new Error('O Sandbox não devolveu o formato esperado da assinatura.');
    }
    subscription = {
      status: detail.status,
      cycle: detail.cycle,
      billingType: detail.billingType,
      amount: detail.value,
      nextDueDate: readDate(detail.nextDueDate),
    };
    limited ||= Boolean(list.hasMore);
    payments = [...new Map(
      [...payments, ...list.data.filter((pay) => pay.subscription === subscriptionId)]
        .map((pay) => [pay.id, pay]),
    ).values()];
  }
  const evidence = payments.map((pay) => ({
    dueDate: readDate(pay.dueDate),
    debitDate: readDate(pay.clientPaymentDate || pay.paymentDate || pay.confirmedDate),
    amount: pay.value,
    status: pay.status,
  }));
  const premature = evidence.some((pay) => (
    (pay.dueDate !== null && pay.dueDate < firstChargeOn) ||
    (pay.debitDate !== null && pay.debitDate < firstChargeOn)
  ));
  const settledUndated = evidence.some((pay) =>
    ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH', 'REFUNDED', 'CHARGEBACK_REQUESTED'].includes(pay.status) &&
      pay.debitDate === null);
  const compatible = subscription && subscription.status === 'ACTIVE' && subscription.cycle === cycle &&
    subscription.billingType === 'CREDIT_CARD' && Math.round(subscription.amount * 100) === cents;
  const scheduled = subscription?.nextDueDate === firstChargeOn ||
    evidence.some((pay) => pay.dueDate === firstChargeOn && Math.round(pay.amount * 100) === cents);
  const consistent = !premature && !limited && !settledUndated && compatible && scheduled;
  return {
    expectedFirstChargeOn: firstChargeOn,
    subscription,
    payments: evidence,
    schedule: premature ? 'cobranca_antecipada_ou_vencimento_antecipado' :
      !subscription || limited || settledUndated ? 'inconclusivo' :
      compatible && scheduled ? 'compativel_com_o_teste' : 'divergencia_revisar_no_painel',
    firstDebitObserved: Boolean(consistent && evidence.some((pay) =>
      pay.dueDate === firstChargeOn && pay.debitDate && pay.debitDate >= firstChargeOn &&
      Math.round(pay.amount * 100) === cents && ['CONFIRMED', 'RECEIVED'].includes(pay.status))),
  };
}

async function run(args, key, fetchImpl) {
  const [command, ...params] = args;
  const request = sandboxClient(key, fetchImpl);
  if (command === 'verificar' && params.length === 0) {
    await request('/customers?externalReference=instalapro-sandbox-verificacao&limit=1');
    return { ambiente: 'sandbox', chaveValidada: true };
  }
  if (command === 'criar' && params.length === 1) {
    const payload = makeCheckout(params[0]);
    const checkout = await request('/checkouts', payload);
    return {
      Plano: params[0],
      CheckoutId: checkout.id,
      CheckoutUrl: parseCheckoutLink(checkout),
      Referencia: payload.externalReference,
      PrimeiroDebito: payload.subscription.nextDueDate,
      Valor: payload.items[0].value,
    };
  }
  if (command === 'inspecionar' && params.length === 4) return inspect(request, ...params);
  if (command === 'inspecionar-checkout' && params.length === 3) return inspect(request, params[0], null, params[1], params[2]);
  throw new Error('Ações disponíveis: verificar, criar <mensal|anual>, inspecionar <id> <referência> <data> <plano>, inspecionar-checkout <id> <data> <plano>.');
}

if (require.main === module) {
  const key = require('node:fs').readFileSync(0, 'utf8').trim();
  run(process.argv.slice(2), key)
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}

module.exports = { getPlan, makeCheckout, parseCheckoutLink, sandboxClient, run };
