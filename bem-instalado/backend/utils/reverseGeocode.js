function pickCity(geocoding) {
  return (
    geocoding.city ||
    geocoding.town ||
    geocoding.village ||
    geocoding.municipality ||
    geocoding.locality ||
    geocoding.county ||
    ''
  );
}

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

function resolveStateCode(geocoding) {
  const isoCode = String(
    geocoding['ISO3166-2-lvl4'] ||
      geocoding['ISO3166-2-lvl6'] ||
      geocoding.state_code ||
      ''
  )
    .trim()
    .toUpperCase()
    .replace(/^BR[-_]/, '');

  if (/^[A-Z]{2}$/.test(isoCode)) {
    return isoCode;
  }

  return STATE_CODES[normalizeText(geocoding.state)] || '';
}

async function reverseGeocode(lat, lon, acceptLanguage = 'pt-BR') {
  const searchParams = new URLSearchParams({
    format: 'jsonv2',
    lat: String(lat),
    lon: String(lon),
    zoom: '14',
    layer: 'address',
    addressdetails: '1',
    'accept-language': acceptLanguage,
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${searchParams.toString()}`, {
    signal: AbortSignal.timeout(6500),
    headers: {
      Accept: 'application/json',
      'Accept-Language': acceptLanguage,
      'User-Agent': `InstalaPro/1.0 (${process.env.NOMINATIM_EMAIL || 'contato@instalapro.app'})`,
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar geolocalização: ${response.status}`);
  }

  const data = await response.json();
  const geocoding = data?.address || {};
  const city = pickCity(geocoding).trim();
  const region = (geocoding.state || '').trim();
  const state = resolveStateCode(geocoding) || region;
  const neighborhood = (
    geocoding.neighbourhood ||
    geocoding.suburb ||
    geocoding.city_district ||
    ''
  ).trim();
  const street = (geocoding.road || geocoding.pedestrian || geocoding.footway || '').trim();
  const houseNumber = (geocoding.house_number || '').trim();
  const zipCode = (geocoding.postcode || '').trim();
  const addressReference = [street, houseNumber].filter(Boolean).join(', ');
  const displayName = (data.display_name || '').trim();

  return {
    latitude: Number(lat),
    longitude: Number(lon),
    city,
    state,
    region,
    neighborhood,
    zipCode,
    addressReference,
    country: (geocoding.country || '').trim(),
    label: displayName || [neighborhood, city, state].filter(Boolean).join(' - '),
    displayName: displayName || [addressReference, neighborhood, city, state].filter(Boolean).join(', '),
  };
}

module.exports = reverseGeocode;
