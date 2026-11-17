const test = require('node:test');
const assert = require('node:assert/strict');
const { isTurnstileEnabled, requireTurnstile } = require('../middleware/turnstileMiddleware');

function createResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test('Turnstile não bloqueia ambientes sem chave configurada', async () => {
  const previousSecret = process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  let nextCalled = false;

  await requireTurnstile({ body: {}, headers: {} }, createResponse(), () => { nextCalled = true; });

  assert.equal(isTurnstileEnabled(), false);
  assert.equal(nextCalled, true);

  if (previousSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = previousSecret;
});

test('Turnstile bloqueia formulário protegido sem token', async () => {
  const previousSecret = process.env.TURNSTILE_SECRET_KEY;
  process.env.TURNSTILE_SECRET_KEY = 'turnstile-secret-test';
  const response = createResponse();

  await requireTurnstile({ body: {}, headers: {} }, response, () => assert.fail('next não deve ser chamado'));

  assert.equal(isTurnstileEnabled(), true);
  assert.equal(response.statusCode, 403);
  assert.equal(response.payload.code, 'TURNSTILE_REQUIRED');

  if (previousSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = previousSecret;
});

test('Turnstile libera token confirmado pelo provedor', async () => {
  const previousSecret = process.env.TURNSTILE_SECRET_KEY;
  const previousFetch = global.fetch;
  process.env.TURNSTILE_SECRET_KEY = 'turnstile-secret-test';
  global.fetch = async () => new Response(JSON.stringify({ success: true }), { status: 200 });
  let nextCalled = false;

  await requireTurnstile(
    { body: { turnstile_token: 'token-test' }, ip: '203.0.113.10', headers: { 'x-forwarded-for': '192.0.2.25' } },
    createResponse(),
    () => { nextCalled = true; }
  );

  assert.equal(nextCalled, true);
  global.fetch = previousFetch;
  if (previousSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = previousSecret;
});

test('Turnstile reconhece o alias traduzido da chave secreta', () => {
  const previousSecret = process.env.TURNSTILE_SECRET_KEY;
  const previousAlias = process.env['CHAVE SECRETA DA CATRACA'];
  delete process.env.TURNSTILE_SECRET_KEY;
  process.env['CHAVE SECRETA DA CATRACA'] = 'turnstile-secret-alias-test';

  assert.equal(isTurnstileEnabled(), true);

  if (previousSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = previousSecret;
  if (previousAlias === undefined) delete process.env['CHAVE SECRETA DA CATRACA'];
  else process.env['CHAVE SECRETA DA CATRACA'] = previousAlias;
});

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

test('Turnstile sem chave em produção recusa o formulário com erro claro', async (t) => {
  withEnv(t, {
    NODE_ENV: 'production',
    TURNSTILE_SECRET_KEY: undefined,
    'CHAVE SECRETA DA CATRACA': undefined,
  });
  t.mock.method(console, 'error', () => {});
  const response = createResponse();

  await requireTurnstile(
    { body: { turnstile_token: 'qualquer' }, headers: {} },
    response,
    () => assert.fail('sem chave em produção o formulário não pode passar')
  );

  assert.equal(response.statusCode, 503);
  assert.equal(response.payload.code, 'TURNSTILE_NOT_CONFIGURED');
  assert.match(response.payload.error, /verificação de segurança/i);
});

for (const nodeEnv of ['development', 'test', undefined]) {
  test(`Turnstile sem chave continua liberado fora de produção (NODE_ENV=${nodeEnv ?? 'vazio'})`, async (t) => {
    withEnv(t, {
      NODE_ENV: nodeEnv,
      TURNSTILE_SECRET_KEY: undefined,
      'CHAVE SECRETA DA CATRACA': undefined,
    });
    let nextCalled = false;
    await requireTurnstile({ body: {}, headers: {} }, createResponse(), () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });
}
