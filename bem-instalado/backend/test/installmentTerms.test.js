const test = require('node:test');
const assert = require('node:assert/strict');
const { installmentInfo, installmentAmountLabel, installmentConditionsLabel } = require('../../shared/installmentTerms.mjs');
const pool = require('../config/database');
const controller = require('../controllers/budgetController');

test('taxa de juros é informativa e não altera valor base nem orçamento salvo', () => {
  const budget = { total_amount: '200.00', installment_enabled: true, installments_count: 6, interest_free_installments: 3, installment_interest_rate: 5 };
  const original = structuredClone(budget);
  const terms = installmentInfo(budget);
  assert.equal(terms.installmentValue, 200 / 6);
  assert.match(installmentAmountLabel(terms), /6x de R\$\s*33,33 \(valor base\)/);
  assert.match(installmentConditionsLabel(terms), /5,00% a.m./);
  assert.match(installmentConditionsLabel(terms), /operadora, não incluídos/);
  assert.deepEqual(budget, original);
});

test('parcelas sem juros e pagamento à vista têm condições coerentes', () => {
  const interestFree = installmentInfo({ total_amount: 300, installment_enabled: true, installments_count: 3 });
  assert.equal(installmentConditionsLabel(interestFree), 'Sem juros até 3x.');
  const upfront = installmentInfo({ total_amount: 300, installment_enabled: false, installments_count: 3 });
  assert.equal(installmentAmountLabel(upfront), 'Pagamento à vista');
  assert.equal(installmentConditionsLabel(upfront), '');
});

test('texto do WhatsApp usa o mesmo valor base e aviso da operadora', async (t) => {
  t.mock.method(pool, 'query', async () => ({ rows: [{ id: 9, client_name: 'Cliente fictício', phone: '48999999999', total_amount: 200,
    installment_enabled: true, installments_count: 6, interest_free_installments: 3, installment_interest_rate: 5 }] }));
  const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await controller.sendWhatsApp({ params: { id: 9 }, userId: 1 }, res);
  const text = new URL(res.body.link).searchParams.get('text');
  assert.match(text, /valor base/);
  assert.match(text, /5,00% a.m./);
  assert.match(text, /Juros calculados pela operadora/);
});
