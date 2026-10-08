import { describe, it, expect } from 'vitest';
import { EMPTY_MANUAL_ADDRESS, isPostalQuery, postalDigits, buildManualLocation, manualAddressFromLocation, manualAddressFromQuery, validateManualAddress } from './requestAddress';

describe('endereço de instalação', () => {
  const address = { ...EMPTY_MANUAL_ADDRESS, street: 'Rua Turquesa', city: 'Palhoça', state: 'SC' };
  it('reconhece CEP inteiro, com máscara ou prefixo', () => {
    expect(isPostalQuery('88137620')).toBe(true);
    expect(isPostalQuery('CEP: 88137-620')).toBe(true);
    expect(isPostalQuery('88137')).toBe(false);
    expect(isPostalQuery('Rua 88137620')).toBe(false);
    expect(postalDigits('88137-620')).toBe('88137620');
  });
  it('permite ruas fora do mapa sem inventar coordenadas e sem exigir CEP ou número', () => {
    expect(buildManualLocation(address)).toMatchObject({ latitude: null, longitude: null, source: 'manual', zipCode: '', houseNumber: '', city: 'Palhoça', state: 'SC' });
    expect(buildManualLocation({ street: 'Estrada sem cadastro', city: 'Palhoça', state: 'SC' }).label).toBe('Estrada sem cadastro');
  });
  it('preserva rua, número e complemento ao voltar para editar', () => {
    const complete = { ...address, number: '120', complement: 'Bloco A', neighborhood: 'Bela Vista', zipCode: '88137620' };
    const location = buildManualLocation(complete);
    expect(location.addressReference).toBe('Rua Turquesa, 120, Bloco A');
    expect(location.zipCode).toBe('88137-620');
    expect(manualAddressFromLocation(location)).toEqual({ ...complete, zipCode: '88137-620' });
  });
  it('exige rua, cidade e UF e verifica CEP opcional', () => {
    expect(validateManualAddress(address)).toBe('');
    expect(() => buildManualLocation({ ...address, street: '' })).toThrow(/rua/);
    expect(() => buildManualLocation({ ...address, city: '' })).toThrow(/cidade/);
    expect(() => buildManualLocation({ ...address, state: 'XX' })).toThrow(/estado/);
    expect(() => buildManualLocation({ ...address, zipCode: '88137' })).toThrow(/CEP/);
  });
  it('reaproveita o endereço digitado sem trocar a cidade pela região anterior', () => {
    expect(manualAddressFromQuery('Rua Flores, 120, Curitiba, PR', { city: 'Palhoça', state: 'SC' }))
      .toMatchObject({ street: 'Rua Flores', number: '120', city: 'Curitiba', state: 'PR' });
    expect(manualAddressFromQuery('88137620')).toMatchObject({ zipCode: '88137620', street: '' });
  });
});
