import api from '../../services/api';

const SUBSCRIPTION_ACCESS_TTL_MS = 5 * 60 * 1000;

let cachedAccess = null;
const pendingRequests = new Map();

function normalizeUserKey(userKey) {
  return userKey ? String(userKey) : '';
}

export function getCachedSubscriptionAccess(userKey) {
  const normalizedUserKey = normalizeUserKey(userKey);

  if (!cachedAccess || cachedAccess.userKey !== normalizedUserKey) {
    return null;
  }

  return cachedAccess;
}

export function isSubscriptionAccessCacheFresh(userKey) {
  const access = getCachedSubscriptionAccess(userKey);
  return Boolean(access && Date.now() - access.checkedAt < SUBSCRIPTION_ACCESS_TTL_MS);
}

export function setSubscriptionAccessCache(userKey, canUseApp) {
  const normalizedUserKey = normalizeUserKey(userKey);

  if (!normalizedUserKey) {
    return;
  }

  cachedAccess = {
    canUseApp: Boolean(canUseApp),
    checkedAt: Date.now(),
    userKey: normalizedUserKey,
  };
}

export async function validateSubscriptionAccess(userKey, { force = false } = {}) {
  const cached = getCachedSubscriptionAccess(userKey);

  if (!force && isSubscriptionAccessCacheFresh(userKey)) {
    return cached.canUseApp;
  }

  const normalizedUserKey = normalizeUserKey(userKey);

  if (pendingRequests.has(normalizedUserKey)) {
    return pendingRequests.get(normalizedUserKey);
  }

  const promise = api
    .get('/subscriptions')
    .then((response) => {
      const canUseApp = Boolean(response.data?.can_use_app);
      setSubscriptionAccessCache(userKey, canUseApp);
      return canUseApp;
    })
    .finally(() => {
      pendingRequests.delete(normalizedUserKey);
    });

  pendingRequests.set(normalizedUserKey, promise);
  return promise;
}
