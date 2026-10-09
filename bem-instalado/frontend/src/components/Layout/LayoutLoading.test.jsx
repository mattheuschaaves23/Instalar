import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';

vi.mock('react-router', async (importOriginal) => ({
  ...await importOriginal(),
  Outlet: () => { throw new Promise(() => {}); },
}));
vi.mock('./InstallerPanelShell', () => ({
  default: ({ children }) => <section><nav>Menu preservado</nav><header>Cabeçalho preservado</header>{children}</section>,
}));
vi.mock('../Auth/EmailVerification', () => ({ EmailVerificationNotice: () => null }));
vi.mock('./DecoratingWallLoader', () => ({
  default: ({ embedded }) => <div role="status">{embedded ? 'Carregando apenas conteúdo' : 'Tela inteira'}</div>,
}));

import Layout from './Layout';

describe('navegação do painel enquanto baixa uma página', () => {
  it('mantém menu e cabeçalho fora da área suspensa', () => {
    const markup = renderToString(<MemoryRouter initialEntries={['/agenda']}><Layout /></MemoryRouter>);
    expect(markup).toContain('Menu preservado');
    expect(markup).toContain('Cabeçalho preservado');
    expect(markup).toContain('Carregando apenas conteúdo');
    expect(markup).not.toContain('Tela inteira');
  });
});
