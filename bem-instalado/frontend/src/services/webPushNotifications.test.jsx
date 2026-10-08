import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./api', () => ({ default: { post: vi.fn() } }));
import api from './api';
import { getWebPushSupport, registerWebPushNotifications, webPushStatusMessage } from './webPushNotifications';

const keyName = 'REACT_APP_WEB_PUSH_VAPID_PUBLIC_KEY';
function browser(permission = 'granted', ready = Promise.resolve({ pushManager: { getSubscription: vi.fn(async () => ({ endpoint: 'https://push.example.test', keys: {} })) } })) {
  vi.stubGlobal('window', { PushManager: function () {}, Notification: { permission, requestPermission: vi.fn(async () => permission) }, atob: (value) => Buffer.from(value, 'base64').toString('binary') });
  vi.stubGlobal('navigator', { serviceWorker: { ready } });
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv(keyName, 'test-public-key'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('notificações do navegador', () => {
  it('permissão concedida não significa que a conta está registrada', () => {
    browser();
    expect(getWebPushSupport()).toEqual({ supported: true, permission: 'granted', enabled: false });
    expect(webPushStatusMessage(getWebPushSupport())).not.toContain('ativadas');
  });
  it('distingue falta de configuração de navegador incompatível', () => {
    browser(); vi.stubEnv(keyName, '');
    expect(getWebPushSupport().reason).toBe('not_configured');
    expect(webPushStatusMessage(getWebPushSupport())).toContain('não foram configuradas');
    vi.stubGlobal('window', {});
    expect(getWebPushSupport().reason).toBe('unsupported');
    expect(webPushStatusMessage(getWebPushSupport())).toContain('Este navegador');
  });
  it('só confirma ativação depois de registrar dispositivo na API', async () => {
    browser(); api.post.mockResolvedValue({ data: {} });
    expect((await registerWebPushNotifications()).enabled).toBe(true);
    expect(api.post).toHaveBeenCalledWith('/notifications/devices', expect.objectContaining({ platform: 'web' }));
    expect(window.Notification.requestPermission).not.toHaveBeenCalled();
  });
  it('falha de API não é anunciada como ativação bem-sucedida', async () => {
    browser(); api.post.mockRejectedValue(new Error('Serviço indisponível'));
    await expect(registerWebPushNotifications()).rejects.toThrow('Serviço indisponível');
  });
  it('permissão bloqueada não tenta cadastrar ou assinar push', async () => {
    browser('denied');
    expect(await registerWebPushNotifications()).toEqual({ supported: true, permission: 'denied', enabled: false });
    expect(api.post).not.toHaveBeenCalled();
    expect(webPushStatusMessage({ supported: true, permission: 'denied' })).toContain('configurações do navegador');
  });
  it('não fica esperando indefinidamente um service worker ausente', async () => {
    vi.useFakeTimers(); browser('granted', new Promise(() => {}));
    const result = registerWebPushNotifications();
    await vi.advanceTimersByTimeAsync(10000);
    expect((await result).reason).toBe('service_worker_unavailable');
    expect(api.post).not.toHaveBeenCalled();
  });
});
