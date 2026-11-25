import { Capacitor, registerPlugin } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export const NativeWhatsApp = registerPlugin('NativeWhatsApp');

export async function openBudgetWhatsApp(link, tab) {
  const url = new URL(link);
  if (url.origin !== 'https://wa.me' || url.username || url.password || !/^\/[0-9]{10,15}$/.test(url.pathname)) {
    throw new Error('Link do WhatsApp inválido.');
  }
  if (Capacitor.isNativePlatform()) {
    if (Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('NativeWhatsApp')) {
      await NativeWhatsApp.open({ url: url.href });
    } else {
      await Browser.open({ url: url.href });
    }
  } else if (tab && !tab.closed) {
    tab.location.replace(url.href);
  } else {
    window.location.assign(url.href);
  }
}
