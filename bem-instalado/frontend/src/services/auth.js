import api from './api';

export async function loginRequest(payload) {
  const response = await api.post('/auth/login', payload);
  return response.data;
}

function getSocialLoginBaseUrl() {
  return String(api.defaults.baseURL || '/api').replace(/\/+$/, '');
}

function sanitizeNextPath(value, fallback) {
  const nextPath = String(value || '').trim();
  return nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : fallback;
}

export function buildSocialLoginUrl(provider, { role = 'installer', next = '/dashboard' } = {}) {
  const normalizedRole = role === 'client' ? 'client' : 'installer';
  const fallbackNext = normalizedRole === 'client' ? '/cliente' : '/dashboard';
  const url = new URL(`${getSocialLoginBaseUrl()}/auth/oauth/${provider}`, window.location.origin);

  url.searchParams.set('role', normalizedRole);
  url.searchParams.set('next', sanitizeNextPath(next, fallbackNext));

  return url.toString();
}

export function startSocialLogin(provider, options) {
  window.location.assign(buildSocialLoginUrl(provider, options));
}

export async function registerRequest(payload) {
  const response = await api.post('/auth/register', payload);
  return response.data;
}

export async function getProfileRequest() {
  const response = await api.get('/users/profile');
  return response.data;
}

export async function setup2FARequest() {
  const response = await api.get('/auth/2fa/setup');
  return response.data;
}

export async function enable2FARequest(payload) {
  const response = await api.post('/auth/2fa/enable', payload);
  return response.data;
}

export async function disable2FARequest() {
  const response = await api.post('/auth/2fa/disable');
  return response.data;
}
