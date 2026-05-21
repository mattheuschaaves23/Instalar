const OWNER_ADMIN_EMAILS = new Set(['matheuschavesminadasilva@gmail.com']);

export function isOwnerAdminEmail(email) {
  return OWNER_ADMIN_EMAILS.has(String(email || '').trim().toLowerCase());
}

export function hasAdminAccess(user) {
  return Boolean(user?.is_admin || isOwnerAdminEmail(user?.email));
}
