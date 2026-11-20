const test = require('node:test');
const assert = require('node:assert/strict');

test('orçamento manual com nome apenas: salva e permite adicionar o WhatsApp depois', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const target = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Use um banco local isolado para testes de escrita.');
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DATABASE_SSL = 'false';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET ||= 'integration-test-secret-with-at-least-32-characters';
  const pool = require('../config/database');
  const { ensureRuntimeSchema } = require('../server');
  const clients = require('../controllers/clientController');
  const budgets = require('../controllers/budgetController');
  const invoke = async (handler, request) => {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await handler(request, response);
    return response;
  };

  let userId;
  try {
    await ensureRuntimeSchema();
    userId = (await pool.query(
      "INSERT INTO users (name, email, password) VALUES ('Instalador QA', $1, 'not-a-login-password') RETURNING id",
      [`manual-budget-${Date.now()}@example.test`],
    )).rows[0].id;
    const bad = await invoke(clients.createClient, { userId, body: { name: '   ', quick_create: true } });
    assert.equal(bad.statusCode, 400);

    const client = await invoke(clients.createClient, { userId, body: { name: '  Cliente avulso  ', quick_create: true } });
    assert.equal(client.statusCode, 201, JSON.stringify(client.body));
    assert.equal(client.body.name, 'Cliente avulso');
    assert.equal(client.body.phone, '');
    assert.equal(client.body.document_id, null);
    assert.equal(client.body.street, null);

    const budget = await invoke(budgets.createBudget, { userId, body: {
      client_id: client.body.id,
      pricing_mode: 'roll',
      price_per_roll: 50,
      environments: [{ name: 'Sala', height: 2, width: 4 }],
    } });
    assert.equal(budget.statusCode, 201, JSON.stringify(budget.body));
    assert.equal(budget.body.client_id, client.body.id);
    assert.equal(Number(budget.body.total_amount), 100);
    const request = { userId, params: { id: budget.body.id } };
    const withoutPhone = await invoke(budgets.sendWhatsApp, request);
    assert.equal(withoutPhone.statusCode, 409);
    assert.equal(withoutPhone.body.link, undefined);

    const updated = await invoke(clients.updateClient, { userId, params: { id: client.body.id }, body: { whatsapp: '5548999990000', city: 'Palhoça' } });
    assert.equal(updated.statusCode, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.city, 'Palhoça');
    assert.equal(updated.body.document_id, null);

    const withPhone = await invoke(budgets.sendWhatsApp, request);
    assert.equal(withPhone.statusCode, 200);
    assert.equal(new URL(withPhone.body.link).pathname, '/5548999990000');
  } finally {
    if (userId) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.end();
  }
});
