const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/database');
const { selectServiceRequestInterest } = require('../controllers/serviceRequestController');

test('repetir uma escolha já concluída não falha por causa do prazo original do pedido', async (t) => {
  const queries = [];
  let released = false;
  const client = {
    async query(sql) {
      queries.push(sql.trim());
      if (sql.includes('SELECT *') && sql.includes('FROM service_requests')) return { rows: [{ id: 42, status: 'selected', selected_installer_id: 7, expires_at: '2020-01-01T00:00:00Z' }] };
      if (sql.includes('FROM service_request_interests')) return { rows: [{ id: 8, request_id: 42, installer_id: 7, status: 'selected', phone: '48999999999' }] };
      return { rows: [] };
    },
    release() { released = true; },
  };
  t.mock.method(pool, 'connect', async () => client);
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await selectServiceRequestInterest({ params: { id: '42', interestId: '8' }, headers: { 'x-client-request-token': 'test-only-access-token' }, body: {} }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.selected_interest.installer_id, 7);
  assert.ok(queries.includes('COMMIT'));
  assert.equal(queries.some((sql) => /INSERT|UPDATE/.test(sql)), false, 'repetição não duplica notificações nem altera a escolha');
  assert.equal(released, true);
});
