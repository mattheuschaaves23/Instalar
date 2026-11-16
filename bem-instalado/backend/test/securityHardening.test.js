const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/database');
const { createRateLimiter } = require('../middleware/rateLimit');
const { diagnosticRoute, redactDiagnostic } = require('../utils/monitoringPrivacy');
const { safeMetadata, logApplicationError } = require('../utils/errorMonitoring');

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(status) { this.statusCode = status; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('limite agrega IDs por rota, mas não mistura limites independentes nem usuários', async (t) => {
  const rows = new Map();
  t.mock.method(pool, 'query', async (sql, [scope, hash, _start, expiresAt] = []) => {
    if (sql.includes('DELETE')) return { rows: [] };
    assert.equal(scope, 'GET:/api/test:/details/:id:' + scope.split(':').at(-1));
    const count = (rows.get(hash) || 0) + 1;
    rows.set(hash, count);
    return { rows: [{ request_count: count, expires_at: expiresAt }] };
  });
  const shared = createRateLimiter({ max: 2 });
  const separate = createRateLimiter({ max: 2, bucket: 'separate' });
  const req = (id, ip = '192.0.2.9') => ({
    method: 'GET', baseUrl: '/api/test', path: `/details/${id}`, route: { path: '/details/:id' }, ip,
  });
  const next = t.mock.fn();
  await shared(req(4), response(), next);
  await shared(req(5), response(), next);
  const blocked = response();
  await shared(req(6), blocked, next);
  assert.equal(blocked.statusCode, 429);
  assert.ok(Number(blocked.headers['Retry-After']) > 0);
  await shared(req(7, '192.0.2.10'), response(), next);
  await separate(req(7), response(), next);
  assert.equal(next.mock.callCount(), 4);
});

test('limite local mantém a mesma regra durante falha do banco', async (t) => {
  t.mock.method(pool, 'query', async () => { throw new Error('banco de teste indisponível'); });
  const limit = createRateLimiter({ max: 1, bucket: 'fallback-test' });
  const req = { method: 'POST', baseUrl: '/api/test', route: { path: '/:id' }, ip: '192.0.2.3' };
  const next = t.mock.fn();
  await limit({ ...req, path: '/1' }, response(), next);
  const blocked = response();
  await limit({ ...req, path: '/2' }, blocked, next);
  assert.equal(blocked.statusCode, 429);
  assert.equal(next.mock.callCount(), 1);
});

test('monitoramento armazena mensagens sanitizadas e somente padrões de rota', async (t) => {
  const req = { method: 'GET', originalUrl: '/public/items/3?acesso=chave-local', baseUrl: '/public', route: { path: '/items/:id' } };
  assert.equal(diagnosticRoute(req), '/public/items/:id');
  assert.equal(diagnosticRoute({ originalUrl: req.originalUrl }), '');
  const message = 'Falha: https://example.test/?token=chave-local e-mail qa@example.test telefone (48) 99999-9999 senha=exemplo';
  const sanitized = redactDiagnostic(message);
  for (const secret of ['chave-local', 'qa@example.test', '99999-9999', 'senha=exemplo']) {
    assert.ok(!sanitized.includes(secret));
  }
  assert.deepEqual(safeMetadata({ password: 'exemplo', title: 'token=chave-local', count: 3 }),
    { title: 'token=[removido]', count: 3 });
  const query = t.mock.method(pool, 'query', async () => ({ rows: [] }));
  await logApplicationError({ message, req, notifyExternally: false, metadata: { title: 'token=chave-local' } });
  const params = query.mock.calls[0].arguments[1];
  assert.equal(params[2], sanitized);
  assert.equal(params[3], '/public/items/:id');
  assert.ok(!JSON.stringify(params).includes('chave-local'));
});
