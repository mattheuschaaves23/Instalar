const STATES = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));

export function getInstallerRequirements(profile = {}) {
  const phone = String(profile.phone || '').replace(/\D/g, '');
  const localPhone = /^[1-9]\d(?:[2-5]\d{7}|9\d{8})$/;
  return [
    { field: 'name', label: 'Nome', complete: String(profile.name || '').trim().length >= 2 },
    { field: 'phone', label: 'Telefone', complete: localPhone.test(phone) || (phone.startsWith('55') && localPhone.test(phone.slice(2))) },
    { field: 'city', label: 'Cidade', complete: String(profile.city || '').trim().length >= 2 },
    { field: 'state', label: 'Estado', complete: STATES.has(String(profile.state || '').trim().toUpperCase()) },
    { field: 'email_verified', label: 'E-mail confirmado', complete: Boolean(profile.email_verified_at || profile.email_verified)
      && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(profile.email || '').trim()) },
  ];
}
