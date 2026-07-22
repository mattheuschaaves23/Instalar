import { useState } from 'react';

const BRAND_MARK_URL = '/brand/instalapro-mark.png';

export default function BrandMark({ className = '', fallback = 'IP' }) {
  const [imageError, setImageError] = useState(false);

  return (
    <span className={`brand-mark ${className}`.trim()}>
      {!imageError ? (
        <img
          alt="Logo InstalaPro"
          className="brand-mark-image"
          onError={() => setImageError(true)}
          src={BRAND_MARK_URL}
        />
      ) : (
        <span className="brand-mark-fallback">{fallback}</span>
      )}
    </span>
  );
}
