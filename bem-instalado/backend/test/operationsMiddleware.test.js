const test = require('node:test');
const assert = require('node:assert/strict');

const { hasOperationsAccess } = require('../middleware/operationsMiddleware');

function requestWithToken(token) {
  return {
    get(name) {
      return name.toLowerCase() === 'authorization' ? `Bearer ${token}` : '';
    },
  };
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

test('accepts the dedicated cron secret', () => {
  const previousOperationsToken = process.env.OPERATIONS_TOKEN;
  const previousCronSecret = process.env.CRON_SECRET;
  process.env.OPERATIONS_TOKEN = 'legacy-operational-token-123456789';
  process.env.CRON_SECRET = 'scheduled-workflow-secret-123456789';

  assert.equal(hasOperationsAccess(requestWithToken(process.env.CRON_SECRET)), true);

  restoreEnv('OPERATIONS_TOKEN', previousOperationsToken);
  restoreEnv('CRON_SECRET', previousCronSecret);
});

test('rejects an unknown operational token', () => {
  const previousOperationsToken = process.env.OPERATIONS_TOKEN;
  const previousCronSecret = process.env.CRON_SECRET;
  process.env.OPERATIONS_TOKEN = 'legacy-operational-token-123456789';
  process.env.CRON_SECRET = 'scheduled-workflow-secret-123456789';

  assert.equal(hasOperationsAccess(requestWithToken('wrong-token')), false);

  restoreEnv('OPERATIONS_TOKEN', previousOperationsToken);
  restoreEnv('CRON_SECRET', previousCronSecret);
});

test('accepts the translated operations token alias used by the first Vercel setup', () => {
  const previousOperationsToken = process.env.OPERATIONS_TOKEN;
  const previousCronSecret = process.env.CRON_SECRET;
  const previousAlias = process.env['TOKEN_DE_OPERAÇÕES'];
  delete process.env.OPERATIONS_TOKEN;
  delete process.env.CRON_SECRET;
  process.env['TOKEN_DE_OPERAÇÕES'] = 'translated-operational-token-123456789';

  assert.equal(hasOperationsAccess(requestWithToken(process.env['TOKEN_DE_OPERAÇÕES'])), true);

  restoreEnv('OPERATIONS_TOKEN', previousOperationsToken);
  restoreEnv('CRON_SECRET', previousCronSecret);
  restoreEnv('TOKEN_DE_OPERAÇÕES', previousAlias);
});
