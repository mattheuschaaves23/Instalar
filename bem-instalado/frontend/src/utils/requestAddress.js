export const BRAZIL_STATE_OPTIONS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
export const EMPTY_MANUAL_ADDRESS = { zipCode: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' };

export function postalDigits(value) { return String(value || '').replace(/\D/g, ''); }
export function isPostalQuery(value) { return /^(?:cep\s*:?\s*)?\d{5}[\s-]?\d{3}$/i.test(String(value || '').trim()); }
export function addressSearchKey(query, region = {}) {
  return [query.trim().toLowerCase(), region.city || '', region.state || ''].join('|');
}

export function manualAddressFromLocation(location) {
  return { ...EMPTY_MANUAL_ADDRESS, zipCode: location.zipCode || '',
    street: location.street || location.addressReference || '', number: location.houseNumber || '', complement: location.complement || '',
    neighborhood: location.neighborhood || '', city: location.city || '', state: location.state || '' };
}

export function manualAddressFromQuery(query, region = {}) {
  const value = String(query || '').trim();
  const address = { ...EMPTY_MANUAL_ADDRESS, city: region.city || '', state: region.state || '' };
  if (/^(?:cep\s*:?\s*)?[\d\s-]+$/i.test(value)) {
    address.zipCode = postalDigits(value).slice(0, 8);
    return address;
  }
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3 && BRAZIL_STATE_OPTIONS.includes(parts.at(-1).toUpperCase())) {
    address.state = parts.pop().toUpperCase();
    address.city = parts.pop();
    if (parts.length > 1 && /^\d+[a-z]?$/i.test(parts.at(-1))) address.number = parts.pop();
    address.street = parts.join(', ');
  } else address.street = value;
  return address;
}

export function validateManualAddress(address) {
  if (String(address.street || '').trim().length < 3) return 'Informe a rua ou uma referência do local com pelo menos 3 caracteres.';
  if (String(address.city || '').trim().length < 2) return 'Informe a cidade da instalação.';
  if (!BRAZIL_STATE_OPTIONS.includes(address.state)) return 'Selecione o estado da instalação.';
  if (address.zipCode && postalDigits(address.zipCode).length !== 8) return 'Confira o CEP: use 8 números ou deixe o campo vazio.';
  return '';
}

export function buildManualLocation(address) {
  const error = validateManualAddress(address);
  if (error) throw new Error(error);
  const street = address.street.trim();
  const city = address.city.trim();
  const neighborhood = String(address.neighborhood || '').trim();
  const reference = [street, String(address.number || '').trim(), String(address.complement || '').trim()].filter(Boolean).join(', ');
  const digits = postalDigits(address.zipCode);
  const zipCode = digits ? `${digits.slice(0, 5)}-${digits.slice(5)}` : '';
  return { latitude: null, longitude: null, source: 'manual', precision: 'manual',
    street, houseNumber: String(address.number || '').trim(), complement: String(address.complement || '').trim(), addressReference: reference, label: reference,
    city, state: address.state, neighborhood, zipCode,
    displayName: [reference, neighborhood, city, address.state, zipCode].filter(Boolean).join(', ') };
}
