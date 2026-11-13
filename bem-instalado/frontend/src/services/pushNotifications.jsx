import { Capacitor } from '@capacitor/core';
import api from './api';

let activeRegistration;

function platformName() {
  const platform = Capacitor.getPlatform();
  return platform === 'ios' ? 'ios' : platform === 'android' ? 'android' : '';
}

export async function registerNativePushNotifications() {
  if (activeRegistration || !Capacitor.isNativePlatform()
    || !Capacitor.isPluginAvailable('PushNotifications')) return;
  const platform = platformName();
  if (!platform) return;
  const registration = { handles: [] };
  activeRegistration = registration;
  const isActive = () => activeRegistration === registration;
  const keepListener = async (listener) => {
    const handle = await listener;
    if (isActive()) registration.handles.push(handle);
    else await handle.remove();
  };

  try {
    const { data } = await api.get('/notifications/devices/capabilities', { handleSessionError: true });
    if (!isActive() || !data?.push_configured) return;
    const { PushNotifications } = await import('@capacitor/push-notifications');
    if (!isActive()) return;
    let permission = await PushNotifications.checkPermissions();
    if (!isActive()) return;
    if (permission.receive === 'prompt') {
      permission = await PushNotifications.requestPermissions();
    }
    if (!isActive() || permission.receive !== 'granted') return;

    await keepListener(PushNotifications.addListener('registration', (token) => {
      if (isActive() && token?.value) {
        void api.post('/notifications/devices', { platform, token: token.value }, { handleSessionError: true }).catch(() => null);
      }
    }));
    if (!isActive()) return;
    await keepListener(PushNotifications.addListener('registrationError', () => {
      if (isActive()) resetNativePushRegistration();
    }));
    if (isActive()) await PushNotifications.register();
  } catch (_error) {
    if (isActive()) resetNativePushRegistration();
  }
}

export function resetNativePushRegistration() {
  const previous = activeRegistration;
  activeRegistration = undefined;
  previous?.handles.forEach((handle) => { void handle.remove().catch(() => null); });
}
