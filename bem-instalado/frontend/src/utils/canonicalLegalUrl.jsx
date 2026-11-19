import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { publicOrigin } from '../../../shared/legalDocuments.json';

const LEGAL_PATHS = new Set(['/privacidade', '/termos', '/excluir-conta']);

export function getCanonicalLegalRedirect(origin, path, search = '', hash = '') {
  if (origin !== 'https://instalar-sigma.vercel.app' || !LEGAL_PATHS.has(path)) return '';
  const destination = new URL(path, publicOrigin);
  destination.search = search;
  destination.hash = hash;
  return destination.href;
}

export function useCanonicalLegalUrl(path) {
  const { search, hash } = useLocation();
  useEffect(() => {
    const destination = getCanonicalLegalRedirect(window.location.origin, path, search, hash);
    if (destination) window.location.replace(destination);
  }, [path, search, hash]);
}
