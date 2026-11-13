const INVALID_SESSION_CODES = new Set([
  'AUTH_TOKEN_MISSING',
  'AUTH_TOKEN_MALFORMED',
  'AUTH_TOKEN_INVALID',
  'AUTH_USER_NOT_FOUND',
  'AUTH_SESSION_REVOKED',
]);

export function isInvalidSession(error) {
  return error.response?.status === 401 && INVALID_SESSION_CODES.has(error.response?.data?.code);
}
