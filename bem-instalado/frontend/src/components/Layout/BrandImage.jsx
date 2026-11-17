import { useState, useSyncExternalStore } from 'react';
import { BRAND_IMAGES, BRAND_NAME } from '../../utils/brandAssets';

function subscribeTheme(onChange) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-site-theme'] });
  return () => observer.disconnect();
}

const getTheme = () => typeof document !== 'undefined' && document.documentElement.dataset.siteTheme === 'dark' ? 'dark' : 'light';
const getServerTheme = () => 'light';
const subscribeFixedSurface = () => () => {};

export default function BrandImage({ variant = 'logo', surface = 'auto', className = '', fallback, ...imageProps }) {
  const siteTheme = useSyncExternalStore(surface === 'auto' ? subscribeTheme : subscribeFixedSurface, getTheme, getServerTheme);
  const [failedSource, setFailedSource] = useState('');
  const resolvedSurface = surface === 'dark' || surface === 'light' ? surface : siteTheme;
  const asset = (BRAND_IMAGES[variant] || BRAND_IMAGES.logo)[resolvedSurface];
  if (failedSource === asset.src) return fallback || <span className="brand-wordmark-fallback">{BRAND_NAME}</span>;
  return (
    <img
      {...imageProps}
      alt={`Logo ${BRAND_NAME}`}
      className={className}
      data-brand-surface={resolvedSurface}
      decoding="async"
      height={asset.height}
      onError={() => setFailedSource(asset.src)}
      src={asset.src}
      width={asset.width}
    />
  );
}
