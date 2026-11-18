const test = require('node:test');
const assert = require('node:assert/strict');
const { PROFILE_ACCENTS, PROFILE_APPEARANCE_DEFAULTS, isValidProfileAppearance, normalizeProfileAppearance } = require('../../shared/profileAppearance.mjs');

test('personalização aceita somente os quatro ajustes visuais seguros', () => {
  assert.equal(isValidProfileAppearance({}), true);
  for (const accent of Object.keys(PROFILE_ACCENTS)) {
    const appearance = { accent, cover_height: 'immersive', cover_position: 0, gallery_format: 'square' };
    assert.equal(isValidProfileAppearance(appearance), true);
    assert.deepEqual(normalizeProfileAppearance(appearance), appearance);
  }
  for (const invalid of [null, [], 'blue', { accent: 'constructor' }, { accent: '__proto__' },
    { accent: 'url(javascript:alert(1))' }, { cover_height: '100vh' }, { cover_position: -1 },
    { cover_position: 101 }, { cover_position: '50' }, { cover_position: 1.5 },
    { gallery_format: '<script>' }, { is_admin: true }, { css: 'body{display:none}' }, { cover_url: 'https://tracker.test' }]) {
    assert.equal(isValidProfileAppearance(invalid), false, JSON.stringify(invalid));
  }
});

test('perfis antigos e dados inválidos recebem aparência padrão sem campos privados', () => {
  assert.deepEqual(normalizeProfileAppearance(null), PROFILE_APPEARANCE_DEFAULTS);
  assert.deepEqual(normalizeProfileAppearance({ accent: '__proto__', cover_position: NaN, is_admin: true }), PROFILE_APPEARANCE_DEFAULTS);
  assert.equal(normalizeProfileAppearance({ cover_position: Infinity }).cover_position, 50);
  assert.equal(normalizeProfileAppearance({ cover_position: 200 }).cover_position, 100);
});

test('API recusa personalização malformada antes de consultar o banco', async (t) => {
  const pool = require('../config/database');
  const query = t.mock.method(pool, 'query', async () => { throw new Error('Não deve acessar o banco'); });
  const controller = require('../controllers/userController');
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await controller.updateProfile({ userId: 7, body: { profile_appearance: { accent: 'red;display:none' } } }, res);
  assert.equal(res.code, 400);
  assert.match(res.body.error, /Personalização inválida/);
  assert.equal(query.mock.callCount(), 0);
});

test('API salva só a aparência recebida, parametriza o SQL e preserva os outros campos', async (t) => {
  const pool = require('../config/database');
  const appearance = { accent: 'ocean', cover_height: 'immersive', cover_position: 35, gallery_format: 'square' };
  let update;
  t.mock.method(pool, 'query', async (sql, params) => {
    if (sql.includes('UPDATE users') && sql.includes('profile_appearance =')) {
      update = { sql, params };
      return { rows: [{ id: 7, profile_appearance: appearance, email_verified_at: new Date() }] };
    }
    return { rows: [{ id: 7, certificate_file: null, is_admin: true }] };
  });
  const controller = require('../controllers/userController');
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await controller.updateProfile({ userId: 7, body: { profile_appearance: appearance } }, res);
  assert.equal(res.code, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.profile_appearance, appearance);
  assert.equal(update.params[34], 7);
  assert.deepEqual(JSON.parse(update.params[35]), appearance);
  assert.ok(update.params.slice(0, 34).every((value) => value === null));
  assert.match(update.sql, /profile_appearance = COALESCE\(\$36::jsonb, profile_appearance\)/);
});
