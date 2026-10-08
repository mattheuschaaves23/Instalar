// CNPJ uses the same check-digit rule for numeric and alphanumeric documents.
// Receita Federal: ASCII value minus 48 for each of the first twelve characters.
export function normalizeDocument(value) {
  return String(value ?? '').replace(/[.\/\-\s]/g, '').toUpperCase();
}

export function isValidDocument(value, clientType = 'person') {
  const document = normalizeDocument(value);
  if (clientType === 'company') {
    if (!/^[A-Z0-9]{12}\d{2}$/.test(document) || /^(\d)\1{13}$/.test(document)) return false;
    const numbers = Array.from(document, (character) => character.charCodeAt(0) - 48);
    const digit = (length, weights) => {
      const remainder = numbers.slice(0, length).reduce((sum, number, index) => sum + number * weights[index], 0) % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };
    return numbers[12] === digit(12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
      && numbers[13] === digit(13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  }
  if (!/^\d{11}$/.test(document) || /^(\d)\1{10}$/.test(document)) return false;
  const numbers = Array.from(document, Number);
  const digit = (length) => {
    const remainder = numbers.slice(0, length).reduce((sum, number, index) => sum + number * (length + 1 - index), 0) % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return numbers[9] === digit(9) && numbers[10] === digit(10);
}

export function formatDocument(value, clientType = 'person') {
  const company = clientType === 'company';
  const document = normalizeDocument(value).replace(company ? /[^A-Z0-9]/g : /\D/g, '').slice(0, company ? 14 : 11);
  const groups = company ? [2, 3, 3, 4, 2] : [3, 3, 3, 2];
  const separators = company ? ['.', '.', '/', '-'] : ['.', '.', '-'];
  let offset = 0;
  return groups.map((length, index) => {
    const part = document.slice(offset, offset + length);
    offset += length;
    return part ? `${index ? separators[index - 1] : ''}${part}` : '';
  }).join('');
}
