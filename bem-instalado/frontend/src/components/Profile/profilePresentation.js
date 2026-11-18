import { normalizeProfileAppearance } from '../../../../shared/profileAppearance.mjs';

// Explicit projection: never pass the private account object to the public view.
export function buildOwnerProfilePreview(profile = {}, { summary = {}, reviews = [], slots = [] } = {}) {
  const fields = ['id', 'name', 'business_name', 'city', 'state', 'logo', 'installer_photo', 'bio',
    'service_region', 'service_hours', 'installation_method', 'years_experience',
    'base_service_cost', 'travel_fee', 'default_price_per_roll', 'wallpaper_store_recommended'];
  const installer = Object.fromEntries(fields.filter((key) => profile[key] !== undefined).map((key) => [key, profile[key]]));
  return {
    installer: {
      ...installer,
      profile_appearance: normalizeProfileAppearance(profile.profile_appearance),
      display_name: String(profile.business_name || '').trim() || profile.name || 'Seu perfil profissional',
      installation_gallery: Array.isArray(profile.installation_gallery) ? profile.installation_gallery.filter(Boolean) : [],
      installation_days: Array.isArray(profile.installation_days) ? profile.installation_days : [],
      certificate_verified: Boolean(profile.certification_verified),
      average_rating: Number(summary.average_rating || 0),
      review_count: Number(summary.review_count || 0),
      availability_slots: slots.map(({ id, slot_date, start_time, end_time }) => ({ id, slot_date, start_time, end_time })),
      safety: {
        provides_warranty: Boolean(profile.provides_warranty), warranty_days: Number(profile.warranty_days || 0),
        accepts_service_contract: Boolean(profile.accepts_service_contract),
      },
    },
    reviews: reviews.map(({ id, reviewer_name, reviewer_region, rating, comment, created_at }) => ({ id, reviewer_name, reviewer_region, rating, comment, created_at })),
  };
}
