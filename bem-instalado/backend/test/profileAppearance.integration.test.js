const test = require('node:test');
const assert = require('node:assert/strict');

test('PostgreSQL isolado: salva aparência, recarrega e mantém perfil oculto e dados essenciais', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const target = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Exige banco local de testes, nunca produção.');
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DATABASE_SSL = 'false';
  process.env.NODE_ENV = 'test';
  const pool = require('../config/database');
  const { ensureRuntimeSchema } = require('../server');
  const controller = require('../controllers/userController');
  const publicController = require('../controllers/publicController');
  const response = () => ({ code: 200, status(code) { this.code = code; return this; }, set() { return this; }, json(body) { this.body = body; return this; } });
  let id;
  try {
    await ensureRuntimeSchema();
    const inserted = await pool.query(`INSERT INTO users (name, email, password, phone, city, state, email_verified_at, public_profile)
      VALUES ('Perfil ilustrativo QA', $1, 'not-a-login-password', '48999990000', 'Palhoça', 'SC', NOW(), FALSE) RETURNING id`, [`appearance-${Date.now()}@example.test`]);
    id = inserted.rows[0].id;
    const appearance = { accent: 'forest', cover_height: 'immersive', cover_position: 35, gallery_format: 'square' };
    const saved = response();
    await controller.updateProfile({ userId: id, body: { profile_appearance: appearance } }, saved);
    assert.equal(saved.code, 200, JSON.stringify(saved.body));
    assert.deepEqual(saved.body.profile_appearance, appearance);
    assert.equal(saved.body.phone, '48999990000');
    assert.equal(saved.body.public_profile, false);
    assert.equal(saved.body.order_readiness.ready, true);
    const loaded = response();
    await controller.getProfile({ userId: id }, loaded);
    assert.deepEqual(loaded.body.profile_appearance, appearance);
    const visible = response();
    await publicController.getInstallerProfile({ userId: id, user: { account_type: 'installer' }, params: { id }, query: {}, headers: {} }, visible);
    assert.equal(visible.code, 200, JSON.stringify(visible.body));
    assert.deepEqual(visible.body.installer.profile_appearance, appearance);
    const privateFields = ['phone', 'email', 'document_id', 'emergency_contact', 'password'];
    for (const field of privateFields) assert.equal(Object.hasOwn(visible.body.installer, field), false);
    const anonymous = response();
    await publicController.getInstallerProfile({ params: { id }, query: {}, headers: {} }, anonymous);
    assert.equal(anonymous.code, 404);
    const oldClient = response();
    await controller.updateProfile({ userId: id, body: { bio: 'Nova bio sem enviar aparência' } }, oldClient);
    assert.deepEqual(oldClient.body.profile_appearance, appearance);
  } finally {
    if (id) await pool.query('DELETE FROM users WHERE id = $1', [id]);
    await pool.end();
  }
});
