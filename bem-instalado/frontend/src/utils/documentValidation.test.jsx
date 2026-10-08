import { describe, expect, it } from 'vitest';
import { formatDocument, isValidDocument, normalizeDocument } from '../../../shared/documents.mjs';
import { installmentInfo, installmentAmountLabel, installmentConditionsLabel, paymentOptionsLabel } from '../../../shared/installmentTerms.mjs';

describe('documentos do cliente', () => {
  it.each(['00000000000', '11111111111', '52998224724', '529A8224725'])('recusa CPF inválido %s', (value) => expect(isValidDocument(value)).toBe(false));
  it('aceita CPF com dígitos verificadores válidos', () => expect(isValidDocument('529.982.247-25')).toBe(true));
  it('aceita CNPJ numérico e alfanumérico oficial, normalizando letras', () => {
    expect(isValidDocument('11.222.333/0001-81', 'company')).toBe(true);
    expect(isValidDocument('12.abc.345/01de-35', 'company')).toBe(true);
    expect(normalizeDocument('12.abc.345/01de-35')).toBe('12ABC34501DE35');
    expect(formatDocument('12abc34501de35', 'company')).toBe('12.ABC.345/01DE-35');
    expect(isValidDocument('12ABC34501DE34', 'company')).toBe(false);
  });
});
it('prévia e resumo anunciam o valor base sem recalcular juros', () => {
  const terms = installmentInfo({ total_amount: 200, installment_enabled: true, installments_count: 6, interest_free_installments: 3, installment_interest_rate: 5 });
  expect(installmentAmountLabel(terms)).toContain('33,33 (valor base)');
  expect(installmentConditionsLabel(terms)).toContain('Juros calculados pela operadora');
});

it.each([
  [true, false, '3x no cartão'],
  [true, true, '3x + à vista'],
  [false, true, 'À vista'],
  [false, false, 'Não informado'],
])('a confirmação só anuncia as formas selecionadas: parcelado=%s, à vista=%s', (enabled, hasUpfront, label) => {
  expect(paymentOptionsLabel({ enabled, count: 3 }, hasUpfront)).toBe(label);
});
