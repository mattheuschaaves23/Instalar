const APP_SCHEME = 'instalapro:';
const APP_SCHEME_HOST = 'auth';
const APP_CALLBACK_PATH = '/callback';
const WEB_CALLBACK_PATH = '/auth/mobile/callback';
const PUBLIC_CALLBACK_HOSTS = ['instalar-sigma.vercel.app', 'instalarpro.com.br'];

function getAllowedWebHosts() {
  const hosts = new Set(PUBLIC_CALLBACK_HOSTS);

  try {
    const configuredApi = new URL(
      process.env.REACT_APP_API_URL || '',
      typeof window !== 'undefined' ? window.location.origin : 'https://localhost'
    );

    if (configuredApi.protocol === 'https:') {
      hosts.add(configuredApi.hostname.toLowerCase());
    }
  } catch (_error) {
    // Keep the production hosts above if no valid API origin is configured.
  }

  return hosts;
}

export function getNativeOAuthRoute(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ''));
    const isCustomScheme = (
      parsed.protocol === APP_SCHEME
      && parsed.hostname === APP_SCHEME_HOST
      && parsed.pathname === APP_CALLBACK_PATH
    );
    const isVerifiedWebLink = (
      parsed.protocol === 'https:'
      && getAllowedWebHosts().has(parsed.hostname.toLowerCase())
      && parsed.pathname === WEB_CALLBACK_PATH
    );

    if (!isCustomScheme && !isVerifiedWebLink) {
      return '';
    }

    return `/auth/social/callback${parsed.search}${parsed.hash}`;
  } catch (_error) {
    return '';
  }
}

export function buildNativeOAuthFallbackUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ''));

    if (
      parsed.protocol !== 'https:'
      || !getAllowedWebHosts().has(parsed.hostname.toLowerCase())
      || parsed.pathname !== WEB_CALLBACK_PATH
    ) {
      return '';
    }

    return `${APP_SCHEME}//${APP_SCHEME_HOST}${APP_CALLBACK_PATH}${parsed.search}${parsed.hash}`;
  } catch (_error) {
    return '';
  }
}
