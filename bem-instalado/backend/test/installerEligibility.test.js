const test = require('node:test');
const assert = require('node:assert/strict');
const { getInstallerReadiness, normalizeBrazilianWhatsApp } = require('../utils/installerEligibility');
const essential = {
  name: 'Instalador Teste', phone: '(48) 99999-9999', city: 'Palhoça', state: 'SC',
  email: 'qa@example.test', email_verified_at: new Date(),
};

test('somente cinco dados essenciais liberam pedidos, sem certificado nem perfil público', () => {
  const readiness = getInstallerReadiness(essential);
  assert.equal(readiness.ready, true);
  assert.equal(readiness.requirements.length, 5);
  assert.deepEqual(readiness.missing_fields, []);
});

test('campos opcionais e selo não substituem os dados essenciais', () => {
  const readiness = getInstallerReadiness({
    name: ' ', phone: '123', state: 'XX', email: 'invalido', email_verified_at: new Date(),
    is_admin: true, certification_verified: true, public_profile: true,
    certificate_file: 'certificado.pdf', installation_gallery: ['foto.jpg'],
  });
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.missing_fields, ['name', 'phone', 'city', 'state', 'email_verified']);
});

test('normaliza telefone nacional e com DDI sem aceitar número fictício curto', () => {
  for (const phone of ['(48) 99999-9999', '+55 48 99999-9999']) {
    assert.equal(normalizeBrazilianWhatsApp(phone), '5548999999999');
  }
  assert.equal(normalizeBrazilianWhatsApp('00000000000'), '');
  assert.equal(normalizeBrazilianWhatsApp('99999999'), '');
  assert.equal(getInstallerReadiness({...essential, state: ' sc '}).ready, true);
});
