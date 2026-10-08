const test = require('node:test');
const assert = require('node:assert/strict');

test('PostgreSQL isolado: aprovações simultâneas, rejeição e conflito de agenda', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  // Never fall back to the production connection for a write test.
  const target = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Este teste de escrita exige PostgreSQL local/isolado, não um banco remoto de produção.');
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DATABASE_SSL = 'false';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET ||= 'integration-test-secret-with-at-least-32-characters';
  const pool = require('../config/database');
  const { ensureRuntimeSchema } = require('../server');
  const controller = require('../controllers/budgetController');
  await ensureRuntimeSchema();
  let userId;
  try {
    const user = await pool.query("INSERT INTO users (name, email, password) VALUES ('Conta QA fictícia', $1, 'not-a-login-password') RETURNING id", [`budget-qa-${Date.now()}@example.test`]);
    userId = user.rows[0].id;
    const client = await pool.query("INSERT INTO clients (user_id, name, phone) VALUES ($1, 'Cliente QA fictício', '48999990000') RETURNING id", [userId]);
    const createBudget = async () => (await pool.query('INSERT INTO budgets (user_id, client_id, total_amount) VALUES ($1, $2, 200) RETURNING id', [userId, client.rows[0].id])).rows[0].id;
    const invoke = async (action, id, body = {}) => {
      const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
      await controller[action]({ userId, params: { id }, body }, res);
      return res;
    };
    const id = await createBudget();
    const approval = { schedule_date: '2030-01-10 09:00:00' };
    const repeated = await Promise.all(Array.from({ length: 3 }, () => invoke('approveBudget', id, approval)));
    assert.ok(repeated.every((res) => res.statusCode === 200), JSON.stringify(repeated));
    const notifications = await pool.query("SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND title = 'Orçamento aprovado'", [userId]);
    const schedules = await pool.query('SELECT * FROM schedules WHERE budget_id = $1', [id]);
    assert.equal(notifications.rows[0].count, 1);
    assert.equal(schedules.rows.length, 1);
    await pool.query("UPDATE schedules SET status = 'completed' WHERE id = $1", [schedules.rows[0].id]);
    assert.equal((await invoke('approveBudget', id, approval)).statusCode, 200);
    assert.equal((await pool.query('SELECT status FROM schedules WHERE id = $1', [schedules.rows[0].id])).rows[0].status, 'completed');
    assert.equal((await invoke('rejectBudget', id)).statusCode, 409);
    assert.equal((await invoke('approveBudget', id, { schedule_date: '2030-01-11 09:00:00' })).statusCode, 409);

    const pendingId = await createBudget();
    const rejected = await Promise.all([invoke('rejectBudget', pendingId), invoke('rejectBudget', pendingId)]);
    assert.ok(rejected.every((res) => res.statusCode === 200));
    assert.equal((await invoke('approveBudget', pendingId, approval)).statusCode, 409);

    const first = await createBudget();
    const second = await createBudget();
    const conflict = await Promise.all([invoke('approveBudget', first, { schedule_date: '2030-01-12 09:00:00' }), invoke('approveBudget', second, { schedule_date: '2030-01-12 09:00:00' })]);
    assert.deepEqual(conflict.map((res) => res.statusCode).sort(), [200, 409]);
    const states = await pool.query('SELECT status FROM budgets WHERE id = ANY($1::int[])', [[first, second]]);
    assert.deepEqual(states.rows.map((row) => row.status).sort(), ['approved', 'pending']);
  } finally {
    if (userId) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.end();
  }
});
