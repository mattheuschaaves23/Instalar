const test = require('node:test');
const assert = require('node:assert/strict');
const { getOpportunityListing } = require('../services/opportunityListing');

test('PostgreSQL isolado: abas, histórico, filtros, contadores e paginação das oportunidades', { skip: !process.env.TEST_DATABASE_URL }, async (t) => {
  const target = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Teste de escrita permitido somente em PostgreSQL local isolado.');
  const { Client } = require('pg');
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL, ssl: false });
  await db.connect();
  try {
    await db.query('BEGIN');
    // Temporary tables shadow production names only inside this connection.
    await db.query(`CREATE TEMP TABLE service_requests (
      id integer PRIMARY KEY, service_label text, rooms text[], city text, state text,
      neighborhood text, latitude numeric, longitude numeric, place_type text,
      photo_urls jsonb DEFAULT '[]', selected_installer_id integer, selected_at timestamp, direct_installer_id integer,
      status text, expires_at timestamp, created_at timestamp DEFAULT NOW()
    ) ON COMMIT DROP;
    CREATE TEMP TABLE service_request_interests (
      id serial PRIMARY KEY, request_id integer, installer_id integer, status text,
      created_at timestamp DEFAULT NOW()
    ) ON COMMIT DROP;`);
    const rows = [
      [101, 'Palhoça', 'SC', -27.6453, -48.6679, 'open', null, 15],
      [102, 'São José', 'SC', -27.60, -48.62, 'open', null, 15],
      [103, 'Rio de Janeiro', 'RJ', -22.9, -43.2, 'open', null, 15],
      [104, 'Rio de Janeiro', 'RJ', -22.9, -43.2, 'expired', null, -1],
      [105, 'São Paulo', 'SP', -23.5, -46.6, 'selected', 1, 15],
      [106, 'São Paulo', 'SP', -23.5, -46.6, 'completed', 1, 15],
      [107, 'Palhoça', 'SC', -27.6453, -48.6679, 'selected', 2, 15],
      [108, 'Palhoça', 'SC', -27.6453, -48.6679, 'canceled', null, 15],
      [109, 'Palhoça', 'SC', -27.6453, -48.6679, 'open', null, 15],
      [110, 'São Paulo', 'SP', -23.5, -46.6, 'selected', 2, 15],
      [111, 'Chapecó', 'SC', -27.1, -52.6, 'open', null, 15],
      [112, 'Palhoça', 'SC', -27.6453, -48.6679, 'open', null, -1],
    ];
    for (const [id, city, state, lat, lon, status, chosen, days] of rows) await db.query(`INSERT INTO service_requests
      (id, service_label, rooms, neighborhood, city, state, latitude, longitude, status, selected_installer_id, expires_at, place_type)
      VALUES ($1, 'Papel vinílico', ARRAY['Sala'], 'Centro', $2, $3, $4, $5, $6, $7, NOW() + ($8::integer * INTERVAL '1 day'), $9)`,
    [id, city, state, lat, lon, status, chosen, days, id === 102 ? 'commercial' : 'residential']);
    await db.query(`UPDATE service_requests SET photo_urls = '["https://example.test/foto.jpg"]' WHERE id = 101;
      UPDATE service_requests SET created_at = NOW() + INTERVAL '1 day' WHERE id = 111;
      INSERT INTO service_request_interests (request_id, installer_id, status) VALUES
        (103,1,'interested'),(104,1,'interested'),(105,1,'selected'),(106,1,'selected'),
        (107,1,'interested'),(108,1,'interested'),(109,2,'interested'),(110,2,'selected');`);
    const installer = { city: 'Palhoça', state: 'SC', latitude: -27.6453, longitude: -48.6679, service_radius_km: 80 };
    const list = (query, profile = installer) => getOpportunityListing(db, profile, 1, query);
    const expected = { open: 3, interested: 4, selected: 2, matched: 5 };
    await t.test('cada aba retorna somente sua situação e contadores independentes', async () => {
      for (const [status, count] of [['open', 3], ['interested', 4], ['selected', 2]]) {
        const page = await list({ status });
        assert.equal(page.total, count, status);
        assert.ok(page.opportunities.every((row) => row.workspace_tab === status));
        assert.deepEqual(page.stats, expected);
        assert.ok(!page.opportunities.some((row) => row.id === 110));
      }
    });
    await t.test('histórico expirado, cancelado e escolhido continua após mudança de região', async () => {
      const moved = { ...installer, city: 'Vitória', state: 'ES', latitude: -20.3, longitude: -40.3 };
      assert.equal((await list({ status: 'open' }, moved)).total, 0);
      assert.equal((await list({ status: 'interested' }, moved)).total, 4);
      assert.equal((await list({ status: 'selected' }, moved)).total, 2);
      const history = await list({ status: 'interested' }, moved);
      assert.ok(history.opportunities.some((row) => row.status === 'expired'));
      assert.ok(history.opportunities.some((row) => row.status === 'canceled'));
    });
    await t.test('filtros reais pesquisam acentos, cidade, local e fotos sem zerar outras abas', async () => {
      for (const query of [{ q: 'sao jose' }, { city: 'São José', state: 'sc' }, { place: 'commercial' }]) {
        const page = await list(query);
        assert.deepEqual(page.opportunities.map((row) => row.id), [102]);
        assert.deepEqual(page.stats, expected);
      }
      assert.deepEqual((await list({ photos: 'true' })).opportunities.map((row) => row.id), [101]);
      assert.equal((await list({ q: '100%' })).total, 0);
    });
    await t.test('região é filtrada antes de limitar a página e total não depende do limite', async () => {
      const first = await list({ limit: 1 });
      const second = await list({ limit: 1, offset: 1 });
      assert.equal(first.total, 3);
      assert.equal(first.has_more, true);
      assert.equal(second.total, 3);
      assert.notEqual(first.opportunities[0].id, second.opportunities[0].id);
      assert.ok(!first.opportunities.some((row) => row.id === 111));
      assert.equal((await list({ limit: 1, offset: 2 })).has_more, false);
    });
  } finally { await db.query('ROLLBACK').catch(() => {}); await db.end(); }
});
