const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET ||= 'oauth-account-linking-test-secret-with-32-characters';

const pool = require('../config/database');
const authController = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');

const GOOGLE_CLIENT_ID = 'google-client-id-test';
const PRE_EXISTING_PASSWORD = 'SenhaDoCadastroAntigo123';
const VICTIM_EMAIL = 'vitima@example.test';

function responseRecorder() {
  return {
    statusCode: 200,
    cookies: [],
    redirects: [],
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    cookie(...args) { this.cookies.push(args); return this; },
    redirect(value) { this.redirects.push(value); return value; },
  };
}

// Simula a tabela users com uma linha só. Interpreta apenas o que as consultas
// do login Google, do login por senha e do middleware de sessão precisam.
function mockUsersTable(t, row) {
  t.mock.method(pool, 'query', async (sql, params = []) => {
    const text = String(sql);
    if (/INSERT INTO (audit_logs|subscriptions)/.test(text)) return { rows: [], rowCount: 0 };
    if (/^\s*UPDATE users/.test(text)) {
      if (/email_verified_at IS NULL/.test(text.split('WHERE')[1] || '') && row.email_verified_at) {
        return { rows: [], rowCount: 0 };
      }
      const passwordParam = text.match(/\bpassword\s*=\s*\$(\d+)/);
      if (passwordParam) row.password = params[Number(passwordParam[1]) - 1];
      if (/auth_version\s*=\s*auth_version\s*\+\s*1/.test(text)) row.auth_version += 1;
      if (/email_verified_at\s*=\s*COALESCE\(\s*email_verified_at\s*,\s*NOW\(\)\s*\)/.test(text.split('WHERE')[0])) {
        row.email_verified_at = row.email_verified_at || new Date();
      }
      if (/auth_provider\s*=\s*\$2/.test(text)) {
        row.auth_provider = params[1];
        row.auth_provider_id = params[2];
        row.email_verified_at = row.email_verified_at || new Date();
      }
      return { rows: [{ ...row }], rowCount: 1 };
    }
    if (/FROM users/.test(text)) return { rows: [{ ...row }], rowCount: 1 };
    throw new Error(`consulta inesperada no teste: ${text.slice(0, 80)}`);
  });
}

