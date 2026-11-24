// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import api from '../../services/api';
import Budgets from './Budgets';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));
vi.mock('../../contexts/SubscriptionContext', () => ({ useSubscription: () => ({ isPro: true }) }));
vi.mock('../Layout/panelBadgeCounts', () => ({ notifyPanelBadgeCountsChanged: vi.fn() }));

const records = [
  { id: 1042, client_name: 'Mariana Silva', created_at: '2026-11-20T12:00:00Z', status: 'draft', source_request_status: 'selected', total_amount: 0 },
  { id: 1041, client_name: 'Rafael Costa', created_at: '2026-11-18T12:00:00Z', status: 'pending', total_amount: 450 },
  { id: 1038, client_name: 'Ana Ribéiro', created_at: '2026-11-15T12:00:00Z', status: 'approved', total_amount: 800 },
  { id: 1034, client_name: 'Pedro Lima', created_at: '2026-11-12T12:00:00Z', status: 'rejected', total_amount: 1250 },
];

const table = () => within(screen.getByRole('table', { name: 'Lista de orçamentos' }));
const open = async () => {
  render(<MemoryRouter><Budgets /></MemoryRouter>);
  await screen.findByRole('table');
};

beforeEach(() => {
  api.get.mockReset().mockResolvedValue({ data: records });
  api.put.mockReset().mockResolvedValue({ data: {} });
});

afterEach(cleanup);

describe('lista de orçamentos', () => {
  it('abre com o orçamento indicado no link do aviso', async () => {
    api.get.mockResolvedValueOnce({ data: [...records, { ...records[1], id: 10410, client_name: 'Outro orçamento' }] });
    render(<MemoryRouter initialEntries={['/budgets?orcamento=1041']}><Budgets /></MemoryRouter>);
    await screen.findByRole('table');
    expect(screen.getByRole('searchbox').value).toBe('#1041');
    expect(table().getByText('Rafael Costa')).toBeTruthy();
    expect(table().queryByText('Pedro Lima')).toBeNull();
    expect(table().queryByText('Outro orçamento')).toBeNull();
  });
  it('preserva dados e ações reais e não mostra R$ 0,00 no rascunho', async () => {
    await open();
    expect(api.get).toHaveBeenCalledWith('/budgets', { params: { include_drafts: true } });
    expect(screen.getByRole('link', { name: 'Novo orçamento' }).getAttribute('href')).toBe('/budgets/new');
    const draft = within(table().getByRole('row', { name: /Mariana Silva/ }));
    expect(draft.getByRole('link', { name: 'Completar orçamento' }).getAttribute('href')).toBe('/budgets/1042/complete');
    expect(draft.queryByText(/R\$/)).toBeNull();
    expect(draft.queryByRole('button', { name: /PDF|WhatsApp|Mais ações/ })).toBeNull();
  });

  it('sincroniza abas e seletor, busca sem acento e aceita número com #', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: /Rascunhos/ }));
    expect(screen.getByRole('combobox', { name: 'Filtrar por status' }).value).toBe('draft');
    expect(table().queryByText('Pedro Lima')).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por status' }), { target: { value: 'approved' } });
    expect(screen.getByRole('button', { name: /Aprovados/ }).getAttribute('aria-pressed')).toBe('true');
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: 'ana ribeiro' } });
    expect(table().getByText('Ana Ribéiro')).toBeTruthy();
    fireEvent.change(search, { target: { value: '#1041' } });
    expect(screen.getByText('Nenhum orçamento encontrado.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    fireEvent.change(search, { target: { value: '#1041' } });
    expect(table().getByText('Rafael Costa')).toBeTruthy();
    expect(table().queryByText('Ana Ribéiro')).toBeNull();
  });

  it('ordena por valor com rascunhos ao final e abre aprovação sem gravar no clique', async () => {
    await open();
    fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar orçamentos' }), { target: { value: 'highest' } });
    const rows = table().getAllByRole('row');
    expect(rows[1].textContent).toContain('Pedro Lima');
    expect(rows.at(-1).textContent).toContain('Mariana Silva');
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar e agendar' }));
    expect(screen.getByRole('dialog', { name: 'Agendar instalação' })).toBeTruthy();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('filtra pelo mês passado e combina o período com busca e status', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 11, 5, 12));
    try {
      api.get.mockResolvedValueOnce({ data: [...records, {
        ...records[1], id: 1045, client_name: 'Cliente de dezembro', created_at: new Date(2026, 11, 1, 0).toISOString(),
      }] });
      await open();
      fireEvent.change(screen.getByRole('combobox', { name: 'Data de criação' }), { target: { value: 'last-month' } });
      expect(table().getByText('Mariana Silva')).toBeTruthy();
      expect(table().queryByText('Cliente de dezembro')).toBeNull();

      fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por status' }), { target: { value: 'pending' } });
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Rafael' } });
      expect(table().getByText('Rafael Costa')).toBeTruthy();
      expect(table().queryByText('Mariana Silva')).toBeNull();
      expect(screen.getByText('1 orçamento')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('inclui o último dia do período, avisa quando as datas estão invertidas e limpa o filtro', async () => {
    api.get.mockResolvedValueOnce({ data: [
      { ...records[0], created_at: new Date(2026, 10, 19, 23, 59).toISOString() },
      { ...records[1], created_at: new Date(2026, 10, 20, 0).toISOString() },
    ] });
    await open();
    const period = screen.getByRole('combobox', { name: 'Data de criação' });
    fireEvent.change(period, { target: { value: 'custom' } });
    const start = screen.getByLabelText('De');
    const end = screen.getByLabelText('Até');
    fireEvent.change(start, { target: { value: '2026-11-19' } });
    fireEvent.change(end, { target: { value: '2026-11-18' } });
    expect(end.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('A data final não pode ser anterior à inicial.')).toBeTruthy();
    fireEvent.change(end, { target: { value: '2026-11-19' } });
    expect(end.getAttribute('aria-invalid')).toBeNull();
    expect(table().getByText('Mariana Silva')).toBeTruthy();
    expect(table().queryByText('Rafael Costa')).toBeNull();

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '#1041' } });
    expect(screen.getByText('Nenhum orçamento encontrado.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(period.value).toBe('all');
    expect(screen.queryByLabelText('Até')).toBeNull();
    expect(table().getByText('Rafael Costa')).toBeTruthy();
  });

  it('mostra ações secundárias e devolve o foco ao fechar com Escape', async () => {
    await open();
    const trigger = screen.getByRole('button', { name: 'Mais ações do orçamento #1041' });
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Enviar no WhatsApp' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rejeitar' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Rejeitar' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('não confunde falha no carregamento com uma lista vazia e permite tentar novamente', async () => {
    api.get.mockRejectedValueOnce(new Error('offline'));
    render(<MemoryRouter><Budgets /></MemoryRouter>);
    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível carregar orçamentos.');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(table().getByText('Mariana Silva')).toBeTruthy();
  });
});
