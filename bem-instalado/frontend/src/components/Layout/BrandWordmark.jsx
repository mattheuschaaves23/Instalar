import { useState } from 'react';

const WORDMARK_URL = '/brand/instalapro-logo.png';

export default function BrandWordmark({ size = 'md', className = '' }) {
  const [imageError, setImageError] = useState(false);

  return (
    <span className={`brand-wordmark brand-wordmark--${size} ${className}`.trim()}>
      {!imageError ? (
        <img
          alt="Logo InstalaPro"
          className="brand-wordmark-image"
          onError={() => setImageError(true)}
          src={WORDMARK_URL}
        />
      ) : (
        <span className="brand-wordmark-fallback">InstalaPro</span>
      )}
    </span>
  );
}
