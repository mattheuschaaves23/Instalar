const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const pool = require('../config/database');
const controller = require('../controllers/userController');

function response() {
  return {
    code: 200,
    headers: {},
    set(key, value) { this.headers[key] = value; return this; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    async download(file, name, done) {
      this.file = file;
      this.name = name;
      this.contents = await fs.readFile(file);
      await done();
      return this;
    },
  };
}

test('prévia lê somente o perfil autenticado, gera um PDF e não grava preferências', async t => {
  const query = t.mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /SELECT .* FROM users/s);
    assert.deepEqual(values, [8]);
    return { rows: [{ id: 8, name: 'Instaladora de teste' }] };
  });
  const res = response();
  await controller.previewPdfBranding({ userId: 8, body: { userId: 99, brand_name: 'Marca ainda não salva' } }, res);
  assert.equal(query.mock.callCount(), 1);
  assert.equal(res.name, 'orcamento-exemplo.pdf');
  assert.match(res.contents.toString('latin1'), /^%PDF/);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  await assert.rejects(fs.stat(res.file), { code: 'ENOENT' });
});

test('normaliza e salva as preferências do PDF só para conta com o recurso Pro', async t => {
  const query = t.mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /UPDATE users SET pdf_branding/);
    assert.equal(values[1], 8);
    assert.equal(JSON.parse(values[0]).template, 'classic');
    assert.equal(JSON.parse(values[0]).accent_color, '#AB2470');
  });
  const body = { template: 'classic', accent_color: '#ab2470' };
  const free = response();
  await controller.updatePdfBranding({ userId: 8, planAccess: { features: { custom_pdf_branding: false } }, body }, free);
  assert.equal(free.code, 403);
  assert.equal(query.mock.callCount(), 0);
  const pro = response();
  await controller.updatePdfBranding({ userId: 8, planAccess: { features: { custom_pdf_branding: true } }, body }, pro);
  assert.equal(pro.code, 200);
  assert.equal(pro.body.branding.template, 'classic');
  assert.equal(query.mock.callCount(), 1);
});
