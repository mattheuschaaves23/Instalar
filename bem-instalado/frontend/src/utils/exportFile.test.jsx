// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { exportFile } from './exportFile';

const bridge = vi.hoisted(() => ({ save: vi.fn(), platform: vi.fn() }));
vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({ save: bridge.save }) }));
vi.mock('./nativePlatform', () => ({ getNativeStorePlatform: bridge.platform }));

it.each(['android', 'ios'])('entrega o PDF autenticado ao seletor nativo do %s', async (platform) => {
  bridge.platform.mockReturnValue(platform);
  bridge.save.mockResolvedValue({ saved: true });
  const result = await exportFile(new Blob(['%PDF-1.7'], { type: 'application/pdf' }), 'orcamento-42.pdf', 'application/pdf');
  expect(bridge.save).toHaveBeenCalledWith({ name: 'orcamento-42.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjc=' });
  expect(result).toEqual({ saved: true });
});

it('não confirma uma gravação cancelada no seletor nativo', async () => {
  bridge.platform.mockReturnValue('android');
  bridge.save.mockResolvedValue({ saved: false });
  await expect(exportFile(new Blob(['{}']), 'meus-dados.json', 'application/json')).resolves.toEqual({ saved: false });
});

it('recusa páginas de erro HTML em vez de salvá-las como PDF', async () => {
  bridge.platform.mockReturnValue('android');
  bridge.save.mockClear();
  await expect(exportFile(new Blob(['Falha'], { type: 'text/html' }), 'orcamento.pdf', 'application/pdf')).rejects.toThrow('Formato inesperado');
  expect(bridge.save).not.toHaveBeenCalled();
});
