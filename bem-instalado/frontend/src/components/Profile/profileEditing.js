export const PROFILE_EDIT_STEPS = [
  { title: 'Dados essenciais', description: 'O necessário para aceitar pedidos. Você pode completar o restante depois.' },
  { title: 'Apresentação', description: 'Mostre quem você é e os trabalhos que já realizou. Tudo nesta etapa é opcional.' },
  { title: 'Atendimento', description: 'Organize sua região, horários, valores e informações complementares.' },
];

const STEP_FIELDS = [
  ['name', 'phone', 'city', 'state'],
  ['business_name', 'logo', 'installer_photo', 'installation_gallery', 'certificate_file', 'certificate_name', 'bio', 'years_experience'],
  ['service_region', 'service_radius_km', 'installation_method', 'service_hours', 'installation_days',
    'default_price_per_roll', 'default_removal_price', 'base_service_cost', 'travel_fee', 'monthly_goal',
    'document_type', 'document_id', 'emergency_contact', 'emergency_phone', 'safety_notes',
    'accepts_service_contract', 'provides_warranty', 'warranty_days', 'wallpaper_store_recommended'],
];

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
