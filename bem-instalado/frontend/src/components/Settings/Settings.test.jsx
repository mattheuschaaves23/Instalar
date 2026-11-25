// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import api from '../../services/api';
import { resetSitePreferences } from '../../utils/sitePreferences';
import { AdminWorkspace } from '../Admin/AdminWorkspace';
import Settings from './Settings';

const mocks = vi.hoisted(() => ({ isAdmin: false, isPro: false, confirm: vi.fn(), logout: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 515, is_admin: mocks.isAdmin, account_type: 'installer' }, logout: mocks.logout }),
}));
vi.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({ isPro: mocks.isPro, loading: false, subscription: { plan: mocks.isPro ? 'pro' : 'free' } }),
}));
vi.mock('../../contexts/ConfirmContext', () => ({ useConfirm: () => mocks.confirm }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), delete: vi.fn() } }));

function open(path = '/settings', withAdminMenu = false) {
  const content = <Settings />;
  return render(<MemoryRouter initialEntries={[path]}>{withAdminMenu ? <AdminWorkspace>{content}</AdminWorkspace> : content}</MemoryRouter>);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.isAdmin = false;
  mocks.isPro = false;
  mocks.confirm.mockResolvedValue(false);
  resetSitePreferences();
});
afterEach(() => {
  cleanup();
  resetSitePreferences();
});

describe('configurações do InstalarPro', () => {
  it('mostra a entrada ativa no menu ADM e os atalhos das seis seções', () => {
    mocks.isAdmin = true;
    open('/settings?aba=exclusao', true);
    const main = within(screen.getByRole('navigation', { name: 'Áreas administrativas' }));
    const sub = within(screen.getByRole('navigation', { name: 'Seções de configurações' }));
    expect(main.getByRole('link', { name: 'Configurações' }).getAttribute('aria-current')).toBe('page');
    expect(sub.getAllByRole('link')).toHaveLength(6);
    expect(sub.getByRole('link', { name: 'Exclusão' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('Conta administrativa protegida')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Excluir minha conta' })).toBeNull();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('aplica tema e animações imediatamente e permite restaurar o padrão', () => {
    open('/settings?aba=tema');
    const nav = within(screen.getByRole('navigation', { name: 'Seções de configurações' }));
    fireEvent.click(screen.getByRole('radio', { name: /^Escuro/ }));
    expect(document.documentElement.dataset.siteTheme).toBe('dark');
    fireEvent.click(nav.getByRole('link', { name: 'Animações' }));
    fireEvent.click(screen.getByRole('radio', { name: /^Reduzidas/ }));
    expect(document.documentElement.dataset.siteMotion).toBe('reduced');
    fireEvent.click(nav.getByRole('link', { name: 'Geral' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar padrão' }));
    expect(document.documentElement.dataset.siteTheme).toBe('light');
    expect(document.documentElement.dataset.siteMotion).toBe('smooth');
  });

  it('deixa o modo compacto visível e bloqueado no plano Grátis', () => {
    open('/settings?aba=espacamento');
    expect(screen.getByRole('radio', { name: /^Compacto/ }).disabled).toBe(true);
    expect(screen.getByRole('link', { name: 'Ver plano Pro' }).getAttribute('href')).toBe('/subscription');
  });

  it('aplica a densidade compacta quando o plano Pro está ativo', () => {
    mocks.isPro = true;
    open('/settings?aba=espacamento');
    fireEvent.click(screen.getByRole('radio', { name: /^Compacto/ }));
    expect(document.documentElement.dataset.siteDensity).toBe('compact');
  });

  it('mostra apenas JSON em Meus dados e não baixa sem ação do usuário', () => {
    open('/settings?aba=meus-dados');
    expect(screen.getByText('JSON')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Baixar meus dados' })).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('mantém a confirmação explícita para exclusão de conta comum e respeita o cancelamento', async () => {
    open('/settings?aba=exclusao');
    const button = screen.getByRole('button', { name: 'Excluir minha conta' });
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: /Para confirmar, digite/ }), { target: { value: 'EXCLUIR' } });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledOnce());
    expect(api.delete).not.toHaveBeenCalled();
    expect(mocks.logout).not.toHaveBeenCalled();
  });
});
