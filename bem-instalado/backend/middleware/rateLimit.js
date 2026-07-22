const crypto = require('crypto');
const pool = require('../config/database');

const fallbackBuckets = new Map();
let lastFallbackCleanupAt = 0;

function getClientIp(req) {
  const rawIp = String(req.ip || req.socket?.remoteAddress || '').trim();
  const normalized = rawIp.replace(/^::ffff:/, '');
  return normalized || 'unknown';
}

function cleanupExpiredEntries(now) {
  for (const [key, bucket] of fallbackBuckets.entries()) {
    if (bucket.resetAt <= now) {
      fallbackBuckets.delete(key);
    }
  }
}

function defaultKeyGenerator(req) {
  return getClientIp(req);
}

function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 60,
  keyGenerator = defaultKeyGenerator,
  message = 'Muitas tentativas. Aguarde alguns segundos e tente novamente.',
} = {}) {
  return async (req, res, next) => {
    const now = Date.now();
    const key = String(keyGenerator(req) || 'unknown');
    const scopedKey = `${req.method}:${req.baseUrl || ''}:${req.path || ''}:${key}`;
    const scope = `${req.method}:${req.baseUrl || ''}:${req.path || ''}`.slice(0, 180);
    const keyHash = crypto.createHash('sha256').update(scopedKey).digest('hex');
    const windowStartedAt = new Date(Math.floor(now / windowMs) * windowMs);
    const expiresAt = new Date(windowStartedAt.getTime() + windowMs);

    try {
      const result = await pool.query(
        `
          INSERT INTO api_rate_limits (scope, key_hash, window_started_at, request_count, expires_at)
          VALUES ($1, $2, $3, 1, $4)
          ON CONFLICT (scope, key_hash, window_started_at)
          DO UPDATE SET request_count = api_rate_limits.request_count + 1
          RETURNING request_count, expires_at
        `,
        [scope, keyHash, windowStartedAt, expiresAt]
      );
      const bucket = result.rows[0];
      const count = Number(bucket.request_count || 0);
      const resetAt = new Date(bucket.expires_at).getTime();
      const remaining = Math.max(max - count, 0);
      const retryAfterSeconds = Math.ceil(Math.max(resetAt - now, 0) / 1000);

      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Reset', String(Math.floor(resetAt / 1000)));

      if (Math.random() < 0.01) {
        pool.query('DELETE FROM api_rate_limits WHERE expires_at < NOW() - INTERVAL \'1 hour\'').catch(() => null);
      }

      if (count > max) {
        res.setHeader('Retry-After', String(retryAfterSeconds));
        return res.status(429).json({
          error: message,
          retry_after_seconds: retryAfterSeconds,
        });
      }

      return next();
    } catch (_error) {
      // A protecao local mantem um limite conservador durante falhas transitorias do banco.
    }

    const current = fallbackBuckets.get(scopedKey);

    if (!current || current.resetAt <= now) {
      fallbackBuckets.set(scopedKey, { count: 1, resetAt: now + windowMs });
    } else {
      current.count += 1;
      fallbackBuckets.set(scopedKey, current);
    }

    if (now - lastFallbackCleanupAt > 60 * 1000) {
      cleanupExpiredEntries(now);
      lastFallbackCleanupAt = now;
    }

    const bucket = fallbackBuckets.get(scopedKey);
    const remaining = Math.max(max - bucket.count, 0);
    const retryAfterSeconds = Math.ceil(Math.max(bucket.resetAt - now, 0) / 1000);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.floor(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        error: message,
        retry_after_seconds: retryAfterSeconds,
      });
    }

    return next();
  };
}

module.exports = {
  createRateLimiter,
  getClientIp,
};
