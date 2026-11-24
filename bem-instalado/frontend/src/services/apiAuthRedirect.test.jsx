import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/safeStorage', () => ({
  clearAuthToken: vi.fn().mockResolvedValue(undefined),
  getAuthToken: vi.fn(() => null),
  getAuthSessionVersion: vi.fn(() => 0),
}));
vi.mock('../utils/nativePlatform', () => ({ isNativeStoreApp: vi.fn(() => false) }));
vi.mock('./sentry', () => ({ captureFrontendException: vi.fn() }));

import api from './api';
import { clearAuthToken, getAuthSessionVersion, getAuthToken } from '../utils/safeStorage';
import { isNativeStoreApp } from '../utils/nativePlatform';

const originalWindow = globalThis.window;

function openPage(pathname) {
  const replace = vi.fn();
  globalThis.window = { location: { pathname, search: '?token=reset-link-test', replace } };
  return replace;
}

async function rejectSession(code = 'AUTH_TOKEN_MISSING') {
  const error = { response: { status: 401, data: { code } } };
  await expect(api.get('/users/profile', {
    adapter: async (config) => { throw Object.assign(error, { config }); },
  })).rejects.toBe(error);
}

beforeEach(() => {
  vi.clearAllMocks();
  getAuthToken.mockReturnValue(null);
  getAuthSessionVersion.mockReturnValue(0);
  isNativeStoreApp.mockReturnValue(false);
});

describe('isolamento da sessão por requisição', () => {
  it('não encerra uma sessão criada depois que uma requisição anterior começou', async () => {
    const replace = openPage('/dashboard');
    await expect(api.get('/notifications', {
      adapter: async (config) => {
        getAuthSessionVersion.mockReturnValue(1);
        getAuthToken.mockReturnValue('new-session-test');
        throw { config, response: { status: 401, data: { code: 'AUTH_TOKEN_MISSING' } } };
      },
    })).rejects.toMatchObject({ response: { status: 401 } });
    expect(clearAuthToken).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('encerra a sessão quando o servidor revoga o token atual', async () => {
    const replace = openPage('/dashboard');
    getAuthToken.mockReturnValue('revoked-session-test');
    await rejectSession('AUTH_SESSION_REVOKED');
    expect(clearAuthToken).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith('/instalador/entrar');
  });

  it('no Android, envia o token de sessão sem cookies e não derruba o painel por falha do push', async () => {
    const replace = openPage('/dashboard');
    isNativeStoreApp.mockReturnValue(true);
    getAuthToken.mockReturnValue('native-session-test');
    await expect(api.post('/notifications/devices', {}, {
      handleSessionError: true,
      adapter: async (config) => {
        expect(config.withCredentials).toBe(false);
        expect(config.headers.get('Authorization')).toBe('Bearer native-session-test');
        throw { config, response: { status: 401, data: { code: 'AUTH_SESSION_REVOKED' } } };
      },
    })).rejects.toMatchObject({ response: { status: 401 } });
    expect(clearAuthToken).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
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
