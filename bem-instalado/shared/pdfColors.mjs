const channels = hex => hex.slice(1).match(/../g).map(part => parseInt(part, 16));
const hexColor = rgb => '#' + rgb.map(value => value.toString(16).padStart(2, '0')).join('');

export function accentInk(hex) {
  const rgb = channels(hex);
  const luminance = () => rgb.map(value => {
    const srgb = value / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  // Bright accents still work as decoration; use a darker version for text and white-on-color.
  while (luminance() > 0.14) rgb.forEach((value, index) => { rgb[index] = Math.floor(value * 0.87); });
  return hexColor(rgb);
}

export function tint(hex, weight) {
  return hexColor(channels(hex).map(value => Math.round(255 + (value - 255) * weight)));
}
