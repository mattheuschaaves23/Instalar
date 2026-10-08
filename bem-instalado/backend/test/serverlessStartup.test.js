const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('inicia a função e carrega validação/PDF sem require de ES modules', () => {
  const output = execFileSync(process.execPath, [
    '--no-experimental-require-module',
    path.join(__dirname, 'fixtures/serverlessStartup.cjs'),
  ], {
    env: { ...process.env, NODE_ENV: 'test', VERCEL: '1', JWT_SECRET: 'qa-serverless-startup-with-thirty-two-characters' },
    encoding: 'utf8', timeout: 15000,
  });
  assert.match(output, /serverless-startup-ok/);
});