// Conexão de transação do resetPassword: o token de redefinição existe e é
// válido; o UPDATE users passa pela mesma interpretação da tabela simulada.
function mockResetConnection(t, row, resetTokenHash) {
  t.mock.method(pool, 'connect', async () => ({
    async query(sql, params = []) {
      const text = String(sql);
      if (/^\s*(BEGIN|COMMIT|ROLLBACK)/.test(text)) return { rows: [], rowCount: 0 };
      if (/FROM password_reset_tokens/.test(text)) {
        return params[0] === resetTokenHash
          ? { rows: [{ id: 1, user_id: row.id }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      if (/UPDATE password_reset_tokens/.test(text)) return { rows: [], rowCount: 1 };
      if (/^\s*UPDATE users/.test(text)) return pool.query(sql, params);
      throw new Error(`consulta inesperada na transação: ${text.slice(0, 80)}`);
    },
    release() {},
  }));
}

function mockGoogle(t) {
  t.mock.method(global, 'fetch', async (url) => {
    if (String(url) === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({ id_token: 'id-token-de-teste' }), { status: 200 });
    }
    if (String(url).startsWith('https://oauth2.googleapis.com/tokeninfo')) {
      return new Response(JSON.stringify({
        aud: GOOGLE_CLIENT_ID,
        sub: 'google-subject-da-vitima',
        email: VICTIM_EMAIL,
        email_verified: 'true',
        name: 'Vitima',
      }), { status: 200 });
    }
    throw new Error(`fetch inesperado no teste: ${url}`);
  });
}

function withGoogleEnv(t) {
  const previous = {
    FRONTEND_URL: process.env.FRONTEND_URL,
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  };
  process.env.FRONTEND_URL = 'https://instalar-sigma.vercel.app';
  process.env.GOOGLE_OAUTH_CLIENT_ID = GOOGLE_CLIENT_ID;
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'google-client-secret-test';
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

const requestBase = {
  protocol: 'https',
  headers: {},
  ip: '127.0.0.1',
  get(name) { return name === 'host' ? 'instalar-sigma.vercel.app' : ''; },
};

async function signInWithGoogle() {
  const start = responseRecorder();
  await authController.startOAuth({
    ...requestBase,
    params: { provider: 'google' },
    query: { role: 'installer', next: '/dashboard', platform: 'android' },
  }, start);
  const state = new URL(start.redirects.at(-1)).searchParams.get('state');
  assert.ok(state, 'startOAuth deveria gerar o state');

  const callback = responseRecorder();
  await authController.handleOAuthCallback({
    ...requestBase,
    body: {},
    params: { provider: 'google' },
    query: { state, code: 'codigo-de-teste' },
  }, callback);
  const redirect = new URL(callback.redirects.at(-1));
  const hash = new URLSearchParams(redirect.hash.slice(1));
  assert.equal(hash.get('oauth_error'), null, `login Google falhou: ${hash.get('oauth_error')}`);
  return hash.get('token');
}

async function loginWithPassword(password) {
  const res = responseRecorder();
  await authController.login({
    ...requestBase,
    body: { email: VICTIM_EMAIL, password, account_type: 'installer', platform: 'android' },
  }, res);
  return res;
}

async function sessionStatus(token) {
  const res = responseRecorder();
  let nextCalled = false;
  await auth({ headers: { authorization: `Bearer ${token}` } }, res, () => { nextCalled = true; });
  return nextCalled ? 200 : res.statusCode;
}

function baseUser(overrides) {
  return {
    id: 77,
    account_type: 'installer',
    name: 'Cadastro por senha',
    email: VICTIM_EMAIL,
    password: bcrypt.hashSync(PRE_EXISTING_PASSWORD, 4),
    auth_version: 0,
    auth_provider: null,
    auth_provider_id: null,
    is_admin: false,
    deleted_at: null,
    ...overrides,
  };
}

test('login Google em conta de senha nunca confirmada derruba a senha e as sessões anteriores', async (t) => {
  withGoogleEnv(t);
  mockGoogle(t);
  const row = baseUser({ email_verified_at: null });
  mockUsersTable(t, row);
  const earlierSession = jwt.sign({ id: row.id, v: row.auth_version }, process.env.JWT_SECRET);

  const googleSession = await signInWithGoogle();

  const oldPasswordLogin = await loginWithPassword(PRE_EXISTING_PASSWORD);
  assert.equal(oldPasswordLogin.statusCode, 401, 'a senha criada antes da confirmação do e-mail não pode continuar valendo');
  assert.equal(await sessionStatus(earlierSession), 401, 'sessões abertas antes do vínculo devem ser revogadas');
  assert.equal(await sessionStatus(googleSession), 200, 'a sessão do dono do e-mail (Google) continua válida');
  assert.ok(row.email_verified_at, 'o e-mail fica confirmado pelo Google');
});

test('login Google em conta com e-mail já confirmado mantém a senha e as sessões', async (t) => {
  withGoogleEnv(t);
  mockGoogle(t);
  const row = baseUser({ email_verified_at: new Date('2026-10-01T12:00:00Z') });
  mockUsersTable(t, row);
  const earlierSession = jwt.sign({ id: row.id, v: row.auth_version }, process.env.JWT_SECRET);

  const googleSession = await signInWithGoogle();

  const passwordLogin = await loginWithPassword(PRE_EXISTING_PASSWORD);
  assert.equal(passwordLogin.statusCode, 200);
  assert.equal(await sessionStatus(earlierSession), 200);
  assert.equal(await sessionStatus(googleSession), 200);
});

test('senha definida pelo "Esqueci a senha" continua valendo depois do login Google', async (t) => {
  // O link de redefinição chegou no e-mail da conta: quem trocou a senha por
  // ele controla o e-mail. Essa senha não pode ser revogada pelo vínculo Google.
  withGoogleEnv(t);
  mockGoogle(t);
  const row = baseUser({ email_verified_at: null });
  mockUsersTable(t, row);
  const resetToken = 'token-de-redefinicao-recebido-no-email-0123456789';
  const resetTokenHash = require('node:crypto').createHash('sha256').update(resetToken).digest('hex');
  mockResetConnection(t, row, resetTokenHash);
  const newPassword = 'SenhaNovaDoDono2026';

  const reset = responseRecorder();
  await authController.resetPassword({ ...requestBase, body: { token: resetToken, password: newPassword } }, reset);
  assert.equal(reset.statusCode, 200, `resetPassword falhou: ${JSON.stringify(reset.body)}`);
  assert.equal((await loginWithPassword(newPassword)).statusCode, 200, 'a senha nova vale logo depois do reset');

  const googleSession = await signInWithGoogle();

  const afterGoogle = await loginWithPassword(newPassword);
  assert.equal(afterGoogle.statusCode, 200, 'a senha que o dono do e-mail definiu continua valendo depois do Google');
  assert.equal(await sessionStatus(googleSession), 200);
});
