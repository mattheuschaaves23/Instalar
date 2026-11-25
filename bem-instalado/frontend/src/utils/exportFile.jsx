import { registerPlugin } from '@capacitor/core';
import { getNativeStorePlatform } from './nativePlatform';

const NativeFileExport = registerPlugin('NativeFileExport');
const MAX_EXPORT_BYTES = 16 * 1024 * 1024;
const TOO_LARGE_MESSAGE = 'O arquivo é grande demais para salvar no app. Baixe pelo site.';

function readBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reader.onabort = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const data = result.slice(result.indexOf(',') + 1);
      if (!result.startsWith('data:') || !data) reject(new Error('O arquivo veio vazio.'));
      else resolve(data);
    };
    reader.readAsDataURL(blob);
  });
}

export async function exportFile(payload, name, mimeType) {
  const type = payload?.type?.split(';')[0];
  if (type && type !== mimeType && type !== 'application/octet-stream') throw new Error('Formato inesperado.');
  const blob = payload instanceof Blob && payload.type === mimeType
    ? payload : new Blob([payload], { type: mimeType });
  if (!payload || !blob.size) throw new Error('O arquivo veio vazio.');

  if (getNativeStorePlatform() !== 'web') {
    if (blob.size > MAX_EXPORT_BYTES) throw Object.assign(new Error(TOO_LARGE_MESSAGE), { code: 'EXPORT_TOO_LARGE' });
    return NativeFileExport.save({ name, mimeType, data: await readBase64(blob) });
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  return { saved: true };
}

export async function exportErrorMessage(error, fallback) {
  const data = error?.response?.data;
  if (data instanceof Blob && data.type.includes('application/json')) {
    try {
      const body = JSON.parse(await data.text());
      return body.error || fallback;
    } catch {
      return fallback;
    }
  }
  return data?.error || (error?.code === 'EXPORT_TOO_LARGE' ? TOO_LARGE_MESSAGE : fallback);
}
