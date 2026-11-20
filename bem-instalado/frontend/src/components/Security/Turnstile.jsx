import { useEffect, useRef } from 'react';

const SCRIPT_ID = 'cloudflare-turnstile-script';
const SITE_KEY = String(process.env.REACT_APP_TURNSTILE_SITE_KEY || '').trim();
let scriptLoad;

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptLoad) return scriptLoad;
  scriptLoad = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    const fail = () => {
      script.remove();
      reject(new Error('turnstile_unavailable'));
    };
    script.onload = () => window.turnstile ? resolve(window.turnstile) : fail();
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch((error) => {
    scriptLoad = undefined;
    throw error;
  });
  return scriptLoad;
}

export function isTurnstileEnabled() {
  return Boolean(SITE_KEY);
}

export default function Turnstile({ action, onError, onExpire, onVerify, resetKey = 0 }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const callbacksRef = useRef({ onError, onExpire, onVerify });

  useEffect(() => {
    callbacksRef.current = { onError, onExpire, onVerify };
  }, [onError, onExpire, onVerify]);

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return undefined;
    let active = true;

    loadTurnstileScript()
      .then((turnstile) => {
        if (!active || !turnstile || widgetIdRef.current !== null) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          action,
          callback: (token) => callbacksRef.current.onVerify?.(token),
          'error-callback': () => (callbacksRef.current.onError || callbacksRef.current.onExpire)?.(),
          'expired-callback': () => callbacksRef.current.onExpire?.(),
          sitekey: SITE_KEY,
          theme: 'auto',
        });
      })
      .catch(() => { if (active) (callbacksRef.current.onError || callbacksRef.current.onExpire)?.(); });

    return () => {
      active = false;
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action]);

  useEffect(() => {
    if (widgetIdRef.current !== null && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetKey]);

  if (!SITE_KEY) return null;
  return <div aria-label="Verificação de segurança" className="turnstile-challenge" ref={containerRef} />;
}
