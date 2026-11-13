import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getProfileRequest, loginRequest, logoutRequest, registerClientRequest, registerRequest } from '../services/auth';
import { clearAuthToken, getAuthSessionVersion, getAuthToken, hydrateAuthToken, setAuthToken } from '../utils/safeStorage';
import { registerNativePushNotifications, resetNativePushRegistration } from '../services/pushNotifications';
import { clearCsrfToken, refreshCsrfToken } from '../services/csrf';
import { isInvalidSession } from '../utils/authSession';
import { isNativeStoreApp } from '../utils/nativePlatform';

const AuthContext = createContext(null);

function nativeSessionError(message) {
  return Object.assign(new Error(message), { code: 'NATIVE_SESSION_ERROR' });
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const profileAttempt = useRef(0);

  const loadProfile = useCallback(async () => {
    const attempt = ++profileAttempt.current;
    const version = getAuthSessionVersion();
    const isCurrent = () => attempt === profileAttempt.current && version === getAuthSessionVersion();
    setLoading(true);
    setAuthError('');

    try {
      if (isNativeStoreApp()) {
        if (!await hydrateAuthToken() || !isCurrent()) return null;
      } else {
        await refreshCsrfToken();
        if (!isCurrent()) return null;
      }
      const profile = await getProfileRequest();
      if (!isCurrent()) return null;
      setUser(profile);
      return profile;
    } catch (error) {
      if (!isCurrent()) return null;

      if (isInvalidSession(error)) {
        void clearAuthToken();
        setUser(null);
      } else {
        setAuthError(
          error.response?.data?.error ||
            'Não foi possível validar sua sessão. Verifique a conexão e tente novamente.'
        );
      }

      return null;
    } finally {
      if (attempt === profileAttempt.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
    return () => {
      profileAttempt.current += 1;
    };
  }, [loadProfile]);

  const userId = user?.id;
  useEffect(() => {
    if (userId) {
      void registerNativePushNotifications();
    }
    return resetNativePushRegistration;
  }, [userId]);

  const acceptSession = async (result, remember) => {
    if (!result.user || (isNativeStoreApp() && !String(result.token || '').trim())) {
      throw nativeSessionError('Não foi possível iniciar a sessão neste aplicativo. Tente novamente.');
    }
    profileAttempt.current += 1;
    const saved = setAuthToken(result.token, remember);
    const version = getAuthSessionVersion();
    await saved;
    if (version !== getAuthSessionVersion() || (isNativeStoreApp() && !getAuthToken())) {
      throw nativeSessionError('O acesso foi interrompido. Tente entrar novamente.');
    }
    setUser(result.user);
    setAuthError('');
    setLoading(false);
    return result;
  };

  const login = async (payload, { remember = true } = {}) => {
    return acceptSession(await loginRequest({ ...payload, remember }), remember);
  };

  const register = async (payload) => {
    return acceptSession(await registerRequest(payload), true);
  };

  const registerClient = async (payload) => {
    return acceptSession(await registerClientRequest(payload), true);
  };

  const logout = useCallback(async () => {
    profileAttempt.current += 1;
    resetNativePushRegistration();
    if (!isNativeStoreApp()) await logoutRequest().catch(() => null);
    const clearing = clearAuthToken();
    clearCsrfToken();
    setUser(null);
    setAuthError('');
    setLoading(false);
    await clearing;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, setUser, loading, authError, retryProfile: loadProfile, login, register, registerClient, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
