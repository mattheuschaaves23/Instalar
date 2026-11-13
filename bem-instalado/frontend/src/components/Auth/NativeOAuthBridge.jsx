import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router';
import { getNativeOAuthRoute } from '../../utils/nativeOAuth';

export default function NativeOAuthBridge() {
  const navigate = useNavigate();
  const lastHandledUrl = useRef('');

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return undefined;
    }

    let disposed = false;
    let listenerHandle;

    const handleUrl = async ({ url } = {}) => {
      const route = getNativeOAuthRoute(url);

      if (disposed || !route || lastHandledUrl.current === url) {
        return;
      }

      if (!disposed && lastHandledUrl.current !== url) {
        lastHandledUrl.current = url;
        void Browser.close().catch(() => null);
        navigate(route, { replace: true });
      }
    };

    CapacitorApp.addListener('appUrlOpen', handleUrl).then((handle) => {
      if (disposed) {
        void handle.remove().catch(() => null);
        return;
      }

      listenerHandle = handle;
    }).catch(() => null);

    CapacitorApp.getLaunchUrl()
      .then((launch) => handleUrl(launch))
      .catch(() => null);

    return () => {
      disposed = true;
      void listenerHandle?.remove().catch(() => null);
    };
  }, [navigate]);

  return null;
}
