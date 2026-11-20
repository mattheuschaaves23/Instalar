const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeDirectQuoteDetails } = require('../utils/directQuoteDetails');

const details = {
  street: ' Rua de teste ', house_number: 'S/N', neighborhood: 'Centro',
  place_type: 'residential', material_type: 'unknown',
  environments: [{ name: ' Sala ', removal: 'unknown' }],
};

test('aceita pedidos antigos e mantém campos desconhecidos em branco', () => {
  assert.deepEqual(normalizeDirectQuoteDetails(undefined), { value: null });
  const { value } = normalizeDirectQuoteDetails(details);
  assert.equal(value.clientEmail, null);
  assert.equal(value.privateDetails.street, 'Rua de teste');
  assert.deepEqual(value.privateDetails.environments, [{ name: 'Sala', width: null, height: null, rolls: null, removal: 'unknown' }]);
});

test('valida os dados adicionais sem mudar o pedido curto dos clientes antigos', () => {
  for (const invalid of [
    null, [], { ...details, client_email: 'inválido' }, { ...details, zip_code: '123' },
    { ...details, street: '' }, { ...details, place_type: 'unknown' }, { ...details, place_type: { toString: null } },
    { ...details, environments: [{ ...details.environments[0], width: -2 }] },
    { ...details, environments: [{ ...details.environments[0], width: 0.001 }] },
    { ...details, environments: [{ ...details.environments[0], rolls: 1.5 }] },
    { ...details, environments: Array(9).fill(details.environments[0]) },
  ]) assert.ok(normalizeDirectQuoteDetails(invalid).error);
});
