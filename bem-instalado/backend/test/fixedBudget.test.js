const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/database');
const controller = require('../controllers/budgetController');

function setup(t) {
  const writes = [];
  t.mock.method(pool, 'connect', async () => ({
    release() {},
    async query(sql, args = []) {
      if (/INSERT INTO/.test(sql)) writes.push({ sql, args });
      if (/INSERT INTO budgets/.test(sql)) {
        return { rows: [{ id: 1, pricing_mode: args[2], total_amount: args[13] }] };
      }
      if (/FROM users/.test(sql)) return { rows: [{ is_admin: false, portfolio_photos: 0 }] };
      if (/FROM subscriptions/.test(sql)) return { rows: [{ plan: 'free', status: 'active' }] };
      if (/SELECT id FROM clients/.test(sql)) return { rowCount: 1, rows: [{ id: 5 }] };
      return { rows: [] };
    },
  }));
  return writes;
}

async function submit(body) {
  const res = { code: 200, status(code) { this.code = code; return this; }, json(payload) { this.payload = payload; return this; } };
  await controller.createBudget({ userId: 7, params: {}, body: { client_id: 5, environments: [], ...body } }, res);
  return res;
}

test('grava somente o valor fechado sem fabricar medidas, ambientes ou rolos', async (t) => {
  const writes = setup(t);
  const res = await submit({ pricing_mode: 'fixed', fixed_price: 450.5 });
  assert.equal(res.code, 201, JSON.stringify(res.payload));
  assert.equal(res.payload.total_amount, 450.5);
  assert.equal(res.payload.pricing_mode, 'fixed');
  const budget = writes.find(({ sql }) => /INSERT INTO budgets/.test(sql));
  assert.deepEqual(budget.args.slice(4, 10), [0, 0, 0, 0, 450.5, 0]);
  assert.ok(!writes.some(({ sql }) => /INSERT INTO environments/.test(sql)));
});

test('rejeita valor fechado inválido e preserva a exigência de medidas por m²', async (t) => {
  const writes = setup(t);
  for (const fixed_price of [0, -1, '', null, true, 'não é preço', 10.001, 100000000]) {
    const res = await submit({ pricing_mode: 'fixed', fixed_price });
    assert.equal(res.code, 400);
    assert.match(res.payload.error, /valor/i);
  }
  const measured = await submit({ pricing_mode: 'square_meter', price_per_square_meter: 50 });
  assert.equal(measured.code, 400);
  assert.equal(writes.length, 0);
});
