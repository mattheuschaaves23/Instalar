const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET ||= 'password-only-auth-test-secret-with-32-characters';

const pool = require('../config/database');
const controller = require('../controllers/authController');
const admin = require('../middleware/adminMiddleware');

const password = 'SenhaSomenteParaTeste123!';
const passwordHash = bcrypt.hashSync(password, 4);

function responseRecorder() {
  return {
    statusCode: 200,
    cookies: [],
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    cookie(...args) { this.cookies.push(args); return this; },
  };
}

for (const accountType of ['client', 'installer']) {
  test(`login de ${accountType} não exige código mesmo com proteção legada no banco`, async (t) => {
    const user = {
      id: 42, account_type: accountType, email: 'conta@example.test',
      password: passwordHash, auth_version: 3, is_admin: false,
      two_factor_enabled: true, two_factor_secret: 'segredo-legado-inativo',
    };
    t.mock.method(pool, 'query', async (sql) => {
      if (sql.includes('SELECT * FROM users')) return { rows: [user] };
      assert.match(sql, /INSERT INTO audit_logs/);
      return { rows: [] };
    });
    const res = responseRecorder();
    await controller.login({
      body: { email: user.email, password, account_type: accountType },
      headers: {}, ip: '127.0.0.1',
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.user.id, user.id);
    assert.equal(Object.hasOwn(res.body, 'twoFactorRequired'), false);
    assert.equal(Object.hasOwn(res.body.user, 'two_factor_enabled'), false);
    assert.equal(Object.hasOwn(res.body.user, 'two_factor_secret'), false);
    assert.equal(res.cookies[0][0], 'instalapro_session');
    assert.equal(res.cookies[0][2].httpOnly, true);
    const session = jwt.verify(res.cookies[0][1], process.env.JWT_SECRET);
    assert.equal(session.id, user.id);
    assert.equal(session.v, user.auth_version);
  });
}

test('continua recusando senha incorreta sem criar uma sessão', async (t) => {
  t.mock.method(pool, 'query', async (sql) => ({
    rows: sql.includes('SELECT * FROM users')
      ? [{ id: 42, email: 'conta@example.test', password: passwordHash, two_factor_enabled: true }]
      : [],
  }));
  const res = responseRecorder();
  await controller.login({
    body: { email: 'conta@example.test', password: 'SenhaErrada', account_type: 'installer' },
    headers: {}, ip: '127.0.0.1',
  }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Credenciais inválidas.');
  assert.equal(res.cookies.length, 0);
});

test('administrador autenticado acessa o painel sem configuração em duas etapas', async (t) => {
  t.mock.method(pool, 'query', async () => ({ rows: [{ id: 42, is_admin: true, two_factor_enabled: false }] }));
  const res = responseRecorder();
  let nextCalled = false;
  await admin({ userId: 42 }, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(res.body, undefined);
});

test('usuário comum continua sem acesso ao painel administrativo', async (t) => {
  t.mock.method(pool, 'query', async () => ({ rows: [{ id: 42, is_admin: false }] }));
  const res = responseRecorder();
  let nextCalled = false;
  await admin({ userId: 42 }, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test('usuário inexistente continua sem acesso ao painel administrativo', async (t) => {
  t.mock.method(pool, 'query', async () => ({ rows: [] }));
  const res = responseRecorder();
  await admin({ userId: 42 }, res, () => assert.fail('Não deveria autorizar o acesso.'));
  assert.equal(res.statusCode, 401);
});

test('endpoints de configuração em duas etapas não são mais registrados', () => {
  const routes = require('../routes/authRoutes');
  const registeredPaths = routes.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
  assert.equal(registeredPaths.some((path) => path.startsWith('/2fa/')), false);
  assert.ok(registeredPaths.includes('/login'));
  assert.ok(registeredPaths.includes('/reset-password'));
  assert.ok(registeredPaths.includes('/verify-email'));
});
