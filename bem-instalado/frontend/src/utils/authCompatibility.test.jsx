import { afterEach, describe, expect, it } from 'vitest';
import { getAuthRequestErrorMessage } from './authErrorMessage';

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

afterEach(() => {
  if (originalWindow === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }

  if (originalDocument === undefined) {
    delete globalThis.document;
  } else {
    globalThis.document = originalDocument;
  }
});

describe('mensagens de falha no login', () => {
  it('explica timeout e ausência de conexão', () => {
    expect(getAuthRequestErrorMessage({ code: 'ECONNABORTED' })).toMatch(/demorou/i);
    expect(getAuthRequestErrorMessage({ request: {} })).toMatch(/internet/i);
  });

  it('transforma o bloqueio temporário em uma orientação objetiva', () => {
    const message = getAuthRequestErrorMessage({
      response: { status: 429, data: { retry_after_seconds: 121 } },
    });

    expect(message).toContain('3 minutos');
  });
});

describe('armazenamento compatível com navegadores móveis', () => {
  it('tenta novamente quando o armazenamento falha apenas na inicialização', async () => {
    let temporarilyBlocked = true;
    const values = new Map();
    const storage = {
      getItem(key) {
        return values.get(key) || null;
      },
      setItem(key, value) {
        if (temporarilyBlocked) {
          throw new Error('storage temporarily unavailable');
        }
        values.set(key, String(value));
      },
      removeItem(key) {
        values.delete(key);
      },
    };
    let cookieValue = '';

    globalThis.window = {
      localStorage: storage,
      sessionStorage: storage,
      location: { protocol: 'https:' },
    };
    globalThis.document = {};
    Object.defineProperty(globalThis.document, 'cookie', {
      configurable: true,
      get: () => cookieValue,
      set: (value) => {
        cookieValue = String(value).split(';')[0];
      },
    });

    const storageModule = await import('./safeStorage');

    expect(storageModule.safeLocalStorage.setItem('first', 'attempt')).toBe(false);
    temporarilyBlocked = false;
    expect(storageModule.safeLocalStorage.setItem('second', 'attempt')).toBe(true);
    expect(storageModule.safeLocalStorage.getItem('second')).toBe('attempt');

    await storageModule.setAuthToken('mobile-token', true);
    expect(storageModule.getAuthToken()).toBe('mobile-token');
    await storageModule.clearAuthToken();
    expect(storageModule.getAuthToken()).toBeNull();
  });
});
