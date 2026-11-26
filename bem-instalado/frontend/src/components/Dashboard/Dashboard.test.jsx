// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import api from '../../services/api';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PANEL_BADGE_REFRESH_EVENT } from '../Layout/panelBadgeCounts';
import Dashboard from './Dashboard';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 71, name: 'Instalador Teste', account_type: 'installer' } }),
}));
vi.mock('../../contexts/SubscriptionContext', () => ({ useSubscription: vi.fn() }));
vi.mock('../../contexts/NotificationContext', () => ({ useNotifications: () => ({ notifications: [] }) }));

const november = { month: '2026-11', revenue: '3250.00', approved: 2, pending: 1, rejected: 1, installations: 5 };
const october = { month: '2026-10', revenue: '975.50', approved: 1, pending: 0, rejected: 0, installations: 2 };
const upcoming = [{ id: 'manual-2', date: '2026-11-26T14:00:00Z', client_name: 'Cliente fictício' }];
let response;
let offline;
let ads;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSubscription).mockReturnValue({ isPro: true });
  response = { month: '2026-11', months: [october, november], upcoming };
  offline = false;
  ads = [];
  api.get.mockImplementation(async (path) => {
    if (path === '/users/dashboard-overview') {
      if (offline) throw new Error('offline');
      return { data: response };
    }
    if (path === '/opportunities') return { data: { opportunities: [], stats: { open: 3, selected: 1 } } };
    if (path === '/public/dashboard-ads') return { data: { ads } };
    return { data: [] };
  });
});
afterEach(cleanup);

const open = () => render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard /></MemoryRouter>);
const metrics = () => within(screen.getByRole('region', { name: 'Indicadores do mês' }));
const money = (amount) => new RegExp(amount.replace('.', '\\.'));

it('mostra o anúncio patrocinado entre o título e os indicadores do dashboard', async () => {
  ads = [{
    id: 1, title: 'Parceiro de teste', description: 'Materiais para instalação',
    media_type: 'image', media_url: 'https://example.test/banner.png',
    link_url: 'https://example.test/catalogo', cta_label: 'Ver catálogo',
  }];
  open();
  const title = screen.getByRole('heading', { name: 'Dashboard' });
  const ad = await screen.findByRole('complementary', { name: 'Patrocinado' });
  expect(title.compareDocumentPosition(ad) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const indicators = screen.getByRole('region', { name: 'Indicadores do mês' });
  expect(ad.compareDocumentPosition(indicators) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(ad).getByRole('link', { name: 'Ver catálogo' }).getAttribute('href')).toBe('https://example.test/catalogo');
});

it('usa dados da conta para os indicadores e gráficos e permite consultar outro mês', async () => {
  open();
  expect(await metrics().findByText(money('3.250,00'))).toBeTruthy();
  expect(screen.queryByRole('complementary', { name: 'Patrocinado' })).toBeNull();
  expect(metrics().getByText('2 de 4')).toBeTruthy();
  expect(metrics().getByText('50%')).toBeTruthy();
  expect(metrics().getByText('5')).toBeTruthy();
  expect(screen.getByRole('img', { name: /Valores aprovados por mês/ })).toBeTruthy();
  expect(screen.getByText(/Cliente fictício/)).toBeTruthy();
  expect(screen.getByText('3 pedidos disponíveis')).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Orçamentos recentes' })).toBeNull();
  fireEvent.change(screen.getByRole('combobox', { name: 'Mês dos indicadores' }), { target: { value: '2026-10' } });
  expect(metrics().getByText(money('975,50'))).toBeTruthy();
  expect(metrics().getByText('1 de 1')).toBeTruthy();
  expect(metrics().getByText('100%')).toBeTruthy();
  expect(screen.getByText(/Cliente fictício/)).toBeTruthy();
});

it('atualiza sem recarregar a página e distingue dados desatualizados de zero', async () => {
  open();
  await metrics().findByText('2 de 4');
  offline = true;
  fireEvent(window, new Event(PANEL_BADGE_REFRESH_EVENT));
  expect(await screen.findByText(/últimos dados disponíveis/i)).toBeTruthy();
  expect(metrics().getByText('2 de 4')).toBeTruthy();
  offline = false;
  response = { ...response, months: [{ ...november, approved: 3, pending: 0 }] };
  fireEvent(window, new Event(PANEL_BADGE_REFRESH_EVENT));
  expect(await metrics().findByText('3 de 4')).toBeTruthy();
  expect(screen.queryByText(/últimos dados disponíveis/i)).toBeNull();
});

it('refreshes visible data on an interval without showing a fabricated zero at first', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  try {
    open();
    expect(metrics().queryByText('0 de 0')).toBeNull();
    await metrics().findByText('2 de 4');
    response = { ...response, months: [{ ...november, approved: 0, pending: 0, rejected: 0, revenue: 0 }] };
    await vi.advanceTimersByTimeAsync(30_000);
    await waitFor(() => expect(metrics().getByText('0 de 0')).toBeTruthy());
    expect(screen.getByText('Nenhuma proposta neste mês.')).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});

it('mantém os gráficos como recurso Pro', async () => {
  vi.mocked(useSubscription).mockReturnValue({ isPro: false, planAccess: { limits: { monthly_budgets: 5 } } });
  open();
  expect(await metrics().findByText('2 de 4')).toBeTruthy();
  expect(screen.queryByRole('img', { name: /Valores aprovados por mês/ })).toBeNull();
  expect(screen.getByRole('link', { name: 'Ver plano Pro' }).getAttribute('href')).toBe('/subscription');
});
