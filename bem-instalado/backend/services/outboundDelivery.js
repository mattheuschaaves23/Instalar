const crypto = require('crypto');
const pool = require('../config/database');
const { isEmailEnabled, sendEmailMessage } = require('./email');
const { notifyOperationalAlert } = require('./operationalAlerts');

const DEFAULT_MAX_ATTEMPTS = 5;

function maxAttempts() {
  const value = Number(process.env.OUTBOUND_DELIVERY_MAX_ATTEMPTS || DEFAULT_MAX_ATTEMPTS);
  return Number.isInteger(value) ? Math.min(Math.max(value, 1), 12) : DEFAULT_MAX_ATTEMPTS;
}

function deliveryKey({ to, category, message }) {
  return crypto
    .createHash('sha256')
    .update(`${category}:${String(to).toLowerCase()}:${message.subject}:${message.text || ''}`)
    .digest('hex');
}

function sanitizeMessage(message) {
  return {
    subject: String(message?.subject || '').trim().slice(0, 220),
    text: String(message?.text || '').slice(0, 40000),
    html: String(message?.html || '').slice(0, 120000),
  };
}

async function queueEmailDelivery({ to, message, category = 'transactional', idempotencyKey }) {
  const recipient = String(to || '').trim().toLowerCase();
  const safeMessage = sanitizeMessage(message);
  if (!recipient || !safeMessage.subject) return { sent: false, reason: 'invalid_email_payload' };
  if (!isEmailEnabled()) return { sent: false, reason: 'smtp_not_configured' };

  const key = String(idempotencyKey || deliveryKey({ to: recipient, category, message: safeMessage })).slice(0, 180);
  const inserted = await pool.query(
    `INSERT INTO outbound_deliveries (channel, recipient, payload, category, idempotency_key, max_attempts)
     VALUES ('email', $1, $2::jsonb, $3, $4, $5)
     ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = NOW()
     RETURNING id, status`,
    [recipient, JSON.stringify(safeMessage), String(category || 'transactional').slice(0, 80), key, maxAttempts()]
  );
  const delivery = inserted.rows[0];

  // Try once while the originating request is still active. The queued record
  // remains available for the protected operations endpoint if SMTP is down.
  await processEmailDeliveries({ limit: 1, onlyDeliveryId: delivery.id });
  const fresh = await pool.query('SELECT status, attempts FROM outbound_deliveries WHERE id = $1', [delivery.id]);
  const status = fresh.rows[0]?.status || delivery.status;
  return {
    sent: status === 'sent',
    queued: status === 'pending' || status === 'processing',
    failed: status === 'failed',
    attempts: Number(fresh.rows[0]?.attempts || 0),
  };
}

async function claimDeliveries({ limit, onlyDeliveryId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE outbound_deliveries
       SET status = 'pending', locked_at = NULL, updated_at = NOW()
       WHERE status = 'processing' AND locked_at < NOW() - INTERVAL '15 minutes'`
    );
    const claimed = await client.query(
      `WITH candidate AS (
         SELECT id
         FROM outbound_deliveries
         WHERE status = 'pending'
           AND next_attempt_at <= NOW()
           AND ($2::bigint IS NULL OR id = $2)
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE outbound_deliveries d
       SET status = 'processing', attempts = attempts + 1, locked_at = NOW(), updated_at = NOW()
       FROM candidate
       WHERE d.id = candidate.id
       RETURNING d.*`,
      [limit, onlyDeliveryId || null]
    );
    await client.query('COMMIT');
    return claimed.rows;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    client.release();
  }
}

function retryMinutes(attempt) {
  return Math.min(60, Math.max(1, 2 ** Math.max(0, Number(attempt) - 1)));
}

async function markFailed(delivery, error) {
  const reason = String(error?.message || 'email_delivery_failed').slice(0, 1200);
  const permanent = Number(delivery.attempts) >= Number(delivery.max_attempts);
  await pool.query(
    `UPDATE outbound_deliveries
     SET status = $2,
         locked_at = NULL,
         last_error = $3,
         next_attempt_at = CASE WHEN $2 = 'pending' THEN NOW() + ($4::int * INTERVAL '1 minute') ELSE next_attempt_at END,
         updated_at = NOW()
     WHERE id = $1`,
    [delivery.id, permanent ? 'failed' : 'pending', reason, retryMinutes(delivery.attempts)]
  );

  if (permanent) {
    await notifyOperationalAlert({
      severity: 'critical',
      source: 'outbound-email',
      message: `E-mail não entregue após ${delivery.attempts} tentativas (${delivery.category}).`,
      metadata: { delivery_id: delivery.id, category: delivery.category, attempts: delivery.attempts },
    });
  }
}

async function processEmailDeliveries({ limit = 20, onlyDeliveryId = null, timeBudgetMs = 18000 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const deadline = Date.now() + Math.min(Math.max(Number(timeBudgetMs) || 18000, 1000), 18000);
  let claimed = 0;
  let sent = 0;
  let failed = 0;

  // Claim only the message about to be sent. The rest stays available to other
  // workers and does not consume an attempt if this serverless call times out.
  while (claimed < safeLimit && deadline - Date.now() > 1000) {
    const [delivery] = await claimDeliveries({ limit: 1, onlyDeliveryId });
    if (!delivery) break;
    claimed += 1;
    try {
      await sendEmailMessage({ to: delivery.recipient, ...delivery.payload, timeoutMs: Math.min(12000, Math.max(1, deadline - Date.now() - 1000)) });
      await pool.query(
        `UPDATE outbound_deliveries
         SET status = 'sent', sent_at = NOW(), locked_at = NULL, last_error = NULL, updated_at = NOW()
         WHERE id = $1`,
        [delivery.id]
      );
      sent += 1;
    } catch (error) {
      failed += 1;
      await markFailed(delivery, error);
    }
  }

  return { claimed, sent, failed };
}

async function deliverySummary() {
  const result = await pool.query(
    `SELECT status, COUNT(*)::int AS count
     FROM outbound_deliveries
     WHERE created_at > NOW() - INTERVAL '30 days'
     GROUP BY status`
  );
  return result.rows.reduce((summary, row) => ({ ...summary, [row.status]: row.count }), {
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0,
  });
}

module.exports = { deliverySummary, processEmailDeliveries, queueEmailDelivery };
