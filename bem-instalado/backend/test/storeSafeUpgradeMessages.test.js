// As mensagens de limite do plano aparecem dentro do app das lojas (toast do app
// Android/iOS). Nenhuma pode mandar o usuario assinar, pagar ou ativar o Pro, porque
// a compra so existe no site e as politicas de pagamento da Google Play e da App
// Store proibem direcionar o usuario a pagar fora da loja.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pool = require('../config/database');
const clientController = require('../controllers/clientController');

const STEERING = /(assin(e|ar|atura)|\bative|\bativar|\bpague|\bpagar|pagamento|pelo site|no site|checkout|\bpix\b|cart[aã]o)/i;
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('limite de clientes do plano Gratis nao manda assinar o Pro', async (t) => {
  t.mock.method(pool, 'query', async () => assert.fail('Nao deve gravar acima do limite'));
  const res = response();
  await clientController.createClient({
    userId: 1,
    planAccess: { is_pro: false, limits: { clients: 15 }, usage: { clients: 15 } },
    body: { name: 'Contato ficticio', phone: '48999999999', client_type: 'person', document_id: '529.982.247-25' },
  }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'FREE_CLIENT_LIMIT');
  assert.match(res.body.error, /até 15 clientes/);
  assert.doesNotMatch(res.body.error, STEERING);
});

test('nenhuma mensagem de upgradeRequired nos controllers manda assinar, ativar ou pagar', () => {
  const dir = path.join(__dirname, '..', 'controllers');
  const offenders = [];
  let checked = 0;
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const call of source.split('upgradeRequired(res, {').slice(1)) {
      const match = call.match(/error:\s*(`[^`]*`|'[^']*')/);
      assert.ok(match, `${file}: upgradeRequired sem mensagem de erro literal`);
      checked += 1;
      if (STEERING.test(match[1])) offenders.push(`${file}: ${match[1]}`);
    }
  }
  assert.ok(checked >= 7, `esperava achar as mensagens de limite, achou ${checked}`);
  assert.deepEqual(offenders, []);
});
