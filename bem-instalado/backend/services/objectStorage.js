const path = require('path');
const { Readable } = require('stream');

function safeFilename(filename) {
  const parsed = path.parse(String(filename || 'arquivo'));
  const base = parsed.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'arquivo';
  const extension = parsed.ext.toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
  return `${base}${extension}`;
}

function isObjectStorageConfigured() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
    (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID)
  );
}

async function storeProfileAsset({ userId, kind, file }) {
  if (!isObjectStorageConfigured()) {
    const error = new Error('Armazenamento de arquivos ainda não foi conectado na hospedagem.');
    error.code = 'OBJECT_STORAGE_NOT_CONFIGURED';
    throw error;
  }

  const { put } = require('@vercel/blob');
  const owner = String(userId || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'anonymous';
  const pathname = `uploads/${owner}/${kind}/${safeFilename(file.originalname)}`;
  const result = await put(pathname, file.buffer, {
    access: 'private',
    addRandomSuffix: true,
    contentType: file.mimetype,
  });

  return {
    pathname: result.pathname,
    content_type: file.mimetype,
    size: file.size,
    original_name: String(file.originalname || '').slice(0, 180),
  };
}

function encodeAssetKey(pathname) {
  return Buffer.from(String(pathname || ''), 'utf8').toString('base64url');
}

function decodeAssetKey(assetKey) {
  try {
    const value = Buffer.from(String(assetKey || ''), 'base64url').toString('utf8');
    return value.startsWith('uploads/') && !value.includes('..') ? value : '';
  } catch (_error) {
    return '';
  }
}

function publicAssetUrl(pathname) {
  return `/api/public/assets/${encodeAssetKey(pathname)}`;
}

function protectedAssetUrl(pathname) {
  return `/api/users/uploads/file/${encodeAssetKey(pathname)}`;
}

async function streamStoredAsset(pathname, res, { cacheControl = 'private, max-age=300' } = {}) {
  const { get } = require('@vercel/blob');
  const result = await get(pathname, { access: 'private' });

  if (!result) return false;
  res.set('Content-Type', result.blob?.contentType || result.headers?.get?.('content-type') || 'application/octet-stream');
  res.set('Cache-Control', cacheControl);
  res.set('X-Content-Type-Options', 'nosniff');
  Readable.fromWeb(result.stream).pipe(res);
  return true;
}

module.exports = {
  decodeAssetKey,
  isObjectStorageConfigured,
  protectedAssetUrl,
  publicAssetUrl,
  storeProfileAsset,
  streamStoredAsset,
};
