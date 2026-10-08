const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/database');
const controller = require('../controllers/clientController');

const person = { name: 'Contato fictício', phone: '48999999999', client_type: 'person', document_id: '529.982.247-25' };
const company = { ...person, client_type: 'company', document_id: '11.222.333/0001-81', contact_name: 'Responsável fictício' };
const planAccess = { is_pro: true, limits: { clients: null }, usage: { clients: 0 } };
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

for (const body of [{ ...person, document_id: '00000000000' }, { ...person, document_id: '52998224724' }, { ...company, document_id: '00000000000000' }, { ...company, document_id: '12ABC34501DE34' }]) {
  test(`recusa documento inválido ${body.document_id} antes de inserir cliente`, async (t) => {
    let inserted = false;
    t.mock.method(pool, 'query', async () => { inserted = true; return { rows: [{ id: 9 }] }; });
    const res = response();
    await controller.createClient({ userId: 1, planAccess, body }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(inserted, false);
  });
}

for (const [body, normalized] of [[person, '52998224725'], [company, '11222333000181'], [{ ...company, document_id: '12.abc.345/01de-35' }, '12ABC34501DE35']]) {
  test(`aceita e normaliza documento válido ${normalized}`, async (t) => {
    t.mock.method(pool, 'query', async (sql, values) => {
      assert.match(sql, /INSERT INTO clients/);
      assert.equal(values[4], normalized);
      return { rows: [{ id: 9, document_id: normalized }] };
    });
    const res = response();
    await controller.createClient({ userId: 1, planAccess, body }, res);
    assert.equal(res.statusCode, 201);
  });
}

test('recusa nome e telefone vazios após retirar espaços', async (t) => {
  t.mock.method(pool, 'query', async () => assert.fail('Não deve gravar nome vazio'));
  const res = response();
  await controller.createClient({ userId: 1, planAccess, body: { ...person, name: ' ', phone: ' ' } }, res);
  assert.equal(res.statusCode, 400);
});

test('valida documento na edição parcial usando o tipo já salvo', async (t) => {
  t.mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /SELECT/);
    assert.deepEqual(values, [9, 1]);
    return { rows: [{ id: 9, ...person }] };
  });
  const res = response();
  await controller.updateClient({ userId: 1, params: { id: 9 }, body: { document_id: '1' } }, res);
  assert.equal(res.statusCode, 400);
});

test('não permite mudar CPF para CNPJ sem documento compatível', async (t) => {
  t.mock.method(pool, 'query', async (sql) => {
    assert.match(sql, /SELECT/);
    return { rows: [{ id: 9, ...person }] };
  });
  const res = response();
  await controller.updateClient({ userId: 1, params: { id: 9 }, body: { client_type: 'company', contact_name: 'Responsável' } }, res);
  assert.equal(res.statusCode, 400);
});

test('edição de cliente de outro proprietário retorna 404 sem UPDATE', async (t) => {
  t.mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /SELECT/);
    assert.deepEqual(values, [9, 2]);
    return { rows: [] };
  });
  const res = response();
  await controller.updateClient({ userId: 2, params: { id: 9 }, body: { name: 'Outro nome' } }, res);
  assert.equal(res.statusCode, 404);
});

test('continua permitindo editar nome de cliente legado sem alterar documento', async (t) => {
  t.mock.method(pool, 'query', async (sql) => {
    if (/SELECT/.test(sql)) return { rows: [{ id: 9, ...person, document_id: null }] };
    assert.match(sql, /UPDATE clients/);
    return { rows: [{ id: 9, name: 'Nome atualizado' }] };
  });
  const res = response();
  await controller.updateClient({ userId: 1, params: { id: 9 }, body: { name: 'Nome atualizado' } }, res);
  assert.equal(res.statusCode, 200);
});
