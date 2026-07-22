import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getProfileRequest, loginRequest, registerClientRequest, registerRequest } from '../services/auth';
import { clearAuthToken, getAuthToken, setAuthToken } from '../utils/safeStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const loadProfile = useCallback(async () => {
    const token = getAuthToken();

    if (!token) {
      setUser(null);
      setAuthError('');
      setLoading(false);
      return null;
    }

    setLoading(true);
    setAuthError('');

    try {
      const profile = await getProfileRequest();
      setUser(profile);
      return profile;
    } catch (error) {
      const status = error.response?.status;
      const code = error.response?.data?.code || '';

      if (status === 401 && code.startsWith('AUTH_')) {
        clearAuthToken();
        setUser(null);
      } else {
        setAuthError(
          error.response?.data?.error ||
            'Não foi possível validar sua sessão. Verifique a conexão e tente novamente.'
        );
      }

      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      setLoading(false);
      return;
    }

    loadProfile();
  }, [loadProfile]);

  const login = async (payload, { remember = true } = {}) => {
    const result = await loginRequest(payload);
    setAuthToken(result.token, remember);
    setUser(result.user);
    setAuthError('');
    return result;
  };

  const register = async (payload) => {
    const result = await registerRequest(payload);
    setAuthToken(result.token, true);
    setUser(result.user);
    setAuthError('');
    return result;
  };

  const registerClient = async (payload) => {
    const result = await registerClientRequest(payload);
    setAuthToken(result.token, true);
    setUser(result.user);
    setAuthError('');
    return result;
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
    setAuthError('');
  };

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
