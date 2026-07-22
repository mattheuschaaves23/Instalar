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

  if (/^[A-Z]{2}$/.test(compactCode)) {
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

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const properties = feature.properties || {};
  const street = properties.street || (properties.housenumber ? properties.name : '');
  const houseNumber = properties.housenumber || '';
  const neighborhood = properties.district || properties.locality || '';
  const city =
    properties.city ||
    properties.locality ||
    properties.county ||
    properties.district ||
    properties.name ||
    '';
  const region = properties.state || properties.county || '';
  const state = resolveStateCode(properties.statecode, region);
  const zipCode = properties.postcode || '';
  const baseLabel = street || properties.name || neighborhood || city || region || 'Localizacao';
  const label = houseNumber ? `${baseLabel}, ${houseNumber}` : baseLabel;
  const subtitle = uniqueParts([neighborhood, city, state || region, zipCode, 'Brasil'])
    .filter((part) => normalizeText(part) !== normalizeText(label))
    .join(' - ');
  const displayName = uniqueParts([label, neighborhood, city, state || region, zipCode]).join(', ');

  return {
    latitude,
    longitude,
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

async function forwardGeocode(query, limit = 6, acceptLanguage = 'pt-BR') {
  const normalizedQuery = String(query || '').trim();

  if (normalizedQuery.length < 3) {
    return [];
  }

  const searchParams = new URLSearchParams({
    q: normalizedQuery,
    limit: String(Math.min(Math.max(Number(limit) || 6, 1), 8)),
    countrycode: 'BR',
  });
  const response = await fetch(`https://photon.komoot.io/api?${searchParams.toString()}`, {
    signal: AbortSignal.timeout(6500),
    headers: {
      Accept: 'application/geo+json, application/json',
      'Accept-Language': acceptLanguage,
      'User-Agent': 'InstalarPapelPerto/1.0 (busca de instaladores)',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar enderecos: ${response.status}`);
  }

  const data = await response.json();
  const seen = new Set();

  return (data.features || [])
    .map(serializeFeature)
    .filter(Boolean)
    .filter((location) => {
      const key = `${location.displayName}|${location.latitude}|${location.longitude}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

module.exports = forwardGeocode;
