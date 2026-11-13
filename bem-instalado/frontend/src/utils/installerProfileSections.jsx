import { readClientRequestTrackingHash } from './clientRequest';

export const PROFILE_SECTIONS = [
  { id: 'projetos', label: 'Projetos', icon: 'grid' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar' },
  { id: 'avaliacoes', label: 'Avaliações', icon: 'star' },
  { id: 'informacoes', label: 'Informações', icon: 'document' },
];

export const REVIEW_FORM_ANCHOR = 'avaliar-instalador';

function isSection(value) {
  return value === REVIEW_FORM_ANCHOR || PROFILE_SECTIONS.some(({ id }) => id === value);
}

export function readProfileSection(hash) {
  const fragment = String(hash || '').replace(/^#/, '');
  const section = readClientRequestTrackingHash(hash)
    ? new URLSearchParams(fragment).get('secao')
    : fragment;
  return isSection(section) ? section : '';
}

export function buildProfileSectionHash(section, hash = '') {
  const target = isSection(section) ? section : PROFILE_SECTIONS[0].id;
  const tracking = readClientRequestTrackingHash(hash);
  if (!tracking) return `#${target}`;
  return `#${new URLSearchParams({
    pedido: String(tracking.id),
    acesso: tracking.client_access_token,
    secao: target,
  })}`;
}
