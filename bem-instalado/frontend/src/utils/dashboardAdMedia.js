import limits from '../../../shared/dashboardAdLimits.json';

export const AD_INLINE_LIMIT = limits.inlineBytes;
export const AD_BANNER_WIDTH = 1440;
export const AD_BANNER_HEIGHT = 240;
export const AD_FILE_ACCEPT = {
  image: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
  video: '.mp4,video/mp4',
};
const AD_MEDIA_PATH = /^\/api\/public\/dashboard-ads\/media\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const VALID_UPLOAD_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const uploadPath = '/admin/dashboard-ads/uploads';

export const adFileMaximumMb = (kind) => (kind === 'video' ? limits.videoBytes : limits.imageBytes) / 1024 ** 2;

export function adMediaFileError(file, kind) {
  if (!file) return '';
  if (!file.size) return 'O arquivo está vazio.';
  const maxMb = adFileMaximumMb(kind);
  if (file.size > maxMb * 1024 ** 2) return `O arquivo excede ${maxMb} MB.`;
  const extension = kind === 'video' ? /\.mp4$/i : /\.(?:jpe?g|png|webp)$/i;
  if (!extension.test(file.name)) return kind === 'video' ? 'Envie um vídeo MP4.' : 'Envie uma imagem JPG, PNG ou WebP.';
  return '';
}

export async function removePendingDashboardAdUpload(api, id) {
  if (VALID_UPLOAD_ID.test(id || '')) await api.delete(`${uploadPath}/${id}`).catch(() => {});
}

export async function sendDashboardAdInParts(api, file, mediaType, onProgress) {
  const { data } = await api.post(uploadPath, { size: file.size, filename: file.name, media_type: mediaType });
  if (!VALID_UPLOAD_ID.test(data?.id || '') || data.chunk_size !== limits.chunkBytes) {
    throw new Error('Não foi possível iniciar o envio do arquivo.');
  }
  const id = data.id;
  const chunkSize = data.chunk_size;
  try {
    for (let offset = 0, part = 0; offset < file.size; offset += chunkSize, part += 1) {
      const end = Math.min(file.size, offset + chunkSize);
      const form = new FormData();
      form.append('file', file.slice(offset, end), 'parte');
      const report = (sent) => onProgress(Math.min(99, Math.round((offset + sent) / file.size * 100)));
      const send = () => api.put(`${uploadPath}/${id}/${part}`, form, {
        timeout: 90_000,
        onUploadProgress: ({ loaded, total }) => { if (total) report(Math.min(end - offset, loaded / total * (end - offset))); },
      });
      try {
        await send();
      } catch (error) {
        const status = error.response?.status;
        if (status && status < 500) throw error;
        await send();
      }
      report(end - offset);
    }
    return id;
  } catch (error) {
    await removePendingDashboardAdUpload(api, id);
    throw error;
  }
}

export function resolveDashboardAdMedia(value, apiBase, { admin = false } = {}) {
  if (!AD_MEDIA_PATH.test(value || '')) return value;
  const path = admin ? value.replace('/api/public/', '/api/admin/') : value;
  return /^https?:\/\//i.test(apiBase || '') ? apiBase.replace(/\/+$/, '') + path.slice('/api'.length) : path;
}
