import BrandImage from './BrandImage';

export default function BrandMark({ className = '', fallback = 'IP', surface = 'auto' }) {
  return (
    <span className={`brand-mark ${className}`.trim()}>
      <BrandImage className="brand-mark-image" fallback={<span className="brand-mark-fallback">{fallback}</span>} surface={surface} variant="mark" />
    </span>
  );
}
