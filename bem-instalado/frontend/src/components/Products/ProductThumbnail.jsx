import { isProductPhoto } from './productPhotos';
import './ProductThumbnail.css';

export default function ProductThumbnail({ photo, preview = false }) {
  return (
    <span aria-hidden="true" className={preview ? 'product-thumbnail product-thumbnail-preview' : 'product-thumbnail'}>
      {isProductPhoto(photo) ? <img alt="" decoding="async" src={photo} /> : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m4 7.5 8-4 8 4v9l-8 4-8-4zM4 7.5l8 4 8-4m-8 4v9M8 5.5l8 4" />
        </svg>
      )}
    </span>
  );
}
