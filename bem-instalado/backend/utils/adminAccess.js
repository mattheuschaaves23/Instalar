const OWNER_ADMIN_EMAILS = new Set(
  [
    'matheuschavesminadasilva@gmail.com',
    ...String(process.env.OWNER_ADMIN_EMAILS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  ].map((value) => String(value || '').trim().toLowerCase())
);

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isOwnerAdminEmail(email) {
  return OWNER_ADMIN_EMAILS.has(normalizeEmail(email));
}

module.exports = {
  isOwnerAdminEmail,
  normalizeEmail,
};
