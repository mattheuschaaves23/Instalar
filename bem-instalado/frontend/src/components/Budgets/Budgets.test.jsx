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
