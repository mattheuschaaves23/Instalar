const assert = require('node:assert/strict');
const test = require('node:test');
// 4×4 JPEG generated for this fixture.
const photo = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAEAAQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD8qqKKKAP/2Q==';

test('orçamento de catálogo, edição e horário na agenda com PostgreSQL isolado', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const target = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
  process.env.DATABASE_URL = target.toString();
  process.env.DATABASE_SSL = 'false';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET ||= 'integration-test-secret-with-at-least-32-characters';
  const pool = require('../config/database');
  const { app, ensureRuntimeSchema } = require('../server');
  const { once } = require('node:events');
  const jwt = require('jsonwebtoken');
  const { jwtSecret } = require('../config/auth');
  const { createBudget, updateBudget, approveBudget, getBudgets } = require('../controllers/budgetController');
  const { reschedule } = require('../controllers/scheduleController');
  const users = [];
  let server;
  let stamp = Date.now();
  async function createUser() {
    const { rows: [{ id }] } = await pool.query(
      "INSERT INTO users (name, email, password, email_verified_at) VALUES ('Instalador QA', $1, 'fixture', NOW()) RETURNING id",
      [`catalog-${stamp++}@example.test`]
    );
    users.push(id);
    return id;
  }
  async function call(handler, userId, body, id) {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    await handler({ userId, body, params: id ? { id } : {}, query: { include_drafts: 'true' } }, res);
    return res;
  }
  try {
    await ensureRuntimeSchema();
    const installer = await createUser();
    const other = await createUser();
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/products`;
    const catalog = (owner, { path = '', data, method = 'GET' } = {}) => fetch(base + path, {
      method,
      headers: { Authorization: `Bearer ${jwt.sign({ id: owner }, jwtSecret, { expiresIn: '5m' })}`, 'Content-Type': 'application/json' },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const { rows: [client] } = await pool.query("INSERT INTO clients (user_id, name, phone) VALUES ($1, 'Cliente QA', '') RETURNING id", [installer]);
    assert.equal((await catalog(installer, { method: 'POST', data: { name: 'Sem formato', price: 12, photo: 'data:image/jpeg;base64,YQ==' } })).status, 400);
    const first = await catalog(installer, { method: 'POST', data: { name: 'Produto QA', price: 125.50, photo } });
    assert.equal(first.status, 201);
    const product = await first.json();
    assert.ok(product.photo_version);
    assert.equal(product.photo, undefined);
    const second = await catalog(other, { method: 'POST', data: { name: 'Outro', price: 35 } });
    assert.equal(second.status, 201);
    const foreign = await second.json();
    assert.equal(foreign.photo_version, null);
    const photoPath = `/photos?ids=${product.id}`;
    assert.deepEqual(await (await catalog(installer, { path: photoPath })).json(), { [product.id]: photo });
    assert.deepEqual(await (await catalog(other, { path: photoPath })).json(), {});
    assert.deepEqual((await (await catalog(other)).json()).map((item) => item.id), [foreign.id]);
    assert.equal((await catalog(other, { path: `/${product.id}`, method: 'DELETE' })).status, 404);
    const input = { pricing_mode: 'fixed', client_id: client.id, product_items: [{ product_id: product.id, quantity: 2, unit_price: 1 }] };
    const quote = await call(createBudget, installer, input);
    assert.equal(quote.statusCode, 201, JSON.stringify(quote.body));
    assert.equal(quote.body.total_amount, '251.00');
    const id = quote.body.id;
    assert.equal((await call(createBudget, installer, { ...input, product_items: [{ product_id: foreign.id, quantity: 1 }] })).statusCode, 409);
    assert.equal((await call(updateBudget, other, input, id)).statusCode, 404);
    assert.equal((await catalog(installer, { path: `/${product.id}`, method: 'PUT', data: { name: 'Produto atualizado', price: 999 } })).status, 200);
    assert.deepEqual(await (await catalog(installer, { path: photoPath })).json(), { [product.id]: photo });
    const replacementBytes = Buffer.from(photo.split(',')[1], 'base64');
    replacementBytes.writeUInt16BE(72, 14); // A different valid JPEG: change JFIF horizontal density.
    const replacement = 'data:image/jpeg;base64,' + replacementBytes.toString('base64');
    const replacePhoto = await catalog(installer, { path: `/${product.id}`, method: 'PUT', data: { name: 'Produto atualizado', price: 999, photo: replacement } });
    assert.equal(replacePhoto.status, 200);
    assert.deepEqual(await (await catalog(installer, { path: photoPath })).json(), { [product.id]: replacement });
    const removedPhoto = await catalog(installer, { path: `/${product.id}`, method: 'PUT', data: { name: 'Produto atualizado', price: 999, photo: null } });
    assert.equal((await removedPhoto.json()).photo_version, null);
    assert.deepEqual(await (await catalog(installer, { path: photoPath })).json(), {});
    assert.equal((await catalog(installer, { path: `/${product.id}`, method: 'DELETE' })).status, 204);
    const edited = await call(updateBudget, installer, { ...input, product_items: [{ product_id: product.id, quantity: 3 }], version: quote.body.updated_at.toISOString() }, id);
    assert.equal(edited.statusCode, 200, JSON.stringify(edited.body));
    assert.equal(edited.body.id, id);
    assert.equal(edited.body.total_amount, '376.50');
    const manual = await call(createBudget, installer, { pricing_mode: 'square_meter', manual_price: 345, client_id: client.id });
    assert.equal(manual.statusCode, 201, JSON.stringify(manual.body));
    assert.equal(manual.body.pricing_mode, 'square_meter');
    assert.equal(manual.body.total_amount, '345.00');
    const rollInput = { pricing_mode: 'roll', client_id: client.id, price_per_roll: 80, removal_price_per_roll: 10 };
    const byRoll = await call(createBudget, installer, { ...rollInput, environments: [
      { height: null, width: null, rolls_manual: 3, removal_included: true },
    ] });
    assert.equal(byRoll.statusCode, 201, JSON.stringify(byRoll.body));
    assert.equal(byRoll.body.total_amount, '270.00');
    assert.equal(Number(byRoll.body.total_rolls), 3);
    assert.equal(Number(byRoll.body.total_area), 0);
    const storedRoom = await pool.query('SELECT width, height, rolls_manual, rolls_auto FROM environments WHERE budget_id = $1', [byRoll.body.id]);
    assert.deepEqual(storedRoom.rows[0], { width: '0.00', height: '0.00', rolls_manual: 3, rolls_auto: 0 });
    for (const environment of [{}, { rolls_manual: 2.5 }, { width: 4, rolls_manual: 3 }]) {
      const invalid = await call(createBudget, installer, { ...rollInput, environments: [{ name: 'Sala', ...environment }] });
      assert.equal(invalid.statusCode, 400, JSON.stringify(invalid.body));
    }
    const m2 = { pricing_mode: 'square_meter', price_per_square_meter: 20, client_id: client.id };
    const byArea = await call(createBudget, installer, { ...m2, environments: [{ area_manual: 12.5 }] });
    assert.equal(byArea.statusCode, 201, JSON.stringify(byArea.body));
    assert.equal(byArea.body.total_amount, '250.00');
    const areaRoom = await pool.query('SELECT height, width, area FROM environments WHERE budget_id = $1', [byArea.body.id]);
    assert.deepEqual(areaRoom.rows[0], { height: '0.00', width: '0.00', area: '12.50' });
    for (const room of [{}, { area_manual: 0 }, { area_manual: 1.125 }, { width: 4, area_manual: 12.5 }]) {
      const invalid = await call(createBudget, installer, { ...m2, environments: [{ name: 'Sala', ...room }] });
      assert.equal(invalid.statusCode, 400, JSON.stringify(invalid.body));
    }
    const listed = await call(getBudgets, installer);
    assert.equal(listed.body.find((row) => row.id === id).client_profile_complete, false);

    const approval = await call(approveBudget, installer, { schedule_date: '2030-05-22T13:30' }, id);
    assert.equal(approval.statusCode, 200, JSON.stringify(approval.body));
    assert.equal((await call(updateBudget, installer, input, id)).statusCode, 409);
    const otherApproval = await call(approveBudget, installer, { schedule_date: '2030-05-22T15:30' }, manual.body.id);
    assert.equal(otherApproval.statusCode, 200, JSON.stringify(otherApproval.body));
    const schedule = approval.body.schedule.id;
    assert.equal((await call(reschedule, other, { schedule_date: '2030-05-22T16:30' }, schedule)).statusCode, 404);
    assert.equal((await call(reschedule, installer, { schedule_date: '2030-05-22T15:30' }, schedule)).statusCode, 409);
    const moved = await call(reschedule, installer, { schedule_date: '2030-05-22T16:30' }, schedule);
    assert.equal(moved.statusCode, 200, JSON.stringify(moved.body));
    assert.equal(moved.body.date.toISOString(), '2030-05-22T19:30:00.000Z');
    const { rows } = await pool.query('SELECT schedule_date FROM budgets WHERE id = $1', [id]);
    assert.equal(rows[0].schedule_date.toISOString(), '2030-05-22T19:30:00.000Z');
  } finally {
    if (server) await new Promise((done) => server.close(done));
    if (users.length) await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [users]);
    await pool.end();
  }
});
