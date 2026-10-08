import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import Home from './Home';

const { authState } = vi.hoisted(() => ({ authState: { user: null, logout: vi.fn() } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../../contexts/NotificationContext', () => ({
  useNotifications: () => ({ notifications: [], refreshNotifications: vi.fn() }),
}));
vi.mock('../../contexts/ConfirmContext', () => ({ useConfirm: () => vi.fn() }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

function renderPage(path = '/cliente') {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><Home /></MemoryRouter>);
}

describe('novo visual do pedido do cliente', () => {
  beforeEach(() => { authState.user = null; });

  it('preserva as etapas e as sete opções, sem a antiga barra de preenchimento', () => {
    const markup = renderPage();
    expect(markup).toContain('client-request-redesign');
    expect(markup).toContain('Encontre um instalador');
    expect(markup).toContain('aria-current="step"');
    expect(markup.match(/aria-pressed="false"/g)).toHaveLength(7);
    for (const label of ['Serviço', 'Detalhes', 'Localização', 'Confirmar']) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain('Você escolhe com quem compartilhar seu contato.');
    expect(markup).not.toContain('client-app-request-score');
  });

  it('mantém os acessos à conta e aos avisos de clientes autenticados', () => {
    authState.user = { id: 1, account_type: 'client', name: 'Cliente de teste' };
    const markup = renderPage();
    expect(markup).toContain('Avisos da conta');
    expect(markup).toContain('href="/cliente/pedidos"');
    expect(markup).toContain('Minha conta');
    expect(markup).toContain('Sair');
  });

  it('não aplica o redesenho nas páginas de histórico e acompanhamento', () => {
    expect(renderPage('/cliente/pedidos')).not.toContain('client-request-redesign');
    expect(renderPage('/cliente/pedido')).not.toContain('client-request-redesign');
  });
});
