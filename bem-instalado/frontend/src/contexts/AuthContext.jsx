import { createContext, useContext, useEffect, useState } from 'react';
import { getProfileRequest, loginRequest, registerClientRequest, registerRequest } from '../services/auth';
import { clearAuthToken, getAuthToken, setAuthToken } from '../utils/safeStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    getProfileRequest()
      .then((profile) => {
        if (isMounted) {
          setUser(profile);
        }
      })
      .catch(() => {
        clearAuthToken();
        if (isMounted) {
          setUser(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (payload, { remember = true } = {}) => {
    const result = await loginRequest(payload);
    setAuthToken(result.token, remember);
    setUser(result.user);
    return result;
  };

  const register = async (payload) => {
    const result = await registerRequest(payload);
    setAuthToken(result.token, true);
    setUser(result.user);
    return result;
  };

  const registerClient = async (payload) => {
    const result = await registerClientRequest(payload);
    setAuthToken(result.token, true);
    setUser(result.user);
    return result;
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, registerClient, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
