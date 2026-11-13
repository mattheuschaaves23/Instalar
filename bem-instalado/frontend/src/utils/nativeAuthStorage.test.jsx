import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
}));
vi.mock('@capacitor/preferences', () => ({
  Preferences: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
}));

import { Preferences } from '@capacitor/preferences';
import { clearAuthToken, getAuthToken, hydrateAuthToken, setAuthToken } from './safeStorage';

beforeEach(async () => {
  await clearAuthToken();
  vi.clearAllMocks();
});

describe('sessão persistida no Android', () => {
  it('não substitui o novo login quando uma leitura de sessão antiga chega atrasada', async () => {
    let finishReading;
    Preferences.get.mockImplementationOnce(() => new Promise((resolve) => { finishReading = resolve; }));
    const hydration = hydrateAuthToken();
    await vi.waitFor(() => expect(Preferences.get).toHaveBeenCalledOnce());
    await setAuthToken('new-session-test');
    finishReading({ value: 'old-session-test' });
    await expect(hydration).resolves.toBe('new-session-test');
    expect(getAuthToken()).toBe('new-session-test');
  });

  it('apaga a sessão antiga do dispositivo ao entrar sem manter o acesso', async () => {
    await setAuthToken('temporary-session-test', false);
    expect(Preferences.set).not.toHaveBeenCalled();
    expect(Preferences.remove).toHaveBeenCalledWith({ key: 'token' });
    expect(getAuthToken()).toBe('temporary-session-test');
  });

  it('não permite que uma gravação lenta ressuscite a sessão depois de sair', async () => {
    let finishSaving;
    Preferences.set.mockImplementationOnce(() => new Promise((resolve) => { finishSaving = resolve; }));
    const saving = setAuthToken('pending-session-test');
    const clearing = clearAuthToken();
    await vi.waitFor(() => expect(Preferences.set).toHaveBeenCalledOnce());
    expect(getAuthToken()).toBeNull();
    expect(Preferences.remove).not.toHaveBeenCalled();
    finishSaving();
    await expect(saving).resolves.toBe(false);
    await clearing;
    expect(Preferences.remove).toHaveBeenCalledOnce();
  });
});
