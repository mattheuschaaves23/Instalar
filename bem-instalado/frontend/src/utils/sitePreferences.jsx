import { safeLocalStorage } from './safeStorage';

export const SITE_PREFERENCES_EVENT = 'site-preferences:changed';

const STORAGE_KEY = 'instalar-site-preferences';

export const DEFAULT_SITE_PREFERENCES = {
  accentColor: '#e2b42d',
  density: 'comfortable',
  motion: 'smooth',
};

export const ACCENT_PRESETS = [
  { name: 'Dourado', value: '#e2b42d' },
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Verde', value: '#22c55e' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Violeta', value: '#8b5cf6' },
  { name: 'Ciano', value: '#06b6d4' },
];

function normalizeHexColor(value) {
  const input = String(value || '').trim();

  if (/^#[0-9a-fA-F]{6}$/.test(input)) {
    return input.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{3}$/.test(input)) {
    return `#${input[1]}${input[1]}${input[2]}${input[2]}${input[3]}${input[3]}`.toLowerCase();
  }

  return DEFAULT_SITE_PREFERENCES.accentColor;
}

function hexToRgb(hex) {
  const safeHex = normalizeHexColor(hex).slice(1);
  const value = Number.parseInt(safeHex, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixColor(sourceHex, targetHex, weight) {
  const source = hexToRgb(sourceHex);
  const target = hexToRgb(targetHex);
  const ratio = Math.max(0, Math.min(1, weight));

  return rgbToHex({
    r: source.r + (target.r - source.r) * ratio,
    g: source.g + (target.g - source.g) * ratio,
    b: source.b + (target.b - source.b) * ratio,
  });
}

function getContrastText(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.58 ? '#100b03' : '#fff8e8';
}

function buildAccentTokens(accentColor) {
  const accent = normalizeHexColor(accentColor);
  const { r, g, b } = hexToRgb(accent);
  const strong = mixColor(accent, '#ffffff', 0.24);
  const deep = mixColor(accent, '#000000', 0.38);
  const panel = '#050505';
  const panelSoft = '#0a0a0a';
  const panelElevated = '#101010';
  const strongRgb = hexToRgb(strong);
  const deepRgb = hexToRgb(deep);
  const panelRgb = hexToRgb(panel);
  const panelSoftRgb = hexToRgb(panelSoft);
  const panelElevatedRgb = hexToRgb(panelElevated);

  return {
    accent,
    strong,
    deep,
    contrast: getContrastText(accent),
    rgb: `${r}, ${g}, ${b}`,
    strongRgb: `${strongRgb.r}, ${strongRgb.g}, ${strongRgb.b}`,
    deepRgb: `${deepRgb.r}, ${deepRgb.g}, ${deepRgb.b}`,
    panel,
    panelSoft,
    panelElevated,
    panelRgb: `${panelRgb.r}, ${panelRgb.g}, ${panelRgb.b}`,
    panelSoftRgb: `${panelSoftRgb.r}, ${panelSoftRgb.g}, ${panelSoftRgb.b}`,
    panelElevatedRgb: `${panelElevatedRgb.r}, ${panelElevatedRgb.g}, ${panelElevatedRgb.b}`,
  };
}

export function normalizeSitePreferences(value) {
  const source = value && typeof value === 'object' ? value : {};

  return {
    accentColor: normalizeHexColor(source.accentColor),
    density: source.density === 'compact' ? 'compact' : 'comfortable',
    motion: source.motion === 'reduced' ? 'reduced' : 'smooth',
  };
}

export function readSitePreferences() {
  if (typeof window === 'undefined') {
    return DEFAULT_SITE_PREFERENCES;
  }

  try {
    const storedValue = safeLocalStorage.getItem(STORAGE_KEY);
    return normalizeSitePreferences(storedValue ? JSON.parse(storedValue) : DEFAULT_SITE_PREFERENCES);
  } catch (_error) {
    return DEFAULT_SITE_PREFERENCES;
  }
}

export function applySitePreferences(nextPreferences = readSitePreferences()) {
  if (typeof document === 'undefined') {
    return normalizeSitePreferences(nextPreferences);
  }

  const preferences = normalizeSitePreferences(nextPreferences);
  const tokens = buildAccentTokens(preferences.accentColor);
  const root = document.documentElement;

  root.style.setProperty('--site-accent', tokens.accent);
  root.style.setProperty('--site-accent-strong', tokens.strong);
  root.style.setProperty('--site-accent-deep', tokens.deep);
  root.style.setProperty('--site-accent-contrast', tokens.contrast);
  root.style.setProperty('--site-accent-rgb', tokens.rgb);
  root.style.setProperty('--site-accent-strong-rgb', tokens.strongRgb);
  root.style.setProperty('--site-accent-deep-rgb', tokens.deepRgb);
  root.style.setProperty('--site-accent-soft', `rgba(${tokens.rgb}, 0.14)`);
  root.style.setProperty('--site-accent-line', `rgba(${tokens.rgb}, 0.18)`);
  root.style.setProperty('--site-accent-line-strong', `rgba(${tokens.rgb}, 0.34)`);
  root.style.setProperty('--bg', '#000000');
  root.style.setProperty('--site-bg', '#000000');
  root.style.setProperty('--site-bg-rgb', '0, 0, 0');
  root.style.setProperty('--site-panel', tokens.panel);
  root.style.setProperty('--site-panel-soft', tokens.panelSoft);
  root.style.setProperty('--site-panel-elevated', tokens.panelElevated);
  root.style.setProperty('--site-panel-rgb', tokens.panelRgb);
  root.style.setProperty('--site-panel-soft-rgb', tokens.panelSoftRgb);
  root.style.setProperty('--site-panel-elevated-rgb', tokens.panelElevatedRgb);
  root.style.setProperty('--gold', tokens.accent);
  root.style.setProperty('--gold-strong', tokens.strong);
  root.style.setProperty('--gold-soft', `rgba(${tokens.rgb}, 0.14)`);
  root.style.setProperty('--line', `rgba(${tokens.rgb}, 0.18)`);
  root.style.setProperty('--muted', 'rgba(246, 239, 223, 0.64)');
  root.style.setProperty('--ref-gold', tokens.accent);
  root.style.setProperty('--ref-gold-strong', tokens.strong);
  root.style.setProperty('--ref-line', `rgba(${tokens.rgb}, 0.17)`);
  root.style.setProperty('--route-line-gold', `rgba(${tokens.rgb}, 0.22)`);
  root.dataset.siteDensity = preferences.density;
  root.dataset.siteMotion = preferences.motion;

  return preferences;
}

export function saveSitePreferences(nextPreferences) {
  const preferences = normalizeSitePreferences(nextPreferences);

  if (typeof window !== 'undefined') {
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    applySitePreferences(preferences);
    try {
      window.dispatchEvent(new CustomEvent(SITE_PREFERENCES_EVENT, { detail: preferences }));
    } catch (_error) {
      window.dispatchEvent(new Event(SITE_PREFERENCES_EVENT));
    }
  }

  return preferences;
}

export function resetSitePreferences() {
  if (typeof window !== 'undefined') {
    safeLocalStorage.removeItem(STORAGE_KEY);
  }

  return saveSitePreferences(DEFAULT_SITE_PREFERENCES);
}

export function applyStoredSitePreferences() {
  return applySitePreferences(readSitePreferences());
}
