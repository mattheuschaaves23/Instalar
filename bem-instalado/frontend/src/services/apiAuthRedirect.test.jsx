import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/safeStorage', () => ({
  clearAuthToken: vi.fn().mockResolvedValue(undefined),
  getAuthToken: vi.fn(() => null),
}));
vi.mock('./sentry', () => ({ captureFrontendException: vi.fn() }));

import api from './api';
import { clearAuthToken, getAuthToken } from '../utils/safeStorage';

const originalWindow = globalThis.window;

function openPage(pathname) {
  const replace = vi.fn();
  globalThis.window = { location: { pathname, search: '?token=reset-link-test', replace } };
  return replace;
}

async function rejectSession(code = 'AUTH_TOKEN_MISSING') {
  const error = { response: { status: 401, data: { code } } };
  await expect(api.get('/users/profile', { adapter: async () => { throw error; } })).rejects.toBe(error);
}

beforeEach(() => {
  vi.clearAllMocks();
  getAuthToken.mockReturnValue(null);
});
afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

describe('acesso direto aos links de recuperação de senha', () => {
  for (const route of ['/cliente/recuperar-senha', '/instalador/recuperar-senha']) {
    it(`mantém ${route} aberto sem sessão e preserva o token do link`, async () => {
      const replace = openPage(route);
      await rejectSession();
      expect(replace).not.toHaveBeenCalled();
      expect(globalThis.window.location.search).toBe('?token=reset-link-test');
    });

    it(`mantém ${route} aberto mesmo com uma sessão antiga inválida`, async () => {
      const replace = openPage(route);
      getAuthToken.mockReturnValue('expired-session-test');
      await rejectSession('AUTH_SESSION_REVOKED');
      expect(replace).not.toHaveBeenCalled();
    });
  }

  it.each([
    ['/dashboard', '/instalador/entrar'],
    ['/cliente/pedidos', '/cliente/entrar'],
  ])('continua protegendo %s quando falta uma sessão válida', async (route, loginPath) => {
    const replace = openPage(route);
    await rejectSession();
    expect(clearAuthToken).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith(loginPath);
  });

  it.each(['/instalador/entrar', '/cliente/entrar', '/login'])('preserva o comportamento da página %s', async (route) => {
    const replace = openPage(route);
    await rejectSession();
    expect(replace).not.toHaveBeenCalled();
  });

  it('mantém páginas públicas abertas para visitantes', async () => {
    const replace = openPage('/');
    await rejectSession();
    expect(replace).not.toHaveBeenCalled();
  });
});
