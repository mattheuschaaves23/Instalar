const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const express = require('express');

test('anúncios em banco isolado: arquivo validado, publicação, pausa e URL antiga preservada', {
  skip: !process.env.TEST_DATABASE_URL,
}, async (t) => {
  const target = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Use um banco de teste local.');
  process.env.DATABASE_URL = target.href;
  process.env.DATABASE_SSL = 'false';
  process.env.DB_POOL_MAX = '1';
  process.env.JWT_SECRET ||= 'integration-test-secret-with-at-least-32-characters';
  const pool = require('../config/database');
  t.after(() => pool.end());
  const adminRoutes = require('../routes/adminRoutes');
  const publicRoutes = require('../routes/publicRoutes');
  const jwt = require('jsonwebtoken');
  await pool.query(`
    CREATE TEMP TABLE users (id int, account_type text, is_admin boolean, auth_version int, email_verified_at timestamp, deleted_at timestamp);
    INSERT INTO users VALUES (1, 'installer', true, 0, NOW(), NULL), (2, 'installer', false, 0, NOW(), NULL);
    CREATE TEMP TABLE audit_logs (actor_user_id int, action text, entity_type text, entity_id text, metadata jsonb, ip_address text, user_agent text);
    CREATE TEMP TABLE api_rate_limits (scope text, key_hash text, window_started_at timestamptz,
      request_count int, expires_at timestamptz, PRIMARY KEY (scope, key_hash, window_started_at));
    CREATE TEMP TABLE dashboard_ads (id serial PRIMARY KEY, title text, description text, media_type text, media_url text,
      link_url text, cta_label text, is_active boolean, sort_order int, created_at timestamp DEFAULT NOW(), updated_at timestamp DEFAULT NOW());
    INSERT INTO dashboard_ads (title, media_type, media_url, is_active, sort_order)
      VALUES ('Arte legada', 'image', 'https://example.test/banner.png', TRUE, 0);
  `);
  for (const name of ['026_dashboard_ad_media.sql', '027_dashboard_ad_large_uploads.sql']) {
    const sql = readFileSync(join(__dirname, '../db/migrations', name), 'utf8');
    await pool.query(sql.replaceAll('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE IF NOT EXISTS'));
  }
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use('/api/public', publicRoutes);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once('listening', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const admin = { Authorization: 'Bearer ' + jwt.sign({ id: 1 }, process.env.JWT_SECRET) };
  const nonAdmin = { Authorization: 'Bearer ' + jwt.sign({ id: 2 }, process.env.JWT_SECRET) };
  const adsPath = '/api/admin/dashboard-ads';
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+tmWQAAAAASUVORK5CYII=', 'base64');
  const multipart = (bytes) => {
    const form = new FormData();
    form.append('title', 'Arquivo QA');
    form.append('media_type', 'image');
    form.append('file', new Blob([bytes], { type: 'image/png' }), 'banner.png');
    return form;
  };
  const send = (path, options) => fetch(origin + path, options);
  assert.equal((await send(adsPath, { method: 'POST', body: multipart(png) })).status, 401);
  assert.equal((await send(adsPath, { method: 'POST', headers: nonAdmin, body: multipart(png) })).status, 403);
  assert.equal((await send(adsPath, { method: 'POST', headers: admin, body: multipart('sem imagem') })).status, 400);
  const json = { ...admin, 'Content-Type': 'application/json' };
  assert.equal((await send(adsPath, {
    method: 'POST', headers: json, body: JSON.stringify({ title: 'Novo anúncio sem arquivo', media_url: 'https://example.test/new.png' }),
  })).status, 400);
  const legacy = await send(adsPath + '/1', { method: 'PATCH', headers: json, body: '{"title":"Arte legada editada"}' });
  assert.equal(legacy.status, 200);
  assert.equal((await legacy.json()).ad.media_url, 'https://example.test/banner.png');
  const created = await send(adsPath, { method: 'POST', headers: admin, body: multipart(png) });
  assert.equal(created.status, 201);
  const { ad } = await created.json();
  const listPath = '/api/public/dashboard-ads';
  const visible = (await (await send(listPath)).json()).ads;
  assert.equal(visible.find((item) => item.id === 1).media_url, 'https://example.test/banner.png');
  const delivered = await send(new URL(visible.find((item) => item.id === ad.id).media_url, origin).pathname);
  assert.equal(delivered.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await delivered.arrayBuffer()), png);
  const range = await send(ad.media_url, { headers: { Range: 'bytes=0-7' } });
  assert.equal(range.status, 206);
  assert.deepEqual(Buffer.from(await range.arrayBuffer()), png.subarray(0, 8));
  const replace = await send(adsPath + '/' + ad.id, { method: 'PATCH', headers: admin, body: multipart(png) });
  assert.equal(replace.status, 200);
  const replacement = (await replace.json()).ad;
  assert.notEqual(replacement.media_url, ad.media_url);
  assert.equal((await send(ad.media_url)).status, 404);
  const pause = await send(adsPath + '/' + ad.id, {
    method: 'PATCH', headers: json, body: '{"is_active":false}',
  });
  assert.equal(pause.status, 200);
  assert.equal((await send(replacement.media_url)).status, 404);
  const previewPath = replacement.media_url.replace('/public/', '/admin/');
  assert.equal((await send(previewPath, { headers: nonAdmin })).status, 403);
  const preview = await send(previewPath, { headers: admin });
  assert.equal(preview.status, 200);
  assert.deepEqual(Buffer.from(await preview.arrayBuffer()), png);

  // MP4-like fixture with a substantive data box; this tests end-to-end
  // storage/range delivery, not a video decoder.
  const box = (kind, bytes) => {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(8 + bytes.length);
    header.write(kind, 4);
    return Buffer.concat([header, bytes]);
  };
  const videoHeader = Buffer.concat([box('ftyp', Buffer.from('isom\0\0\0\0isom')), box('moov', Buffer.from('metadata'))]);
  const videoSize = process.env.QA_AD_MEDIA_AT_LIMIT === '1' ? 50 * 1024 * 1024 : 6 * 1024 * 1024 + videoHeader.length + 8;
  const video = Buffer.concat([videoHeader, box('mdat', Buffer.alloc(videoSize - videoHeader.length - 8, 0x12))]);
  const uploadPath = adsPath + '/uploads';
  const secondAdmin = { Authorization: 'Bearer ' + jwt.sign({ id: 3 }, process.env.JWT_SECRET) };
  await pool.query("INSERT INTO users VALUES (3, 'installer', true, 0, NOW(), NULL)");
  const startUpload = async (size) => send(uploadPath, {
    method: 'POST', headers: json,
    body: JSON.stringify({ size, filename: 'banner.mp4', media_type: 'video' }),
  });
  assert.equal((await startUpload(51 * 1024 * 1024)).status, 413);
  const started = await startUpload(video.length);
  assert.equal(started.status, 201);
  const { id: uploadId, chunk_size: chunkSize } = await started.json();
  assert.equal(chunkSize, 3 * 1024 * 1024);
  const part = (index, headers = admin) => {
    const body = new FormData();
    body.set('file', new Blob([video.subarray(index * chunkSize, (index + 1) * chunkSize)]), 'parte');
    return send(uploadPath + '/' + uploadId + '/' + index, { method: 'PUT', headers, body });
  };
  assert.equal((await part(0, secondAdmin)).status, 404);
  assert.equal((await part(1)).status, 409);
  assert.equal((await part(0)).status, 204);
  assert.equal((await part(0)).status, 204);
  const save = (method = 'POST', path = adsPath) => send(path, {
    method, headers: json, body: JSON.stringify({ title: 'Vídeo grande QA', media_type: 'video', upload_id: uploadId }),
  });
  assert.equal((await save()).status, 409);
  for (let index = 1; index * chunkSize < video.length; index += 1) {
    assert.equal((await part(index)).status, 204);
  }
  const largeAdResponse = await save();
  assert.equal(largeAdResponse.status, 201);
  const largeAd = (await largeAdResponse.json()).ad;
  assert.equal((await save()).status, 404);
  const full = await send(largeAd.media_url);
  assert.equal(full.status, 200);
  assert.deepEqual(Buffer.from(await full.arrayBuffer()), video);
  const partial = await send(largeAd.media_url, { headers: { Range: 'bytes=' + (chunkSize - 3) + '-' + (chunkSize + 3) } });
  assert.equal(partial.status, 206);
  assert.deepEqual(Buffer.from(await partial.arrayBuffer()), video.subarray(chunkSize - 3, chunkSize + 4));
  const updated = await send(adsPath + '/' + largeAd.id, { method: 'PATCH', headers: admin, body: multipart(png) });
  assert.equal(updated.status, 200);
  assert.equal((await send(largeAd.media_url)).status, 404);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM dashboard_ad_upload_parts WHERE upload_id = $1', [uploadId])).rows[0].count, 0);
  const cancelled = await startUpload(video.length);
  const { id: cancelledId } = await cancelled.json();
  assert.equal((await send(uploadPath + '/' + cancelledId, { method: 'DELETE', headers: admin })).status, 204);
  assert.equal((await pool.query('SELECT id FROM dashboard_ad_uploads WHERE id = $1', [cancelledId])).rowCount, 0);
});
