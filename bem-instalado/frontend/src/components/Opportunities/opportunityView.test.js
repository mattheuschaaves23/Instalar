import { describe, expect, it } from 'vitest';
import { formatOpportunityDate, getOpportunityArea, getOpportunityState, getOpportunityTitle, mergeOpportunityPage } from './opportunityView';

describe('organização das oportunidades', () => {
  it('mantém os estados reais de interesse, escolha e encerramento', () => {
    expect(getOpportunityState({ status: 'open' }).key).toBe('new');
    expect(getOpportunityState({ status: 'open', interested_by_me: true }).key).toBe('waiting');
    expect(getOpportunityState({ status: 'selected', selected_by_me: true }).key).toBe('selected');
    expect(getOpportunityState({ status: 'accepted', selected_by_me: true }).label).toBe('Agendado');
    expect(getOpportunityState({ status: 'in_progress', selected_by_me: true }).label).toBe('Em andamento');
    expect(getOpportunityState({ status: 'completed', selected_by_me: true }).key).toBe('completed');
    expect(getOpportunityState({ status: 'selected', not_selected: true }).key).toBe('not-selected');
    expect(getOpportunityState({ status: 'expired', interested_by_me: true }).key).toBe('expired');
    expect(getOpportunityState({ status: 'canceled', selected_by_me: true }).key).toBe('canceled');
  });
  it('não inventa área, título, data ou foto quando o cliente não informou', () => {
    expect(getOpportunityArea({})).toBe('Medidas a combinar');
    expect(getOpportunityArea({ measurement_detail: '2 paredes, 12 m²' })).toBe('2 paredes, 12 m²');
    expect(getOpportunityArea({ roll_count: 3 })).toBe('3 rolos');
    expect(getOpportunityTitle({ service_label: 'Remoção', rooms: ['Quarto'] })).toBe('Remoção · Quarto');
    expect(formatOpportunityDate('inválida')).toBe('Data não informada');
    expect(formatOpportunityDate('2026-11-17T12:00:00Z', Date.parse('2026-11-17T12:20:00Z'))).toBe('há 20 minutos');
  });
  it('a paginação não duplica pedidos nem restaura versões antigas dos dados', () => {
    expect(mergeOpportunityPage([{ id: 1, status: 'open' }, { id: 2 }], [{ id: 1, status: 'selected' }, { id: 3 }])).toEqual([
      { id: 1, status: 'selected' }, { id: 2 }, { id: 3 },
    ]);
  });
});
