const { defaults, basic, appearanceOptions, limits, templates, validityOptions } = require('../../shared/pdfBranding.json');

function normalizeText(value, limit, multiline = false) {
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ');
  if (!multiline) return cleaned.replace(/\s+/g, ' ').trim().slice(0, limit).trimEnd();
  const bounded = cleaned.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim().slice(0, limit).trimEnd();
  const lines = bounded.split('\n');
  // Keep authored paragraphs without allowing pasted line breaks to force arbitrary page breaks.
  return lines.length <= 8 ? bounded : [...lines.slice(0, 7), lines.slice(7).filter(Boolean).join(' ')].join('\n');
}

function normalizePdfBranding(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result = { ...defaults };
  for (const [key, limit] of Object.entries(limits)) {
    result[key] = normalizeText(source[key], limit, ['intro_text', 'scope_text', 'closing_text'].includes(key)) || defaults[key];
  }
  for (const key of Object.keys(defaults).filter(field => field.startsWith('show_'))) {
    if (typeof source[key] === 'boolean') result[key] = source[key];
  }
  const color = typeof source.accent_color === 'string' ? source.accent_color.trim().toUpperCase() : '';
  if (/^#[0-9A-F]{6}$/.test(color)) result.accent_color = color;
  if (templates.some(template => template.id === source.template)) result.template = source.template;
  for (const [key, options] of Object.entries(appearanceOptions)) {
    if (options.some(option => option.id === source[key])) result[key] = source[key];
  }
  if (validityOptions.includes(source.validity_days)) result.validity_days = source.validity_days;
  return result;
}

function resolvePdfBranding(value, canCustomize) {
  const branding = normalizePdfBranding(canCustomize ? value : null);
  return !canCustomize || branding.template === 'basic' ? { ...defaults, ...basic } : branding;
}

module.exports = { normalizePdfBranding, normalizeText, resolvePdfBranding };
