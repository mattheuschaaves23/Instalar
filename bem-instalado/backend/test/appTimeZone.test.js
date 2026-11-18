// Servidor em UTC (como a Vercel) e usuario em America/Sao_Paulo.
process.env.TZ = 'UTC';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { localDateKey, parseLocalDateTime } = require('../utils/appTimeZone');
const { buildAvailableDates } = require('../utils/installerAvailability');

test('processo roda em UTC neste teste', () => {
  assert.equal(new Date('2026-01-01T00:00:00').getTimezoneOffset(), 0);
});

test('horario sem fuso do datetime-local e lido como Sao Paulo', () => {
  assert.equal(parseLocalDateTime('2026-11-19 09:00:00').toISOString(), '2026-11-19T12:00:00.000Z');
  assert.equal(parseLocalDateTime('2026-11-19T09:00').toISOString(), '2026-11-19T12:00:00.000Z');
  assert.equal(parseLocalDateTime('2026-11-19T21:30').toISOString(), '2026-11-20T00:30:00.000Z');
  assert.equal(parseLocalDateTime('2026-11-19').toISOString(), '2026-11-19T03:00:00.000Z');
});

test('horario com fuso explicito e mantido', () => {
  assert.equal(parseLocalDateTime('2026-11-19T12:00:00.000Z').toISOString(), '2026-11-19T12:00:00.000Z');
  assert.equal(parseLocalDateTime('2026-11-19T09:00:00-03:00').toISOString(), '2026-11-19T12:00:00.000Z');
  const instant = new Date('2026-11-19T12:00:00Z');
  assert.equal(parseLocalDateTime(instant).getTime(), instant.getTime());
});

test('horario de verao antigo de Sao Paulo (2018) usa o offset da data', () => {
  assert.equal(parseLocalDateTime('2018-12-10 09:00').toISOString(), '2018-12-10T11:00:00.000Z');
});

test('valores invalidos viram null', () => {
  for (const value of ['', null, undefined, '19/11/2026 09:00', '2026-02-31 09:00', '2026-11-19 24:00', 'amanha']) {
    assert.equal(parseLocalDateTime(value), null, String(value));
  }
});

test('dia de uma instalacao as 22:00 em Sao Paulo continua no mesmo dia', () => {
  assert.equal(localDateKey('2026-11-20T01:00:00.000Z'), '2026-11-19');
});

test('agenda ocupada bloqueia o dia de Sao Paulo, nao o dia em UTC', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-16T13:00:00Z') }); // segunda 10:00 em SP
  // instalacao terca 17/11 as 22:00 em Sao Paulo = quarta 01:00 UTC
  const dates = buildAvailableDates(['mon', 'tue', 'wed', 'thu', 'fri'], ['2026-11-18T01:00:00.000Z'], 3);
  assert.deepEqual(dates.map((value) => value.slice(0, 10)), ['2026-11-16', '2026-11-18', '2026-11-19']);
});

test('depois das 21:00 em Sao Paulo, hoje ainda e hoje', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-17T01:30:00Z') }); // segunda 16/11 22:30 em SP
  assert.equal(localDateKey(new Date()), '2026-11-16');
  assert.equal(buildAvailableDates(['mon'], [], 1)[0].slice(0, 10), '2026-11-16');
});

test('SQL das colunas de horario nao compara com o dia ou a hora em UTC', () => {
  const dir = path.join(__dirname, '..', 'controllers');
  const offenders = [];
  const forbidden = [
    /\bDATE\(date\)/,
    /\bdate::time\b/,
    /\bdate\s*>=\s*CURRENT_DATE/,
    /\bdate\s*>=\s*DATE_TRUNC\('week',\s*CURRENT_DATE\)/,
    /\bslot_date\s*>=\s*CURRENT_DATE/,
  ];
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const pattern of forbidden) if (pattern.test(source)) offenders.push(`${file}: ${pattern}`);
  }
  assert.deepEqual(offenders, []);
});

test('PDF do orcamento mostra a data de Sao Paulo (instalacao as 22:00)', () => {
  const { formatDate } = require('../utils/generatePDF');
  assert.equal(formatDate('2026-11-20T01:00:00.000Z'), '19/11/2026');
});

test('migration converte so as colunas de horario digitado e le o valor atual como Sao Paulo', () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'migrations', '021_wall_clock_timestamptz.sql'), 'utf8');
  for (const pair of ['ALTER TABLE schedules', 'ALTER TABLE budgets', 'ALTER TABLE service_proposals', 'ALTER TABLE service_bookings']) {
    assert.ok(sql.includes(pair), pair);
  }
  assert.match(sql, /data_type = 'timestamp without time zone'/);
  assert.match(sql, /'America\/Sao_Paulo'/);
  assert.match(sql, /tstzrange\(scheduled_start, scheduled_end/);
});
