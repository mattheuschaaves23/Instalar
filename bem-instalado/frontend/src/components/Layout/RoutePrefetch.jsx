import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { canPrefetch, getInternalLinkPath, preloadRoute } from '../../utils/routeModules';

export default function RoutePrefetch() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!canPrefetch(navigator.connection)) return undefined;
    // Start shell and page imports together on a direct panel visit, avoiding
    // the sequential shell -> page download. Auth guards still check access.
    void preloadRoute(pathname).catch(() => null);
    const onIntent = (event) => {
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor || anchor.hasAttribute('download') || anchor.target === '_blank') return;
      const path = getInternalLinkPath(anchor.getAttribute('href'), window.location.origin);
      if (path && path !== pathname) void preloadRoute(path).catch(() => null);
    };
    const events = ['pointerover', 'focusin', 'touchstart'];
    events.forEach((name) => document.addEventListener(name, onIntent, { passive: true }));
    return () => events.forEach((name) => document.removeEventListener(name, onIntent));
  }, [pathname]);

  return null;
}
