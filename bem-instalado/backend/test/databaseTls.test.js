const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('PostgreSQL em produção exige certificado válido em vez de ignorá-lo', () => {
  const result = spawnSync(process.execPath, ['-e', "const p=require('./config/database'); console.log(JSON.stringify(p.options.ssl)); p.end();"], {
    cwd: path.resolve(__dirname, '..'), encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: 'postgresql://qa:fake@db.example.test/qa?sslmode=require', DATABASE_SSL: 'true', DATABASE_SSL_CA: 'TEST-CA\\nLINE' },
  });
  assert.equal(result.status, 0, result.stderr);
  const ssl = JSON.parse(result.stdout.trim().split('\n').at(-1));
  assert.equal(ssl.rejectUnauthorized, true);
  assert.equal(ssl.ca, 'TEST-CA\nLINE');
});
