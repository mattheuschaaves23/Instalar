const contract = require('../../shared/directQuoteDetails.json');
const { normalizePostalCode } = require('./postalAddress');

const text = (value) => typeof value === 'string' ? value.trim() : '';
const boundedNumber = (value, max) => typeof value === 'number' && Number.isFinite(value) && value >= 0.01 && value <= max;

function normalizeDirectQuoteDetails(input) {
  // Older clients may still send the original short form.
  if (input === undefined) return { value: null };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Confira os dados do orçamento.' };
  const clientEmail = text(input.client_email);
  const street = text(input.street);
  const houseNumber = text(input.house_number);
  const neighborhood = text(input.neighborhood);
  const zip = text(input.zip_code);
  const zipCode = zip ? normalizePostalCode(zip) : null;
  const reference = text(input.address_reference);
  if (clientEmail && (clientEmail.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail))) {
    return { error: 'Informe um e-mail válido ou deixe o campo em branco.' };
  }
  if (street.length < 2 || street.length > 160 || !houseNumber || houseNumber.length > 30 ||
      !neighborhood || neighborhood.length > 120 || (zip && !zipCode) || reference.length > 300) {
    return { error: 'Confira a rua, o número, o bairro e o CEP da instalação.' };
  }
  const placeType = text(input.place_type);
  const materialType = text(input.material_type);
  if (!Object.hasOwn(contract.places, placeType) || !Object.hasOwn(contract.materials, materialType)) {
    return { error: 'Selecione o tipo de local e de papel de parede.' };
  }
  if (!Array.isArray(input.environments) || !input.environments.length || input.environments.length > contract.maxEnvironments) {
    return { error: 'Informe ao menos um ambiente da instalação.' };
  }
  const environments = [];
  for (const room of input.environments) {
    const name = text(room?.name);
    const { width = null, height = null, rolls = null, removal } = room || {};
    if (!name || name.length > 80 || !contract.removalOptions.includes(removal) ||
        [width, height].some((value) => value !== null && !boundedNumber(value, contract.maxDimension)) ||
        (rolls !== null && (!Number.isInteger(rolls) || !boundedNumber(rolls, contract.maxRolls)))) {
      return { error: 'Confira o nome, as medidas e a quantidade de rolos de cada ambiente.' };
    }
    environments.push({ name, width, height, rolls, removal });
  }
  return { value: {
    clientEmail: clientEmail || null, neighborhood, zipCode, reference: reference || null,
    placeType, placeLabel: contract.places[placeType],
    materialType, materialLabel: contract.materials[materialType],
    privateDetails: { street, house_number: houseNumber, environments },
  } };
}

module.exports = { normalizeDirectQuoteDetails };
