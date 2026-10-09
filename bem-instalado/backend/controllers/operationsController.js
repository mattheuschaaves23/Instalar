const pool = require('../config/database');
const { deliverySummary, processEmailDeliveries } = require('../services/outboundDelivery');
const { sendOperationsHeartbeat } = require('../services/betterStack');
const { logApplicationError } = require('../utils/errorMonitoring');

function batchSize() {
  const value = Number(process.env.OUTBOUND_DELIVERY_BATCH_SIZE || 20);
  return Number.isInteger(value) ? Math.min(Math.max(value, 1), 50) : 20;
}

exports.run = async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    const email = await processEmailDeliveries({ limit: batchSize() });
    const deliveries = await deliverySummary();
    const heartbeat = await sendOperationsHeartbeat();
    res.set('Cache-Control', 'no-store');
    return res.json({
      ok: true,
      healthy: email.failed === 0 && deliveries.failed === 0 && (heartbeat.sent || heartbeat.reason === 'betterstack_not_configured'),
      ran_at: new Date().toISOString(),
      email,
      deliveries,
      monitoring: { heartbeat: heartbeat.sent ? 'sent' : heartbeat.reason },
    });
  } catch (error) {
    console.error('Falha na rotina operacional.', error);
    void logApplicationError({
      message: error.message,
      stack: error.stack,
      req: _req,
      source: 'operations',
      statusCode: 503,
    });
    return res.status(503).json({ ok: false, error: 'A rotina operacional não foi concluída.' });
  }
};

exports.status = async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    const deliveries = await deliverySummary();
    res.set('Cache-Control', 'no-store');
    return res.json({ ok: true, database: 'connected', deliveries, checked_at: new Date().toISOString() });
  } catch (_error) {
    return res.status(503).json({ ok: false, database: 'unavailable' });
  }
};
