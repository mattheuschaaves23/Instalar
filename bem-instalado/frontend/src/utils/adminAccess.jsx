export function hasAdminAccess(user) {
  return Boolean(user?.is_admin);
}
