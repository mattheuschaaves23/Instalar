import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const storageCache = new Map();
const AUTH_TOKEN_KEY = 'token';
const NATIVE_STORAGE_TIMEOUT_MS = 2500;
let memoryAuthToken = '';
let authSessionVersion = 0;
let nativeWrites = Promise.resolve();

function updateNativeToken(token) {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();
  // Timeout the caller, not the write queue: a delayed save must never
  // finish after a newer removal (or replace a newer token).
  nativeWrites = nativeWrites.then(() => token
    ? Preferences.set({ key: AUTH_TOKEN_KEY, value: token })
    : Preferences.remove({ key: AUTH_TOKEN_KEY })
  ).catch(() => null);
  const pendingWrite = nativeWrites;
  return resolveWithTimeout(() => pendingWrite, null);
}

function resolveWithTimeout(task, fallback, timeoutMs = NATIVE_STORAGE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let finished = false;
    let timeoutId;

    const finish = (value) => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timeoutId);
      resolve(value);
    };

    timeoutId = setTimeout(() => finish(fallback), timeoutMs);
    Promise.resolve()
      .then(task)
      .then(finish)
      .catch(() => finish(fallback));
  });
}

function getStorage(storageName) {
  if (typeof window === 'undefined') {
    return null;
  }

  if (storageCache.has(storageName)) {
    return storageCache.get(storageName);
  }

  try {
    const storage = window[storageName];
    const testKey = `__instalar_${storageName}_test__`;

    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    storageCache.set(storageName, storage);
    return storage;
  } catch (_error) {
    // Alguns navegadores móveis bloqueiam o armazenamento apenas durante a
    // inicialização. Não memorize a falha: a próxima tentativa pode funcionar.
    storageCache.delete(storageName);
    return null;
  }
}

function createSafeStorage(storageName) {
  return {
    getItem(key) {
      try {
        return getStorage(storageName)?.getItem(key) || null;
      } catch (_error) {
        return null;
      }
    },
    setItem(key, value) {
      try {
        const storage = getStorage(storageName);

        if (!storage) {
          return false;
        }

        storage.setItem(key, value);
        return true;
      } catch (_error) {
        return false;
      }
    },
    removeItem(key) {
      try {
        getStorage(storageName)?.removeItem(key);
        return true;
      } catch (_error) {
        return false;
      }
    },
  };
}

export const safeLocalStorage = createSafeStorage('localStorage');
export const safeSessionStorage = createSafeStorage('sessionStorage');

export function getAuthToken() {
  return memoryAuthToken || null;
}

export function getAuthSessionVersion() {
  return authSessionVersion;
}

export async function hydrateAuthToken() {
  if (memoryAuthToken) return memoryAuthToken;
  if (!Capacitor.isNativePlatform()) return null;

  const version = authSessionVersion;
  const result = await resolveWithTimeout(
    () => nativeWrites.then(() => Preferences.get({ key: AUTH_TOKEN_KEY })),
    null
  );
  if (authSessionVersion !== version) return getAuthToken();
  if (!result) throw new Error('Não foi possível ler a sessão salva no dispositivo.');
  memoryAuthToken = String(result.value || '').trim();
  return getAuthToken();
}

export async function setAuthToken(token, remember = true) {
  const version = ++authSessionVersion;
  memoryAuthToken = String(token || '').trim();
  await updateNativeToken(remember ? memoryAuthToken : '');
  return version === authSessionVersion && Boolean(memoryAuthToken);
}

export async function clearAuthToken() {
  authSessionVersion += 1;
  memoryAuthToken = '';
  safeLocalStorage.removeItem(AUTH_TOKEN_KEY);
  safeSessionStorage.removeItem(AUTH_TOKEN_KEY);
  await updateNativeToken('');
}
