import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getCachedSubscriptionAccess,
  isSubscriptionAccessCacheFresh,
  validateSubscriptionAccess,
} from './subscriptionAccessCache';

const BACKGROUND_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export default function SubscriptionGate() {
  const location = useLocation();
  const { user } = useAuth();
  const userKey = user?.id || user?.email || '';
  const cachedAccess = getCachedSubscriptionAccess(userKey);
  const [loading, setLoading] = useState(!cachedAccess);
  const [canUseApp, setCanUseApp] = useState(Boolean(cachedAccess?.canUseApp));

  useEffect(() => {
    let isMounted = true;
    const cached = getCachedSubscriptionAccess(userKey);
    const hasCache = Boolean(cached);

    if (cached) {
      setCanUseApp(cached.canUseApp);
      setLoading(false);
    } else {
      setLoading(true);
    }

    if (!userKey || (hasCache && isSubscriptionAccessCacheFresh(userKey))) {
      return () => {
        isMounted = false;
      };
    }

    validateSubscriptionAccess(userKey)
      .then((nextCanUseApp) => {
        if (isMounted) {
          setCanUseApp(Boolean(nextCanUseApp));
        }
      })
      .catch(() => {
        if (isMounted) {
          // Em falhas transitorias de rede/API, mantem o ultimo estado seguro ou nao bloqueia a forca.
          setCanUseApp(cached?.canUseApp ?? true);
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
  }, [userKey]);

  useEffect(() => {
    if (!userKey) {
      return undefined;
    }

    let isMounted = true;

    const validateInBackground = () => {
      validateSubscriptionAccess(userKey, { force: true })
        .then((nextCanUseApp) => {
          if (isMounted) {
            setCanUseApp(Boolean(nextCanUseApp));
            setLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setLoading(false);
          }
        });
    };

    const validateWhenVisible = () => {
      if (!document.hidden) {
        validateInBackground();
      }
    };

    const interval = window.setInterval(validateInBackground, BACKGROUND_CHECK_INTERVAL_MS);
    window.addEventListener('focus', validateInBackground);
    document.addEventListener('visibilitychange', validateWhenVisible);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', validateInBackground);
      document.removeEventListener('visibilitychange', validateWhenVisible);
    };
  }, [userKey]);

  if (loading) {
    return (
      <div className="auth-scene flex min-h-[55vh] items-center justify-center px-6">
        <div className="lux-panel fade-up max-w-lg p-8 text-center">
          <p className="eyebrow">Validando acesso</p>
          <h1 className="page-title mt-4 text-[2.8rem]">Conferindo sua assinatura</h1>
          <p className="page-copy mt-4">
            Estamos verificando seu pagamento antes de liberar as ferramentas do painel.
          </p>
        </div>
      </div>
    );
  }

  return canUseApp ? <Outlet /> : <Navigate replace state={{ from: location.pathname }} to="/subscription" />;
}
