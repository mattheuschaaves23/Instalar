import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import api from './api';
import { getNativeStorePlatform } from '../utils/nativePlatform';

const IS_INSTALLER_APP = process.env.REACT_APP_INSTALLER_APP === 'true';

export async function loginRequest(payload) {
  const response = await api.post('/auth/login', { ...payload, platform: getNativeStorePlatform() }, { timeout: 45000 });
  return response.data;
}

export async function forgotPasswordRequest(payload) {
  const response = await api.post('/auth/forgot-password', payload);
  return response.data;
}

export async function resetPasswordRequest(payload) {
  const response = await api.post('/auth/reset-password', payload);
  return response.data;
}

export async function verifyEmailRequest(token) {
  const response = await api.post('/auth/verify-email', { token });
  return response.data;
}

export async function resendEmailVerificationRequest() {
  const response = await api.post('/auth/resend-verification');
  return response.data;
}

export async function logoutRequest() {
  const response = await api.post('/auth/logout');
  return response.data;
}

function getSocialLoginBaseUrl() {
  return String(api.defaults.baseURL || '/api').replace(/\/+$/, '');
}

function sanitizeNextPath(value, fallback) {
  const nextPath = String(value || '').trim();
  return nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : fallback;
}

export function buildSocialLoginUrl(
  provider,
  { role = 'installer', next = '/dashboard', platform } = {}
) {
  const normalizedRole = role === 'client' ? 'client' : 'installer';
  const fallbackNext = normalizedRole === 'client' ? '/cliente' : '/dashboard';
  const url = new URL(`${getSocialLoginBaseUrl()}/auth/oauth/${provider}`, window.location.origin);
  const nativePlatform = getNativeStorePlatform();
  const targetPlatform = platform === 'android' || platform === 'ios'
    ? platform
    : normalizedRole === 'installer'
      ? nativePlatform
      : 'web';

  url.searchParams.set('role', normalizedRole);
  url.searchParams.set('next', sanitizeNextPath(next, fallbackNext));
  if (targetPlatform !== 'web') {
    url.searchParams.set('platform', targetPlatform);
  }

  return url.toString();
}

export async function startSocialLogin(provider, options) {
  const url = buildSocialLoginUrl(provider, options);

  if (IS_INSTALLER_APP && Capacitor.isNativePlatform()) {
    await Browser.open({
      url,
      toolbarColor: '#080706',
      presentationStyle: 'fullscreen',
    });
    return;
  }

  window.location.assign(url);
}

export async function registerRequest(payload) {
  const response = await api.post('/auth/register', { ...payload, platform: getNativeStorePlatform() });
  return response.data;
}

export async function registerClientRequest(payload) {
  const response = await api.post('/auth/register/client', { ...payload, platform: getNativeStorePlatform() });
  return response.data;
}

export async function getProfileRequest() {
  const response = await api.get('/users/profile', { timeout: 12000 });
  return response.data;
}
