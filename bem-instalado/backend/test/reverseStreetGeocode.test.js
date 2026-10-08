const test = require('node:test');
const assert = require('node:assert/strict');
const reverseStreetGeocode = require('../utils/reverseStreetGeocode');
const reverseGeocode = require('../utils/reverseGeocode');
const latitude = -23.561414;
const longitude = -46.655881;
const streetFeature = { geometry: { coordinates: [-46.6559677, -23.5614961] }, properties: {
  name: 'Museu de Arte de São Paulo', street: 'Av. Paulista', housenumber: '1578',
  district: 'Bela Vista', city: 'São Paulo', state: 'São Paulo', postcode: '01310-200', countrycode: 'BR',
} };
const cityFeature = { geometry: { coordinates: [-46.65, -23.55] }, properties: {
  name: 'São Paulo', osm_key: 'place', osm_value: 'city', state: 'São Paulo', countrycode: 'BR',
} };
const response = (features) => ({ ok: true, json: async () => ({ features }) });
function mockFetch(t, handler) {
  reverseStreetGeocode.clearCache();
  t.after(() => reverseStreetGeocode.clearCache());
  return t.mock.method(global, 'fetch', handler);
}

test('Minha localização consulta rua, bairro, cidade, UF e CEP, mantendo o ponto GPS', async (t) => {
  const fetch = mockFetch(t, async (url) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/reverse');
    assert.deepEqual(parsed.searchParams.getAll('layer'), ['house', 'street']);
    assert.equal(parsed.searchParams.get('radius'), '0.5');
    return response([streetFeature]);
  });
  const address = await reverseGeocode(latitude, longitude, 'pt-BR', 'address');
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(address.source, 'gps');
  assert.equal(address.precision, 'street');
  assert.equal(address.street, 'Av. Paulista');
  assert.equal(address.neighborhood, 'Bela Vista');
  assert.equal(address.city, 'São Paulo');
  assert.equal(address.state, 'SP');
  assert.equal(address.zipCode, '01310-200');
  assert.equal(address.latitude, latitude);
  assert.equal(address.longitude, longitude);
  assert.equal(address.houseNumber, '');
  assert.equal(address.addressReference, 'Av. Paulista');
  assert.doesNotMatch(address.displayName, /1578|Museu/);
});

test('nome da via também é reconhecido quando o mapa a descreve como highway', async (t) => {
  mockFetch(t, async () => response([{ ...streetFeature, properties: {
    ...streetFeature.properties, street: '', housenumber: '', name: 'Rua Turquesa', osm_key: 'highway', osm_value: 'residential',
  } }]));
  const address = await reverseStreetGeocode(latitude, longitude);
  assert.equal(address.street, 'Rua Turquesa');
  assert.equal(address.houseNumber, '');
});

test('um prédio sem campo de rua não transforma o nome do prédio em logradouro', () => {
  const address = reverseStreetGeocode.serializeGpsAddress({ ...streetFeature,
    properties: { ...streetFeature.properties, street: '', osm_key: 'tourism', osm_value: 'museum' },
  }, latitude, longitude);
  assert.equal(address.street, '');
  assert.equal(address.addressReference, '');
  assert.equal(address.houseNumber, '');
  assert.equal(address.precision, 'region');
  assert.doesNotMatch(address.displayName, /Museu/);
});

test('se não há rua mapeada, devolve região sem inventar rua nem número', async (t) => {
  const fetch = mockFetch(t, async (url) => new URL(url).searchParams.getAll('layer').includes('street')
    ? response([]) : response([cityFeature]));
  const address = await reverseStreetGeocode(latitude, longitude);
  assert.equal(fetch.mock.callCount(), 2);
  assert.equal(address.city, 'São Paulo');
  assert.equal(address.street, '');
  assert.equal(address.addressReference, '');
  assert.equal(address.precision, 'region');
});

test('compartilha consultas GPS repetidas sem reusar o marcador arredondado ou alterações do cliente', async (t) => {
  const fetch = mockFetch(t, async () => response([streetFeature]));
  const [first, second] = await Promise.all([
    reverseStreetGeocode(latitude, longitude), reverseStreetGeocode(latitude, longitude),
  ]);
  first.street = 'Alterada';
  assert.equal(second.street, 'Av. Paulista');
  const nextLatitude = latitude + 0.0000001;
  const cached = await reverseStreetGeocode(nextLatitude, longitude);
  assert.equal(cached.street, 'Av. Paulista');
  assert.equal(cached.latitude, nextLatitude);
  assert.equal(fetch.mock.callCount(), 1);
});

test('não armazena erro do provedor e permite uma nova tentativa', async (t) => {
  const fetch = mockFetch(t, async () => ({ ok: false, status: 503 }));
  await assert.rejects(reverseStreetGeocode(latitude, longitude), /503/);
  fetch.mock.mockImplementation(async () => response([streetFeature]));
  assert.equal((await reverseStreetGeocode(latitude, longitude)).street, 'Av. Paulista');
  assert.equal(fetch.mock.callCount(), 2);
});

test('rejeita coordenadas inválidas e regiões fora da cobertura brasileira', async (t) => {
  const fetch = mockFetch(t, async () => response([{ ...cityFeature, properties: {
    ...cityFeature.properties, countrycode: 'US', state: 'California',
  } }]));
  await assert.rejects(reverseStreetGeocode(91, longitude), /Coordenadas/);
  await assert.rejects(reverseStreetGeocode(latitude, NaN), /Coordenadas/);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(await reverseStreetGeocode(latitude, longitude), null);
});
