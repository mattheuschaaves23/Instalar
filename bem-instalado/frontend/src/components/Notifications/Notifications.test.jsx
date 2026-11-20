// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import api from '../../services/api';
import Notifications from './Notifications';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));
vi.mock('../Layout/panelBadgeCounts', () => ({ notifyPanelBadgeCountsChanged: vi.fn() }));
vi.mock('../../services/webPushNotifications', () => ({
  getWebPushSupport: vi.fn(() => ({ supported: true, enabled: false })),
  webPushStatusMessage: vi.fn(() => 'Ative os avisos para receber atualizações.'),
  registerWebPushNotifications: vi.fn(async () => ({ permission: 'granted', enabled: true })),
}));

const records = [
  { id: 4, title: 'Pedido direto recebido', message: 'Você recebeu o pedido #32 pelo link do seu perfil.', type: 'info', read: false, created_at: new Date().toISOString(), action_path: '/opportunities' },
  { id: 3, title: 'Você foi escolhido', message: 'O rascunho do orçamento está pronto.', type: 'success', read: false, created_at: new Date().toISOString(), action_path: '/budgets/18/complete' },
  { id: 2, title: 'Orçamento aprovado', message: 'O orçamento #1041 foi aprovado.', type: 'success', read: true, created_at: '2020-01-01T12:00:00Z' },
  { id: 1, title: 'Instalação agendada', message: 'Confira os detalhes.', type: 'info', read: true, created_at: '2020-01-01T12:00:00Z' },
];
const open = () => render(<MemoryRouter><Notifications /></MemoryRouter>);

beforeEach(() => {
  api.get.mockReset().mockResolvedValue({ data: records });
  api.put.mockReset().mockResolvedValue({ data: { success: true } });
});
afterEach(cleanup);

it('agrupa por data, destaca não lidas e oferece destinos específicos a partir dos avisos', async () => {
  open();
  const today = within(await screen.findByRole('region', { name: 'Hoje' }));
  expect(today.getByRole('link', { name: 'Ver pedido' }).getAttribute('href')).toBe('/opportunities?pedido=32');
  expect(today.getByRole('link', { name: 'Abrir rascunho' }).getAttribute('href')).toBe('/budgets/18/complete');
  const earlier = within(screen.getByRole('region', { name: 'Anteriores' }));
  expect(earlier.getByRole('link', { name: 'Ver orçamento' }).getAttribute('href')).toBe('/budgets?orcamento=1041');
  expect(earlier.getByRole('link', { name: 'Ver agenda' }).getAttribute('href')).toBe('/agenda');
  expect(screen.getByRole('button', { name: /Não lidas/ }).textContent).toContain('2');
});

it('combina filtro de leitura e categoria, e atualiza a tela ao marcar tudo como lido', async () => {
  open();
  await screen.findByText('Pedido direto recebido');
  fireEvent.click(screen.getByRole('button', { name: /Não lidas/ }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por tipo' }), { target: { value: 'orders' } });
  expect(screen.getByText('Pedido direto recebido')).toBeTruthy();
  expect(screen.queryByText('Você foi escolhido')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Marcar todas como lidas' }));
  expect(await screen.findByText('Nenhuma notificação não lida neste filtro.')).toBeTruthy();
  expect(api.put).toHaveBeenCalledWith('/notifications/read-all');
  fireEvent.click(screen.getByRole('button', { name: 'Lidas' }));
  expect(screen.getByText('Pedido direto recebido')).toBeTruthy();
});

it('mantém status de leitura quando o servidor recusa a ação', async () => {
  api.put.mockRejectedValueOnce(new Error('offline'));
  open();
  await screen.findByText('Pedido direto recebido');
  fireEvent.click(screen.getByRole('button', { name: 'Marcar Pedido direto recebido como lida' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível atualizar');
  expect(screen.getByRole('button', { name: /Não lidas/ }).textContent).toContain('2');
});

it('não usa destinos externos mesmo se vierem na resposta da API', async () => {
  api.get.mockResolvedValueOnce({ data: [{ ...records[0], title: 'Aviso do sistema', action_path: 'https://example.test/out' }] });
  open();
  await screen.findByText('Aviso do sistema');
  expect(screen.queryByRole('link')).toBeNull();
});

it('esconde o controle de push em Preferências e só ativa após clique', async () => {
  open();
  expect(screen.queryByRole('button', { name: 'Ativar notificações' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Preferências' }));
  fireEvent.click(screen.getByRole('button', { name: 'Ativar notificações' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ativado neste navegador' }).disabled).toBe(true));
});
