import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';

const fixture = vi.hoisted(() => ({ isAdmin: false }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 999999, is_admin: fixture.isAdmin } }),
}));
vi.mock('../../contexts/ConfirmContext', () => ({ useConfirm: () => vi.fn() }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import SupportChat from './SupportChat';

describe('primeira renderização do suporte', () => {
  it.each([false, true])('mostra o conteúdo antes de buscar os dados (administrador: %s)', (isAdmin) => {
    fixture.isAdmin = isAdmin;
    const markup = renderToStaticMarkup(<MemoryRouter><SupportChat /></MemoryRouter>);
    expect(markup).toContain(isAdmin ? 'Responda às conversas e acompanhe sugestões.' : 'Suporte direto com o administrador');
    expect(markup).toContain(isAdmin ? 'ip-admin-chat-compose' : 'support-compose');
    expect(markup).not.toContain('wall-loader');
    expect(markup).not.toContain('A transformação já começou');
    expect(markup).not.toContain('Ainda não há mensagens.');
  });
});
