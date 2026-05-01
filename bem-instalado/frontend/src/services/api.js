import axios from 'axios';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

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
      parsedUrl.hostname = window.location.hostname;
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

const api = axios.create({
  baseURL: resolveBaseUrl(),
});

function isLoginRoute(pathname) {
  return ['/instalador/entrar', '/cliente/entrar', '/login'].some((route) =>
    String(pathname || '').startsWith(route)
  );
}

function getLoginRoute(pathname) {
  const path = String(pathname || '');
  return path.startsWith('/cliente') || path.startsWith('/installers') ? '/cliente/entrar' : '/instalador/entrar';
}

function redirectTo(targetPath) {
  if (!targetPath || window.location.pathname === targetPath) {
    return;
  }

  window.location.replace(targetPath);
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.error || '';
    const code = error.response?.data?.code || '';

    if (typeof window !== 'undefined') {
      if (status === 401 && !isLoginRoute(window.location.pathname)) {
        localStorage.removeItem('token');
        redirectTo(getLoginRoute(window.location.pathname));
      }

      if (status === 403 && code === 'ACCOUNT_TYPE_FORBIDDEN') {
        redirectTo(error.response?.data?.account_type === 'client' ? '/cliente' : '/dashboard');
      }

      if (
        status === 403 &&
        (code === 'SUBSCRIPTION_INACTIVE' || message.toLowerCase().includes('assinatura inativa')) &&
        window.location.pathname !== '/subscription'
      ) {
        redirectTo('/subscription');
      }
    }

    return Promise.reject(error);
  }
);

export default api;
