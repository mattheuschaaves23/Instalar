const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSearchText } = require('../utils/textSearch');

test('busca normaliza acentos e caixa', () => {
  assert.equal(normalizeSearchText('  Palhoça  '), 'palhoca');
  assert.equal(normalizeSearchText('SÃO JOSÉ'), 'sao jose');
  assert.equal(normalizeSearchText('Florianópolis'), 'florianopolis');
});
