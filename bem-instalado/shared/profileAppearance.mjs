export const PROFILE_ACCENTS = Object.freeze({
  blue: { label: 'Azul', color: '#175cd3', light: '#a4c8ff', soft: '#edf4ff' },
  ocean: { label: 'Oceano', color: '#146a79', light: '#7dd5e3', soft: '#eaf7f9' },
  forest: { label: 'Verde', color: '#216343', light: '#8bd7ad', soft: '#edf7f1' },
  plum: { label: 'Ameixa', color: '#754385', light: '#dfb3ef', soft: '#f7effa' },
  graphite: { label: 'Grafite', color: '#394553', light: '#bdccd9', soft: '#f0f3f6' },
});

export const PROFILE_APPEARANCE_DEFAULTS = Object.freeze({
  accent: 'blue', cover_height: 'standard', cover_position: 50, gallery_format: 'landscape',
});

const heights = ['compact', 'standard', 'immersive'];
const formats = ['landscape', 'square', 'portrait'];
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

// Only these four presentation values are accepted. Never persist CSS, HTML,
// arbitrary colors, remote URLs or account permissions inside the appearance.
export function isValidProfileAppearance(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every((key) => own(PROFILE_APPEARANCE_DEFAULTS, key))
    && (!own(value, 'accent') || (typeof value.accent === 'string' && own(PROFILE_ACCENTS, value.accent)))
    && (!own(value, 'cover_height') || heights.includes(value.cover_height))
    && (!own(value, 'gallery_format') || formats.includes(value.gallery_format))
    && (!own(value, 'cover_position') || (typeof value.cover_position === 'number'
      && Number.isInteger(value.cover_position) && value.cover_position >= 0 && value.cover_position <= 100)));
}

export function normalizeProfileAppearance(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    accent: typeof input.accent === 'string' && own(PROFILE_ACCENTS, input.accent) ? input.accent : 'blue',
    cover_height: heights.includes(input.cover_height) ? input.cover_height : 'standard',
    cover_position: typeof input.cover_position === 'number' && Number.isFinite(input.cover_position)
      ? Math.round(Math.max(0, Math.min(100, input.cover_position))) : 50,
    gallery_format: formats.includes(input.gallery_format) ? input.gallery_format : 'landscape',
  };
}

export function profileAppearanceStyle(value) {
  const appearance = normalizeProfileAppearance(value);
  const palette = PROFILE_ACCENTS[appearance.accent];
  return {
    '--profile-brand': palette.color,
    '--profile-brand-light': palette.light,
    '--profile-brand-soft': palette.soft,
    '--profile-cover-position': `${appearance.cover_position}%`,
  };
}
