// Native-pixel crops from the approved request mockups, not approximated SVGs.
// Vite fingerprints these assets so an update never reuses an older icon cache.
const croppedAssets = import.meta.glob('../../assets/request-icons/*.png', {
  eager: true, import: 'default', query: '?url',
});

export const REQUEST_ICON_SOURCES = Object.fromEntries(
  Object.entries(croppedAssets).map(([path, source]) => [path.split('/').pop().replace('.png', ''), source]),
);

export default function RequestIcon({ name, className = '', Fallback }) {
  const source = REQUEST_ICON_SOURCES[name];
  // Keep other pages' icon system available without inventing new artwork.
  if (!source) return Fallback ? <Fallback name={name} className={className} /> : null;
  return (
    <img alt="" aria-hidden="true" className={`request-image-icon ${className}`.trim()}
      decoding="async" draggable={false} height="64" src={source} width="64" />
  );
}
