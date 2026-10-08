const test = require('node:test');
const assert = require('node:assert/strict');

const poolPath = require.resolve('../config/database');
const controllerPath = require.resolve('../controllers/supportController');
const user = { id: 71, name: 'Conta QA', email: 'qa@example.test', is_admin: false };
const conversation = { id: 22, installer_id: 71, status: 'open' };
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } });
const fakeQuery = async (sql, params) => {
  if (sql.includes('FROM users')) return { rows: [user] };
  if (sql.includes('INSERT INTO support_messages')) return { rows: [{ id: 19, conversation_id: 22, sender_id: 71, body: params[2], is_from_admin: false }] };
  if (sql.includes('FROM support_conversations')) return { rows: [conversation] };
  if (sql.includes('FROM support_messages')) return { rows: [] };
  return { rows: [], rowCount: 0 };
};
async function withController(pool, callback) {
  const previous = require.cache[poolPath];
  require.cache[poolPath] = { id: poolPath, filename: poolPath, loaded: true, exports: pool };
  delete require.cache[controllerPath];
  try { await callback(require('../controllers/supportController')); }
  finally { delete require.cache[controllerPath]; if (previous) require.cache[poolPath] = previous; else delete require.cache[poolPath]; }
}
test('suporte abre a conversa usando o pool sem referência a conexão inexistente', async () => {
  await withController({ query: fakeQuery }, async controller => {
    const res = response();
    await controller.getMyConversation({ userId: 71 }, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.conversation.id, 22);
    assert.deepEqual(res.body.messages, []);
  });
});
test('envio no suporte não reserva uma segunda conexão quando o pool possui apenas uma', async () => {
  let released = false;
  const db = { query: fakeQuery, release() { released = true; } };
  await withController({ connect: async () => db, query() { throw new Error('Segunda conexão indisponível: pool máximo 1'); } }, async controller => {
    const res = response();
    await controller.sendMessage({ userId: 71, body: { body: 'Mensagem QA fictícia.' }, app: { get() { return null; } } }, res);
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    assert.equal(res.body.message.body, 'Mensagem QA fictícia.');
    assert.equal(released, true);
  });
});
