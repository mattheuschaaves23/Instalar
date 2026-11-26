const { randomUUID } = require('node:crypto');
const { extname } = require('node:path');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { detectFileMimeType, normalizeMimeType } = require('./uploadValidation');
const limits = require('../../shared/dashboardAdLimits.json');

const MEDIA_PREFIX = '/api/public/dashboard-ads/media/';
const MEDIA_KEY = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const MAX_AD_MEDIA_BYTES = limits.inlineBytes;
const FILE_TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.mp4': 'video/mp4',
};

const makeMediaPath = (key = randomUUID()) => MEDIA_PREFIX + key;
const isAdMediaKey = (key) => typeof key === 'string' && MEDIA_KEY.test(key);
const isAdMediaPath = (path) => typeof path === 'string' && path.startsWith(MEDIA_PREFIX) && MEDIA_KEY.test(path.slice(MEDIA_PREFIX.length));
const adFileMimeType = (filename, kind) => {
  const expected = FILE_TYPES[extname(String(filename || '')).toLowerCase()];
  return expected?.startsWith(kind + '/') ? expected : '';
};

function isMp4(buffer) {
  // The browser verifies it can play the selected file before upload. At the
  // API boundary, check the MP4 container instead of trusting a name or MIME.
  const boxes = new Set();
  let offset = 0;
  for (let count = 0; offset < buffer.length && count < 256; count += 1) {
    if (offset + 8 > buffer.length) return false;
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > buffer.length) return false;
      const extended = buffer.readBigUInt64BE(offset + 8);
      if (extended > BigInt(buffer.length - offset)) return false;
      size = Number(extended);
      header = 16;
    } else if (size === 0) {
      size = buffer.length - offset;
    }
    if (size < header || offset + size > buffer.length) return false;
    if (type === 'ftyp') {
      if (offset !== 0 || size < header + 8) return false;
      const supportedBrand = /^(isom|iso[2-9]|mp4[12]|avc1|dash|M4V |MSNV)$/;
      const brand = buffer.toString('ascii', offset + header, offset + header + 4);
      if (!supportedBrand.test(brand)) {
        let compatible = false;
        for (let pos = offset + header + 8; pos + 4 <= offset + size; pos += 4) {
          if (supportedBrand.test(buffer.toString('ascii', pos, pos + 4))) {
            compatible = true;
            break;
          }
        }
        if (!compatible) return false;
      }
    }
    if (size > header) boxes.add(type);
    offset += size;
  }
  return offset === buffer.length && ['ftyp', 'moov', 'mdat'].every((box) => boxes.has(box));
}

function validateAdMedia(file, kind, maxBytes = MAX_AD_MEDIA_BYTES) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    return { error: 'Selecione um arquivo para a propaganda.' };
  }
  if (file.buffer.length > maxBytes) return { error: `O arquivo excede ${maxBytes / 1024 ** 2} MB.` };
  const expected = adFileMimeType(file.originalname, kind);
  const declared = normalizeMimeType(file.mimetype);
  if (!expected || !expected.startsWith(kind + '/') || (declared !== 'application/octet-stream' && declared !== expected)) {
    return { error: kind === 'video' ? 'Envie um vídeo MP4.' : 'Envie uma imagem JPG, PNG ou WebP.' };
  }
  const matchesContent = expected === 'video/mp4' ? isMp4(file.buffer) : detectFileMimeType(file.buffer) === expected;
  if (!matchesContent) return { error: 'O conteúdo não corresponde ao formato do arquivo.' };
  return { buffer: file.buffer, contentType: expected, path: makeMediaPath() };
}

function dashboardAdMediaHandler(db, { admin = false } = {}) {
  return async (req, res) => {
    const path = MEDIA_PREFIX + String(req.params.key || '');
    if (!isAdMediaPath(path)) return res.status(404).json({ error: 'Arquivo não encontrado.' });
    try {
      const { rows: [media] } = await db.query(
        `SELECT a.media_bytes, a.media_content_type, u.id AS upload_id, u.byte_length
         FROM dashboard_ads a
         LEFT JOIN dashboard_ad_uploads u ON u.ad_id = a.id AND u.id = $3::uuid
         WHERE a.media_url = $1 AND ($2::boolean OR a.is_active = TRUE)
           AND (a.media_bytes IS NOT NULL OR u.id IS NOT NULL) LIMIT 1`,
        [path, admin, req.params.key]
      );
      if (!media || !Object.values(FILE_TYPES).includes(media.media_content_type)) {
        return res.status(404).json({ error: 'Arquivo não encontrado.' });
      }
      const bytes = media.media_bytes;
      const length = media.byte_length || bytes.length;
      const range = req.range(length, { combine: true });
      if (range && (!Array.isArray(range) || range.type !== 'bytes' || range.length !== 1)) {
        return res.status(416).set('Content-Range', `bytes */${length}`).end();
      }
      res.set({
        'Accept-Ranges': 'bytes',
        'Cache-Control': admin ? 'private, no-store' : 'public, max-age=60',
        'Content-Type': media.media_content_type,
        'X-Content-Type-Options': 'nosniff',
      });
      const { start, end } = range ? range[0] : { start: 0, end: length - 1 };
      if (range) res.status(206).set('Content-Range', `bytes ${start}-${end}/${length}`);
      res.set('Content-Length', String(end - start + 1));
      if (req.method === 'HEAD') return res.end();
      if (media.upload_id) {
        // Read one part at a time; clients can seek without fetching the whole file.
        const chunkSize = limits.chunkBytes;
        async function* parts() {
          for (let index = Math.floor(start / chunkSize); index <= Math.floor(end / chunkSize) && !res.destroyed; index += 1) {
            const { rows: [part] } = await db.query(
              'SELECT bytes FROM dashboard_ad_upload_parts WHERE upload_id = $1 AND part_index = $2',
              [media.upload_id, index]
            );
            if (!part) throw new Error('Missing dashboard media part');
            yield part.bytes.subarray(Math.max(0, start - index * chunkSize), Math.min(part.bytes.length, end - index * chunkSize + 1));
          }
        }
        await pipeline(Readable.from(parts()), res);
        return;
      }
      return res.end(bytes.subarray(start, end + 1));
    } catch (_error) {
      if (res.destroyed || res.headersSent) return res.destroy();
      res.removeHeader('Content-Length');
      res.removeHeader('Content-Range');
      return res.status(503).json({ error: 'Arquivo temporariamente indisponível.' });
    }
  };
}

module.exports = { MAX_AD_MEDIA_BYTES, adFileMimeType, dashboardAdMediaHandler, isAdMediaKey, isAdMediaPath, makeMediaPath, validateAdMedia };
