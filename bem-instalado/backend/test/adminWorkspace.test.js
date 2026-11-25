const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/database');
const controller = require('../controllers/adminController');

function response() {
  return {
    code: 200,
    data: null,
    status(code) { this.code = code; return this; },
    json(payload) { this.data = payload; return this; },
  };
}

test('envia filtros de origem, status, ID e paginação na listagem de pedidos', async (t) => {
  const calls = [];
  t.mock.method(pool, 'query', async (sql, binds) => {
    calls.push({ sql, binds });
    return { rows: [{ id: 52, status: 'direct_pending', is_direct: true, total_count: 5 }] };
  });
  const res = response();
  await controller.listServiceRequests({ query: { origin: 'direct', q: '#52', status: 'open', page: '2', limit: '4' } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(calls[1].binds, ['open', '#52', 4, 4, 'direct']);
  assert.match(calls[1].sql, /sr\.id::text = LTRIM/);
  assert.match(calls[1].sql, /direct_installer_id IS NOT NULL/);
  assert.deepEqual(res.data, { requests: [{ id: 52, status: 'open', is_direct: true }], pagination: { page: 2, limit: 4, total: 5, total_pages: 2 } });
});

test('reconhece estorno e mês civil brasileiro na listagem de pagamentos', async (t) => {
  const method = t.mock.method(pool, 'query', async () => ({ rows: [] }));
  const res = response();
  await controller.listPayments({ query: { period: 'month', q: '#1002', status: 'refunded' } }, res);
  assert.equal(res.code, 200);
  const [sql, args] = method.mock.calls[0].arguments;
  assert.deepEqual(args, ['#1002', 'refunded', 20, 0, 'month']);
  assert.match(sql, /America\/Sao_Paulo/);
  assert.match(sql, /p\.id::text = LTRIM/);
});

test('carrega somente os dados da fila de interessados do pedido válido', async (t) => {
  const items = [{ id: 7, status: 'interested', installer_name: 'Instaladora de teste' }];
  const method = t.mock.method(pool, 'query', async () => ({ rows: items }));
  const invalid = response();
  await controller.listServiceRequestInterests({ params: { id: 'não-numérico' } }, invalid);
  assert.equal(invalid.code, 400);
  assert.equal(method.mock.calls.length, 0);
  const valid = response();
  await controller.listServiceRequestInterests({ params: { id: '52' } }, valid);
  assert.equal(valid.code, 200);
  assert.deepEqual(valid.data, { interests: items });
  const [sql, args] = method.mock.calls[0].arguments;
  assert.deepEqual(args, [52]);
  assert.match(sql, /i\.request_id = \$1/);
  assert.doesNotMatch(sql, /email|phone/i);
});
