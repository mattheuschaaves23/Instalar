// Processo Node em America/Sao_Paulo (como este servidor de desenvolvimento) e banco
// em UTC. Antes, o created_at gravado pelo banco voltava 3 h adiantado (pedido das
// 19:07 aparecia 22:07) e um Date gravado numa coluna TIMESTAMP mudava de instante.
process.env.TZ = 'America/Sao_Paulo';

const test = require('node:test');
const assert = require('node:assert/strict');

test('PostgreSQL isolado: TIMESTAMP sem fuso nao depende do fuso do processo Node', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const target = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Este teste exige PostgreSQL local/isolado.');
  assert.equal(new Date('2026-01-01T00:00:00').getTimezoneOffset(), 180, 'o processo precisa rodar em Sao Paulo');
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DATABASE_SSL = 'false';
  const pool = require('../config/database');
  try {
    const db = await pool.connect();
    try {
      await db.query("SET TIME ZONE 'UTC'");
      await db.query('CREATE TEMP TABLE timestamp_probe (created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, expires_at TIMESTAMP)');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      const inserted = await db.query('INSERT INTO timestamp_probe (expires_at) VALUES ($1) RETURNING created_at, expires_at', [expiresAt]);
      const createdDiffMinutes = Math.abs(inserted.rows[0].created_at.getTime() - Date.now()) / 60000;
      assert.ok(createdDiffMinutes < 1, `created_at do banco volta como o instante real (diferenca ${createdDiffMinutes.toFixed(0)} min)`);
      assert.equal(inserted.rows[0].expires_at.getTime(), expiresAt.getTime(), 'Date gravado volta igual');
      const stillValid = await db.query('SELECT expires_at > NOW() AS valid FROM timestamp_probe');
      assert.equal(stillValid.rows[0].valid, true, 'prazo de 30 min nao nasce vencido');
    } finally {
      db.release();
    }
  } finally {
    await pool.end();
  }
});
