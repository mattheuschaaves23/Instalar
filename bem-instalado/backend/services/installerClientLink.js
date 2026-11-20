const { createHmac, timingSafeEqual } = require('node:crypto');
const pool = require('../config/database');
const { getInstallerPlanAccess } = require('./planAccess');
const { acceptsDirectRequests, getInstallerReadiness, publicProfileSql } = require('../utils/installerEligibility');
const { publicOrigin } = require('../../shared/legalDocuments.json');
const contract = require('../../shared/installerClientLink.json');

const tokenPattern = new RegExp(contract.tokenPattern);

function makeInstallerLinkToken(installer) {
  const { jwtSecret } = require('../config/auth');
  return createHmac('sha256', jwtSecret)
    .update(`instalarpro:client-link:v1:${installer.id}:${installer.auth_version || 0}`)
    .digest('base64url');
}

function hasLinkTokenShape(token) {
  return typeof token === 'string' && tokenPattern.test(token);
}

function matchesInstallerLinkToken(installer, token) {
  return Boolean(installer && hasLinkTokenShape(token) &&
    timingSafeEqual(Buffer.from(token), Buffer.from(makeInstallerLinkToken(installer))));
}

function readInstallerLinkToken(req) {
  return req.headers?.[contract.authorizationHeader.toLowerCase()] || '';
}

async function getLinkInstaller(installerId, db = pool, { lock = false } = {}) {
  const { rows } = await db.query(
    `SELECT id, auth_version, name, phone, email, email_verified_at, city, state,
            ${publicProfileSql()} AS public_profile
     FROM users WHERE id = $1 AND deleted_at IS NULL AND COALESCE(account_type, 'installer') = 'installer'
     ${lock ? 'FOR SHARE' : ''}`,
    [installerId],
  );
  return rows[0] || null;
}

async function hasProClientLinkAccess(installerId, db = pool) {
  try {
    // Match the Pro access shown in the installer panel without creating or changing subscriptions.
    const planAccess = await getInstallerPlanAccess(installerId, db, { includeUsage: false, reconcileSubscription: false });
    return planAccess.is_pro;
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') return false;
    throw error;
  }
}

function buildInstallerClientLink(installer) {
  const url = new URL(`/installers/${installer.id}`, publicOrigin);
  url.searchParams.set(contract.modeParameter, '1');
  url.hash = new URLSearchParams({ [contract.fragmentKey]: makeInstallerLinkToken(installer) }).toString();
  return url.href;
}

async function mayUseClientLink(installer, token, db = pool) {
  // Older links of public profiles can still work, but never bypass the Pro access check.
  const eligible = token
    ? matchesInstallerLinkToken(installer, token) && getInstallerReadiness(installer).ready
    : acceptsDirectRequests(installer);
  if (!eligible) return false;
  return hasProClientLinkAccess(installer.id, db);
}

module.exports = {
  buildInstallerClientLink, getLinkInstaller, hasProClientLinkAccess, hasLinkTokenShape,
  mayUseClientLink, readInstallerLinkToken,
};
