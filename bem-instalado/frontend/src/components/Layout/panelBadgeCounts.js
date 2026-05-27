import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';

export const PANEL_BADGE_REFRESH_EVENT = 'panel-badge-counts:refresh';

const BADGE_REFRESH_INTERVAL = 15000;
const INACTIVE_SCHEDULE_STATUSES = new Set(['completed', 'canceled', 'cancelled']);

function countActiveSchedules(items) {
  if (!Array.isArray(items)) {
    return 0;
  }

  return items.filter((item) => !INACTIVE_SCHEDULE_STATUSES.has(String(item.status || '').toLowerCase())).length;
}

export function formatPanelBadgeCount(value) {
  const count = Number(value || 0);
  return count > 99 ? '99+' : String(count);
}

export function getPanelBadgeValue(item, counts = {}) {
  if (!item.badgeKey) {
    return null;
  }

  const count = Number(counts[item.badgeKey] || 0);

  return count > 0 ? formatPanelBadgeCount(count) : null;
}

export function notifyPanelBadgeCountsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PANEL_BADGE_REFRESH_EVENT));
  }
}

export function usePanelBadgeCounts() {
  const { user } = useAuth();
  const notificationContext = useNotifications();
  const notifications = notificationContext?.notifications || [];
  const refreshNotifications = notificationContext?.refreshNotifications;
  const [agenda, setAgenda] = useState(0);
  const [reviews, setReviews] = useState(0);
  const [opportunities, setOpportunities] = useState(0);
  const canLoadCounts = user?.account_type === 'installer' || user?.is_admin;
  const lastFocusedRefreshAtRef = useRef(0);

  const loadAgendaCount = useCallback(async () => {
    if (!canLoadCounts) {
      setAgenda(0);
      return;
    }

    try {
      const response = await api.get('/schedules');
      setAgenda(countActiveSchedules(response.data));
    } catch (_error) {
      setAgenda(0);
    }
  }, [canLoadCounts]);

  const loadReviewCount = useCallback(async () => {
    if (!canLoadCounts) {
      setReviews(0);
      return;
    }

    try {
      const response = await api.get('/users/reviews/summary');
      setReviews(Number(response.data?.review_count || 0));
    } catch (_error) {
      setReviews(0);
    }
  }, [canLoadCounts]);

  const loadOpportunityCount = useCallback(async () => {
    if (!canLoadCounts) {
      setOpportunities(0);
      return;
    }

    try {
      const response = await api.get('/opportunities', { params: { status: 'open', limit: 100 } });
      setOpportunities(Number(response.data?.stats?.open || response.data?.opportunities?.length || 0));
    } catch (_error) {
      setOpportunities(0);
    }
  }, [canLoadCounts]);

  const refreshCounts = useCallback((includeNotifications = false) => {
    loadAgendaCount();
    loadReviewCount();
    loadOpportunityCount();
    if (includeNotifications) {
      refreshNotifications?.();
    }
  }, [loadAgendaCount, loadOpportunityCount, loadReviewCount, refreshNotifications]);

  useEffect(() => {
    refreshCounts();

    if (!canLoadCounts) {
      return undefined;
    }

    const interval = setInterval(() => {
      if (!document.hidden) {
        refreshCounts();
      }
    }, BADGE_REFRESH_INTERVAL);

    const refreshAfterAttentionReturn = () => {
      const now = Date.now();

      if (document.hidden || now - lastFocusedRefreshAtRef.current < 5000) {
        return;
      }

      lastFocusedRefreshAtRef.current = now;
      refreshCounts(true);
    };

    const refreshWhenVisible = () => {
      if (!document.hidden) {
        refreshAfterAttentionReturn();
      }
    };

    const refreshAfterPanelEvent = () => refreshCounts(true);

    window.addEventListener('focus', refreshAfterAttentionReturn);
    window.addEventListener(PANEL_BADGE_REFRESH_EVENT, refreshAfterPanelEvent);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshAfterAttentionReturn);
      window.removeEventListener(PANEL_BADGE_REFRESH_EVENT, refreshAfterPanelEvent);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [canLoadCounts, refreshCounts]);

  const unreadNotifications = notifications.filter((item) => !item.read).length;

  return useMemo(
    () => ({
      agenda,
      opportunities,
      reviews,
      notifications: unreadNotifications,
    }),
    [agenda, opportunities, reviews, unreadNotifications]
  );
}
