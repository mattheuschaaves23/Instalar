const test = require('node:test');
const assert = require('node:assert/strict');

test('grava a quantidade de remoção separadamente e mantém os modos antigos', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const target = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Use um PostgreSQL local isolado.');
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DATABASE_SSL = 'false';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET ||= 'integration-test-secret-with-at-least-32-characters';
  const pool = require('../config/database');
  const { ensureRuntimeSchema } = require('../server');
  const { createBudget, getBudget } = require('../controllers/budgetController');

  let userId;
  const invoke = async (handler, request) => {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ userId, ...request }, response);
    return response;
  };

  try {
    await ensureRuntimeSchema();
    userId = (await pool.query(
      "INSERT INTO users (name, email, password) VALUES ('Instalador QA', $1, 'not-a-login-password') RETURNING id",
      [`removal-test-${Date.now()}@example.test`],
    )).rows[0].id;
    await pool.query("INSERT INTO subscriptions (user_id, plan, status) VALUES ($1, 'pro', 'active')", [userId]);
    const { rows: [client] } = await pool.query(
      "INSERT INTO clients (user_id, name, phone) VALUES ($1, 'Cliente QA', '48999990000') RETURNING id",
      [userId],
    );
    const rooms = [
      { name: 'Sala', height: 2, width: 4, removal_included: true },
      { name: 'Quarto', height: 2, width: 2, removal_included: true },
      { name: 'Escritório', height: 2, width: 2, removal_included: false },
    ];
    const base = { client_id: client.id, pricing_mode: 'roll', price_per_roll: 80, environments: rooms, removal_included: true };

    for (const removal_rolls of [0, -1, 2.5, 1001, true, '3']) {
      const invalid = await invoke(createBudget, { body: { ...base, removal_rolls, removal_price_per_roll: 50.01 } });
      assert.equal(invalid.statusCode, 400);
    }
    const noRoom = await invoke(createBudget, { body: {
      ...base, removal_rolls: 1, removal_price_per_roll: 50.01,
      environments: rooms.map((room) => ({ ...room, removal_included: false })),
    } });
    assert.equal(noRoom.statusCode, 400);

    // Instala 4 rolos; a estimativa de remoção é de 3; o instalador escolheu remover 1.
    const manual = await invoke(createBudget, { body: { ...base, removal_rolls: 1, removal_price_per_roll: 50.01 } });
    assert.equal(manual.statusCode, 201, JSON.stringify(manual.body));
    const saved = await invoke(getBudget, { params: { id: manual.body.id } });
    assert.equal(saved.statusCode, 200);
    assert.equal(saved.body.total_rolls, 4);
    assert.equal(saved.body.removal_rolls, 1);
    assert.equal(saved.body.removal_cost, '50.01');
    assert.equal(saved.body.total_amount, '370.01');
    assert.deepEqual(saved.body.environments.map((room) => room.removal_total), ['33.34', '16.67', '0.00']);
    assert.deepEqual(saved.body.environments.map((room) => room.total), ['193.34', '96.67', '80.00']);

    const automatic = await invoke(createBudget, { body: { ...base, removal_price_per_roll: 50.01 } });
    assert.equal(automatic.statusCode, 201, JSON.stringify(automatic.body));
    assert.equal(automatic.body.removal_rolls, 3);
    assert.equal(automatic.body.removal_cost, '150.03');

    const legacy = await invoke(createBudget, { body: {
      ...base, removal_price: 35, environments: [{ ...rooms[0], removal_included: false }],
    } });
    assert.equal(legacy.statusCode, 201, JSON.stringify(legacy.body));
    assert.equal(legacy.body.removal_cost, '35.00');
    assert.equal(legacy.body.total_amount, '195.00');
  } finally {
    if (userId) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.end();
  }
});
