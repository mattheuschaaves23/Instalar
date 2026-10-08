const { BRAZIL_STATES, normalizePostalCode, parsePostalSearch, lookupPostalCode, searchPostalAddresses } = require('./postalAddress');

const CACHE_LIMIT = 400;
const resultCache = new Map();
const pendingSearches = new Map();

const STATE_CODES = {
  acre: 'AC',
  alagoas: 'AL',
  amapa: 'AP',
  amazonas: 'AM',
  bahia: 'BA',
  ceara: 'CE',
  'distrito federal': 'DF',
  'espirito santo': 'ES',
  goias: 'GO',
  maranhao: 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  para: 'PA',
  paraiba: 'PB',
  parana: 'PR',
  pernambuco: 'PE',
  piaui: 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  rondonia: 'RO',
  roraima: 'RR',
  'santa catarina': 'SC',
  'sao paulo': 'SP',
  sergipe: 'SE',
  tocantins: 'TO',
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function resolveStateCode(stateCode, stateName) {
  const compactCode = String(stateCode || '')
    .trim()
    .toUpperCase()
    .replace(/^BR[-_]/, '');

  if (BRAZIL_STATES.has(compactCode)) {
    return compactCode;
  }

  return STATE_CODES[normalizeText(stateName)] || '';
}

function uniqueParts(parts) {
  const seen = new Set();

  return parts.filter((part) => {
    const value = String(part || '').trim();
    if (!value) {
      return false;
    }

    const key = normalizeText(value);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function serializeFeature(feature) {
  const [longitude, latitude] = feature?.geometry?.coordinates || [];

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null;
  }

  const properties = feature.properties || {};
  if (properties.countrycode && String(properties.countrycode).toUpperCase() !== 'BR') return null;
  const street = properties.street || (properties.housenumber || properties.osm_key === 'highway' ? properties.name : '') || '';
  const houseNumber = properties.housenumber || '';
  const neighborhood = properties.district || properties.locality || '';
  const city =
    properties.city ||
    properties.town || properties.village || properties.municipality ||
    properties.county ||
    (properties.osm_key === 'place' && ['city', 'town', 'village'].includes(properties.osm_value) ? properties.name : '') ||
    '';
  const region = properties.state || properties.county || '';
  const state = resolveStateCode(properties.statecode, region);
  if (!city || !state) return null;
  const zipCode = properties.postcode || '';
  const baseLabel = street || properties.name || neighborhood || city || region || 'Localização';
  const label = houseNumber ? `${baseLabel}, ${houseNumber}` : baseLabel;
  const subtitle = uniqueParts([neighborhood, city, state || region, zipCode, 'Brasil'])
    .filter((part) => normalizeText(part) !== normalizeText(label))
    .join(' - ');
  const displayName = uniqueParts([label, neighborhood, city, state || region, zipCode]).join(', ');

  return {
    latitude,
    longitude,
    source: 'photon',
    street,
    houseNumber,
    label,
    subtitle,
    displayName,
    city,
    state,
    region,
    neighborhood,
    zipCode,
    addressReference: uniqueParts([street, houseNumber]).join(', '),
  };
}

async function searchMap(query, acceptLanguage, context = {}) {
  const hasRegion = context.city && BRAZIL_STATES.has(context.state) &&
    !parsePostalSearch(query) && !normalizeText(query).includes(normalizeText(context.city));
  const searchParams = new URLSearchParams({
    q: hasRegion ? `${query}, ${context.city}, ${context.state}` : query,
    limit: '12',
    countrycode: 'BR',
  });
  const response = await fetch(`https://photon.komoot.io/api?${searchParams.toString()}`, {
    signal: AbortSignal.timeout(3000),
    headers: {
      Accept: 'application/geo+json, application/json',
      'Accept-Language': acceptLanguage,
      'User-Agent': `InstalaPro/1.0 (${process.env.GEOCODING_CONTACT || process.env.NOMINATIM_EMAIL || 'contato@instalapro.app'})`,
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar endereços: ${response.status}`);
  }

  const data = await response.json();
  return (data.features || []).map(serializeFeature).filter(Boolean);
}

function dedupeLocations(locations) {
  const seen = new Set();
  return locations.filter((location) => {
    // Segments of one street are one suggestion, not several different choices.
    const key = normalizeText([location.label, location.neighborhood, location.city, location.state, location.zipCode].join('|'));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function forwardGeocode(query, limit = 12, acceptLanguage = 'pt-BR', context = {}) {
  const normalizedQuery = String(query || '').trim().replace(/\s+/g, ' ');
  if (normalizedQuery.length < 3 || normalizedQuery.length > 180) return [];
  const cep = normalizePostalCode(normalizedQuery);
  // Don't autocomplete an incomplete or invalid numeric CEP to a different CEP.
  if (!cep && /^(?:cep\s*:?\s*)?[\d\s-]+$/i.test(normalizedQuery)) return [];
  const safeContext = { city: String(context.city || '').trim().slice(0, 100), state: String(context.state || '').trim().toUpperCase() };
  const key = [normalizeText(cep || normalizedQuery), normalizeText(safeContext.city), safeContext.state, String(acceptLanguage).slice(0, 40)].join('|');
  const cached = resultCache.get(key);
  let promise;
  if (cached && cached.expires > Date.now()) promise = Promise.resolve(cached.locations);
  else {
    resultCache.delete(key);
    promise = pendingSearches.get(key);
    if (!promise) {
      promise = (async () => {
        let locations;
        if (cep) locations = await lookupPostalCode(cep);
        else {
          const postalSearch = parsePostalSearch(normalizedQuery, safeContext);
          const providers = await Promise.allSettled([
            searchMap(normalizedQuery, acceptLanguage, safeContext),
            ...(postalSearch ? [searchPostalAddresses(postalSearch)] : []),
          ]);
          if (providers.every((result) => result.status === 'rejected')) throw providers[0].reason;
          // Exact postal matches broaden coverage beyond streets present in OSM.
          locations = providers.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
        }
        locations = dedupeLocations(locations).slice(0, 12);
        if (resultCache.size >= CACHE_LIMIT) resultCache.delete(resultCache.keys().next().value);
        resultCache.set(key, { locations, expires: Date.now() + (locations.length ? (cep ? 12*60*60*1000 : 5*60*1000) : 15000) });
        return locations;
      })().finally(() => pendingSearches.delete(key));
      pendingSearches.set(key, promise);
    }
  }
  return structuredClone((await promise).slice(0, Math.min(Math.max(Number(limit) || 12, 1), 12)));
}

module.exports = forwardGeocode;
module.exports.serializeFeature = serializeFeature;
module.exports.dedupeLocations = dedupeLocations;
module.exports.clearCache = () => { resultCache.clear(); pendingSearches.clear(); };
