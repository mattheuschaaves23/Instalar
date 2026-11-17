import { useEffect } from 'react';

function setMeta(selector, attribute, value) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute[0], attribute[1]);
    document.head.appendChild(element);
  }
  element.setAttribute('content', value);
}

export default function PageMetadata({ title, description, noIndex = false, canonicalPath = '' }) {
  useEffect(() => {
    const resolvedTitle = title || 'InstalarPro';
    const resolvedDescription = description || 'InstalarPro conecta clientes, instaladores e lojas de papel de parede.';
    document.title = resolvedTitle;
    setMeta('meta[name="description"]', ['name', 'description'], resolvedDescription);
    setMeta('meta[property="og:title"]', ['property', 'og:title'], resolvedTitle);
    setMeta('meta[property="og:description"]', ['property', 'og:description'], resolvedDescription);
    setMeta('meta[name="robots"]', ['name', 'robots'], noIndex ? 'noindex, nofollow' : 'index, follow');

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `${window.location.origin}${canonicalPath || window.location.pathname}`);
  }, [canonicalPath, description, noIndex, title]);

  return null;
}
