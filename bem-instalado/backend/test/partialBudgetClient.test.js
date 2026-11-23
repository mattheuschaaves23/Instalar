const { test } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/database');
const { createClient } = require('../controllers/clientController');

async function create(body) {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
  await createClient({ userId: 17, planAccess: { limits: { clients: null }, usage: { clients: 0 } }, body }, res);
  return res;
}

test('cadastro parcial do orçamento guarda os dados disponíveis em uma única inserção', async (t) => {
  const db = t.mock.method(pool, 'query', async () => ({ rows: [{ id: 77 }] }));
  const result = await create({ allow_incomplete: true, name: '  Mariana Silva ', email: 'mariana@example.test', city: 'Palhoça' });
  assert.equal(result.statusCode, 201, JSON.stringify(result.body));
  assert.equal(db.mock.callCount(), 1);
  const params = db.mock.calls[0].arguments[1];
  assert.deepEqual(params.slice(0, 5), [17, 'Mariana Silva', '', 'person', null]);
  assert.equal(params[7], 'mariana@example.test');
  assert.equal(params[12], 'Palhoça');
});

test('cadastro parcial valida documento quando preenchido e não muda o cadastro normal', async (t) => {
  const db = t.mock.method(pool, 'query', async () => ({ rows: [] }));
  const partial = await create({ allow_incomplete: true, name: 'Mariana Silva', document_id: '11111111111' });
  const normal = await create({ name: 'Mariana Silva' });
  assert.equal(partial.statusCode, 400);
  assert.equal(normal.statusCode, 400);
  assert.equal(db.mock.callCount(), 0);
});
