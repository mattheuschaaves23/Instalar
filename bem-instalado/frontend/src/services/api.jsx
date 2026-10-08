import axios from 'axios';
import { clearAuthToken, getAuthToken } from '../utils/safeStorage';
import { getCsrfToken } from '../utils/csrfToken';
import { captureFrontendException } from './sentry';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const DEFAULT_API_TIMEOUT_MS = 20000;
const INVALID_SESSION_CODES = new Set([
  'AUTH_TOKEN_MISSING',
  'AUTH_TOKEN_MALFORMED',
  'AUTH_TOKEN_INVALID',
  'AUTH_USER_NOT_FOUND',
  'AUTH_SESSION_REVOKED',
]);

function isLocalHost(hostname) {
  return LOCAL_HOSTS.has(String(hostname || '').toLowerCase());
}

function normalizeApiUrl(rawUrl) {
  if (!rawUrl) {
    return '';
  }

  try {
    const base = typeof window !== 'undefined' ? window.location.origin : undefined;
    const parsedUrl = new URL(rawUrl, base);

    if (
      typeof window !== 'undefined' &&
      isLocalHost(parsedUrl.hostname) &&
      !isLocalHost(window.location.hostname)
    ) {
      return `${window.location.origin}${parsedUrl.pathname}${parsedUrl.search}`.replace(/\/$/, '');
    }

    return parsedUrl.toString().replace(/\/$/, '');
  } catch (_error) {
    return rawUrl;
  }
}

function resolveBaseUrl() {
  const envApiUrl = normalizeApiUrl(process.env.REACT_APP_API_URL);

  if (envApiUrl) {
    return envApiUrl;
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;

    if (port === '3000') {
      return `${protocol}//${hostname}:5000/api`;
    }
  }

  return '/api';
}

function resolveApiTimeout() {
  const rawTimeout = Number.parseInt(process.env.REACT_APP_API_TIMEOUT_MS, 10);

  if (Number.isFinite(rawTimeout) && rawTimeout >= 3000) {
    return rawTimeout;
  }

  return DEFAULT_API_TIMEOUT_MS;
}

const api = axios.create({
  baseURL: resolveBaseUrl(),
  timeout: resolveApiTimeout(),
  withCredentials: true,
});

function isAuthEntryRoute(pathname) {
  // Restoring the previous session may return 401 while a visitor opens an
  // email reset link. These public forms must remain open and keep its token.
  return [
    '/instalador/entrar', '/cliente/entrar', '/login',
    '/instalador/recuperar-senha', '/cliente/recuperar-senha',
  ].some((route) =>
    String(pathname || '') === route || String(pathname || '').startsWith(`${route}/`)
  );
}

function isPublicRoute(pathname) {
  const path = String(pathname || '');
  return path === '/' || path === '/cliente' || path === '/papelperto' || path === '/termos' || path === '/privacidade'
    || path.startsWith('/installers/');
}

function getLoginRoute(pathname) {
  const path = String(pathname || '');
  return path.startsWith('/cliente') || path.startsWith('/papelperto') || path.startsWith('/installers')
    ? '/cliente/entrar'
    : '/instalador/entrar';
}

function redirectTo(targetPath) {
  if (typeof window === 'undefined' || !targetPath || window.location.pathname === targetPath) {
    return;
  }

  window.location.replace(targetPath);
}

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  const method = String(config.method || 'get').toUpperCase();

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      config.headers = config.headers || {};
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Changing a search query deliberately cancels the previous request.
    // This is not an outage and should not be reported to error monitoring.
    if (axios.isCancel(error)) return Promise.reject(error);
    const status = error.response?.status;
    const code = error.response?.data?.code || '';

    if (status >= 500 || !error.response) {
      captureFrontendException(error, {
        source: 'api.request',
        stack: error.config?.url ? `${String(error.config.method || 'GET').toUpperCase()} ${error.config.url}` : '',
      });
    }

    if (typeof window !== 'undefined') {
      if (
        status === 401 &&
        INVALID_SESSION_CODES.has(code) &&
        !isAuthEntryRoute(window.location.pathname) &&
        !(isPublicRoute(window.location.pathname) && !getAuthToken())
      ) {
        void clearAuthToken();
        redirectTo(getLoginRoute(window.location.pathname));
      }

      if (status === 403 && code === 'ACCOUNT_TYPE_FORBIDDEN') {
        redirectTo(error.response?.data?.account_type === 'client' ? '/cliente' : '/dashboard');
      }

      if (status === 403 && code === 'ADMIN_TWO_FACTOR_REQUIRED') {
        redirectTo('/profile?security=2fa');
      }
    }

    return Promise.reject(error);
  }
);

export default api;
