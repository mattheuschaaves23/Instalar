const test = require('node:test');
const assert = require('node:assert/strict');
const { __test } = require('../controllers/serviceRequestController');

const opportunity = {
  id: 41,
  client_name: 'Cliente Exemplo',
  client_phone: '48999999999',
  client_email: 'cliente@example.test',
  zip_code: '88000-000',
  address_reference: 'Rua protegida, 123',
  neighborhood: 'Centro',
  city: 'Florianópolis',
  state: 'SC',
  details: 'Parede com uma janela e umidade no canto.',
  photo_count: 1,
  photo_names: ['parede.jpg'],
  photo_urls: ['https://example.test/parede.jpg'],
  status: 'open',
};

test('proposta mostra detalhes e fotos sem revelar contato ou endereço completo', () => {
  const serialized = __test.serializeOpportunity(opportunity);

  assert.equal(serialized.details, opportunity.details);
  assert.deepEqual(serialized.photo_urls, opportunity.photo_urls);
  assert.equal(serialized.neighborhood, opportunity.neighborhood);
  assert.equal(serialized.client_name, null);
  assert.equal(serialized.client_phone, null);
  assert.equal(serialized.client_email, null);
  assert.equal(serialized.zip_code, null);
  assert.equal(serialized.address_reference, null);
  assert.equal(serialized.interest_whatsapp_url, null);
  assert.equal(serialized.can_contact_on_interest, false);
});

test('contato e endereço completo são liberados somente ao instalador escolhido', () => {
  const serialized = __test.serializeOpportunity({
    ...opportunity,
    status: 'selected',
    my_interest_status: 'selected',
    selected_by_me: true,
    whatsapp_url: 'https://wa.me/5548999999999',
  });

  assert.equal(serialized.client_name, opportunity.client_name);
  assert.equal(serialized.client_phone, opportunity.client_phone);
  assert.equal(serialized.client_email, opportunity.client_email);
  assert.equal(serialized.zip_code, opportunity.zip_code);
  assert.equal(serialized.address_reference, opportunity.address_reference);
  assert.equal(serialized.whatsapp_url, 'https://wa.me/5548999999999');
});

test('instalador interessado sabe quando outro profissional foi escolhido sem receber contato', () => {
  const serialized = __test.serializeOpportunity({
    ...opportunity,
    status: 'selected',
    my_interest_status: 'interested',
    interested_by_me: true,
  });

  assert.equal(serialized.not_selected, true);
  assert.equal(serialized.client_phone, null);
  assert.equal(serialized.address_reference, null);
  assert.equal(serialized.whatsapp_url, null);
});
