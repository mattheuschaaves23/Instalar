const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET ||= 'password-recovery-exposure-test-secret-32-chars';

// O controller guarda as funções de e-mail ao ser carregado: substitui antes.
const emailService = require('../services/email');
const sentResetEmails = [];
emailService.isEmailEnabled = () => true;
emailService.sendPasswordResetEmail = async (message) => {
  sentResetEmails.push(message);
  return { sent: true };
};

const pool = require('../config/database');
const authController = require('../controllers/authController');

const GENERIC = {
  success: true,
  message: 'Se o e-mail existir, você receberá instruções para redefinir a senha.',
};

function responseRecorder() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function withEnv(t, values) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

// Simula a tabela users e a transação do token. A consulta só "enxerga" conta
// excluída se não filtrar deleted_at, como o PostgreSQL faria.
function mockDatabase(t, users) {
  const insertedTokens = [];
  t.mock.method(pool, 'query', async (sql, params = []) => {
    const text = String(sql);
    if (/INSERT INTO audit_logs/.test(text)) return { rows: [], rowCount: 0 };
    if (/FROM users/.test(text)) {
      const filtersDeleted = /deleted_at IS NULL/.test(text);
      const rows = users.filter((user) => user.email === String(params[0]).toLowerCase()
        && user.account_type === params[1]
        && (!filtersDeleted || !user.deleted_at));
      return { rows: rows.slice(0, 1).map(({ id, email }) => ({ id, email })), rowCount: rows.length ? 1 : 0 };
    }
    throw new Error(`consulta inesperada no teste: ${text.slice(0, 80)}`);
  });
  t.mock.method(pool, 'connect', async () => ({
    async query(sql, params = []) {
      if (/INSERT INTO password_reset_tokens/.test(String(sql))) insertedTokens.push(params);
      return { rows: [], rowCount: 0 };
    },
    release() {},
  }));
  return insertedTokens;
}

async function requestReset(email) {
  const res = responseRecorder();
  await authController.forgotPassword({
    body: { email, account_type: 'installer' },
    headers: {},
    ip: '127.0.0.1',
    protocol: 'https',
    get(name) { return name === 'host' ? 'instalar-sigma.vercel.app' : ''; },
  }, res);
  return res;
}

const activeUser = { id: 10, email: 'ativo@example.test', account_type: 'installer', deleted_at: null };
const deletedUser = { id: 11, email: 'excluido@example.test', account_type: 'installer', deleted_at: new Date('2026-11-01T00:00:00Z') };

const environmentsThatMustNotExpose = [
  { label: 'produção', env: { NODE_ENV: 'production' } },
  { label: 'NODE_ENV vazio', env: { NODE_ENV: undefined } },
  { label: 'desenvolvimento', env: { NODE_ENV: 'development' } },
  { label: 'NODE_ENV=test sem a flag de teste', env: { NODE_ENV: 'test' } },
  { label: 'flag de teste com NODE_ENV=production', env: { NODE_ENV: 'production', EXPOSE_PASSWORD_RESET_TOKEN_FOR_TESTS: 'true' } },
  { label: 'flag de teste dentro da Vercel', env: { NODE_ENV: 'test', EXPOSE_PASSWORD_RESET_TOKEN_FOR_TESTS: 'true', VERCEL: '1' } },
  { label: 'flag de teste dentro do Render', env: { NODE_ENV: 'test', EXPOSE_PASSWORD_RESET_TOKEN_FOR_TESTS: 'true', RENDER: 'true' } },
];

for (const { label, env } of environmentsThatMustNotExpose) {
  test(`recuperação de senha não devolve o token na resposta (${label})`, async (t) => {
    withEnv(t, {
      NODE_ENV: undefined,
      EXPOSE_PASSWORD_RESET_TOKEN_FOR_TESTS: undefined,
      VERCEL: undefined,
      RENDER: undefined,
      FRONTEND_URL: 'https://instalar-sigma.vercel.app',
      ...env,
    });
    const inserted = mockDatabase(t, [activeUser]);

    const known = await requestReset(activeUser.email);
    const unknown = await requestReset('ninguem@example.test');

    assert.equal(known.statusCode, 200);
    assert.equal(inserted.length, 1, 'o token deve ser criado para a conta ativa');
    assert.deepEqual(known.body, GENERIC, 'resposta sem token, link ou detalhe de envio');
    assert.deepEqual(unknown.body, known.body, 'conta existente e inexistente respondem igual');
  });
}

test('recuperação de senha só devolve o token com NODE_ENV=test e a flag explícita de teste', async (t) => {
  withEnv(t, {
    NODE_ENV: 'test',
    EXPOSE_PASSWORD_RESET_TOKEN_FOR_TESTS: 'true',
    VERCEL: undefined,
    RENDER: undefined,
  });
  mockDatabase(t, [activeUser]);
  const res = await requestReset(activeUser.email);
  assert.equal(res.statusCode, 200);
  assert.match(res.body.reset_token, /^[0-9a-f]{64}$/);
});

test('recuperação de senha não acha conta excluída', async (t) => {
  withEnv(t, { NODE_ENV: 'production', VERCEL: undefined, RENDER: undefined, FRONTEND_URL: 'https://instalar-sigma.vercel.app' });
  const inserted = mockDatabase(t, [deletedUser]);
  sentResetEmails.length = 0;

  const res = await requestReset(deletedUser.email);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, GENERIC);
  assert.equal(inserted.length, 0, 'nenhum token para conta excluída');
  assert.equal(sentResetEmails.length, 0, 'nenhum e-mail para conta excluída');
});
