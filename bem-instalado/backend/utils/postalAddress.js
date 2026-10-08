// Postal addresses complement the map index; a CEP is an exact identifier,
// never a fuzzy query that may silently select a different postcode.
const BRAZIL_STATES = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));

function normalizePostalCode(query) {
  const value = String(query || '').trim().replace(/^cep\s*:?\s*/i, '');
  return /^\d{5}[\s-]?\d{3}$/.test(value) ? value.replace(/\D/g, '') : null;
}

function serializePostalAddress(data) {
  if (!data || data.erro || !data.localidade || !BRAZIL_STATES.has(data.uf)) return null;
  const street = String(data.logradouro || '').trim();
  const neighborhood = String(data.bairro || '').trim();
  const city = String(data.localidade).trim();
  const state = data.uf;
  const zipCode = String(data.cep || '').trim();
  const label = street || neighborhood || city;
  return {
    latitude: null, longitude: null, source: 'viacep', precision: 'postal',
    label, street, houseNumber: '', city, state, neighborhood, zipCode,
    addressReference: street,
    subtitle: [neighborhood, city, state, zipCode].filter(Boolean).join(' · '),
    displayName: [street, neighborhood, city, state, zipCode].filter(Boolean).join(', '),
  };
}

async function requestPostalAddress(path) {
  const response = await fetch(`https://viacep.com.br/ws/${path}/json/`, {
    signal: AbortSignal.timeout(3000), headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Consulta de CEP indisponível: ${response.status}`);
  return response.json();
}

async function lookupPostalCode(cep) {
  const normalized = normalizePostalCode(cep);
  if (!normalized) return [];
  const address = serializePostalAddress(await requestPostalAddress(normalized));
  return address ? [address] : [];
}

function parsePostalSearch(query, context = {}) {
  const parts = String(query || '').split(',').map((part) => part.trim()).filter(Boolean);
  if (/^brasil$/i.test(parts.at(-1) || '')) parts.pop();
  let state = String(context.state || '').toUpperCase();
  let city = String(context.city || '').trim();
  if (parts.length >= 3 && BRAZIL_STATES.has(parts.at(-1).toUpperCase())) {
    state = parts.pop().toUpperCase();
    city = parts.pop();
  }
  // ViaCEP requires UF, city and street; never scan every city/state.
  const street = parts.filter((part) => !/^\d+[a-z]?$/i.test(part)).join(' ');
  if (!BRAZIL_STATES.has(state) || city.length < 3 || street.length < 3 || street.toLowerCase() === city.toLowerCase()) return null;
  return { state, city, street };
}

async function searchPostalAddresses(address) {
  if (!address) return [];
  const data = await requestPostalAddress([address.state, address.city, address.street].map(encodeURIComponent).join('/'));
  return Array.isArray(data) ? data.map(serializePostalAddress).filter(Boolean) : [];
}

module.exports = { BRAZIL_STATES, normalizePostalCode, serializePostalAddress, parsePostalSearch, lookupPostalCode, searchPostalAddresses };
