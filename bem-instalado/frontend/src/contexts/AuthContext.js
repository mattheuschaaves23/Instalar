import { createContext, useContext, useEffect, useState } from 'react';
import { getProfileRequest, loginRequest, registerRequest } from '../services/auth';
import { safeLocalStorage } from '../utils/safeStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = safeLocalStorage.getItem('token');

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
        safeLocalStorage.removeItem('token');
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

  const login = async (payload) => {
    const result = await loginRequest(payload);
    safeLocalStorage.setItem('token', result.token);
    setUser(result.user);
    return result;
  };

  const register = async (payload) => {
    const result = await registerRequest(payload);
    safeLocalStorage.setItem('token', result.token);
    setUser(result.user);
    return result;
  };

  const logout = () => {
    safeLocalStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
