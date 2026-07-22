import { safeLocalStorage, safeSessionStorage } from './safeStorage';

export const CLIENT_REQUEST_SESSION_KEY = 'bem_instalado_client_request_v1';
export const CLIENT_PUBLISHED_REQUEST_KEY = 'instalar_published_request_v1';
const PUBLISHED_REQUEST_MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000;

function cleanText(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanList(items, maxItems = 4) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, maxItems);
}

export function writeStoredClientRequest(request) {
  if (!request || typeof request !== 'object') {
    return false;
  }

  const payload = {
    version: 1,
    savedAt: new Date().toISOString(),
    placeType: cleanText(request.placeType, 40),
    placeLabel: cleanText(request.placeLabel, 80),
    service: cleanText(request.service, 40),
    serviceLabel: cleanText(request.serviceLabel, 80),
    room: cleanText(request.room, 140),
    urgency: cleanText(request.urgency, 40),
    urgencyLabel: cleanText(request.urgencyLabel, 80),
    zipCode: cleanText(request.zipCode, 20),
    neighborhood: cleanText(request.neighborhood, 80),
    addressReference: cleanText(request.addressReference, 160),
    city: cleanText(request.city, 80),
    state: cleanText(request.state, 2).toUpperCase(),
    materialStatus: cleanText(request.materialStatus, 40),
    materialLabel: cleanText(request.materialLabel, 90),
    wallSize: cleanText(request.wallSize, 60),
    rollCount: cleanText(request.rollCount, 40),
    contactPreference: cleanText(request.contactPreference, 40),
    contactPreferenceLabel: cleanText(request.contactPreferenceLabel, 80),
    details: cleanText(request.details, 360),
    photoCount: Math.max(0, Number(request.photoCount || 0)),
    photoNames: cleanList(request.photoNames),
  };

  return safeSessionStorage.setItem(CLIENT_REQUEST_SESSION_KEY, JSON.stringify(payload));
}

export function readStoredClientRequest() {
  try {
    const raw = safeSessionStorage.getItem(CLIENT_REQUEST_SESSION_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
      return null;
    }

    return parsed;
  } catch (_error) {
    return null;
  }
}

export function clearStoredClientRequest() {
  return safeSessionStorage.removeItem(CLIENT_REQUEST_SESSION_KEY);
}

function normalizePublishedRequest(request) {
  const id = Number(request?.id || 0);
  const token = cleanText(request?.client_access_token || request?.token, 80);
  const parsedSavedAt = new Date(request?.saved_at || request?.savedAt || '');
  const savedAt = Number.isNaN(parsedSavedAt.getTime()) ? new Date() : parsedSavedAt;

  if (!Number.isInteger(id) || id <= 0 || token.length < 32) {
    return null;
  }

  return {
    id,
    client_access_token: token,
    service_label: cleanText(request?.service_label, 120),
    city: cleanText(request?.city, 120),
    state: cleanText(request?.state, 2).toUpperCase(),
    status: cleanText(request?.status, 30) || 'open',
    saved_at: savedAt.toISOString(),
  };
}

export function writePublishedClientRequest(request) {
  const payload = normalizePublishedRequest(request);

  if (!payload) {
    return false;
  }

  return safeLocalStorage.setItem(CLIENT_PUBLISHED_REQUEST_KEY, JSON.stringify(payload));
}

export function readPublishedClientRequest() {
  try {
    const raw = safeLocalStorage.getItem(CLIENT_PUBLISHED_REQUEST_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const request = normalizePublishedRequest(parsed);

    if (request && Date.now() - new Date(request.saved_at).getTime() > PUBLISHED_REQUEST_MAX_AGE_MS) {
      clearPublishedClientRequest();
      return null;
    }

    return request;
  } catch (_error) {
    return null;
  }
}

export function clearPublishedClientRequest() {
  return safeLocalStorage.removeItem(CLIENT_PUBLISHED_REQUEST_KEY);
}

export function buildClientRequestTrackingHash(request) {
  const payload = normalizePublishedRequest(request);

  if (!payload) {
    return '';
  }

  const params = new URLSearchParams({
    pedido: String(payload.id),
    acesso: payload.client_access_token,
  });

  return `#${params.toString()}`;
}

export function readClientRequestTrackingHash(rawHash = '') {
  const hash = String(rawHash || '').replace(/^#/, '');
  const params = new URLSearchParams(hash);

  return normalizePublishedRequest({
    id: params.get('pedido'),
    client_access_token: params.get('acesso'),
  });
}

export function formatClientRequestLines(request) {
  if (!request) {
    return [];
  }

  const region = [request.neighborhood, request.city, request.state].filter(Boolean).join(' - ');
  const lines = [
    ['Local', request.placeLabel],
    ['Servico', request.serviceLabel],
    ['Ambiente', request.room],
    ['Regiao', region],
    ['CEP', request.zipCode],
    ['Referencia', request.addressReference],
    ['Prazo', request.urgencyLabel],
    ['Material', request.materialLabel],
    ['Medida', request.wallSize],
    ['Rolos', request.rollCount],
    ['Preferencia de contato', request.contactPreferenceLabel],
    ['Detalhes', request.details],
  ];

  const photoCount = Number(request.photoCount || 0);

  if (photoCount > 0) {
    lines.push(['Fotos', `${photoCount} referencia${photoCount > 1 ? 's' : ''} adicionada${photoCount > 1 ? 's' : ''}`]);
  }

  return lines
    .filter(([, value]) => Boolean(String(value || '').trim()))
    .map(([label, value]) => `${label}: ${value}`);
}
