const storageCache = new Map();

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
    storageCache.set(storageName, null);
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
