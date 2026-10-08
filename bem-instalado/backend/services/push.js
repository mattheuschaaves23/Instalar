const pool = require('../config/database');

function firebaseConfig() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.project_id && parsed.client_email && parsed.private_key ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function getMessaging() {
  const serviceAccount = firebaseConfig();
  if (!serviceAccount) return null;
  try {
    const { getApps, initializeApp, cert } = require('firebase-admin/app');
    const { getMessaging: messagingForApp } = require('firebase-admin/messaging');
    const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount) });
    return messagingForApp(app);
  } catch (error) {
    console.error('Push não inicializado:', error.message);
    return null;
  }
}

function getWebPush() {
  const publicKey = String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || '').trim();
  const privateKey = String(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || '').trim();
  const subject = String(process.env.WEB_PUSH_SUBJECT || '').trim();
  if (!publicKey || !privateKey || !subject) return null;

  try {
    // web-push is intentionally optional until the VAPID environment variables
    // are configured. Native FCM keeps working independently.
    const webPush = require('web-push');
    webPush.setVapidDetails(subject, publicKey, privateKey);
    return webPush;
  } catch (_error) {
    return null;
  }
}

function isPushConfigured() {
  return Boolean(firebaseConfig() || getWebPush());
}

function isWebPushConfigured() {
  return Boolean(getWebPush());
}

async function registerDevice({ userId, platform, token }) {
  const normalizedPlatform = ['android', 'ios', 'web'].includes(String(platform || '').toLowerCase())
    ? String(platform).toLowerCase()
    : '';
  const normalizedToken = String(token || '').trim().slice(0, 4096);
  if (!normalizedPlatform || normalizedToken.length < 20) {
    const error = new Error('Dispositivo de notificação inválido.');
    error.code = 'INVALID_PUSH_DEVICE';
    throw error;
  }

  if (normalizedPlatform === 'web') {
    try {
      const subscription = JSON.parse(normalizedToken);
      if (!String(subscription?.endpoint || '').startsWith('https://') || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        throw new Error('invalid_web_push_subscription');
      }
    } catch (_error) {
      const error = new Error('Assinatura de notificação do navegador inválida.');
      error.code = 'INVALID_WEB_PUSH_SUBSCRIPTION';
      throw error;
    }
  }

  const result = await pool.query(
    `INSERT INTO notification_devices (user_id, platform, token, active, last_seen_at, updated_at)
     VALUES ($1, $2, $3, TRUE, NOW(), NOW())
     ON CONFLICT (token) DO UPDATE
     SET user_id = EXCLUDED.user_id,
         platform = EXCLUDED.platform,
         active = TRUE,
         last_seen_at = NOW(),
         updated_at = NOW()
     RETURNING id, platform, last_seen_at`,
    [userId, normalizedPlatform, normalizedToken]
  );
  return result.rows[0];
}

async function unregisterDevice({ userId, deviceId }) {
  const result = await pool.query(
    `UPDATE notification_devices SET active = FALSE, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [deviceId, userId]
  );
  return result.rowCount > 0;
}

async function sendNativePush({ messaging, devices, title, body, data }) {
  if (!messaging || !devices.length) return { sent: 0, failed: 0, invalidIds: [] };
  const response = await messaging.sendEachForMulticast({
    tokens: devices.map((device) => device.token),
    notification: { title: String(title || 'InstalaPro'), body: String(body || '') },
    data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])),
    android: { priority: 'high', notification: { channelId: 'instalapro_alerts' } },
    apns: { payload: { aps: { sound: 'default' } } },
  });
  const invalidIds = [];
  response.responses.forEach((item, index) => {
    const code = item.error?.code || '';
    if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
      invalidIds.push(devices[index].id);
    }
  });
  return { sent: response.successCount, failed: response.failureCount, invalidIds };
}

async function sendWebPush({ webPush, devices, title, body, data }) {
  if (!webPush || !devices.length) return { sent: 0, failed: 0, invalidIds: [] };
  const payload = JSON.stringify({
    title: String(title || 'InstalaPro'),
    body: String(body || ''),
    data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])),
  });
  let sent = 0;
  let failed = 0;
  const invalidIds = [];

  for (const device of devices) {
    try {
      await webPush.sendNotification(JSON.parse(device.token), payload, { TTL: 60 * 60 });
      sent += 1;
    } catch (error) {
      failed += 1;
      if ([404, 410].includes(Number(error?.statusCode))) invalidIds.push(device.id);
    }
  }
  return { sent, failed, invalidIds };
}

async function sendPushToUser({ userId, title, body, data = {} }) {
  if (!userId) return { sent: 0, reason: 'missing_user' };
  const [nativeResult, webResult] = await Promise.all([
    pool.query(`SELECT id, token FROM notification_devices WHERE user_id = $1 AND active = TRUE AND platform IN ('android', 'ios')`, [userId]),
    pool.query(`SELECT id, token FROM notification_devices WHERE user_id = $1 AND active = TRUE AND platform = 'web'`, [userId]),
  ]);
  const native = await sendNativePush({ messaging: getMessaging(), devices: nativeResult.rows, title, body, data });
  const web = await sendWebPush({ webPush: getWebPush(), devices: webResult.rows, title, body, data });
  const invalidIds = [...native.invalidIds, ...web.invalidIds];
  if (invalidIds.length) {
    await pool.query(
      `UPDATE notification_devices SET active = FALSE, updated_at = NOW() WHERE id = ANY($1::int[])`,
      [invalidIds]
    );
  }
  const sent = native.sent + web.sent;
  return { sent, failed: native.failed + web.failed, reason: sent ? undefined : 'not_configured' };
}

module.exports = {
  isPushConfigured,
  isWebPushConfigured,
  registerDevice,
  sendPushToUser,
  unregisterDevice,
};
