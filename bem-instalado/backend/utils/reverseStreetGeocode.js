const { serializeFeature } = require('./forwardGeocode');

const cache = new Map();
const pending = new Map();
const CACHE_LIMIT = 200;

function serializeGpsAddress(feature, latitude, longitude) {
  const address = serializeFeature(feature);
  if (!address) return null;
  // A nearby building's number is not proof of the user's house number.
  const properties = feature.properties || {};
  const street = properties.street ||
    (properties.osm_key === 'highway' || properties.type === 'street' ? properties.name : '') || '';
  const displayName = [street, address.neighborhood, address.city, address.state, address.zipCode].filter(Boolean).join(', ');
  return { ...address, latitude, longitude, street, houseNumber: '', addressReference: street,
    source: 'gps', precision: street ? 'street' : 'region',
    label: street || address.neighborhood || address.city, displayName,
    attribution: '© OpenStreetMap contributors', provider: 'photon' };
}

async function searchNearby(latitude, longitude, language, streetOnly) {
  const url = new URL(process.env.GEOCODING_REVERSE_URL || 'https://photon.komoot.io/reverse');
  const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude),
    radius: streetOnly ? '0.5' : '50', limit: streetOnly ? '5' : '3' });
  for (const layer of streetOnly ? ['house', 'street'] : ['city', 'district', 'locality']) params.append('layer', layer);
  url.search = params.toString();
  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(3500),
    headers: { Accept: 'application/geo+json, application/json', 'Accept-Language': language,
      'User-Agent': `InstalaPro/1.0 (${process.env.GEOCODING_CONTACT || 'instalaproo@gmail.com'})` },
  });
  if (!response.ok) throw new Error(`Falha ao consultar endereço do GPS: ${response.status}`);
  const data = await response.json();
  return (data.features || []).map((feature) => serializeGpsAddress(feature, latitude, longitude)).filter(Boolean);
}

async function reverseStreetGeocode(latitude, longitude, language = 'pt-BR') {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new Error('Coordenadas inválidas.');
  }
  const key = [latitude.toFixed(6), longitude.toFixed(6), String(language).slice(0, 40)].join('|');
  const cached = cache.get(key);
  let request = cached && cached.expires > Date.now() ? Promise.resolve(cached.address) : pending.get(key);
  if (!request) {
    request = (async () => {
      const nearby = await searchNearby(latitude, longitude, language, true);
      // No mapped street: return a region explicitly, never label a city as a street.
      const address = nearby.find((item) => item.street) || nearby[0] ||
        (await searchNearby(latitude, longitude, language, false))[0] || null;
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
      cache.set(key, { address, expires: Date.now() + (address ? 5 * 60 * 1000 : 15000) });
      return address;
    })().finally(() => pending.delete(key));
    pending.set(key, request);
  }
  const address = await request;
  // Reusing a tiny coordinate bucket must not change the actual GPS marker.
  return address ? { ...structuredClone(address), latitude, longitude } : null;
}

module.exports = reverseStreetGeocode;
module.exports.serializeGpsAddress = serializeGpsAddress;
module.exports.clearCache = () => { cache.clear(); pending.clear(); };
