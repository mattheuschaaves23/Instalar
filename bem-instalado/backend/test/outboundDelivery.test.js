const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/database');
const { processEmailDeliveries } = require('../services/outboundDelivery');
const { sendEmailMessage } = require('../services/email');

function fakeSmtp(t, transporter) {
  for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD']) {
    const previous = process.env[key];
    process.env[key] = 'local-test-only';
    t.after(() => previous === undefined ? delete process.env[key] : process.env[key] = previous);
  }
  t.mock.method(require('nodemailer'), 'createTransport', () => transporter);
}

test('SMTP tem prazo total e fecha o transporte quando expira', async (t) => {
  let closed = 0;
  fakeSmtp(t, { sendMail: () => new Promise(() => {}), close: () => { closed += 1; } });
  await assert.rejects(sendEmailMessage({ to: 'qa@example.test', subject: 'QA', timeoutMs: 20 }), { code: 'SMTP_DELIVERY_TIMEOUT' });
  assert.ok(closed > 0);
});

test('fila reserva uma mensagem por vez e deixa o restante intacto ao acabar o prazo', async (t) => {
  let now = 0;
  let claims = 0;
  const waiting = [1, 2, 3];
  const sent = [];
  t.mock.method(Date, 'now', () => now);
  fakeSmtp(t, { async sendMail() { now += 2500; }, close() {} });
  const client = { async query(sql, params) {
    if (sql.includes('WITH candidate')) {
      assert.equal(params[0], 1);
      claims += 1;
      const id = waiting.shift();
      return { rows: id ? [{ id, recipient: 'qa@example.test', payload: { subject: 'QA' }, attempts: 1, max_attempts: 5 }] : [] };
    }
    return { rows: [] };
  }, release() {} };
  t.mock.method(pool, 'connect', async () => client);
  t.mock.method(pool, 'query', async (_sql, params) => { sent.push(params[0]); return { rows: [] }; });
  assert.deepEqual(await processEmailDeliveries({ limit: 20, timeBudgetMs: 2000 }), { claimed: 1, sent: 1, failed: 0 });
  assert.equal(claims, 1);
  assert.deepEqual(waiting, [2, 3]);
  assert.deepEqual(sent, [1]);
});
