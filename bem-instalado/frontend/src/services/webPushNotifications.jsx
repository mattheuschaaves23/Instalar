import api from './api';

function vapidPublicKey() {
  return String(process.env.REACT_APP_WEB_PUSH_VAPID_PUBLIC_KEY || '').trim();
}

function toUint8Array(value) {
  const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function getWebPushSupport() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { supported: false, reason: 'unsupported' };
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { supported: false, reason: 'unsupported' };
  }
  if (!vapidPublicKey()) return { supported: false, reason: 'not_configured' };
  // Browser permission alone does not confirm device registration for this account.
  return { supported: true, permission: window.Notification.permission, enabled: false };
}

export function webPushStatusMessage(status) {
  if (status.enabled) return 'Notificações ativadas neste navegador para esta conta.';
  if (status.reason === 'not_configured') return 'As notificações do navegador ainda não foram configuradas no site. Os avisos continuam disponíveis no painel.';
  if (!status.supported) return 'Este navegador não oferece notificações push. Os avisos continuam disponíveis no painel.';
  if (status.permission === 'denied') return 'Permita notificações nas configurações do navegador e tente novamente.';
  if (status.reason === 'service_worker_unavailable') return 'O serviço de notificações não iniciou. Recarregue a página e tente novamente.';
  return 'Ative neste dispositivo para receber oportunidades e mudanças de agenda.';
}

export async function registerWebPushNotifications() {
  const support = getWebPushSupport();
  if (!support.supported) return support;

  let permission = window.Notification.permission;
  if (permission === 'default') permission = await window.Notification.requestPermission();
  if (permission !== 'granted') return { supported: true, permission, enabled: false };

  let timer;
  let registration;
  try {
    registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => { timer = setTimeout(() => resolve(null), 10000); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  if (!registration) return { supported: true, permission, enabled: false, reason: 'service_worker_unavailable' };
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toUint8Array(vapidPublicKey()),
    });
  }

  await api.post('/notifications/devices', { platform: 'web', token: JSON.stringify(subscription) });
  return { supported: true, permission, enabled: true };
}
