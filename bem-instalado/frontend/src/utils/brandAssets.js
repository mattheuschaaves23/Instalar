export const BRAND_NAME = 'InstalarPro';
export const BRAND_ASSET_ROOT = '/brand/instalarpro-2026';

const image = (file, width, height) => ({ src: `${BRAND_ASSET_ROOT}/${file}.png`, width, height });
export const BRAND_IMAGES = {
  logo: { light: image('logo-light', 5091, 1368), dark: image('logo-dark', 5091, 1368) },
  wordmark: { light: image('wordmark-light', 5091, 1131), dark: image('wordmark-dark', 5091, 1131) },
  mark: { light: image('mark-light', 511, 779), dark: image('mark-dark', 510, 777) },
};
