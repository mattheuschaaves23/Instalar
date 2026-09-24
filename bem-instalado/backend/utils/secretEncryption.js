const crypto = require('crypto');
const { firstEnvValue } = require('../config/env');

const PREFIX = 'v1:';

function getKey() {
  const raw = firstEnvValue('TWO_FACTOR_ENCRYPTION_KEY', 'CHAVE DE CRIPTOGRAFIA DE DOIS FATORES');
  if (!raw) {
    if (process.env.NODE_ENV === 'production') return null;
    return crypto.createHash('sha256').update(String(process.env.JWT_SECRET || 'instalapro-development-only')).digest();
  }

  const candidates = [
    /^[a-f\d]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : null,
    (() => {
      try {
        return Buffer.from(raw, 'base64');
      } catch (_error) {
        return null;
      }
    })(),
  ].filter(Boolean);

  return candidates.find((candidate) => candidate.length === 32) || null;
}

function isEncryptionConfigured() {
  return Boolean(getKey());
}

function encryptSecret(value) {
  const key = getKey();
  if (!key) {
    const error = new Error('A chave TWO_FACTOR_ENCRYPTION_KEY não está configurada.');
    error.code = 'TWO_FACTOR_ENCRYPTION_NOT_CONFIGURED';
    throw error;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

function decryptSecret(value) {
  const raw = String(value || '');
  if (!raw.startsWith(PREFIX)) {
    // Compatibilidade temporária para segredos criados antes desta melhoria.
    return raw;
  }

  const key = getKey();
  if (!key) {
    const error = new Error('A chave de criptografia do 2FA não está disponível.');
    error.code = 'TWO_FACTOR_ENCRYPTION_NOT_CONFIGURED';
    throw error;
  }

  const [, ivEncoded, tagEncoded, encryptedEncoded] = raw.split(':');
  if (!ivEncoded || !tagEncoded || !encryptedEncoded) {
    throw new Error('O segredo 2FA armazenado está inválido.');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivEncoded, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

module.exports = {
  decryptSecret,
  encryptSecret,
  isEncryptionConfigured,
};
