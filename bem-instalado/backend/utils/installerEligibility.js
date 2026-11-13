const BRAZILIAN_STATES = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

function normalizeBrazilianWhatsApp(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const local = /^[1-9]\d(?:[2-5]\d{7}|9\d{8})$/;
  if (local.test(digits)) return `55${digits}`;
  return digits.startsWith('55') && local.test(digits.slice(2)) ? digits : '';
}

function getInstallerReadiness(profile = {}) {
  const requirements = [
    { field: 'name', label: 'Nome', complete: String(profile.name || '').trim().length >= 2 },
    { field: 'phone', label: 'Telefone', complete: Boolean(normalizeBrazilianWhatsApp(profile.phone)) },
    { field: 'city', label: 'Cidade', complete: String(profile.city || '').trim().length >= 2 },
    { field: 'state', label: 'Estado', complete: BRAZILIAN_STATES.has(String(profile.state || '').trim().toUpperCase()) },
    { field: 'email_verified', label: 'E-mail confirmado', complete: Boolean(profile.email_verified_at || profile.email_verified)
      && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(profile.email || '').trim()) },
  ];
  const missing = requirements.filter(({ complete }) => !complete);
  return {
    ready: missing.length === 0,
    requirements,
    missing_fields: missing.map(({ field }) => field),
    message: missing.length ? `Para aceitar pedidos, complete apenas: ${missing.map(({ label }) => label.toLowerCase()).join(', ')}.` : '',
  };
}

module.exports = { getInstallerReadiness, normalizeBrazilianWhatsApp };
