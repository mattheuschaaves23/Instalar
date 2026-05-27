import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { clearStoredClientRequest, writeStoredClientRequest } from '../../utils/clientRequest';
import { safeSessionStorage } from '../../utils/safeStorage';
import BrandMark from '../Layout/BrandMark';
import PaginationControls from '../Layout/PaginationControls';

const AUTO_LOCATION_SESSION_KEY = 'bem_instalado_client_location_checked';
const INSTALLERS_PER_PAGE = 6;
const MAX_REQUEST_PHOTOS = 4;
const MAX_REQUEST_PHOTO_SIZE = 5 * 1024 * 1024;
const SHOW_PUBLIC_INSTALLER_DIRECTORY = false;
const INITIAL_FILTERS = { search: '', city: '', state: '' };
const BRAZILIAN_CITIES_API_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome';
const VIA_CEP_API_URL = 'https://viacep.com.br/ws';
const MIN_LOCATION_QUERY_LENGTH = 2;

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Todos', keywords: [] },
  { value: 'residential', label: 'Residencial', keywords: ['residential', 'residencial', 'casa', 'apartamento', 'sala', 'quarto'] },
  { value: 'commercial', label: 'Comercial', keywords: ['comercial', 'empresa', 'escritorio', 'escritório', 'loja'] },
  { value: 'textured', label: 'Texturizados', keywords: ['textured', 'textura', 'texturizado', 'texturizados'] },
  { value: 'vinyl', label: 'Vinilicos', keywords: ['vinil', 'vinílico', 'vinilico', 'vinilicos', 'vinílicos'] },
  { value: 'adhesive', label: 'Adesivos', keywords: ['adesivo', 'adesivos', 'autocolante', 'adesivacao'] },
];

const QUICK_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'verified', label: 'Verificados' },
  { value: 'available', label: 'Disponiveis' },
  { value: 'featured', label: 'Destaques' },
];

const PLACE_TYPE_OPTIONS = [
  {
    value: 'residential',
    title: 'Casa ou apartamento',
    description: 'Residencia, apartamento, sobrado ou area interna da casa.',
    icon: 'home',
  },
  {
    value: 'commercial',
    title: 'Empresa ou loja',
    description: 'Ambientes comerciais, recepcao, vitrine ou escritorio.',
    icon: 'building',
  },
  {
    value: 'other',
    title: 'Outro local',
    description: 'Condominio, consultorio, area comum ou outro espaco.',
    icon: 'map-pin',
  },
];

const PAPER_TYPE_OPTIONS = [
  {
    value: 'vinyl',
    title: 'Papel vinilico',
    description: 'Materiais lavaveis, resistentes ou de maior durabilidade.',
    icon: 'roller',
  },
  {
    value: 'textured',
    title: 'Texturizado',
    description: 'Papeis com relevo, textura ou acabamento especial.',
    icon: 'texture',
  },
  {
    value: 'adhesive',
    title: 'Adesivo',
    description: 'Material autocolante, adesivo decorativo ou envelopamento leve.',
    icon: 'sticker',
  },
  {
    value: 'all',
    title: 'Ainda nao sei',
    description: 'Quero orientacao dos instaladores interessados.',
    icon: 'users',
  },
];

const ROOM_OPTIONS = ['Sala', 'Quarto', 'Cozinha', 'Banheiro', 'Corredor', 'Comercial', 'Outro ambiente'];
const MATERIAL_STATUS_OPTIONS = [
  { value: 'bought', label: 'Ja comprei o papel' },
  { value: 'need-help', label: 'Preciso de ajuda para comprar' },
  { value: 'not-sure', label: 'Ainda nao sei o material' },
];
const MEASUREMENT_OPTIONS = [
  {
    value: 'unknown',
    label: 'Nao sei as medidas',
    description: 'O profissional confirma antes do orcamento final.',
  },
  {
    value: 'known',
    label: 'Tenho as medidas',
    description: 'Informe tamanho da parede ou quantidade de rolos.',
  },
  {
    value: 'visit',
    label: 'Quero visita tecnica',
    description: 'Ideal quando precisa medir tudo no local.',
  },
];
const URGENCY_OPTIONS = [
  { value: 'urgent', label: 'Urgente', description: 'Preciso resolver o quanto antes.' },
  { value: 'week', label: 'Esta semana', description: 'Quero tentar agendar ainda nesta semana.' },
  { value: 'days', label: 'Proximos dias', description: 'Tenho alguma flexibilidade de data.' },
  { value: 'quote', label: 'Ainda estou orcando', description: 'Quero receber interessados e comparar antes.' },
];
const CONTACT_PREFERENCE_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp', description: 'Mais rapido para combinar fotos e detalhes.' },
  { value: 'phone', label: 'Ligacao', description: 'Prefiro conversar por chamada.' },
  { value: 'any', label: 'Qualquer contato', description: 'Pode ser WhatsApp ou ligacao.' },
];
const REQUEST_STEPS = [
  { value: 'service', label: 'Servico' },
  { value: 'details', label: 'Detalhes' },
  { value: 'location', label: 'Local' },
  { value: 'review', label: 'Publicar' },
];
const DETAIL_STEPS = [
  { value: 'rooms', label: 'Ambientes' },
  { value: 'material', label: 'Material' },
  { value: 'measurements', label: 'Medidas' },
];
const SERVICE_INTRO_STEPS = [
  { value: 'place', label: 'Local' },
  { value: 'paper', label: 'Tipo do papel' },
];
const INITIAL_SERVICE_REQUEST = {
  placeType: '',
  service: '',
  room: '',
  rooms: [],
  materialStatus: '',
  measurementStatus: '',
  wallSize: '',
  rollCount: '',
  urgency: '',
  contactPreference: '',
  zipCode: '',
  neighborhood: '',
  addressReference: '',
  city: '',
  state: '',
  details: '',
  photos: [],
};
const INITIAL_REQUEST_CONTACT = {
  name: '',
  phone: '',
  email: '',
};
const LAST_REQUEST_STEP = REQUEST_STEPS.length - 1;
const LAST_DETAIL_STEP = DETAIL_STEPS.length - 1;
const LAST_SERVICE_INTRO_STEP = SERVICE_INTRO_STEPS.length - 1;

function AppIcon({ name, className = '' }) {
  const commonProps = {
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  };

  switch (name) {
    case 'bell':
      return (
        <svg {...commonProps}>
          <path d="M6 9a6 6 0 0 1 12 0v4.2l1.6 2.4a1 1 0 0 1-.83 1.55H5.23a1 1 0 0 1-.83-1.55L6 13.2V9Z" />
          <path d="M10 18a2 2 0 0 0 4 0" />
        </svg>
      );
    case 'map-pin':
      return (
        <svg {...commonProps}>
          <path d="M12 21s6-5.33 6-11a6 6 0 1 0-12 0c0 5.67 6 11 6 11Z" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
      );
    case 'target':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="7.5" />
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22" />
        </svg>
      );
    case 'search':
      return (
        <svg {...commonProps}>
          <circle cx="11" cy="11" r="6.8" />
          <path d="m20 20-3.7-3.7" />
        </svg>
      );
    case 'filter':
      return (
        <svg {...commonProps}>
          <path d="M4 6h16l-6.4 7.1v4.9l-3.2-1.8v-3.1L4 6Z" />
        </svg>
      );
    case 'sort':
      return (
        <svg {...commonProps}>
          <path d="M8 6v12" />
          <path d="m5 9 3-3 3 3" />
          <path d="M16 18V6" />
          <path d="m13 15 3 3 3-3" />
        </svg>
      );
    case 'users':
      return (
        <svg {...commonProps}>
          <path d="M16 21v-1.3A4.7 4.7 0 0 0 11.3 15H7.7A4.7 4.7 0 0 0 3 19.7V21" />
          <circle cx="9.5" cy="8" r="3.2" />
          <path d="M21 21v-1.3a4.3 4.3 0 0 0-3.1-4.15" />
          <path d="M15.8 4.9a3.2 3.2 0 0 1 0 6.2" />
        </svg>
      );
    case 'home':
      return (
        <svg {...commonProps}>
          <path d="m3 10.6 9-7 9 7" />
          <path d="M5.5 9.8V20h13V9.8" />
        </svg>
      );
    case 'building':
      return (
        <svg {...commonProps}>
          <path d="M4 21V6.5A1.5 1.5 0 0 1 5.5 5H14v16" />
          <path d="M14 21V3.5A1.5 1.5 0 0 1 15.5 2H19a1 1 0 0 1 1 1V21" />
          <path d="M8 9h2M8 13h2M8 17h2M16 9h1.5M16 13h1.5M16 17h1.5" />
        </svg>
      );
    case 'texture':
      return (
        <svg {...commonProps}>
          <rect x="4" y="4" width="16" height="16" rx="2.4" />
          <path d="M8 8h8M8 12h8M8 16h8" />
          <path d="M8 8v8M12 8v8M16 8v8" />
        </svg>
      );
    case 'roller':
      return (
        <svg {...commonProps}>
          <path d="M5 7.5A1.5 1.5 0 0 1 6.5 6H16a2 2 0 0 1 2 2v2H9a2 2 0 0 0-2 2v6" />
          <path d="M9 18h4" />
          <path d="M13 18v2.5" />
        </svg>
      );
    case 'sticker':
      return (
        <svg {...commonProps}>
          <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H18a1 1 0 0 1 1 1v10.5A6.5 6.5 0 0 1 12.5 21h-5A2.5 2.5 0 0 1 5 18.5v-13Z" />
          <path d="M12 21v-4.5A2.5 2.5 0 0 1 14.5 14H19" />
          <path d="M8.5 8h7M8.5 11h4" />
        </svg>
      );
    case 'smile':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9 10h.01M15 10h.01" />
          <path d="M8.5 14a5 5 0 0 0 7 0" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...commonProps}>
          <path d="M12 3.2 5.4 5.9v5.2c0 4.2 2.8 8 6.6 9.7 3.8-1.7 6.6-5.5 6.6-9.7V5.9L12 3.2Z" />
          <path d="m9.5 12 1.7 1.8 3.4-3.8" />
        </svg>
      );
    case 'star':
      return (
        <svg {...commonProps}>
          <path d="m12 3.8 2.45 4.96 5.48.8-3.97 3.86.94 5.46L12 16.5l-4.9 2.58.94-5.46-3.97-3.86 5.48-.8L12 3.8Z" />
        </svg>
      );
    case 'heart':
      return (
        <svg {...commonProps}>
          <path d="m12 20.5-1.2-1.08C5.8 14.95 3 12.4 3 9.26A4.26 4.26 0 0 1 7.35 5a4.7 4.7 0 0 1 4.65 2.82A4.7 4.7 0 0 1 16.65 5 4.26 4.26 0 0 1 21 9.26c0 3.14-2.8 5.69-7.8 10.16L12 20.5Z" />
        </svg>
      );
    case 'message':
      return (
        <svg {...commonProps}>
          <path d="M5 6.5h14A1.5 1.5 0 0 1 20.5 8v8A1.5 1.5 0 0 1 19 17.5H9L4.5 20v-4A1.5 1.5 0 0 1 3.5 14.5V8A1.5 1.5 0 0 1 5 6.5Z" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8.1" r="3.2" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...commonProps}>
          <path d="M9 21H5.8A1.8 1.8 0 0 1 4 19.2V4.8A1.8 1.8 0 0 1 5.8 3H9" />
          <path d="M15.5 8.5 19 12l-3.5 3.5" />
          <path d="M19 12H9" />
        </svg>
      );
    case 'check-badge':
      return (
        <svg {...commonProps}>
          <path d="M12 3.4 14.7 5l3.08-.11.87 2.95L21 10l-1.35 2.16.52 3.02-2.8 1.22L15.9 19l-2.9-.64L10.1 19l-1.47-2.6-2.8-1.22.52-3.02L3 10l2.35-2.16.87-2.95L9.3 5 12 3.4Z" />
          <path d="m9.3 12 1.8 1.8 3.7-4" />
        </svg>
      );
    default:
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

