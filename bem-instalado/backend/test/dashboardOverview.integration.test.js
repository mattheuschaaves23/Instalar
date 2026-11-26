const test = require('node:test');
const assert = require('node:assert/strict');
const { getDashboardOverview } = require('../services/dashboardOverview');

test('resumo de conta: propostas por criação, receita por aprovação e agenda em horário de Brasília', {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const target = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Use um banco de teste local.');
  const { Client } = require('pg');
  const db = new Client({ connectionString: target.href });
  await db.connect();
  try {
    await db.query(`
      CREATE TEMP TABLE budgets (
        user_id int, status text, total_amount numeric, created_at timestamp, approved_date timestamp
      );
      CREATE TEMP TABLE clients (id int, user_id int, name text);
      CREATE TEMP TABLE schedules (id int, user_id int, client_id int, date timestamptz, status text);
      CREATE TEMP TABLE service_requests (id int, client_name text);
      CREATE TEMP TABLE service_bookings (id int, installer_id int, service_request_id int, scheduled_start timestamptz, status text);
      INSERT INTO budgets VALUES
        (1, 'approved', 125.50, '2026-10-30 22:00', '2026-11-01 02:59'),
        (1, 'approved', 450.75, '2026-10-31 22:00', '2026-11-01 03:00'),
        (1, 'approved', 30, '2026-11-15 22:00', NULL),
        (1, 'pending', 200, '2026-11-02 22:00', NULL),
        (1, 'rejected', 900, '2026-11-03 22:00', NULL),
        (1, 'draft', 999, '2026-11-03 22:00', NULL),
        (2, 'approved', 7000, '2026-11-04 22:00', '2026-11-05 22:00');
      INSERT INTO clients VALUES (1, 1, 'Cliente manual'), (2, 2, 'De outra conta');
      INSERT INTO service_requests VALUES (1, 'Cliente site');
      INSERT INTO schedules VALUES
        (1, 1, 1, '2026-11-24 14:00Z', 'completed'),
        (2, 1, 1, '2026-11-26 14:00Z', 'scheduled'),
        (3, 1, 1, '2026-11-26 13:00Z', 'canceled'),
        (4, 2, 2, '2026-11-26 12:30Z', 'scheduled');
      INSERT INTO service_bookings VALUES
        (1, 1, 1, '2026-11-26 13:30Z', 'scheduled'),
        (2, 1, 1, '2026-12-02 15:00Z', 'scheduled');
    `);
    const data = await getDashboardOverview(db, 1, new Date('2026-11-26T12:00:00Z'));
    assert.equal(data.month, '2026-11');
    assert.deepEqual(data.months.slice(-2), [
      { month: '2026-10', revenue: 125.5, approved: 2, pending: 0, rejected: 0, installations: 0 },
      { month: '2026-11', revenue: 480.75, approved: 1, pending: 1, rejected: 1, installations: 3 },
    ]);
    assert.deepEqual(data.upcoming.map(({ id, client_name }) => [id, client_name]), [
      ['marketplace-1', 'Cliente site'], ['manual-2', 'Cliente manual'],
    ]);
    const empty = await getDashboardOverview(db, 99, new Date('2026-11-01T02:59:00Z'));
    assert.equal(empty.month, '2026-10');
    assert.deepEqual(empty.upcoming, []);
    assert.deepEqual(empty.months.at(-1), { month: '2026-10', revenue: 0, approved: 0, pending: 0, rejected: 0, installations: 0 });
  } finally {
    await db.end();
  }
});
