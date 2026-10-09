const test = require('node:test');
const assert = require('node:assert/strict');
const forwardGeocode = require('../utils/forwardGeocode');
const { normalizePostalCode, parsePostalSearch, serializePostalAddress } = require('../utils/postalAddress');

const postal = { cep: '88137-620', logradouro: 'Rua Turquesa', bairro: 'Bela Vista', localidade: 'Palhoça', uf: 'SC' };
const feature = (overrides = {}, coords = [-48.65, -27.64]) => ({ geometry: { coordinates: coords },
  properties: { name: 'Rua Turquesa', osm_key: 'highway', osm_value: 'residential', city: 'Palhoça', state: 'Santa Catarina', countrycode: 'BR', ...overrides } });
const json = (data) => ({ ok: true, json: async () => data });

function mockFetch(t, handler) {
  forwardGeocode.clearCache();
  t.after(() => forwardGeocode.clearCache());
  return t.mock.method(global, 'fetch', handler);
}

test('CEP informado resolve a rua exata sem consultar busca aproximada', async (t) => {
  const fetch = mockFetch(t, async (url) => {
    assert.equal(url, 'https://viacep.com.br/ws/88137620/json/');
    return json(postal);
  });
  const [address] = await forwardGeocode('CEP: 88137-620');
  assert.equal(address.street, 'Rua Turquesa');
  assert.equal(address.city, 'Palhoça');
  assert.equal(address.state, 'SC');
  assert.equal(address.latitude, null);
  assert.equal(address.longitude, null);
  assert.equal(fetch.mock.callCount(), 1);
});

test('CEP inexistente não é substituído por outro CEP parecido', async (t) => {
  const fetch = mockFetch(t, async (url) => {
    assert.match(url, /viacep/);
    return json({ erro: true });
  });
  assert.deepEqual(await forwardGeocode('99999-999'), []);
  assert.equal(fetch.mock.callCount(), 1);
});

test('usa BrasilAPI quando ViaCEP falha e conserva o CEP exato, sem inventar GPS', async (t) => {
  const fetch = mockFetch(t, async (url) => {
    if (url.includes('viacep')) return { ok: false, status: 503 };
    assert.equal(url, 'https://brasilapi.com.br/api/cep/v2/88137620');
    return json({ cep: '88137620', street: postal.logradouro, neighborhood: postal.bairro, city: postal.localidade, state: 'SC', location: { coordinates: { latitude: -27, longitude: -48 } } });
  });
  const [address] = await forwardGeocode('88137620');
  assert.equal(address.source, 'brasilapi');
  assert.equal(address.street, 'Rua Turquesa');
  assert.equal(address.latitude, null);
  assert.equal(address.longitude, null);
  assert.equal((await forwardGeocode('88137620'))[0].city, 'Palhoça');
  assert.equal(fetch.mock.callCount(), 2);
});

test('fallback não aceita CEP trocado nem guarda indisponibilidade no cache', async (t) => {
  const fetch = mockFetch(t, async (url) => {
    if (url.includes('viacep')) throw new Error('Tempo esgotado');
    return json({ cep: '88137621', street: 'Outra rua', city: 'Palhoça', state: 'SC' });
  });
  await assert.rejects(forwardGeocode('88137620'), /CEP inválida/);
  fetch.mock.mockImplementation(async () => json(postal));
  assert.equal((await forwardGeocode('88137620'))[0].street, 'Rua Turquesa');
});

test('fallback distingue CEP inexistente de indisponibilidade dos dois provedores', async (t) => {
  const fetch = mockFetch(t, async (url) => ({ ok: false, status: url.includes('viacep') ? 503 : 404 }));
  assert.deepEqual(await forwardGeocode('88137620'), []);
  forwardGeocode.clearCache();
  fetch.mock.mockImplementation(async () => ({ ok: false, status: 503 }));
  await assert.rejects(forwardGeocode('88137620'), /indisponível/);
});

test('CEP incompleto ou inválido não inicia autocomplete aproximado', async (t) => {
  const fetch = mockFetch(t, async () => { throw new Error('Não deveria consultar'); });
  assert.deepEqual(await forwardGeocode('88137'), []);
  assert.deepEqual(await forwardGeocode('881376200'), []);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(normalizePostalCode('88137-620'), '88137620');
  assert.equal(normalizePostalCode('88137'), null);
});

test('consultas simultâneas e repetidas compartilham resultado sem compartilhar mutações', async (t) => {
  const fetch = mockFetch(t, async () => json(postal));
  const [first, second] = await Promise.all([forwardGeocode('88137620', 1), forwardGeocode('88137620', 12)]);
  first[0].city = 'Alterada';
  assert.equal(second[0].city, 'Palhoça');
  assert.equal((await forwardGeocode('88137620'))[0].city, 'Palhoça');
  assert.equal(fetch.mock.callCount(), 1);
});

test('consulta de rua inclui cadastro postal mesmo quando ausente no mapa', async (t) => {
  mockFetch(t, async (url) => url.includes('viacep') ? json([postal]) : json({ features: [] }));
  const [address] = await forwardGeocode('Rua Turquesa, Palhoça, SC');
  assert.equal(address.source, 'viacep');
  assert.equal(address.street, 'Rua Turquesa');
});

test('cidade explícita prevalece sobre a região anterior', async (t) => {
  const urls = [];
  mockFetch(t, async (url) => { urls.push(url); return url.includes('viacep') ? json([]) : json({ features: [] }); });
  await forwardGeocode('Rua Flores, Curitiba, PR', 12, 'pt-BR', { city: 'Palhoça', state: 'SC' });
  const mapUrl = new URL(urls.find((url) => url.includes('photon')));
  assert.equal(mapUrl.searchParams.get('q'), 'Rua Flores, Curitiba, PR');
  assert.deepEqual(parsePostalSearch('Rua Flores, 120, Curitiba, PR'), { street: 'Rua Flores', city: 'Curitiba', state: 'PR' });
});

test('falha do mapa não impede consulta postal; falha de ambos é reportada', async (t) => {
  const fetch = mockFetch(t, async (url) => {
    if (url.includes('photon')) throw new Error('Mapa fora');
    return json([postal]);
  });
  assert.equal((await forwardGeocode('Rua Turquesa, Palhoça, SC'))[0].source, 'viacep');
  forwardGeocode.clearCache();
  fetch.mock.mockImplementation(async () => { throw new Error('Serviços fora'); });
  await assert.rejects(forwardGeocode('Rua Turquesa, Palhoça, SC'), /Serviços fora/);
});

test('sugestões repetidas de uma rua são deduplicadas e ruas não viram cidades', async (t) => {
  mockFetch(t, async () => json({ features: [feature(), feature({}, [-48.64, -27.63])] }));
  const addresses = await forwardGeocode('Turquesa');
  assert.equal(addresses.length, 1);
  assert.equal(addresses[0].addressReference, 'Rua Turquesa');
  assert.equal(forwardGeocode.serializeFeature(feature({ city: '', state: 'Santa Catarina' })), null);
  assert.equal(forwardGeocode.serializeFeature(feature({ countrycode: 'US' })), null);
  assert.equal(forwardGeocode.serializeFeature(feature({}, [200, 95])), null);
  assert.equal(serializePostalAddress({ ...postal, uf: 'XX' }), null);
});
