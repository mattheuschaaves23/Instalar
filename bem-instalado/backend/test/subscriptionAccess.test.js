const test = require('node:test');
const assert = require('node:assert/strict');

const { isLaunchAccessEnabled } = require('../utils/subscriptionAccess');

test('acesso de lançamento fica ativo por padrão fora de testes', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousLaunchAccess = process.env.SUBSCRIPTION_LAUNCH_ACCESS;

  process.env.NODE_ENV = 'production';
  delete process.env.SUBSCRIPTION_LAUNCH_ACCESS;
  assert.equal(isLaunchAccessEnabled(), true);

  process.env.SUBSCRIPTION_LAUNCH_ACCESS = 'false';
  assert.equal(isLaunchAccessEnabled(), false);

  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousLaunchAccess === undefined) delete process.env.SUBSCRIPTION_LAUNCH_ACCESS;
  else process.env.SUBSCRIPTION_LAUNCH_ACCESS = previousLaunchAccess;
});

test('testes mantêm cobrança bloqueada salvo configuração explícita', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousLaunchAccess = process.env.SUBSCRIPTION_LAUNCH_ACCESS;

  process.env.NODE_ENV = 'test';
  delete process.env.SUBSCRIPTION_LAUNCH_ACCESS;
  assert.equal(isLaunchAccessEnabled(), false);

  process.env.SUBSCRIPTION_LAUNCH_ACCESS = 'true';
  assert.equal(isLaunchAccessEnabled(), true);

  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousLaunchAccess === undefined) delete process.env.SUBSCRIPTION_LAUNCH_ACCESS;
  else process.env.SUBSCRIPTION_LAUNCH_ACCESS = previousLaunchAccess;
});