function getInitials(name) {
  return (name || 'IL')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatZipCode(value) {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function getBrazilianCityState(item) {
  return (
    item?.microrregiao?.mesorregiao?.UF?.sigla ||
    item?.['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla ||
    ''
  ).toUpperCase();
}

function getBrazilianRegionName(item) {
  return (
    item?.microrregiao?.mesorregiao?.UF?.regiao?.nome ||
    item?.['regiao-imediata']?.['regiao-intermediaria']?.UF?.regiao?.nome ||
    ''
  );
}

function normalizeBrazilianCity(item) {
  const city = String(item?.nome || '').trim();
  const state = getBrazilianCityState(item);

  if (!city || !state) {
    return null;
  }

  return {
    id: item.id,
    city,
    state,
    region: getBrazilianRegionName(item),
    searchText: normalizeText(`${city} ${state}`),
  };
}

function installerTextBlob(installer) {
  const serviceParts = [
    installer.services,
    installer.serviceCategories,
    installer.service_categories,
    installer.specialties,
    installer.tags,
  ].flatMap((value) => (Array.isArray(value) ? value : [value]));

  return normalizeText([
    installer.name,
    installer.display_name,
    installer.displayName,
    installer.businessName,
    installer.business_name,
    installer.company_name,
    installer.bio,
    installer.installation_method,
    installer.service_region,
    installer.city,
    installer.state,
    ...serviceParts,
  ].join(' '));
}

function matchesCategory(installer, categoryValue) {
  if (categoryValue === 'all') {
    return true;
  }

  const category = CATEGORY_OPTIONS.find((item) => item.value === categoryValue);
  if (!category) {
    return true;
  }

  const text = installerTextBlob(installer);
  if (text.includes(normalizeText(category.value))) {
    return true;
  }

  return category.keywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function optionLabel(options, value, fallback = '') {
  return options.find((item) => item.value === value)?.label || fallback;
}

function getRequestRooms(request) {
  if (Array.isArray(request.rooms) && request.rooms.length > 0) {
    return request.rooms;
  }

  return request.room ? [request.room] : [];
}

function buildClientRequestSnapshot(request) {
  const placeOption = getPlaceTypeOption(request.placeType);
  const serviceOption = getServiceRequestOption(request.service);
  const regionState = String(request.state || '').trim().toUpperCase();
  const rooms = getRequestRooms(request);
  const measurementStatus = request.measurementStatus || 'unknown';
  const measurementDetail = getMeasurementSummary(request);

  return {
    placeType: request.placeType,
    placeLabel: placeOption?.title || '',
    service: request.service,
    serviceLabel: serviceOption?.title || '',
    room: rooms.join(', '),
    urgency: request.urgency,
    urgencyLabel: optionLabel(URGENCY_OPTIONS, request.urgency, 'Prazo flexivel'),
    zipCode: String(request.zipCode || '').trim(),
    neighborhood: String(request.neighborhood || '').trim(),
    addressReference: String(request.addressReference || '').trim(),
    city: String(request.city || '').trim(),
    state: regionState,
    materialStatus: request.materialStatus,
    materialLabel: optionLabel(MATERIAL_STATUS_OPTIONS, request.materialStatus, 'Material nao informado'),
    measurementStatus,
    measurementLabel: optionLabel(MEASUREMENT_OPTIONS, measurementStatus, 'Medidas a confirmar'),
    measurementDetail,
    wallSize: String(request.wallSize || '').trim(),
    rollCount: String(request.rollCount || '').trim(),
    contactPreference: request.contactPreference,
    contactPreferenceLabel: optionLabel(CONTACT_PREFERENCE_OPTIONS, request.contactPreference, 'WhatsApp'),
    details: String(request.details || '').trim(),
    photoCount: request.photos?.length || 0,
    photoNames: (request.photos || []).map((photo) => photo.name).filter(Boolean),
  };
}

function getMeasurementSummary(request) {
  const measurementStatus = request.measurementStatus || 'unknown';
  const wallSize = String(request.wallSize || '').trim();
  const rollCount = String(request.rollCount || '').trim();

  if (measurementStatus === 'visit') {
    return 'Visita tecnica solicitada';
  }

  if (measurementStatus === 'known') {
    return [wallSize, rollCount].filter(Boolean).join(' / ') || 'Medidas informadas depois';
  }

  return 'Medidas a confirmar pelo profissional';
}

function getRequestCompleteness(request) {
  const filled = [
    request.placeType,
    request.service,
    getRequestRooms(request).length > 0,
    request.materialStatus,
    request.city || request.state,
    request.neighborhood || request.zipCode,
    request.urgency,
    request.contactPreference,
    request.measurementStatus || request.wallSize || request.rollCount,
    String(request.details || '').trim().length >= 12,
  ].filter(Boolean).length;

  return Math.round((filled / 10) * 100);
}

function getInstallerMatchScore(installer, request) {
  if (!request?.service) {
    return 0;
  }

  const hasAvailability = Boolean((installer.availability_slots || []).length || (installer.available_dates || []).length);
  const isVerified = Boolean(installer.certificate_verified || installer.safety?.document_masked);
  const sameCity =
    request.city &&
    installer.city &&
    normalizeText(installer.city) === normalizeText(request.city);
  const sameState =
    request.state &&
    installer.state &&
    normalizeText(installer.state) === normalizeText(request.state);

  let score = 52;

  if (request.service === 'all' || matchesCategory(installer, request.service)) {
    score += 18;
  }

  if (sameCity) {
    score += 14;
  } else if (sameState) {
    score += 9;
  }

  if (hasAvailability) {
    score += request.urgency === 'urgent' ? 10 : 7;
  }

  if (isVerified) {
    score += 5;
  }

  if (Number(installer.average_rating || 0) >= 4.7) {
    score += 4;
  } else if (Number(installer.average_rating || 0) >= 4.2) {
    score += 2;
  }

  return Math.min(98, score);
}

function getInstallerMatchReasons(installer, request) {
  const reasons = [];

  if (request?.service && (request.service === 'all' || matchesCategory(installer, request.service))) {
    reasons.push('Servico compativel');
  }

  if (
    request?.city &&
    installer.city &&
    normalizeText(installer.city) === normalizeText(request.city)
  ) {
    reasons.push('Atende sua cidade');
  } else if (
    request?.state &&
    installer.state &&
    normalizeText(installer.state) === normalizeText(request.state)
  ) {
    reasons.push('Mesmo estado');
  }

  if ((installer.availability_slots || []).length || (installer.available_dates || []).length) {
    reasons.push('Agenda disponivel');
  }

  if (installer.certificate_verified || installer.safety?.document_masked) {
    reasons.push('Perfil verificado');
  }

  return reasons.slice(0, 3);
}

function deriveInstallerTags(installer) {
  const matched = CATEGORY_OPTIONS.filter((item) => item.value !== 'all' && matchesCategory(installer, item.value)).map(
    (item) => item.label
  );

  if (matched.length > 0) {
    return matched.slice(0, 3);
  }

  if (installer.installation_method) {
    return [installer.installation_method.split(',')[0].trim().slice(0, 28)];
  }

  return ['Papel de parede'];
}

function getAvailabilityState(installer) {
  if ((installer.availability_slots || []).length > 0 || installer.availableToday) {
    return { label: 'Disponivel', tone: 'available' };
  }

  if ((installer.available_dates || []).length > 0 || installer.nextAvailability) {
    return { label: 'Agenda aberta', tone: 'scheduled' };
  }

  return { label: 'Agenda cheia', tone: 'busy' };
}

function sortInstallers(items, sortBy, request) {
  const nextItems = [...items];

  nextItems.sort((left, right) => {
    if (sortBy === 'match') {
      return getInstallerMatchScore(right, request) - getInstallerMatchScore(left, request);
    }

    if (sortBy === 'reviews') {
      return Number(right.review_count || 0) - Number(left.review_count || 0);
    }

    if (sortBy === 'available') {
      return (right.availability_slots || []).length - (left.availability_slots || []).length;
    }

    if (sortBy === 'name') {
      return String(left.display_name || '').localeCompare(String(right.display_name || ''), 'pt-BR');
    }

    const leftScore = Number(left.average_rating || 0) * 100 + Number(left.review_count || 0);
    const rightScore = Number(right.average_rating || 0) * 100 + Number(right.review_count || 0);
    return rightScore - leftScore;
  });

  return nextItems;
}

function buildSuggestionScenarios(filters) {
  const scenarios = [];
  const city = String(filters.city || '').trim();
  const state = String(filters.state || '').trim();
  const search = String(filters.search || '').trim();

  if (state) {
    scenarios.push({
      label: `Profissionais proximos em ${state}`,
      params: { search: '', city: '', state },
    });
  }

  if (city) {
    scenarios.push({
      label: `Resultados parecidos com ${city}`,
      params: { search: city, city: '', state },
    });
  }

  if (search) {
    scenarios.push({
      label: 'Sugestoes relacionadas',
      params: { search, city: '', state: '' },
    });
  }

  scenarios.push({
    label: 'Instaladores em destaque',
    params: { search: '', city: '', state: '' },
  });

  const seen = new Set();
  return scenarios.filter((scenario) => {
    const key = JSON.stringify(scenario.params);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getRegionLabel(installer) {
  return [installer.city, installer.state].filter(Boolean).join(', ') || installer.service_region || 'Regiao nao informada';
}

function buildLocationOptions({ cities, installers, cityQuery, stateQuery, neighborhoodQuery, zipQuery }) {
  const seen = new Set();
  const options = [];
  const normalizedCityQuery = normalizeText(cityQuery).trim();
  const normalizedNeighborhoodQuery = normalizeText(neighborhoodQuery).trim();
  const normalizedStateQuery = String(stateQuery || '').trim().toUpperCase();
  const zipDigits = onlyDigits(zipQuery);
  const canSearchCities =
    normalizedCityQuery.length >= MIN_LOCATION_QUERY_LENGTH ||
    normalizedStateQuery.length >= MIN_LOCATION_QUERY_LENGTH ||
    zipDigits.length >= 3;

  if (!canSearchCities) {
    return options;
  }

  const sourceItems = cities.length > 0 ? cities : installers || [];

  sourceItems.forEach((item) => {
    const city = String(item.city || '').trim();
    const state = String(item.state || '').trim().toUpperCase();
    const searchText = item.searchText || normalizeText(`${city} ${state} ${item.service_region || ''}`);

    if (!city || !state) {
      return;
    }

    if (normalizedStateQuery && !state.startsWith(normalizedStateQuery)) {
      return;
    }

    if (normalizedCityQuery && !searchText.includes(normalizedCityQuery)) {
      return;
    }

    const key = `${normalizeText(city)}-${state}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    options.push({
      id: item.id || key,
      city,
      state,
      neighborhood: normalizedNeighborhoodQuery ? String(neighborhoodQuery || '').trim() : '',
      region: item.region || item.service_region || '',
      startsWithCity: normalizedCityQuery ? normalizeText(city).startsWith(normalizedCityQuery) : false,
    });
  });

  return options
    .sort((left, right) => Number(right.startsWithCity) - Number(left.startsWithCity) || left.city.localeCompare(right.city))
    .slice(0, 12);
}

function getServiceRequestOption(value) {
  return PAPER_TYPE_OPTIONS.find((item) => item.value === value) || null;
}

function getPlaceTypeOption(value) {
  return PLACE_TYPE_OPTIONS.find((item) => item.value === value) || null;
}

export default function Home() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const accountHomePath = user?.account_type === 'client' ? '/cliente' : '/dashboard';
  const accountLinkLabel = user?.account_type === 'client' ? 'Minha conta' : 'Meu painel';
  const autoLocationRequestedRef = useRef(false);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [directory, setDirectory] = useState({ installers: [], ranking: [], reviews: [], marketplace: null });
  const [loading, setLoading] = useState(true);
  const [, setLocationState] = useState({
    status: 'idle',
    message: 'Ative sua localizacao para encontrar profissionais mais proximos.',
  });
  const [installersPage, setInstallersPage] = useState(1);
  const [category, setCategory] = useState('all');
  const [quickFilter, setQuickFilter] = useState('all');
  const [sortBy, setSortBy] = useState('rating');
  const [favorites, setFavorites] = useState({});
  const [requestStep, setRequestStep] = useState(0);
  const [serviceIntroStep, setServiceIntroStep] = useState(0);
  const [detailStep, setDetailStep] = useState(0);
  const [serviceRequest, setServiceRequest] = useState(INITIAL_SERVICE_REQUEST);
  const [brazilianCities, setBrazilianCities] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [locationLoadError, setLocationLoadError] = useState('');
  const [zipLookupStatus, setZipLookupStatus] = useState('idle');
  const [requestContact, setRequestContact] = useState(INITIAL_REQUEST_CONTACT);
  const [publishingRequest, setPublishingRequest] = useState(false);
  const [publishedRequest, setPublishedRequest] = useState(null);
  const [requestInterests, setRequestInterests] = useState([]);
  const [loadingInterests, setLoadingInterests] = useState(false);
  const [selectingInterestId, setSelectingInterestId] = useState(null);
  const [hasGuidedRequest, setHasGuidedRequest] = useState(false);
  const [noResultsSuggestions, setNoResultsSuggestions] = useState({
    loading: false,
    label: '',
    items: [],
  });
  const selectedPlaceType = useMemo(
    () => getPlaceTypeOption(serviceRequest.placeType),
    [serviceRequest.placeType]
  );
  const selectedServiceRequest = useMemo(
    () => getServiceRequestOption(serviceRequest.service),
    [serviceRequest.service]
  );
  const selectedUrgency = useMemo(
    () => URGENCY_OPTIONS.find((item) => item.value === serviceRequest.urgency),
    [serviceRequest.urgency]
  );
  const selectedMaterialStatus = useMemo(
    () => MATERIAL_STATUS_OPTIONS.find((item) => item.value === serviceRequest.materialStatus),
    [serviceRequest.materialStatus]
  );
  const selectedContactPreference = useMemo(
    () => CONTACT_PREFERENCE_OPTIONS.find((item) => item.value === serviceRequest.contactPreference),
    [serviceRequest.contactPreference]
  );
  const serviceIntroOptions = serviceIntroStep === 0 ? PLACE_TYPE_OPTIONS : PAPER_TYPE_OPTIONS;
  const selectedDetailStep = DETAIL_STEPS[detailStep] || DETAIL_STEPS[0];
  const requestCompleteness = useMemo(
    () => getRequestCompleteness(serviceRequest),
    [serviceRequest]
  );
  const requestSnapshot = useMemo(
    () => buildClientRequestSnapshot(serviceRequest),
    [serviceRequest]
  );
  const selectedRooms = useMemo(
    () => getRequestRooms(serviceRequest),
    [serviceRequest]
  );
  const locationPreviewCity = serviceRequest.city.trim();
  const locationPreviewState = serviceRequest.state.trim().toUpperCase();
  const locationPreviewNeighborhood = serviceRequest.neighborhood.trim();
  const locationPreviewZip = serviceRequest.zipCode.trim();
  const locationPreviewZipDigits = onlyDigits(locationPreviewZip);
  const hasLocationPreviewInput = Boolean(
    locationPreviewCity.length >= MIN_LOCATION_QUERY_LENGTH ||
      locationPreviewState.length >= MIN_LOCATION_QUERY_LENGTH ||
      locationPreviewNeighborhood.length >= MIN_LOCATION_QUERY_LENGTH ||
      locationPreviewZipDigits.length >= 3
  );
  const locationOptions = useMemo(() => {
    return buildLocationOptions({
      cities: brazilianCities,
      installers: directory.installers,
      cityQuery: locationPreviewCity,
      stateQuery: locationPreviewState,
      neighborhoodQuery: locationPreviewNeighborhood,
      zipQuery: locationPreviewZip,
    });
  }, [
    brazilianCities,
    directory.installers,
    locationPreviewCity,
    locationPreviewNeighborhood,
    locationPreviewState,
    locationPreviewZip,
  ]);
  const selectedInterest = useMemo(
    () => requestInterests.find((interest) => interest.selected) || null,
    [requestInterests]
  );

  const hasActiveFilters = useMemo(
    () => Boolean(filters.search.trim() || filters.city.trim() || filters.state.trim()),
    [filters.search, filters.city, filters.state]
  );

  const filteredInstallers = useMemo(() => {
    const categoryFiltered = directory.installers.filter((installer) => matchesCategory(installer, category));

    const quickFiltered = categoryFiltered.filter((installer) => {
      if (quickFilter === 'verified') {
        return Boolean(installer.certificate_verified || installer.safety?.document_masked);
      }

      if (quickFilter === 'available') {
        return Boolean((installer.availability_slots || []).length > 0 || (installer.available_dates || []).length > 0);
      }

      if (quickFilter === 'featured') {
        return Boolean(installer.featured_installer);
      }

      return true;
    });

    return sortInstallers(quickFiltered, sortBy, serviceRequest);
  }, [category, directory.installers, quickFilter, serviceRequest, sortBy]);

  const favoriteInstallers = useMemo(
    () => filteredInstallers.filter((installer) => favorites[installer.id]),
    [favorites, filteredInstallers]
  );

  const totalInstallersPages = Math.max(1, Math.ceil(filteredInstallers.length / INSTALLERS_PER_PAGE));
  const normalizedInstallersPage = Math.min(installersPage, totalInstallersPages);
  const installersStart = (normalizedInstallersPage - 1) * INSTALLERS_PER_PAGE;
  const paginatedInstallers = useMemo(
    () => filteredInstallers.slice(installersStart, installersStart + INSTALLERS_PER_PAGE),
    [filteredInstallers, installersStart]
  );

  const loadDirectory = useCallback(async (nextFilters = INITIAL_FILTERS) => {
    setLoading(true);

    try {
      const response = await api.get('/public/installers', { params: nextFilters });
      setDirectory(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel carregar os instaladores.');
    } finally {
      setLoading(false);
    }
  }, []);

  const reverseLocation = useCallback(async (latitude, longitude) => {
    const response = await api.get('/public/location/reverse', {
      params: { lat: latitude, lon: longitude },
    });

    return response.data;
  }, []);

  const requestLocationSearch = useCallback(async ({ silent = false } = {}) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationState({
        status: 'unsupported',
        message: 'Seu navegador nao oferece localizacao automatica. Voce pode buscar manualmente.',
      });
      return;
    }

    setLocationState({
      status: 'locating',
      message: 'Buscando sua regiao para filtrar os instaladores.',
    });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const region = await reverseLocation(position.coords.latitude, position.coords.longitude);
          const nextFilters = {
            ...filters,
            city: region.city || '',
            state: region.state || '',
            search: region.city || filters.search,
          };

          setFilters(nextFilters);
          setInstallersPage(1);
          setLocationState({
            status: 'resolved',
            message: region.label
              ? `Mostrando profissionais proximos de ${region.label}.`
              : 'Mostrando profissionais da sua regiao.',
          });

          if (!silent) {
            toast.success(region.label ? `Regiao encontrada: ${region.label}.` : 'Regiao encontrada.');
          }

          await loadDirectory(nextFilters);
        } catch (error) {
          setLocationState({
            status: 'error',
            message: error.response?.data?.error || 'Nao foi possivel localizar sua regiao agora.',
          });

          if (!silent) {
            toast.error(error.response?.data?.error || 'Nao foi possivel localizar sua regiao agora.');
          }
        }
      },
      (error) => {
        const permissionDenied = error.code === 1;
        setLocationState({
          status: permissionDenied ? 'denied' : 'error',
          message: permissionDenied
            ? 'Permita a localizacao para mostrar primeiro os profissionais da sua regiao.'
            : 'Nao foi possivel usar sua localizacao no momento.',
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }, [filters, loadDirectory, reverseLocation]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setRequestContact((current) => ({
      name: current.name || user.name || '',
      phone: current.phone || user.phone || '',
      email: current.email || user.email || '',
    }));
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (
      autoLocationRequestedRef.current ||
      safeSessionStorage.getItem(AUTO_LOCATION_SESSION_KEY) === 'done'
    ) {
      return;
    }

    autoLocationRequestedRef.current = true;
    safeSessionStorage.setItem(AUTO_LOCATION_SESSION_KEY, 'done');
    requestLocationSearch({ silent: true });
  }, [requestLocationSearch]);

  useEffect(() => {
    setInstallersPage(1);
  }, [category, quickFilter, sortBy]);

  useEffect(() => {
    if (loading || !hasGuidedRequest || !SHOW_PUBLIC_INSTALLER_DIRECTORY) {
      return;
    }

    if (directory.installers.length > 0 || !hasActiveFilters) {
      setNoResultsSuggestions({ loading: false, label: '', items: [] });
      return;
    }

    let cancelled = false;

    const fetchSuggestions = async () => {
      setNoResultsSuggestions({ loading: true, label: '', items: [] });
      const scenarios = buildSuggestionScenarios(filters);

      for (const scenario of scenarios) {
        try {
          const response = await api.get('/public/installers', { params: scenario.params });
          const suggestions = (response.data?.installers || []).slice(0, 4);

          if (suggestions.length > 0) {
            if (!cancelled) {
              setNoResultsSuggestions({
                loading: false,
                label: scenario.label,
                items: suggestions,
              });
            }
            return;
          }
        } catch (_error) {
          // Tenta o proximo cenario automaticamente.
        }
      }

      if (!cancelled) {
        setNoResultsSuggestions({ loading: false, label: '', items: [] });
      }
    };

    fetchSuggestions();

    return () => {
      cancelled = true;
    };
  }, [directory.installers.length, filters, hasActiveFilters, hasGuidedRequest, loading]);

  useEffect(() => {
    if (!hasLocationPreviewInput || brazilianCities.length > 0) {
      return undefined;
    }

    let cancelled = false;

    const loadBrazilianCities = async () => {
      setLoadingLocations(true);
      setLocationLoadError('');

      try {
        const response = await fetch(BRAZILIAN_CITIES_API_URL);
        if (!response.ok) {
          throw new Error('Erro ao carregar municipios.');
        }

        const data = await response.json();
        const cities = (Array.isArray(data) ? data : [])
          .map(normalizeBrazilianCity)
          .filter(Boolean);

        if (!cancelled) {
          setBrazilianCities(cities);
        }
      } catch (_error) {
        if (!cancelled) {
          setLocationLoadError('Nao foi possivel carregar todos os municipios agora.');
        }
      } finally {
        if (!cancelled) {
          setLoadingLocations(false);
        }
      }
    };

    loadBrazilianCities();

    return () => {
      cancelled = true;
    };
  }, [brazilianCities.length, hasLocationPreviewInput]);

  useEffect(() => {
    if (locationPreviewZipDigits.length !== 8) {
      setZipLookupStatus('idle');
      return undefined;
    }

    let cancelled = false;

    const lookupZipCode = async () => {
      setZipLookupStatus('loading');

      try {
        const response = await fetch(`${VIA_CEP_API_URL}/${locationPreviewZipDigits}/json/`);
        if (!response.ok) {
          throw new Error('CEP indisponivel.');
        }

        const data = await response.json();
        if (data?.erro) {
          throw new Error('CEP nao encontrado.');
        }

        if (!cancelled) {
          setServiceRequest((current) => ({
            ...current,
            zipCode: data.cep || current.zipCode,
            neighborhood: current.neighborhood || data.bairro || '',
            city: current.city || data.localidade || '',
            state: current.state || data.uf || '',
            addressReference:
              current.addressReference ||
              [data.logradouro, data.complemento].filter(Boolean).join(', '),
          }));
          setZipLookupStatus('resolved');
        }
      } catch (_error) {
        if (!cancelled) {
          setZipLookupStatus('error');
        }
      }
    };

    lookupZipCode();

    return () => {
      cancelled = true;
    };
  }, [locationPreviewZipDigits]);

  const updateServiceRequest = (field, value) => {
    setServiceRequest((current) => ({ ...current, [field]: value }));
  };

  const updateLocationField = (field, value) => {
    if (field === 'zipCode') {
      updateServiceRequest(field, formatZipCode(value));
      return;
    }

    if (field === 'state') {
      updateServiceRequest(field, String(value || '').toUpperCase().slice(0, 2));
      return;
    }

    updateServiceRequest(field, value);
  };

  const updateRequestContact = (field, value) => {
    setRequestContact((current) => ({ ...current, [field]: value }));
  };

  const selectLocationOption = (location) => {
    setServiceRequest((current) => ({
      ...current,
      city: location.city,
      state: location.state,
      neighborhood: location.neighborhood || current.neighborhood,
    }));
  };

  const loadRequestInterests = useCallback(async (request = publishedRequest) => {
    if (!request?.id || !request?.client_access_token) {
      setRequestInterests([]);
      return;
    }

    setLoadingInterests(true);

    try {
      const response = await api.get(`/public/service-requests/${request.id}/interests`, {
        params: { token: request.client_access_token },
      });
      setRequestInterests(response.data?.interests || []);
      if (response.data?.request) {
        setPublishedRequest((current) => (current ? { ...current, ...response.data.request } : current));
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel carregar instaladores interessados.');
    } finally {
      setLoadingInterests(false);
    }
  }, [publishedRequest]);

  const selectInterestedInstaller = async (interest) => {
    if (!publishedRequest?.id || !publishedRequest?.client_access_token || !interest?.id) {
      return;
    }

    setSelectingInterestId(interest.id);

    try {
      const response = await api.post(
        `/public/service-requests/${publishedRequest.id}/interests/${interest.id}/select`,
        { token: publishedRequest.client_access_token }
      );
      const selected = response.data?.selected_interest;

      setRequestInterests((current) =>
        current.map((item) => ({
          ...item,
          selected: selected?.id === item.id,
          status: selected?.id === item.id ? 'selected' : 'interested',
          whatsapp_url: selected?.id === item.id ? selected.whatsapp_url : null,
        }))
      );

      if (response.data?.request) {
        setPublishedRequest((current) => ({ ...current, ...response.data.request }));
      }

      toast.success('Instalador escolhido. O contato pelo WhatsApp foi liberado.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel escolher o instalador.');
    } finally {
      setSelectingInterestId(null);
    }
  };

  useEffect(() => {
    if (!publishedRequest?.id || !publishedRequest?.client_access_token) {
      return undefined;
    }

    const interval = setInterval(() => {
      loadRequestInterests(publishedRequest);
    }, 15000);

    return () => clearInterval(interval);
  }, [loadRequestInterests, publishedRequest]);

  const handlePublishServiceRequest = async () => {
    const phoneDigits = requestContact.phone.replace(/\D/g, '');

    if (!requestContact.name.trim()) {
      toast.error('Informe seu nome para publicar a solicitacao.');
      return;
    }

    if (phoneDigits.length < 10) {
      toast.error('Informe um WhatsApp valido para os instaladores chamarem voce.');
      return;
    }

    if (!serviceRequest.city.trim() && !serviceRequest.state.trim()) {
      setRequestStep(2);
      toast.error('Informe a cidade ou estado do servico.');
      return;
    }

    setPublishingRequest(true);

    try {
      const response = await api.post('/public/service-requests', {
        client_name: requestContact.name,
        client_phone: requestContact.phone,
        client_email: requestContact.email,
        place_type: requestSnapshot.placeType,
        place_label: requestSnapshot.placeLabel,
        service: requestSnapshot.service,
        service_label: requestSnapshot.serviceLabel,
        rooms: selectedRooms,
        material_status: requestSnapshot.materialStatus,
        material_label: requestSnapshot.materialLabel,
        measurement_status: requestSnapshot.measurementStatus,
        measurement_label: requestSnapshot.measurementLabel,
        measurement_detail: requestSnapshot.measurementDetail,
        wall_size: requestSnapshot.wallSize,
        roll_count: requestSnapshot.rollCount,
        urgency: requestSnapshot.urgency,
        urgency_label: requestSnapshot.urgencyLabel,
        contact_preference: requestSnapshot.contactPreference,
        contact_preference_label: requestSnapshot.contactPreferenceLabel,
        zip_code: requestSnapshot.zipCode,
        neighborhood: requestSnapshot.neighborhood,
        address_reference: requestSnapshot.addressReference,
        city: requestSnapshot.city,
        state: requestSnapshot.state,
        details: [requestSnapshot.placeLabel ? `Local: ${requestSnapshot.placeLabel}` : '', requestSnapshot.details]
          .filter(Boolean)
          .join(' | '),
        photo_count: requestSnapshot.photoCount,
        photo_names: requestSnapshot.photoNames,
      });

      const nextRequest = response.data?.service_request || null;
      setPublishedRequest(nextRequest);
      setRequestInterests([]);
      if (nextRequest) {
        loadRequestInterests(nextRequest);
      }
      toast.success('Solicitacao publicada para instaladores proximos.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel publicar a solicitacao.');
    } finally {
      setPublishingRequest(false);
    }
  };

  const updateMeasurementStatus = (value) => {
    setServiceRequest((current) => ({
      ...current,
      measurementStatus: value,
      ...(value === 'known' ? {} : { wallSize: '', rollCount: '' }),
    }));
  };

  const toggleRequestRoom = (room) => {
    setServiceRequest((current) => {
      const currentRooms = getRequestRooms(current);
      const nextRooms = currentRooms.includes(room)
        ? currentRooms.filter((item) => item !== room)
        : [...currentRooms, room];

      return {
        ...current,
        room: nextRooms.join(', '),
        rooms: nextRooms,
      };
    });
  };

  const handleRequestPhotos = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (!files.length) {
      return;
    }

    const availableSlots = MAX_REQUEST_PHOTOS - serviceRequest.photos.length;

    if (availableSlots <= 0) {
      toast.error(`Adicione no maximo ${MAX_REQUEST_PHOTOS} fotos.`);
      return;
    }

    const selectedFiles = files
      .filter((file) => {
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} nao parece ser uma imagem.`);
          return false;
        }

        if (file.size > MAX_REQUEST_PHOTO_SIZE) {
          toast.error(`${file.name} passa de 5 MB.`);
          return false;
        }

        return true;
      })
      .slice(0, availableSlots);

    if (files.length > availableSlots) {
      toast(`Vamos usar as primeiras ${availableSlots} fotos para manter o app leve.`);
    }

    selectedFiles.forEach((file) => {
      const reader = new FileReader();

      reader.onload = () => {
        setServiceRequest((current) => {
          if (current.photos.length >= MAX_REQUEST_PHOTOS) {
            return current;
          }

          return {
            ...current,
            photos: [
              ...current.photos,
              {
                id: `${Date.now()}-${file.name}-${current.photos.length}`,
                name: file.name,
                preview: String(reader.result || ''),
              },
            ],
          };
        });
      };

      reader.readAsDataURL(file);
    });
  };

  const removeRequestPhoto = (photoId) => {
    setServiceRequest((current) => ({
      ...current,
      photos: current.photos.filter((photo) => photo.id !== photoId),
    }));
  };

  const persistCurrentRequest = useCallback(() => {
    if (!hasGuidedRequest) {
      return;
    }

    writeStoredClientRequest(buildClientRequestSnapshot(serviceRequest));
  }, [hasGuidedRequest, serviceRequest]);

  const canAdvanceRequest = () => {
    if (requestStep === 0 && serviceIntroStep === 0 && !serviceRequest.placeType) {
      toast.error('Escolha onde o servico sera feito para continuar.');
      return false;
    }

    if (requestStep === 0 && serviceIntroStep === 1 && !serviceRequest.service) {
      toast.error('Escolha o tipo do papel para continuar.');
      return false;
    }

    if (requestStep === 1 && detailStep === 0 && selectedRooms.length === 0) {
      toast.error('Escolha pelo menos um ambiente para continuar.');
      return false;
    }

    if (requestStep === 1 && detailStep === 1 && !serviceRequest.materialStatus) {
      toast.error('Informe a situacao do material para continuar.');
      return false;
    }

    if (requestStep === 1 && detailStep === 2 && !serviceRequest.measurementStatus) {
      toast.error('Escolha se ja sabe as medidas ou se prefere visita tecnica.');
      return false;
    }

    if (requestStep === 2 && !serviceRequest.city.trim() && !serviceRequest.state.trim()) {
      toast.error('Informe sua cidade ou estado para encontrar profissionais proximos.');
      return false;
    }

    return true;
  };

  const handleRequestNext = () => {
    if (!canAdvanceRequest()) {
      return;
    }

    if (requestStep === 0 && serviceIntroStep < LAST_SERVICE_INTRO_STEP) {
      setServiceIntroStep((current) => Math.min(current + 1, LAST_SERVICE_INTRO_STEP));
      return;
    }

    if (requestStep === 1 && detailStep < LAST_DETAIL_STEP) {
      setDetailStep((current) => Math.min(current + 1, LAST_DETAIL_STEP));
      return;
    }

    if (requestStep === 0) {
      setDetailStep(0);
    }

    setRequestStep((current) => Math.min(current + 1, LAST_REQUEST_STEP));
  };

  const handleRequestBack = () => {
    if (requestStep === 0 && serviceIntroStep > 0) {
      setServiceIntroStep((current) => Math.max(current - 1, 0));
      return;
    }

    if (requestStep === 1 && detailStep > 0) {
      setDetailStep((current) => Math.max(current - 1, 0));
      return;
    }

    if (requestStep === 1) {
      setServiceIntroStep(LAST_SERVICE_INTRO_STEP);
    }

    if (requestStep === 2) {
      setDetailStep(LAST_DETAIL_STEP);
    }

    setRequestStep((current) => Math.max(current - 1, 0));
  };

  const requestGuidedLocation = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      toast.error('Seu navegador nao oferece localizacao automatica.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const region = await reverseLocation(position.coords.latitude, position.coords.longitude);
          setServiceRequest((current) => ({
            ...current,
            city: region.city || current.city,
            state: region.state || current.state,
          }));
          toast.success(region.label ? `Regiao encontrada: ${region.label}.` : 'Regiao encontrada.');
        } catch (error) {
          toast.error(error.response?.data?.error || 'Nao foi possivel localizar sua regiao agora.');
        }
      },
      () => {
        toast.error('Permita a localizacao ou preencha sua cidade manualmente.');
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }, [reverseLocation]);

  const handleGuidedSearch = async (event) => {
    event.preventDefault();

    if (!serviceRequest.placeType) {
      setRequestStep(0);
      setServiceIntroStep(0);
      toast.error('Escolha onde o servico sera feito primeiro.');
      return;
    }

    if (!serviceRequest.service) {
      setRequestStep(0);
      setServiceIntroStep(1);
      toast.error('Escolha o tipo do papel primeiro.');
      return;
    }

    if (!serviceRequest.city.trim() && !serviceRequest.state.trim()) {
      setRequestStep(2);
      toast.error('Informe a regiao do servico para enviar aos instaladores proximos.');
      return;
    }

    const nextFilters = {
      search: '',
      city: serviceRequest.city.trim(),
      state: serviceRequest.state.trim().toUpperCase(),
    };

    setFilters(nextFilters);
    setCategory(serviceRequest.service || 'all');
    setQuickFilter('available');
    setSortBy('match');
    setInstallersPage(1);
    setHasGuidedRequest(true);
    setPublishedRequest(null);
    setRequestInterests([]);
    writeStoredClientRequest(requestSnapshot);

    if (typeof document !== 'undefined') {
      window.requestAnimationFrame(() => {
        document.getElementById('publicar-pedido')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const clearFilters = async () => {
    const nextFilters = { search: '', city: '', state: '' };
    setFilters(nextFilters);
    setServiceRequest(INITIAL_SERVICE_REQUEST);
    setRequestStep(0);
    setServiceIntroStep(0);
    setDetailStep(0);
    setHasGuidedRequest(false);
    setPublishedRequest(null);
    setRequestInterests([]);
    clearStoredClientRequest();
    setCategory('all');
    setQuickFilter('all');
    setSortBy('rating');
    setInstallersPage(1);
    await loadDirectory(nextFilters);
  };

  const toggleFavorite = (installerId) => {
    setFavorites((current) => ({
      ...current,
      [installerId]: !current[installerId],
    }));
  };

  const cycleQuickFilter = () => {
    const currentIndex = QUICK_FILTER_OPTIONS.findIndex((item) => item.value === quickFilter);
    const nextIndex = (currentIndex + 1) % QUICK_FILTER_OPTIONS.length;
    setQuickFilter(QUICK_FILTER_OPTIONS[nextIndex].value);
  };

  const handleLogout = () => {
    logout();
    toast.success('Voce saiu da conta.');
    navigate('/cliente', { replace: true });
  };

  return (
    <div className="client-app-page" id="top">
      <div className="client-app-shell">
        <header className="client-app-topbar fade-up">
          <div className="client-app-brand">
            <BrandMark className="client-app-brand-mark" />
            <div className="client-app-brand-copy">
              <strong>Instalar+</strong>
              <span>Encontre instaladores no Brasil</span>
            </div>
          </div>

          <div className="client-app-top-actions">
            <button className="client-app-icon-button" type="button">
              <AppIcon name="bell" />
            </button>
            {user ? (
              <>
                <Link className="client-app-chip-link" to={accountHomePath}>
                  {accountLinkLabel}
                </Link>
                <button className="client-app-chip-link client-app-logout-button" onClick={handleLogout} type="button">
                  Sair
                </button>
              </>
            ) : null}
          </div>
        </header>

        <section className="client-app-request-card fade-up" id="busca">
          <div className="client-app-request-head">
            <div>
              <p className="client-app-kicker">Pedido guiado</p>
              <h2>Conte o que precisa e receba interessados</h2>
              <p>
                O cliente informa o servico, a localizacao e o prazo. Instaladores proximos enviam interesse
                e voce escolhe com quem quer falar.
              </p>
            </div>

            <div className="client-app-request-side">
              <div className="client-app-request-progress" aria-label="Etapas do pedido">
                {REQUEST_STEPS.map((step, index) => (
                  <button
                    className={index === requestStep ? 'is-active' : index < requestStep ? 'is-done' : ''}
                    disabled={index > requestStep}
                    key={step.value}
                    onClick={() => {
                      if (index === 0 && requestStep !== 0) {
                        setServiceIntroStep(0);
                      }
                      if (index === 1 && requestStep < 1) {
                        setDetailStep(0);
                      }
                      if (index === 1 && requestStep > 1) {
                        setDetailStep(LAST_DETAIL_STEP);
                      }
                      setRequestStep(index);
                    }}
                    type="button"
                  >
                    <span>{index + 1}</span>
                    {step.label}
                  </button>
                ))}
              </div>
              <div className="client-app-request-score" aria-label={`Pedido ${requestCompleteness}% completo`}>
                <div>
                  <strong>{requestCompleteness}% completo</strong>
                  <span>Quanto mais detalhes, melhor a indicacao.</span>
                </div>
                <div className="client-app-request-score-bar">
                  <span style={{ width: `${requestCompleteness}%` }} />
                </div>
              </div>
            </div>
          </div>

          <form className="client-app-request-form" onSubmit={handleGuidedSearch}>
            {requestStep === 0 ? (
              <div className="client-app-request-panel">
                <h3>{serviceIntroStep === 0 ? 'Onde sera instalado?' : 'Qual tipo de papel?'}</h3>
                <p>
                  {serviceIntroStep === 0
                    ? 'Primeiro informe o tipo de local. Depois escolha o material para direcionar os instaladores certos.'
                    : 'Agora escolha o tipo de papel mais proximo do seu caso.'}
                </p>

                <div className="client-app-detail-steps client-app-service-steps" aria-label="Subetapas do servico">
                  {SERVICE_INTRO_STEPS.map((step, index) => (
                    <button
                      className={index === serviceIntroStep ? 'is-active' : index < serviceIntroStep ? 'is-done' : ''}
                      disabled={index === 1 && !serviceRequest.placeType}
                      key={step.value}
                      onClick={() => setServiceIntroStep(index)}
                      type="button"
                    >
                      <span>{index + 1}</span>
                      {step.label}
                    </button>
                  ))}
                </div>

                <div className="client-app-service-grid">
                  {serviceIntroOptions.map((item) => {
                    const selectedValue = serviceIntroStep === 0 ? serviceRequest.placeType : serviceRequest.service;

                    return (
                      <button
                        className={selectedValue === item.value ? 'is-selected' : ''}
                        key={item.value}
                        onClick={() => updateServiceRequest(serviceIntroStep === 0 ? 'placeType' : 'service', item.value)}
                        type="button"
                      >
                        <span className="client-app-service-icon">
                          <AppIcon name={item.icon} />
                        </span>
                        <strong>{item.title}</strong>
                        <span>{item.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {requestStep === 1 ? (
              <div className="client-app-request-panel client-app-request-panel--details">
                <div className="client-app-detail-heading">
                  <div>
                    <h3>{selectedDetailStep.label}</h3>
                    <p>
                      {detailStep === 0
                        ? 'Escolha todos os ambientes da casa onde o servico sera feito.'
                        : detailStep === 1
                          ? 'Informe apenas a situacao do material agora.'
                          : 'Diga se ja sabe as medidas ou se prefere uma visita tecnica.'}
                    </p>
                  </div>
                  <span>Detalhe {detailStep + 1} de {DETAIL_STEPS.length}</span>
                </div>

                <div className="client-app-detail-steps" aria-label="Subetapas dos detalhes">
                  {DETAIL_STEPS.map((step, index) => (
                    <button
                      className={index === detailStep ? 'is-active' : index < detailStep ? 'is-done' : ''}
                      disabled={
                        (index === 1 && selectedRooms.length === 0) ||
                        (index === 2 && (selectedRooms.length === 0 || !serviceRequest.materialStatus))
                      }
                      key={step.value}
                      onClick={() => setDetailStep(index)}
                      type="button"
                    >
                      <span>{index + 1}</span>
                      {step.label}
                    </button>
                  ))}
                </div>

                <div className="client-app-detail-layout">
                  {detailStep === 0 ? (
                    <section className="client-app-detail-section client-app-detail-single" aria-labelledby="rooms-heading">
                    <div className="client-app-detail-titleline">
                      <span>1</span>
                      <div>
                        <strong id="rooms-heading">Onde vai instalar?</strong>
                        <small>Toque para adicionar ou remover.</small>
                      </div>
                    </div>
                    <div className="client-app-room-stream" role="group" aria-label="Ambientes do servico">
                      {ROOM_OPTIONS.map((room) => {
                        const isSelected = selectedRooms.includes(room);

                        return (
                          <button
                            className={isSelected ? 'is-selected' : ''}
                            key={room}
                            onClick={() => toggleRequestRoom(room)}
                            type="button"
                          >
                            <span aria-hidden="true" />
                            {room}
                          </button>
                        );
                      })}
                    </div>
                    <div className="client-app-detail-hint">
                      {selectedRooms.length > 0
                        ? `${selectedRooms.length} ambiente${selectedRooms.length === 1 ? '' : 's'} selecionado${selectedRooms.length === 1 ? '' : 's'}`
                        : 'Nenhum ambiente selecionado ainda'}
                    </div>
                    </section>
                  ) : null}

                  {detailStep === 1 ? (
                    <section className="client-app-detail-section client-app-detail-single" aria-labelledby="material-heading">
                    <div className="client-app-detail-titleline">
                      <span>2</span>
                      <div>
                        <strong id="material-heading">Material</strong>
                        <small>Ajuda o profissional a entender a visita.</small>
                      </div>
                    </div>
                    <div className="client-app-material-list" role="group" aria-label="Status do material">
                      {MATERIAL_STATUS_OPTIONS.map((item) => (
                        <button
                          className={serviceRequest.materialStatus === item.value ? 'is-selected' : ''}
                          key={item.value}
                          onClick={() => updateServiceRequest('materialStatus', item.value)}
                          type="button"
                        >
                          <span aria-hidden="true" />
                          {item.label}
                        </button>
                      ))}
                    </div>
                    </section>
                  ) : null}
                </div>

                {detailStep === 2 ? (
                  <section className="client-app-detail-section client-app-detail-single client-app-measure-section" aria-labelledby="measure-heading">
                  <div className="client-app-detail-titleline">
                    <span>3</span>
                    <div>
                      <strong id="measure-heading">Medidas ou visita</strong>
                      <small>O cliente pode seguir mesmo sem saber o tamanho exato.</small>
                    </div>
                  </div>

                  <div className="client-app-measure-options" role="group" aria-label="Situacao das medidas">
                    {MEASUREMENT_OPTIONS.map((item) => (
                      <button
                        className={serviceRequest.measurementStatus === item.value ? 'is-selected' : ''}
                        key={item.value}
                        onClick={() => updateMeasurementStatus(item.value)}
                        type="button"
                      >
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                      </button>
                    ))}
                  </div>

                  {serviceRequest.measurementStatus === 'known' ? (
                    <div className="client-app-detail-quick-fields">
                      <label className="client-app-request-field client-app-request-field--line">
                        <span>Medida aproximada</span>
                        <input
                          onChange={(event) => updateServiceRequest('wallSize', event.target.value)}
                          placeholder="Ex.: sala 3m x 2,6m; cozinha 2m"
                          value={serviceRequest.wallSize}
                        />
                      </label>
                      <label className="client-app-request-field client-app-request-field--line">
                        <span>Quantidade de rolos</span>
                        <input
                          inputMode="numeric"
                          onChange={(event) => updateServiceRequest('rollCount', event.target.value)}
                          placeholder="Ex.: 4 rolos no total"
                          value={serviceRequest.rollCount}
                        />
                      </label>
                    </div>
                  ) : serviceRequest.measurementStatus ? (
                    <div className="client-app-measure-note">
                      <strong>
                        {serviceRequest.measurementStatus === 'visit'
                          ? 'Visita tecnica marcada como preferencia.'
                          : 'Medidas ficam para confirmar depois.'}
                      </strong>
                      <span>
                        {serviceRequest.measurementStatus === 'visit'
                          ? 'Os profissionais vao ver que precisam combinar uma visita antes do orcamento final.'
                          : 'O instalador pode orientar a quantidade de papel e conferir as paredes pelo atendimento.'}
                      </span>
                    </div>
                  ) : null}
                  </section>
                ) : null}

                {detailStep === 2 ? (
                  <>
                    <label className="client-app-request-field client-app-request-field--line client-app-detail-note">
                      <span>Observacao rapida opcional</span>
                  <textarea
                    onChange={(event) => updateServiceRequest('details', event.target.value)}
                    placeholder="Ex.: sala e cozinha, parede lisa, material ja comprado, precisa medir no local"
                    rows="3"
                    value={serviceRequest.details}
                  />
                    </label>

                    <div className="client-app-photo-uploader">
                  <label className="client-app-photo-drop client-app-photo-drop--compact">
                    <input accept="image/*" multiple onChange={handleRequestPhotos} type="file" />
                    <strong>Fotos ajudam no orcamento</strong>
                    <span>{serviceRequest.photos.length}/{MAX_REQUEST_PHOTOS} adicionadas</span>
                  </label>
                  {serviceRequest.photos.length > 0 ? (
                    <div className="client-app-photo-grid">
                      {serviceRequest.photos.map((photo) => (
                        <figure key={photo.id}>
                          <img alt={`Referencia ${photo.name}`} src={photo.preview} />
                          <figcaption>{photo.name}</figcaption>
                          <button
                            aria-label={`Remover ${photo.name}`}
                            onClick={() => removeRequestPhoto(photo.id)}
                            type="button"
                          >
                            Remover
                          </button>
                        </figure>
                      ))}
                    </div>
                  ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {requestStep === 2 ? (
              <div className="client-app-request-panel">
                <h3>Onde sera o servico?</h3>
                <p>Informe cidade, estado e bairro para priorizar instaladores mais proximos.</p>
                <div className="client-app-request-location">
                  <label className="client-app-request-field">
                    <span>Cidade</span>
                    <input
                      onChange={(event) => updateLocationField('city', event.target.value)}
                      placeholder="Ex.: Sao Paulo"
                      value={serviceRequest.city}
                    />
                  </label>
                  <label className="client-app-request-field">
                    <span>Estado</span>
                    <input
                      maxLength="2"
                      onChange={(event) => updateLocationField('state', event.target.value)}
                      placeholder="SP"
                      value={serviceRequest.state}
                    />
                  </label>
                  <button className="client-app-ghost-button" onClick={requestGuidedLocation} type="button">
                    <AppIcon name="target" />
                    Usar minha localizacao
                  </button>
                </div>
                <div className="client-app-request-location client-app-request-location--detail">
                  <label className="client-app-request-field">
                    <span>Bairro</span>
                    <input
                      onChange={(event) => updateLocationField('neighborhood', event.target.value)}
                      placeholder="Ex.: Cambui"
                      value={serviceRequest.neighborhood}
                    />
                  </label>
                  <label className="client-app-request-field">
                    <span>CEP opcional</span>
                    <input
                      inputMode="numeric"
                      onChange={(event) => updateLocationField('zipCode', event.target.value)}
                      placeholder="Ex.: 13000-000"
                      value={serviceRequest.zipCode}
                    />
                  </label>
                  <label className="client-app-request-field">
                    <span>Referencia</span>
                    <input
                      onChange={(event) => updateServiceRequest('addressReference', event.target.value)}
                      placeholder="Condominio, avenida ou ponto de referencia"
                      value={serviceRequest.addressReference}
                    />
                  </label>
                </div>

                {hasLocationPreviewInput ? (
                <div className="client-app-location-preview" aria-live="polite">
                  <div className="client-app-location-preview-head">
                    <div>
                      <strong>Locais sugeridos</strong>
                      <span>
                        {zipLookupStatus === 'loading'
                          ? 'Buscando bairro, cidade e estado pelo CEP.'
                          : locationPreviewNeighborhood
                            ? 'O bairro digitado vai junto com a cidade escolhida.'
                            : 'Escolha uma cidade e estado para preencher os campos.'}
                      </span>
                    </div>
                    <span className="client-app-location-preview-count">
                      {loadingLocations ? '...' : `${locationOptions.length} loca${locationOptions.length === 1 ? 'l' : 'is'}`}
                    </span>
                  </div>

                  {locationOptions.length > 0 ? (
                    <div className="client-app-location-preview-list">
                      {locationOptions.map((location) => (
                        <button
                          className="client-app-location-preview-item client-app-location-option"
                          key={`${location.city}-${location.state}`}
                          onClick={() => selectLocationOption(location)}
                          type="button"
                        >
                          <span className="client-app-location-pin">
                            <AppIcon name="map-pin" />
                          </span>
                          <span className="client-app-location-preview-copy">
                            <strong>{location.neighborhood ? `${location.neighborhood} - ${location.city}` : location.city}</strong>
                            <span>{[location.state, location.region].filter(Boolean).join(' - ')}</span>
                          </span>
                          <span className="client-app-location-use">Usar</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="client-app-location-preview-empty">
                      {loadingLocations
                        ? 'Carregando municipios do Brasil...'
                        : locationLoadError ||
                          (locationPreviewNeighborhood && !locationPreviewCity && !locationPreviewState && locationPreviewZipDigits.length < 3
                            ? 'Digite tambem a cidade, estado ou CEP para localizar esse bairro.'
                            : 'Digite cidade, estado ou CEP para encontrar locais do Brasil inteiro.')}
                    </p>
                  )}
                </div>
                ) : null}
              </div>
            ) : null}

            {requestStep === 3 ? (
              <div className="client-app-request-panel">
                <h3>Revise e publique o pedido</h3>
                <p>Os instaladores proximos veem a oportunidade e enviam interesse. Depois voce escolhe um.</p>

                <div className="client-app-review-layout">
                  <section className="client-app-review-block">
                    <div>
                      <strong>Quando precisa?</strong>
                      <span>Isso ajuda os instaladores a entenderem a prioridade.</span>
                    </div>
                    <div className="client-app-option-list" role="group" aria-label="Prazo desejado">
                      {URGENCY_OPTIONS.map((item) => (
                        <button
                          className={serviceRequest.urgency === item.value ? 'is-selected' : ''}
                          key={item.value}
                          onClick={() => updateServiceRequest('urgency', item.value)}
                          type="button"
                        >
                          <span className="client-app-option-dot" aria-hidden="true" />
                          <span>
                            <strong>{item.label}</strong>
                            <small>{item.description}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="client-app-review-block">
                    <div>
                      <strong>Como prefere falar?</strong>
                      <span>O contato completo so fica liberado para o instalador escolhido.</span>
                    </div>
                    <div className="client-app-option-list" role="group" aria-label="Preferencia de contato">
                      {CONTACT_PREFERENCE_OPTIONS.map((item) => (
                        <button
                          className={serviceRequest.contactPreference === item.value ? 'is-selected' : ''}
                          key={item.value}
                          onClick={() => updateServiceRequest('contactPreference', item.value)}
                          type="button"
                        >
                          <span className="client-app-option-dot" aria-hidden="true" />
                          <span>
                            <strong>{item.label}</strong>
                            <small>{item.description}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="client-app-request-summary">
                  <span>{selectedPlaceType?.title || 'Local nao escolhido'}</span>
                  <span>{selectedServiceRequest?.title || 'Tipo do papel nao escolhido'}</span>
                  <span>{requestSnapshot.room || 'Ambientes nao informados'}</span>
                  <span>
                    {[serviceRequest.neighborhood, serviceRequest.city, serviceRequest.state.toUpperCase()].filter(Boolean).join(' - ') ||
                      'Regiao nao informada'}
                  </span>
                  <span>{selectedUrgency?.label || 'Prazo flexivel'}</span>
                  <span>{selectedMaterialStatus?.label || 'Material nao informado'}</span>
                  <span>{requestSnapshot.measurementDetail}</span>
                  <span>{selectedContactPreference?.label || 'WhatsApp'}</span>
                  <span>{serviceRequest.photos.length ? `${serviceRequest.photos.length} foto(s)` : 'Sem fotos'}</span>
                </div>
              </div>
            ) : null}

            <div className="client-app-request-actions">
              <button
                className="client-app-ghost-button"
                disabled={requestStep === 0 && serviceIntroStep === 0}
                onClick={handleRequestBack}
                type="button"
              >
                Voltar
              </button>
              {requestStep < LAST_REQUEST_STEP ? (
                <button className="client-app-search-submit" onClick={handleRequestNext} type="button">
                  {requestStep === 0 && serviceIntroStep < LAST_SERVICE_INTRO_STEP
                    ? `Continuar para ${SERVICE_INTRO_STEPS[serviceIntroStep + 1].label}`
                    : requestStep === 1 && detailStep < LAST_DETAIL_STEP
                    ? `Continuar para ${DETAIL_STEPS[detailStep + 1].label}`
                    : 'Continuar'}
                </button>
              ) : (
                <button className="client-app-search-submit" type="submit">
                  Continuar para publicar
                </button>
              )}
            </div>
          </form>
        </section>

        {hasGuidedRequest ? (
          <>
            <section className="client-app-request-receipt fade-up">
              <div className="client-app-request-receipt-main">
                <p className="client-app-kicker">Resumo do pedido</p>
                <h3>{requestSnapshot.serviceLabel || 'Pedido de instalacao'}</h3>
                <p>
                  {[requestSnapshot.room, requestSnapshot.neighborhood, requestSnapshot.city, requestSnapshot.state].filter(Boolean).join(' - ') ||
                    'Regiao e ambiente informados pelo cliente'}
                </p>
              </div>
              <div className="client-app-request-receipt-grid">
                <span>{requestSnapshot.materialLabel}</span>
                <span>{requestSnapshot.urgencyLabel}</span>
                <span>{requestSnapshot.measurementDetail}</span>
              </div>
              <div className="client-app-request-receipt-actions">
                <button className="client-app-ghost-button" onClick={() => setRequestStep(1)} type="button">
                  Editar detalhes
                </button>
                <button className="client-app-ghost-button" onClick={clearFilters} type="button">
                  Novo pedido
                </button>
              </div>
            </section>

            <section className="client-app-opportunity-publish fade-up" id="publicar-pedido">
              <div className="client-app-opportunity-copy">
                <p className="client-app-kicker">Oportunidade para instaladores</p>
                <h3>Publique seu pedido e escolha entre os interessados.</h3>
                <span>
                  Os instaladores proximos veem cidade, bairro, servico e detalhes. Seu WhatsApp completo so fica liberado para o escolhido.
                </span>
              </div>

              {publishedRequest ? (
                <div className="client-app-opportunity-success">
                  <strong>Solicitacao #{publishedRequest.id} publicada</strong>
                  <span>Agora os instaladores podem enviar interesse. Quando aparecerem abaixo, escolha o melhor para liberar o contato.</span>
                </div>
              ) : (
                <div className="client-app-opportunity-form">
                  <label className="client-app-request-field">
                    <span>Seu nome</span>
                    <input
                      onChange={(event) => updateRequestContact('name', event.target.value)}
                      placeholder="Ex.: Matheus Silva"
                      value={requestContact.name}
                    />
                  </label>
                  <label className="client-app-request-field">
                    <span>WhatsApp</span>
                    <input
                      inputMode="tel"
                      onChange={(event) => updateRequestContact('phone', event.target.value)}
                      placeholder="(11) 99999-9999"
                      value={requestContact.phone}
                    />
                  </label>
                  <label className="client-app-request-field">
                    <span>E-mail opcional</span>
                    <input
                      onChange={(event) => updateRequestContact('email', event.target.value)}
                      placeholder="voce@email.com"
                      type="email"
                      value={requestContact.email}
                    />
                  </label>
                  <button
                    className="client-app-search-submit"
                    disabled={publishingRequest}
                    onClick={handlePublishServiceRequest}
                    type="button"
                  >
                    {publishingRequest ? 'Publicando...' : 'Publicar oportunidade'}
                  </button>
                </div>
              )}
            </section>

            {publishedRequest ? (
              <section className="client-app-interest-board fade-up" id="interessados">
                <div className="client-app-interest-head">
                  <div>
                    <p className="client-app-kicker">Instaladores interessados</p>
                    <h3>{selectedInterest ? 'Instalador escolhido' : 'Escolha quem prefere chamar'}</h3>
                    <span>
                      {selectedInterest
                        ? 'O WhatsApp do profissional escolhido esta liberado.'
                        : 'Varios instaladores podem demonstrar interesse no mesmo pedido.'}
                    </span>
                  </div>
                  <button className="client-app-ghost-button" onClick={() => loadRequestInterests()} type="button">
                    {loadingInterests ? 'Atualizando...' : 'Atualizar'}
                  </button>
                </div>

                {requestInterests.length === 0 ? (
                  <div className="client-app-interest-empty">
                    <strong>Aguardando interessados</strong>
                    <span>Seu pedido ja esta no painel dos instaladores mais proximos da regiao informada.</span>
                  </div>
                ) : (
                  <div className="client-app-interest-list">
                    {requestInterests.map((interest) => (
                      <article className={interest.selected ? 'is-selected' : ''} key={interest.id}>
                        <div className="client-app-interest-avatar">
                          {interest.installer_photo || interest.logo ? (
                            <img alt={`Foto de ${interest.display_name}`} src={interest.installer_photo || interest.logo} />
                          ) : (
                            <span>{getInitials(interest.display_name)}</span>
                          )}
                        </div>
                        <div className="client-app-interest-copy">
                          <strong>{interest.display_name}</strong>
                          <span>{[interest.city, interest.state].filter(Boolean).join(', ') || 'Regiao informada no perfil'}</span>
                          <small>
                            {Number(interest.average_rating || 0).toFixed(1)} estrelas - {interest.review_count || 0} avaliacoes
                          </small>
                        </div>
                        <div className="client-app-interest-actions">
                          {interest.selected && interest.whatsapp_url ? (
                            <a className="gold-button" href={interest.whatsapp_url} rel="noreferrer" target="_blank">
                              Chamar no WhatsApp
                            </a>
                          ) : (
                            <button
                              className="gold-button"
                              disabled={Boolean(selectedInterest) || selectingInterestId === interest.id}
                              onClick={() => selectInterestedInstaller(interest)}
                              type="button"
                            >
                              {selectingInterestId === interest.id ? 'Escolhendo...' : 'Escolher'}
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {SHOW_PUBLIC_INSTALLER_DIRECTORY ? (
              <>
                <section className="client-app-category-row fade-up">
                  {CATEGORY_OPTIONS.map((item) => (
                    <button
                      className={`client-app-category ${category === item.value ? 'is-active' : ''}`}
                      key={item.value}
                      onClick={() => setCategory(item.value)}
                      type="button"
                    >
                      <span className="client-app-category-icon">
                        <AppIcon
                          name={
                            item.value === 'all'
                              ? 'users'
                              : item.value === 'residential'
                                ? 'home'
                                : item.value === 'commercial'
                                  ? 'building'
                                  : item.value === 'textured'
                                    ? 'texture'
                                    : item.value === 'vinyl'
                                      ? 'roller'
                                      : 'sticker'
                          }
                        />
                      </span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </section>

                <section className="client-app-toolbar fade-up">
                  <button className="client-app-toolbar-pill" onClick={() => requestLocationSearch()} type="button">
                    <AppIcon name="map-pin" />
                    <span>
                      {filters.city
                        ? `${filters.city}${filters.state ? `, ${filters.state}` : ''}`
                        : 'Minha localizacao'}
                    </span>
                  </button>

                  <div className="client-app-toolbar-actions">
                    <button className="client-app-toolbar-action" onClick={cycleQuickFilter} type="button">
                      <AppIcon name="filter" />
                      <span>{QUICK_FILTER_OPTIONS.find((item) => item.value === quickFilter)?.label || 'Filtro'}</span>
                    </button>

                    <label className="client-app-toolbar-select">
                      <AppIcon name="sort" />
                      <select onChange={(event) => setSortBy(event.target.value)} value={sortBy}>
                        <option value="match">Mais compativeis</option>
                        <option value="rating">Melhor avaliados</option>
                        <option value="reviews">Mais avaliacoes</option>
                        <option value="available">Mais disponiveis</option>
                        <option value="name">Ordem alfabetica</option>
                      </select>
                    </label>
                  </div>
                </section>
              </>
            ) : null}
          </>
        ) : (
          <section className="client-app-empty client-app-start-empty fade-up">
            <strong>Comece pelo pedido para receber indicacoes melhores.</strong>
            <p>
              O fluxo fica em etapas como um marketplace de servicos: primeiro voce explica o que precisa,
              depois recebe interessados e escolhe com quem quer falar.
            </p>
          </section>
        )}

        {SHOW_PUBLIC_INSTALLER_DIRECTORY && hasGuidedRequest ? (
          <section className="client-app-results-head fade-up" id="resultados">
            <div>
              <h2>Profissionais compativeis com seu pedido</h2>
            </div>
            <span className="client-app-count-badge">{filteredInstallers.length} profissionais</span>
          </section>
        ) : null}

        {SHOW_PUBLIC_INSTALLER_DIRECTORY && hasGuidedRequest && loading ? <div className="client-app-empty fade-up">Carregando instaladores...</div> : null}

        {SHOW_PUBLIC_INSTALLER_DIRECTORY && hasGuidedRequest && !loading && filteredInstallers.length === 0 ? (
          <div className="client-app-empty fade-up">
            <strong>Nenhum instalador encontrado com esse filtro.</strong>
            <p>
              Ajuste sua busca ou limpe os filtros para ver novamente todos os profissionais disponiveis.
            </p>
            {hasActiveFilters ? (
              <button className="client-app-ghost-button" onClick={clearFilters} type="button">
                Limpar filtros
              </button>
            ) : null}
          </div>
        ) : null}

        {SHOW_PUBLIC_INSTALLER_DIRECTORY && hasGuidedRequest && !loading && filteredInstallers.length === 0 && hasActiveFilters && noResultsSuggestions.items.length > 0 ? (
          <section className="client-app-suggestion-box fade-up">
            <div className="client-app-section-copy">
              <p className="client-app-kicker">Sugestoes automaticas</p>
              <h3>{noResultsSuggestions.label || 'Confira outros profissionais parecidos'}</h3>
            </div>

            <div className="client-app-suggestion-grid">
              {noResultsSuggestions.items.map((installer) => (
                <Link
                  className="client-app-suggestion-card"
                  key={`suggestion-${installer.id}`}
                  onClick={persistCurrentRequest}
                  to={`/installers/${installer.id}`}
                >
                  {installer.installer_photo ? (
                    <img alt={`Foto de ${installer.display_name}`} src={installer.installer_photo} />
                  ) : installer.logo ? (
                    <img alt={`Logo de ${installer.display_name}`} src={installer.logo} />
                  ) : (
                    <span className="client-app-avatar-fallback">{getInitials(installer.display_name)}</span>
                  )}
                  <div>
                    <strong>{installer.display_name}</strong>
                    <span>{getRegionLabel(installer)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {SHOW_PUBLIC_INSTALLER_DIRECTORY && hasGuidedRequest && favoriteInstallers.length > 0 ? (
          <section className="client-app-favorites fade-up" id="favoritos">
            <div className="client-app-results-head client-app-results-head--small">
              <div>
                <h2>Favoritos</h2>
              </div>
              <span className="client-app-count-badge">{favoriteInstallers.length} salvos</span>
            </div>

            <div className="client-app-results-list">
              {favoriteInstallers.slice(0, 3).map((installer) => {
                const availability = getAvailabilityState(installer);
                const tags = deriveInstallerTags(installer);
                const isVerified = Boolean(installer.certificate_verified || installer.safety?.document_masked);
                const matchScore = getInstallerMatchScore(installer, serviceRequest);
                const matchReasons = getInstallerMatchReasons(installer, serviceRequest);

                return (
                  <article className="client-app-installer-card" key={`favorite-${installer.id}`}>
                    <div className="client-app-status-badge" data-tone={availability.tone}>
                      <span />
                      {availability.label}
                    </div>

                    <div className="client-app-installer-main">
                      <div className="client-app-installer-media">
                        {installer.installer_photo ? (
                          <img alt={`Foto de ${installer.display_name}`} src={installer.installer_photo} />
                        ) : installer.logo ? (
                          <img alt={`Logo de ${installer.display_name}`} src={installer.logo} />
                        ) : (
                          <div className="client-app-avatar-fallback">{getInitials(installer.display_name)}</div>
                        )}
                      </div>

                      <div className="client-app-installer-content">
                        <div className="client-app-installer-head">
                          <div>
                            <h3>{installer.display_name}</h3>
                            <p>{getRegionLabel(installer)}</p>
                          </div>
                          <button
                            className={`client-app-favorite-button ${favorites[installer.id] ? 'is-active' : ''}`}
                            onClick={() => toggleFavorite(installer.id)}
                            type="button"
                          >
                            <AppIcon name="heart" />
                          </button>
                        </div>

                        <div className="client-app-rating-line">
                          <AppIcon name="star" />
                          <strong>{Number(installer.average_rating || 0).toFixed(1)}</strong>
                          <span>({installer.review_count || 0} avaliacoes)</span>
                        </div>

                        <div className="client-app-match-row">
                          <span className="client-app-match-pill">{matchScore}% compativel</span>
                          {matchReasons.map((reason) => (
                            <span key={`favorite-${installer.id}-${reason}`}>{reason}</span>
                          ))}
                        </div>

                        <div className="client-app-tag-row">
                          {tags.map((tag) => (
                            <span className="client-app-tag" key={`${installer.id}-${tag}`}>
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div className="client-app-detail-line">
                          <AppIcon name="shield" />
                          <span>{isVerified ? 'Perfil verificado' : 'Contato direto com o profissional'}</span>
                          <span className="client-app-dot">•</span>
                          <span>{(installer.available_dates || []).length > 0 ? 'Datas disponiveis' : 'Perfil completo'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="client-app-installer-footer">
                      <Link className="client-app-primary-link" onClick={persistCurrentRequest} to={`/installers/${installer.id}`}>
                        Ver perfil
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {SHOW_PUBLIC_INSTALLER_DIRECTORY && hasGuidedRequest && !loading && filteredInstallers.length > 0 ? (
          <section className="client-app-results-list fade-up">
            {paginatedInstallers.map((installer) => {
              const availability = getAvailabilityState(installer);
              const tags = deriveInstallerTags(installer);
              const isVerified = Boolean(installer.certificate_verified || installer.safety?.document_masked);
              const matchScore = getInstallerMatchScore(installer, serviceRequest);
              const matchReasons = getInstallerMatchReasons(installer, serviceRequest);

              return (
                <article className="client-app-installer-card" key={installer.id}>
                  <div className="client-app-status-badge" data-tone={availability.tone}>
                    <span />
                    {availability.label}
                  </div>

                  <div className="client-app-installer-main">
                    <div className="client-app-installer-media">
                      {installer.installer_photo ? (
                        <img alt={`Foto de ${installer.display_name}`} src={installer.installer_photo} />
                      ) : installer.logo ? (
                        <img alt={`Logo de ${installer.display_name}`} src={installer.logo} />
                      ) : (
                        <div className="client-app-avatar-fallback">{getInitials(installer.display_name)}</div>
                      )}
                    </div>

                    <div className="client-app-installer-content">
                      <div className="client-app-installer-head">
                        <div>
                          <h3>
                            {installer.display_name}
                            {isVerified ? (
                              <span className="client-app-verified-mark">
                                <AppIcon name="check-badge" />
                              </span>
                            ) : null}
                          </h3>
                          <p>{getRegionLabel(installer)}</p>
                        </div>

                        <button
                          className={`client-app-favorite-button ${favorites[installer.id] ? 'is-active' : ''}`}
                          onClick={() => toggleFavorite(installer.id)}
                          type="button"
                        >
                          <AppIcon name="heart" />
                        </button>
                      </div>

                      <div className="client-app-rating-line">
                        <AppIcon name="star" />
                        <strong>{Number(installer.average_rating || 0).toFixed(1)}</strong>
                        <span>({installer.review_count || 0} avaliacoes)</span>
                      </div>

                      <div className="client-app-match-row">
                        <span className="client-app-match-pill">{matchScore}% compativel</span>
                        {matchReasons.map((reason) => (
                          <span key={`${installer.id}-${reason}`}>{reason}</span>
                        ))}
                      </div>

                      <div className="client-app-tag-row">
                        {tags.map((tag) => (
                          <span className="client-app-tag" key={`${installer.id}-${tag}`}>
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="client-app-detail-line">
                        <AppIcon name="shield" />
                        <span>{isVerified ? 'Profissional verificado' : 'Contato direto disponivel'}</span>
                        <span className="client-app-dot">•</span>
                        <span>
                          {(installer.availability_slots || []).length > 0 || (installer.available_dates || []).length > 0
                            ? 'Horarios disponiveis'
                            : 'Agenda a confirmar'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="client-app-installer-footer">
                    <Link className="client-app-primary-link" onClick={persistCurrentRequest} to={`/installers/${installer.id}`}>
                      Ver perfil
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}

        {SHOW_PUBLIC_INSTALLER_DIRECTORY && hasGuidedRequest && !loading && filteredInstallers.length > 0 ? (
          <PaginationControls
            currentPage={normalizedInstallersPage}
            onPageChange={setInstallersPage}
            totalPages={totalInstallersPages}
          />
        ) : null}

        <section className="client-app-trust-strip fade-up">
          <article>
            <AppIcon name="shield" />
            <div>
              <strong>Profissionais verificados</strong>
              <span>Todos passam por analise</span>
            </div>
          </article>
          <article>
            <AppIcon name="star" />
            <div>
              <strong>Avaliacoes reais</strong>
              <span>Baseadas em clientes</span>
            </div>
          </article>
          <article>
            <AppIcon name="shield" />
            <div>
              <strong>Contato direto</strong>
              <span>Fale com quem vai atender</span>
            </div>
          </article>
        </section>
      </div>

      {hasGuidedRequest || user ? (
        <nav className="client-app-mobile-dock">
          <a href="#top">
            <AppIcon name="home" />
            <span>Inicio</span>
          </a>
          <a href="#busca">
            <AppIcon name="search" />
            <span>Buscar</span>
          </a>
          <a href="#favoritos">
            <AppIcon name="heart" />
            <span>Favoritos</span>
          </a>
          <a href="https://api.whatsapp.com/send?phone=5548999816000" rel="noreferrer" target="_blank">
            <AppIcon name="message" />
            <span>Mensagens</span>
          </a>
          {user ? (
            <>
              <Link to={accountHomePath}>
                <AppIcon name="profile" />
                <span>Perfil</span>
              </Link>
              <button onClick={handleLogout} type="button">
                <AppIcon name="logout" />
                <span>Sair</span>
              </button>
            </>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
