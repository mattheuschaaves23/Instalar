const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/database');
const controller = require('../controllers/budgetController');

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const request = (body = {}) => ({ userId: 1, params: { id: 9 }, body });

function mockDatabase(t, status = 'pending') {
  const state = { budget: { id: 9, user_id: 1, client_id: 5, status }, notifications: 0, updates: 0, calls: [], released: false };
  const db = {
    release() { state.released = true; },
    async query(sql, values) {
      state.calls.push(sql);
      if (/pg_advisory_xact_lock/.test(sql)) return { rows: [] };
      if (/SELECT \* FROM budgets/.test(sql)) return { rows: state.budget ? [{ ...state.budget }] : [] };
      if (/UPDATE budgets/.test(sql)) {
        state.updates += 1;
        state.budget = { ...state.budget, status: /'rejected'/.test(sql) ? 'rejected' : 'approved' };
        if (/schedule_date/.test(sql)) state.budget.schedule_date = values[0] || state.budget.schedule_date;
        return { rows: [{ ...state.budget }], rowCount: 1 };
      }
      if (/INSERT INTO notifications/.test(sql)) { state.notifications += 1; return { rows: [] }; }
      if (/FROM schedules/.test(sql)) return { rows: [] };
      return { rows: [] };
    },
  };
  t.mock.method(pool, 'connect', async () => db);
  t.mock.method(pool, 'query', async (sql, values) => db.query(sql, values));
  return state;
}

test('aprovação repetida é idempotente e não duplica notificações nem atualizações', async (t) => {
  const state = mockDatabase(t);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = response();
    await controller.approveBudget(request(), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.budget.status, 'approved');
  }
  assert.equal(state.notifications, 1);
  assert.equal(state.updates, 1);
  assert.equal(state.released, true);
  assert.ok(state.calls.some((sql) => /FOR UPDATE/.test(sql)));
});

test('aprovar um orçamento rejeitado retorna conflito sem efeitos', async (t) => {
  const state = mockDatabase(t, 'rejected');
  const res = response();
  await controller.approveBudget(request(), res);
  assert.equal(res.statusCode, 409);
  assert.equal(state.notifications, 0);
  assert.equal(state.updates, 0);
});

test('não permite reagendar um orçamento aprovado pelo endpoint de aprovação', async (t) => {
  const state = mockDatabase(t, 'approved');
  state.budget.schedule_date = '2026-10-10 09:00:00';
  const res = response();
  await controller.approveBudget(request({ schedule_date: '2026-10-11 09:00:00' }), res);
  assert.equal(res.statusCode, 409);
  assert.equal(state.updates, 0);
  assert.equal(state.notifications, 0);
});

test('rejeitar orçamento aprovado retorna conflito e preserva agenda', async (t) => {
  const state = mockDatabase(t, 'approved');
  const res = response();
  await controller.rejectBudget(request(), res);
  assert.equal(res.statusCode, 409);
  assert.equal(state.updates, 0);
  assert.equal(state.budget.status, 'approved');
  assert.ok(state.calls.some((sql) => /FOR UPDATE/.test(sql)));
});

test('rejeição de pendente é idempotente', async (t) => {
  const state = mockDatabase(t);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = response();
    await controller.rejectBudget(request(), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'rejected');
  }
  assert.equal(state.updates, 1);
});

test('aprovação sem orçamento pertencente ao usuário retorna 404', async (t) => {
  const state = mockDatabase(t);
  state.budget = null;
  const res = response();
  await controller.approveBudget(request(), res);
  assert.equal(res.statusCode, 404);
  assert.equal(state.updates, 0);
  assert.equal(state.notifications, 0);
});
