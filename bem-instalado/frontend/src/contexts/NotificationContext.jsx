import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const canLoadNotifications = Boolean(user);
  const lastAttentionRefreshAtRef = useRef(0);

  const loadNotifications = useCallback(async () => {
    if (!canLoadNotifications) {
      setNotifications([]);
      return;
    }

    try {
      const response = await api.get('/notifications');
      setNotifications(Array.isArray(response.data) ? response.data : response.data?.notifications || []);
    } catch (_error) {
      setNotifications([]);
    }
  }, [canLoadNotifications]);

  useEffect(() => {
    loadNotifications();

    if (!canLoadNotifications) {
      return undefined;
    }

    const refreshWhenActive = () => {
      if (!document.hidden) {
        loadNotifications();
      }
    };

    const refreshAfterAttentionReturn = () => {
      const now = Date.now();

      if (document.hidden || now - lastAttentionRefreshAtRef.current < 5000) {
        return;
      }

      lastAttentionRefreshAtRef.current = now;
      loadNotifications();
    };

    const interval = setInterval(refreshWhenActive, 30000);
    window.addEventListener('focus', refreshAfterAttentionReturn);
    document.addEventListener('visibilitychange', refreshAfterAttentionReturn);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshAfterAttentionReturn);
      document.removeEventListener('visibilitychange', refreshAfterAttentionReturn);
    };
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
