const { randomUUID } = require('node:crypto');
const limits = require('../../shared/dashboardAdLimits.json');
const { adFileMimeType, isAdMediaKey, makeMediaPath, validateAdMedia } = require('../utils/dashboardAdMedia');

class DashboardAdUploadError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const fail = (status, message) => { throw new DashboardAdUploadError(status, message); };
const maximumFor = (kind) => kind === 'image' ? limits.imageBytes : kind === 'video' ? limits.videoBytes : 0;
const expired = 'Arquivo não encontrado ou envio expirado.';

async function transaction(pool, action) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const result = await action(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    db.release();
  }
}

async function startDashboardAdUpload(pool, ownerId, input) {
  const kind = input.media_type;
  const filename = typeof input.filename === 'string' ? input.filename : '';
  const contentType = filename.length <= 180 && adFileMimeType(filename, kind);
  const size = input.size;
  const maximum = maximumFor(kind);
  if (!maximum || !contentType || !Number.isSafeInteger(size) || size <= 0) {
    fail(400, 'Selecione um arquivo JPG, PNG, WebP ou MP4 válido.');
  }
  if (size > maximum) fail(413, `O arquivo excede ${maximum / 1024 ** 2} MB.`);
  return transaction(pool, async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(116428, $1::integer)', [ownerId]);
    await db.query('DELETE FROM dashboard_ad_uploads WHERE ad_id IS NULL AND expires_at <= NOW() AND owner_id = $1', [ownerId]);
    const { rows: [pending] } = await db.query(
      'SELECT COUNT(*)::int AS count FROM dashboard_ad_uploads WHERE owner_id = $1 AND ad_id IS NULL', [ownerId]
    );
    if (pending.count >= 2) fail(429, 'Já existem dois envios em andamento. Aguarde ou tente novamente mais tarde.');
    const id = randomUUID();
    await db.query('INSERT INTO dashboard_ad_uploads (id, owner_id, filename, content_type, byte_length) VALUES ($1,$2,$3,$4,$5)',
      [id, ownerId, filename, contentType, size]);
    return { id, chunk_size: limits.chunkBytes };
  });
}

async function pendingUpload(db, ownerId, id) {
  if (!isAdMediaKey(id)) fail(404, expired);
  const { rows: [upload] } = await db.query(
    'SELECT * FROM dashboard_ad_uploads WHERE id = $1 AND owner_id = $2 AND ad_id IS NULL AND expires_at > NOW() FOR UPDATE',
    [id, ownerId]
  );
  if (!upload) fail(404, expired);
  return upload;
}

async function appendDashboardAdPart(pool, ownerId, id, part, bytes) {
  if (!/^\d{1,2}$/.test(part) || !Buffer.isBuffer(bytes) || !bytes.length) fail(400, 'Parte do arquivo inválida.');
  const index = Number(part);
  return transaction(pool, async (db) => {
    const upload = await pendingUpload(db, ownerId, id);
    const expectedSize = Math.min(limits.chunkBytes, upload.byte_length - index * limits.chunkBytes);
    if (bytes.length !== expectedSize || expectedSize <= 0) fail(400, 'O tamanho da parte não corresponde ao arquivo.');
    if (index < upload.next_part) {
      const result = await db.query(
        'SELECT 1 FROM dashboard_ad_upload_parts WHERE upload_id = $1 AND part_index = $2 AND bytes = $3',
        [id, index, bytes]
      );
      if (!result.rowCount) fail(409, 'Esta parte já foi enviada com outro conteúdo.');
      return;
    }
    if (index !== upload.next_part) fail(409, 'Envie as partes do arquivo na ordem.');
    await db.query('INSERT INTO dashboard_ad_upload_parts (upload_id, part_index, bytes) VALUES ($1,$2,$3)', [id, index, bytes]);
    await db.query("UPDATE dashboard_ad_uploads SET next_part = next_part + 1, expires_at = NOW() + INTERVAL '1 hour' WHERE id = $1", [id]);
  });
}

async function cancelDashboardAdUpload(pool, ownerId, id) {
  if (isAdMediaKey(id)) await pool.query('DELETE FROM dashboard_ad_uploads WHERE id = $1 AND owner_id = $2 AND ad_id IS NULL', [id, ownerId]);
}

async function writeAdWithUpload(pool, { id, ownerId, kind, adId, replacing = false }, write) {
  if (!id && !replacing) return write(pool, null);
  return transaction(pool, async (db) => {
    let media = null;
    if (id) {
      const upload = await pendingUpload(db, ownerId, id);
      if (!upload.content_type.startsWith(kind + '/')) fail(400, 'O arquivo não corresponde ao formato escolhido.');
      const partCount = Math.ceil(upload.byte_length / limits.chunkBytes);
      if (upload.next_part !== partCount) fail(409, 'O envio do arquivo ainda não terminou.');
      const { rows } = await db.query('SELECT bytes FROM dashboard_ad_upload_parts WHERE upload_id = $1 ORDER BY part_index', [id]);
      if (rows.length !== partCount || rows.reduce((size, row) => size + row.bytes.length, 0) !== upload.byte_length) {
        fail(409, 'O envio do arquivo ainda não terminou.');
      }
      const verified = validateAdMedia({
        buffer: Buffer.concat(rows.map((row) => row.bytes), upload.byte_length),
        originalname: upload.filename,
        mimetype: upload.content_type,
      }, kind, maximumFor(kind));
      if (verified.error) fail(400, verified.error);
      media = { path: makeMediaPath(id), buffer: null, contentType: verified.contentType };
    }
    const ad = await write(db, media);
    if (!ad) fail(409, 'O anúncio foi alterado. Reabra a edição e tente novamente.');
    if (replacing) await db.query('DELETE FROM dashboard_ad_uploads WHERE ad_id = $1', [adId]);
    if (id) await db.query('UPDATE dashboard_ad_uploads SET ad_id = $1 WHERE id = $2', [ad.id, id]);
    return ad;
  });
}

module.exports = { DashboardAdUploadError, appendDashboardAdPart, cancelDashboardAdUpload, startDashboardAdUpload, writeAdWithUpload };
