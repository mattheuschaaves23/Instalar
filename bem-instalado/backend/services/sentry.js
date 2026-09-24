const crypto = require('crypto');
const { firstEnvValue } = require('../config/env');

const SENSITIVE_VALUE = /(?:bearer\s+)?[a-z0-9._-]{24,}/gi;
const EMAIL_VALUE = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi;
const PHONE_VALUE = /\+?\d[\d\s().-]{7,}\d/g;

function clean(value, maxLength = 2000) {
  return String(value || '')
    .replace(EMAIL_VALUE, '[email]')
    .replace(PHONE_VALUE, '[telefone]')
    .replace(SENSITIVE_VALUE, '[segredo]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function parseDsn(rawDsn = firstEnvValue('SENTRY_DSN', 'SENTINELA_DSN')) {
  const dsn = String(rawDsn || '').trim();
  if (!dsn) return null;

  try {
    const parsed = new URL(dsn);
    const projectId = parsed.pathname.split('/').filter(Boolean).pop();
    const publicKey = decodeURIComponent(parsed.username || '');
    if (!projectId || !publicKey || !/^https?:$/.test(parsed.protocol)) return null;

    return {
      dsn,
      endpoint: `${parsed.protocol}//${parsed.host}/api/${projectId}/envelope/?sentry_key=${encodeURIComponent(publicKey)}&sentry_version=7`,
    };
  } catch (_error) {
    return null;
  }
}

function getSentryConfig() {
  return parseDsn();
}

function isConfigured() {
  return Boolean(getSentryConfig());
}

function createEnvelope(error, context = {}) {
  const eventId = crypto.randomUUID().replace(/-/g, '');
  const message = clean(error?.message || error || 'Erro sem mensagem', 1200);
  const stack = clean(error?.stack || '', 8000);
  const tags = Object.fromEntries(
    Object.entries({
      environment: process.env.NODE_ENV || 'development',
      release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || undefined,
      source: clean(context.source || 'backend', 40),
      route: clean(context.route || '', 180) || undefined,
      method: clean(context.method || '', 12) || undefined,
      status_code: context.statusCode ? String(context.statusCode) : undefined,
    }).filter(([, value]) => value)
  );
  const event = {
    event_id: eventId,
    level: context.level || 'error',
    logger: 'instalapro.backend',
    message,
    platform: 'node',
    server_name: 'instalapro-api',
    tags,
    exception: {
      values: [{ type: error?.name || 'Error', value: message, stacktrace: stack ? { frames: [{ filename: 'backend', function: 'application', context_line: stack }] } : undefined }],
    },
  };

  return `${JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() })}\n${JSON.stringify({ type: 'event', content_type: 'application/json' })}\n${JSON.stringify(event)}`;
}

async function captureException(error, context = {}) {
  const config = getSentryConfig();
  if (!config) return { sent: false, reason: 'sentry_not_configured' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body: createEnvelope(error, context),
      signal: controller.signal,
    });
    return { sent: response.ok, status: response.status };
  } catch (_error) {
    return { sent: false, reason: 'sentry_request_failed' };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { captureException, clean, getSentryConfig, isConfigured, parseDsn };
