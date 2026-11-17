import BrandImage from './BrandImage';

export default function BrandWordmark({ size = 'md', className = '', surface = 'auto' }) {
  return (
    <span className={`brand-wordmark brand-wordmark--${size} ${className}`.trim()}>
      <BrandImage className="brand-wordmark-image" surface={surface} variant={size === 'sm' ? 'wordmark' : 'logo'} />
    </span>
  );
}
