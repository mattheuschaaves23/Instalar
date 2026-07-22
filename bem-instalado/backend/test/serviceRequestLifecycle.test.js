const test = require('node:test');
const assert = require('node:assert/strict');

const { expireOpenServiceRequests } = require('../utils/serviceRequestLifecycle');

test('encerra somente pedidos abertos que já venceram', async () => {
  let executedSql = '';
  const db = {
    async query(sql) {
      executedSql = sql;
      return { rowCount: 2 };
    },
  };

  const expiredCount = await expireOpenServiceRequests(db);

  assert.equal(expiredCount, 2);
  assert.match(executedSql, /status = 'open'/);
  assert.match(executedSql, /expires_at <= NOW\(\)/);
  assert.match(executedSql, /SET status = 'expired'/);
});
