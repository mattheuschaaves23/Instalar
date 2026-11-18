// Servidor em UTC (como a Vercel) e usuario em America/Sao_Paulo.
// O app manda o horario digitado sem fuso ("2026-11-19 09:00:00" na aprovacao do
// orcamento, "2026-11-19T09:00" na proposta do marketplace). Antes, esse valor era
// gravado como TIMESTAMP sem fuso e lido pelo Node em UTC: a agenda mostrava 06:00
// para uma instalacao marcada para 09:00.
process.env.TZ = 'UTC';

const test = require('node:test');
const assert = require('node:assert/strict');

const SAO_PAULO = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const inSaoPaulo = (value) => SAO_PAULO.format(new Date(value));
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } });

test('PostgreSQL isolado: horario digitado em Sao Paulo volta igual com o servidor em UTC', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const target = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Este teste de escrita exige PostgreSQL local/isolado.');
  assert.equal(new Date('2026-01-01T00:00:00').getTimezoneOffset(), 0, 'o processo precisa rodar em UTC');
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DATABASE_SSL = 'false';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET ||= 'integration-test-secret-with-at-least-32-characters';
  const pool = require('../config/database');
  const { ensureRuntimeSchema } = require('../server');
  const budgetController = require('../controllers/budgetController');
  const scheduleController = require('../controllers/scheduleController');
  const marketplace = require('../controllers/marketplaceFlowController');
  await ensureRuntimeSchema();

  let userId;
  try {
    const user = await pool.query("INSERT INTO users (name, email, password) VALUES ('Instalador fuso ficticio', $1, 'not-a-login-password') RETURNING id", [`fuso-qa-${Date.now()}@example.test`]);
    userId = user.rows[0].id;
    const client = await pool.query("INSERT INTO clients (user_id, name, phone) VALUES ($1, 'Cliente fuso ficticio', '48999990000') RETURNING id", [userId]);
    const budgetId = (await pool.query('INSERT INTO budgets (user_id, client_id, total_amount) VALUES ($1, $2, 200) RETURNING id', [userId, client.rows[0].id])).rows[0].id;

    // Igual ao Budgets.jsx: datetime-local "2030-01-10T09:00" vira "2030-01-10 09:00:00".
    const approval = response();
    await budgetController.approveBudget({ userId, params: { id: budgetId }, body: { schedule_date: '2030-01-10 09:00:00' } }, approval);
    assert.equal(approval.statusCode, 200, JSON.stringify(approval.body));
    assert.equal(inSaoPaulo(approval.body.budget.schedule_date), '10/01/2030, 09:00');
    assert.equal(inSaoPaulo(approval.body.schedule.date), '10/01/2030, 09:00');

    // Repetir a mesma aprovacao continua idempotente (compara o mesmo instante).
    const repeated = response();
    await budgetController.approveBudget({ userId, params: { id: budgetId }, body: { schedule_date: '2030-01-10 09:00:00' } }, repeated);
    assert.equal(repeated.statusCode, 200, JSON.stringify(repeated.body));

    const agenda = response();
    await scheduleController.getSchedules({ userId, query: {} }, agenda);
    assert.equal(agenda.statusCode, 200, JSON.stringify(agenda.body));
    const installation = (Array.isArray(agenda.body) ? agenda.body : agenda.body.schedules || []).find((item) => Number(item.budget_id) === Number(budgetId));
    assert.ok(installation, JSON.stringify(agenda.body));
    assert.equal(inSaoPaulo(installation.date), '10/01/2030, 09:00', 'a agenda mostra o horario digitado');

    // Horario vago das 08:30 as 10:00 no mesmo dia bate com a instalacao das 09:00 (Sao Paulo).
    const userController = require('../controllers/userController');
    const slot = response();
    await userController.createAvailabilitySlot({ userId, body: { slot_date: '2030-01-10', start_time: '08:30', end_time: '10:00' } }, slot);
    assert.equal(slot.statusCode, 409, JSON.stringify(slot.body));
    assert.match(slot.body.error, /ocupado por um agendamento/);

    // Instalacao as 22:00 em Sao Paulo (01:00 do dia seguinte em UTC) ocupa o horario
    // vago das 21:30 as 23:00 do mesmo dia de Sao Paulo.
    const lateBudgetId = (await pool.query('INSERT INTO budgets (user_id, client_id, total_amount) VALUES ($1, $2, 200) RETURNING id', [userId, client.rows[0].id])).rows[0].id;
    const lateApproval = response();
    await budgetController.approveBudget({ userId, params: { id: lateBudgetId }, body: { schedule_date: '2030-01-12 22:00:00' } }, lateApproval);
    assert.equal(lateApproval.statusCode, 200, JSON.stringify(lateApproval.body));
    assert.equal(inSaoPaulo(lateApproval.body.schedule.date), '12/01/2030, 22:00');
    const lateSlot = response();
    await userController.createAvailabilitySlot({ userId, body: { slot_date: '2030-01-12', start_time: '21:30', end_time: '23:00' } }, lateSlot);
    assert.equal(lateSlot.statusCode, 409, JSON.stringify(lateSlot.body));

    // Proposta do marketplace: MarketplaceProposal.jsx manda o valor do datetime-local.
    const request = await pool.query(
      `INSERT INTO service_requests (client_name, client_phone, service, status, selected_installer_id, selected_at)
       VALUES ('Cliente fuso ficticio', '48999990001', 'wallpaper', 'selected', $1, NOW()) RETURNING id`,
      [userId]
    );
    const proposal = response();
    await marketplace.sendProposal({
      userId,
      params: { id: request.rows[0].id },
      body: { amount: 350, scope: 'Instalacao ficticia', scheduled_start: '2030-01-11T09:00', scheduled_end: '2030-01-11T11:00' },
      headers: {},
      get: () => '',
    }, proposal);
    assert.equal(proposal.statusCode, 201, JSON.stringify(proposal.body));
    assert.equal(inSaoPaulo(proposal.body.proposal.scheduled_start), '11/01/2030, 09:00');
    assert.equal(inSaoPaulo(proposal.body.proposal.scheduled_end), '11/01/2030, 11:00');

    // Hoje em Sao Paulo, 20:00 ainda e futuro mesmo quando em UTC ja passou das 23:00.
    const stored = await pool.query('SELECT scheduled_start FROM service_proposals WHERE service_request_id = $1', [request.rows[0].id]);
    assert.equal(new Date(stored.rows[0].scheduled_start).toISOString(), '2030-01-11T12:00:00.000Z');
  } finally {
    if (userId) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.end();
  }
});
