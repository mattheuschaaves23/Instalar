export const PROFILE_EDIT_SECTIONS = [
  { id: 'dados', icon: 'checklist', title: 'Dados para pedidos', description: 'Confira o que precisa estar completo para aceitar instalações.' },
  { id: 'perfil', icon: 'user', title: 'Perfil', description: 'Escolha como você se apresenta aos clientes.' },
  { id: 'atendimento', icon: 'clock', title: 'Atendimento', description: 'Ajuste sua região, horários e valores.' },
  { id: 'publicacoes', icon: 'photos', title: 'Publicações', description: 'Mostre as instalações que você já fez no seu portfólio.' },
];

export const PROFILE_EDIT_ORDER = [1, 3, 0, 2];

export function getProfileEditSection(section) {
  const index = PROFILE_EDIT_SECTIONS.findIndex(({ id }) => id === section);
  return index === -1 ? 1 : index;
}

const STEP_FIELDS = [
  ['name', 'phone', 'city', 'state'],
  ['business_name', 'logo', 'installer_photo', 'certificate_file', 'certificate_name', 'bio', 'years_experience'],
  ['service_region', 'service_radius_km', 'installation_method', 'service_hours', 'installation_days',
    'default_price_per_roll', 'default_removal_price', 'base_service_cost', 'travel_fee', 'monthly_goal',
    'document_type', 'document_id', 'emergency_contact', 'emergency_phone', 'safety_notes',
    'accepts_service_contract', 'provides_warranty', 'warranty_days', 'wallpaper_store_recommended'],
  ['installation_gallery'],
];

export function moveProfilePhotoToCover(gallery, index) {
  if (!Number.isInteger(index) || index <= 0 || index >= gallery.length) return gallery;
  return [gallery[index], ...gallery.slice(0, index), ...gallery.slice(index + 1)];
}

export function buildProfileStepPayload(form, step) {
  return Object.fromEntries((STEP_FIELDS[step] || []).filter((key) => form[key] !== undefined).map((key) => [key, form[key]]));
}

export function profileTutorialKey(userId) {
  return `instalapro:profile-edit-tutorial:v1:${userId}`;
}

// A route transition can unmount the editor without reloading the site. Keep
// only changed fields in memory; never store private draft fields on disk.
let pendingDraft = null;

export function readProfileDraft(userId) {
  return pendingDraft?.userId === String(userId) ? pendingDraft : null;
}

export function rememberProfileDraft(userId, step, form, savedForm) {
  const changed = Object.entries(buildProfileStepPayload(form, step))
    .filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(savedForm[key]));
  pendingDraft = changed.length ? { userId: String(userId), step, changes: Object.fromEntries(changed) } : null;
}

export function clearProfileDraft(userId) {
  if (pendingDraft?.userId === String(userId)) pendingDraft = null;
}
