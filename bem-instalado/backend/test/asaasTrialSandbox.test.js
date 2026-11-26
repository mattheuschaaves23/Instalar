const test = require('node:test');
const assert = require('node:assert/strict');
const { getPlan, makeCheckout, parseCheckoutLink, run } = require('../scripts/asaasTrialSandbox');

const key = '$aact_hmlg_key_inventada_para_teste';
const reference = 'instalapro-trial-sandbox-00000000-0000-4000-8000-000000000000';
const checkoutId = 'c7b1c696-b27b-4d3d-80b9-d1c018e387f8';
const firstChargeOn = '2026-12-08';
const subscriptionId = 'sub_sandbox';
const response = (payload, status = 200) => Response.json(payload, { status });

test('mensal e anual correspondem aos preços, checkout aceita só cartão', () => {
  assert.deepEqual(getPlan('mensal'), { cycle: 'MONTHLY', cents: 4990 });
  assert.deepEqual(getPlan('anual'), { cycle: 'YEARLY', cents: 53892 });
  assert.throws(() => getPlan('gratis'), /mensal ou anual/);
  const payload = makeCheckout('anual', new Date('2026-11-30T00:15:00Z'), reference);
  assert.equal(payload.items[0].value, 538.92);
  for (const plan of ['anual', 'mensal']) {
    assert.ok(makeCheckout(plan).items[0].name.length <= 30);
  }
  assert.deepEqual(payload.billingTypes, ['CREDIT_CARD']);
  assert.deepEqual(payload.chargeTypes, ['RECURRENT']);
  assert.equal(payload.subscription.nextDueDate, '2026-12-07');
  assert.equal(payload.externalReference, reference);
  assert.equal('customerData' in payload, false);
});

test('vencimento não fica antes de 7 dias da última confirmação possível', () => {
  const start = new Date('2026-12-01T02:45:00Z'); // 23h45 em São Paulo.
  const payload = makeCheckout('mensal', start);
  assert.equal(payload.subscription.nextDueDate, '2026-12-09');
  const dueStart = new Date(`${payload.subscription.nextDueDate}T00:00:00-03:00`);
  const latestTrialStarts = +start + payload.minutesToExpire * 60000 + 15000;
  assert.ok(dueStart - latestTrialStarts >= 168 * 60 * 60000);
});

test('chave de produção e links que não são do checkout de teste são recusados', async () => {
  await assert.rejects(run(['verificar'], '$aact_prod_inventada', () => assert.fail('sem requisições')),
    /Use uma chave nova/);
  assert.equal(parseCheckoutLink({ id: checkoutId }), `https://sandbox.asaas.com/checkoutSession/show?id=${checkoutId}`);
  assert.equal(parseCheckoutLink({ id: checkoutId, link: `https://sandbox.asaas.com/checkoutSession/show?id=${checkoutId}&example=true` }),
    `https://sandbox.asaas.com/checkoutSession/show?id=${checkoutId}`);
  for (const base of ['https://asaas.com', 'https://sandbox.asaas.com.example.com', 'http://sandbox.asaas.com']) {
    assert.throws(() => parseCheckoutLink({ id: checkoutId, link: `${base}/checkoutSession/show?id=${checkoutId}` }),
      /endereço esperado do Sandbox/);
  }
});

test('requisita somente Sandbox e não exibe a resposta com dados de clientes', async () => {
  const result = await run(['verificar'], key, async (url, options) => {
    assert.equal(url.href, 'https://api-sandbox.asaas.com/v3/customers?externalReference=instalapro-sandbox-verificacao&limit=1');
    assert.equal(options.headers.access_token, key);
    assert.equal(options.redirect, 'error');
    return response({ data: [{ name: 'Dado que não deveria sair' }] });
  });
  assert.deepEqual(result, { ambiente: 'sandbox', chaveValidada: true });
  await assert.rejects(run(['verificar'], key, async () => response({ description: key }, 401)),
    (error) => error.message.includes('401') && !error.message.includes(key));
});

test('cria checkout recorrente de teste e devolve só os dados operacionais', async () => {
  const result = await run(['criar', 'anual'], key, async (url, options) => {
    assert.equal(url.href, 'https://api-sandbox.asaas.com/v3/checkouts');
    assert.equal(options.method, 'POST');
    const payload = JSON.parse(options.body);
    assert.equal(payload.subscription.cycle, 'YEARLY');
    assert.equal(payload.items[0].value, 538.92);
    return response({ id: checkoutId, privateData: 'não devolva' });
  });
  assert.deepEqual(Object.keys(result).sort(),
    ['CheckoutId', 'CheckoutUrl', 'Plano', 'PrimeiroDebito', 'Referencia', 'Valor']);
  assert.equal(result.CheckoutId, checkoutId);
  assert.equal(result.Valor, 538.92);
});

const inspect = (fetchImpl) => run(['inspecionar', checkoutId, reference, firstChargeOn, 'mensal'], key, fetchImpl);
function asaas({ payments = [], hasMore = false, subFields = {} } = {}) {
  return async (url) => {
    if (url.pathname === '/v3/payments') {
      assert.equal(url.searchParams.get('checkoutSession'), checkoutId);
      return response({ data: [] });
    }
    if (url.pathname === '/v3/subscriptions') {
      assert.equal(url.searchParams.get('externalReference'), reference);
      return response({ data: [{ id: subscriptionId, externalReference: reference }] });
    }
    if (url.pathname === `/v3/subscriptions/${subscriptionId}`) {
      return response({
        id: subscriptionId, status: 'ACTIVE', cycle: 'MONTHLY',
        billingType: 'CREDIT_CARD', value: 49.9, nextDueDate: firstChargeOn,
        ...subFields,
      });
    }
    assert.equal(url.pathname, `/v3/subscriptions/${subscriptionId}/payments`);
    return response({
      data: payments.map((payment, index) => ({ id: `pay_${index}`, subscription: subscriptionId, ...payment })),
      hasMore,
    });
  };
}

test('agenda compatível não significa que o cartão já foi debitado', async () => {
  const result = await inspect(asaas({ payments: [{ status: 'PENDING', dueDate: firstChargeOn, value: 49.9 }] }));
  assert.equal(result.schedule, 'compativel_com_o_teste');
  assert.equal(result.firstDebitObserved, false);
});

test('ignora registros de outra referência e trata falta de evidência como inconclusiva', async () => {
  assert.equal((await inspect(async () => response({ data: [{ externalReference: 'outra' }] }))).schedule, 'inconclusivo');
  assert.equal((await inspect(asaas({ hasMore: true }))).schedule, 'inconclusivo');
  assert.equal((await inspect(asaas({ payments: [{ status: 'RECEIVED' }] }))).schedule, 'inconclusivo');
  assert.equal((await inspect(asaas({ subFields: { status: 'INACTIVE' } }))).schedule, 'divergencia_revisar_no_painel');
});

test('sinaliza vencimento ou débito anterior à data e confirma só recebimento datado', async () => {
  const success = { status: 'CONFIRMED', dueDate: firstChargeOn, clientPaymentDate: firstChargeOn, value: 49.9 };
  assert.equal((await inspect(asaas({ payments: [success] }))).firstDebitObserved, true);
  for (const early of [
    { ...success, dueDate: '2026-12-07' },
    { ...success, clientPaymentDate: '2026-12-07' },
  ]) {
    const result = await inspect(asaas({ payments: [success, early] }));
    assert.equal(result.schedule, 'cobranca_antecipada_ou_vencimento_antecipado');
    assert.equal(result.firstDebitObserved, false);
  }
});
