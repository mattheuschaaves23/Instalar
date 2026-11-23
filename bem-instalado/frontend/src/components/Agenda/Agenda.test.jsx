// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import api from '../../services/api';
import Agenda from './Agenda';
import { useConfirm } from '../../contexts/ConfirmContext';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../../contexts/ConfirmContext', () => ({ useConfirm: vi.fn() }));
vi.mock('../Layout/panelBadgeCounts', () => ({ notifyPanelBadgeCountsChanged: vi.fn() }));

HTMLDialogElement.prototype.showModal ??= function showModal() { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function close() {
  this.removeAttribute('open');
  this.dispatchEvent(new Event('close'));
};

const today = new Date(2026, 10, 23, 18);
const makeItem = (id, name, date, fields = {}) => ({
  id, client_name: name, date: date.toISOString(), title: 'Instalação de papel de parede',
  status: 'scheduled', source: 'manual', ...fields,
});
const appointments = [
  makeItem(1, 'Rafael Costa', new Date(2026, 10, 23, 14, 30)),
  makeItem(2, 'Ana Ribeiro', new Date(2026, 10, 23, 9), {
    destination: { city: 'São José', state: 'SC', full_address: 'Rua de Teste, 15', reference: 'Portão azul' },
    route_links: { google_maps: 'https://www.google.com/maps/dir/?api=1&destination=teste', waze: 'https://waze.com/ul?q=teste' },
  }),
  makeItem(3, 'Instalação cancelada', new Date(2026, 10, 24, 9), { status: 'canceled' }),
  makeItem(4, 'João de Teste', new Date(2026, 11, 1, 10), { source: 'marketplace' }),
];

const open = () => render(<MemoryRouter initialEntries={['/agenda']}><Agenda /></MemoryRouter>);
const day = (name) => screen.getByRole('button', { name });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(today);
  vi.resetAllMocks();
  vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(false));
  api.get.mockResolvedValue({ data: appointments });
  api.put.mockResolvedValue({ data: {} });
  api.delete.mockResolvedValue({ data: {} });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('seleciona hoje e exibe as instalações por horário', async () => {
  open();
  const list = await screen.findByRole('list', { name: 'Instalações do dia' });
  expect(screen.getByRole('heading', { name: 'Segunda-feira, 23 de novembro' })).toBeTruthy();
  expect(within(list).getAllByRole('heading').map((node) => node.textContent)).toEqual(['Ana Ribeiro', 'Rafael Costa']);
  const selected = day(/23 de novembro de 2026/);
  expect(selected.getAttribute('aria-current')).toBe('date');
  expect(selected.getAttribute('aria-pressed')).toBe('true');
  expect(selected.getAttribute('aria-label')).toContain('2 instalações');
  expect(screen.getByRole('link', { name: 'Criar orçamento' }).getAttribute('href')).toBe('/budgets/new');
});

it('abre o próximo compromisso no mês correto e permite voltar a hoje', async () => {
  open();
  fireEvent.click(await screen.findByRole('button', { name: /Próximo compromisso.*10:00/ }));
  expect(screen.getByRole('heading', { name: 'Dezembro de 2026' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'João de Teste' })).toBeTruthy();
  fireEvent.click(day('Hoje'));
  fireEvent.click(day('Mês anterior'));
  expect(screen.getByRole('heading', { name: 'Outubro de 2026' })).toBeTruthy();
  fireEvent.click(day('Próximo mês'));
  expect(screen.getByRole('heading', { name: 'Novembro de 2026' })).toBeTruthy();
  fireEvent.click(day(/25 de novembro de 2026/));
  expect(screen.getByText(/Nenhuma instalação neste dia/)).toBeTruthy();
});

it('mantém endereço, rotas e conclusão no detalhe do agendamento', async () => {
  open();
  fireEvent.click(await screen.findByRole('button', { name: 'Ver endereço de Ana Ribeiro' }));
  const dialog = screen.getByRole('dialog', { name: 'Ana Ribeiro' });
  expect(within(dialog).getByText('Portão azul')).toBeTruthy();
  expect(within(dialog).getByRole('link', { name: 'Abrir no Waze' }).getAttribute('href')).toContain('waze.com');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Concluir' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/schedules/2/status', { status: 'completed' }));
  expect(await screen.findByText('Concluído')).toBeTruthy();
});

it('pede confirmação antes de excluir um agendamento', async () => {
  open();
  const confirm = vi.mocked(useConfirm).getMockImplementation()();
  const action = await screen.findByRole('button', { name: 'Ver detalhes de Rafael Costa' });
  const remove = () => {
    fireEvent.click(action);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }));
  };
  remove();
  await waitFor(() => expect(confirm).toHaveBeenCalled());
  expect(api.delete).not.toHaveBeenCalled();
  confirm.mockResolvedValueOnce(true);
  remove();
  await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/schedules/1'));
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Rafael Costa' })).toBeNull());
});

it('distingue falha ao carregar de um dia sem compromissos e permite tentar novamente', async () => {
  api.get.mockRejectedValueOnce(new Error('offline'));
  open();
  expect((await screen.findByRole('alert')).textContent).toBe('Não foi possível carregar a agenda.');
  expect(screen.queryByText(/Nenhuma instalação neste dia/)).toBeNull();
  fireEvent.click(day('Tentar novamente'));
  expect(await screen.findByRole('heading', { name: 'Ana Ribeiro' })).toBeTruthy();
});
