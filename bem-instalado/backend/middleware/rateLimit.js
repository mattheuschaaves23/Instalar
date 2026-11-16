const crypto = require('crypto');
const pool = require('../config/database');

const fallbackBuckets = new Map();
const MAX_FALLBACK_BUCKETS = 10000;
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
  bucket = 'default',
  message = 'Muitas tentativas. Aguarde alguns segundos e tente novamente.',
} = {}) {
  return async (req, res, next) => {
    const now = Date.now();
    const key = String(keyGenerator(req) || 'unknown');
    const route = typeof req.route?.path === 'string' ? req.route.path : req.path || '';
    const scope = `${req.method}:${req.baseUrl || ''}:${route}:${bucket}`.slice(0, 180);
    const scopedKey = `${scope}:${key}`;
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
      const stored = result.rows[0];
      const count = Number(stored.request_count || 0);
      const resetAt = new Date(stored.expires_at).getTime();
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

    if (now - lastFallbackCleanupAt > 60 * 1000) {
      cleanupExpiredEntries(now);
      lastFallbackCleanupAt = now;
    }

    const current = fallbackBuckets.get(keyHash);
    if (!current || current.resetAt <= now) {
      if (!current && fallbackBuckets.size >= MAX_FALLBACK_BUCKETS) {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({ error: message, retry_after_seconds: 60 });
      }
      fallbackBuckets.set(keyHash, { count: 1, resetAt: now + windowMs });
    } else {
      current.count += 1;
    }

    const stored = fallbackBuckets.get(keyHash);
    const remaining = Math.max(max - stored.count, 0);
    const retryAfterSeconds = Math.ceil(Math.max(stored.resetAt - now, 0) / 1000);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.floor(stored.resetAt / 1000)));

    if (stored.count > max) {
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
