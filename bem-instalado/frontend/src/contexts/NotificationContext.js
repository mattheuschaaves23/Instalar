import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const canLoadNotifications = user?.account_type === 'installer' || user?.is_admin;

  const loadNotifications = useCallback(async () => {
    if (!canLoadNotifications) {
      setNotifications([]);
      return;
    }

    try {
      const response = await api.get('/notifications');
      setNotifications(response.data);
    } catch (_error) {
      setNotifications([]);
    }
  }, [canLoadNotifications]);

  useEffect(() => {
    loadNotifications();

    if (!canLoadNotifications) {
      return undefined;
    }

    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [canLoadNotifications, loadNotifications, user?.id]);

  return (
    <NotificationContext.Provider value={{ notifications, refreshNotifications: loadNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
