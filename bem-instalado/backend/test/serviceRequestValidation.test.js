const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/database');
const { createPublicServiceRequest } = require('../controllers/serviceRequestController');

const valid = { client_name: 'Cliente de teste', client_phone: '48988888888', service: 'wallpaper', city: 'Palhoça', state: 'SC', privacy_consent: true };
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('validação de localização antes de gravar um pedido', async (t) => {
  // Never use the configured database or a real map service in unit tests.
  const query = t.mock.method(pool, 'query', async (_sql, values) => ({ rows: [{ id: 42, latitude: values[34], longitude: values[35] }] }));
  const fetch = t.mock.method(global, 'fetch', async () => { throw new Error('Maps must not be called'); });
  for (const change of [
    { city: '' }, { state: '' }, { state: 'XX' }, { state: 'SANTA CATARINA' },
    { latitude: -27.6 }, { longitude: -48.6 }, { latitude: true, longitude: [] },
    { latitude: ' ', longitude: ' ' }, { latitude: 91, longitude: 10 }, { latitude: -27, longitude: 181 },
  ]) {
    await t.test(`rejeita ${JSON.stringify(change)}`, async () => {
      const before = query.mock.callCount();
      const res = response();
      await createPublicServiceRequest({ body: { ...valid, ...change } }, res);
      assert.equal(res.statusCode, 400, JSON.stringify(res.body));
      assert.equal(query.mock.callCount(), before, 'nenhuma gravação deve ocorrer');
    });
  }
  await t.test('endereço manual não vira um ponto inventado no centro da cidade', async () => {
    fetch.mock.resetCalls();
    const res = response();
    await createPublicServiceRequest({ body: valid }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(fetch.mock.callCount(), 0);
    assert.equal(res.body.service_request.latitude, null);
    assert.equal(res.body.service_request.longitude, null);
  });
  await t.test('preserva o par de coordenadas informado e aceita UF minúscula', async () => {
    const res = response();
    await createPublicServiceRequest({ body: { ...valid, state: 'sc', latitude: '-27.645', longitude: '-48.668' } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.service_request.latitude, -27.645);
    assert.equal(res.body.service_request.longitude, -48.668);
  });
});
