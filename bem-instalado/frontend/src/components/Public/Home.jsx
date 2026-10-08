import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import {
  buildClientRequestTrackingHash,
  clearPublishedClientRequest,
  readClientRequestTrackingHash,
  readPublishedClientRequest,
  writePublishedClientRequest,
  writeStoredClientRequest,
} from '../../utils/clientRequest';
import { safeSessionStorage } from '../../utils/safeStorage';
import BrandWordmark from '../Layout/BrandWordmark';
import PaginationControls from '../Layout/PaginationControls';
import Turnstile, { isTurnstileEnabled } from '../Security/Turnstile';
import './Home.css';
import './RequestComposer.css';
import PageMetadata from './PageMetadata';
import { RequestDetails, RequestReview } from './RequestStages';
import RequestLocationMap from './RequestLocationMap';

const AUTO_LOCATION_SESSION_KEY = 'papelperto_client_location_checked';
const INSTALLERS_PER_PAGE = 6;
const MAX_REQUEST_PHOTOS = 4;
const MAX_REQUEST_PHOTO_SIZE = 4 * 1024 * 1024;
const SHOW_PUBLIC_INSTALLER_DIRECTORY = false;
const INITIAL_FILTERS = { search: '', city: '', state: '' };

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
  { value: 'available', label: 'Disponíveis' },
  { value: 'featured', label: 'Destaques' },
];

const PLACE_TYPE_OPTIONS = [
  {
    value: 'residential',
    title: 'Casa ou apartamento',
    description: 'Residência e áreas internas',
    icon: 'home',
  },
  {
    value: 'commercial',
    title: 'Empresa ou loja',
    description: 'Espaços comerciais',
    icon: 'building',
  },
  {
    value: 'other',
    title: 'Outro local',
    description: 'Outros ambientes',
    icon: 'map-pin',
  },
];

const PAPER_TYPE_OPTIONS = [
  {
    value: 'vinyl',
    title: 'Papel vinílico',
    description: 'Lavável e resistente',
    icon: 'roller',
  },
  {
    value: 'textured',
    title: 'Texturizado',
    description: 'Relevo e acabamento',
    icon: 'texture',
  },
  {
    value: 'adhesive',
    title: 'Adesivo',
    description: 'Autocolante decorativo',
    icon: 'sticker',
  },
  {
    value: 'all',
    title: 'Ainda não sei',
    description: 'Quero orientação',
    icon: 'question',
  },
];

const ROOM_OPTIONS = ['Sala', 'Quarto', 'Cozinha', 'Banheiro', 'Corredor', 'Comercial', 'Outro ambiente'];
const MATERIAL_STATUS_OPTIONS = [
  { value: 'bought', label: 'Já comprei o papel' },
  { value: 'need-help', label: 'Preciso de ajuda para comprar' },
  { value: 'not-sure', label: 'Ainda não sei o material' },
];
const MEASUREMENT_OPTIONS = [
  {
    value: 'unknown',
    label: 'Não sei as medidas',
    description: 'O profissional confirma antes do orçamento.',
  },
  {
    value: 'known',
    label: 'Tenho as medidas',
    description: 'Informe tamanho da parede ou quantidade de rolos.',
  },
  {
    value: 'visit',
    label: 'Quero visita técnica',
    description: 'O instalador confirma as medidas no local.',
  },
];
const URGENCY_OPTIONS = [
  { value: 'urgent', label: 'Urgente', description: 'Preciso resolver o quanto antes.' },
  { value: 'week', label: 'Esta semana', description: 'Quero tentar agendar ainda nesta semana.' },
  { value: 'days', label: 'Próximos dias', description: 'Tenho alguma flexibilidade de data.' },
  { value: 'quote', label: 'Ainda estou orçando', description: 'Quero comparar antes de escolher.' },
];
const CONTACT_PREFERENCE_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp', description: 'Mais rápido para combinar fotos e detalhes.' },
  { value: 'phone', label: 'Ligação', description: 'Prefiro conversar por chamada.' },
  { value: 'any', label: 'Qualquer contato', description: 'Pode ser WhatsApp ou ligação.' },
];
const REQUEST_STEPS = [
  { value: 'service', label: 'Serviço' },
  { value: 'details', label: 'Detalhes' },
  { value: 'location', label: 'Localização' },
  { value: 'review', label: 'Confirmar' },
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
const GUIDED_LOCATION_TARGET_ACCURACY = 50;
const GUIDED_LOCATION_TIMEOUT = 10000;

function getPreciseBrowserPosition() {
  return new Promise((resolve, reject) => {
    let bestPosition = null;
    let watchId = null;
    let timeoutId = null;
    let settled = false;

    const finish = (callback, value) => {
      if (settled) {
        return;
      }

      settled = true;
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      callback(value);
    };

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const accuracy = Number(position.coords.accuracy);
        const bestAccuracy = Number(bestPosition?.coords?.accuracy);

        if (
          !bestPosition ||
          (Number.isFinite(accuracy) && (!Number.isFinite(bestAccuracy) || accuracy < bestAccuracy))
        ) {
          bestPosition = position;
        }

        if (Number.isFinite(accuracy) && accuracy <= GUIDED_LOCATION_TARGET_ACCURACY) {
          finish(resolve, bestPosition);
        }
      },
      (error) => {
        if (error?.code === 1) {
          finish(reject, error);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: GUIDED_LOCATION_TIMEOUT,
        maximumAge: 0,
      }
    );

    timeoutId = window.setTimeout(() => {
      if (bestPosition) {
        finish(resolve, bestPosition);
        return;
      }

      finish(reject, new Error('LOCATION_TIMEOUT'));
    }, GUIDED_LOCATION_TIMEOUT);
  });
}

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
          <path d="M3 6c3-5 4 5 7 0s4 5 7 0 4 0 4 0M3 12c3-5 4 5 7 0s4 5 7 0 4 0 4 0M3 18c3-5 4 5 7 0s4 5 7 0 4 0 4 0" />
        </svg>
      );
    case 'roller':
      return (
        <svg {...commonProps}>
          <path d="m4 13 9-9a5 5 0 0 1 7 7l-9 9" />
          <ellipse cx="7" cy="17" rx="5" ry="4.5" transform="rotate(45 7 17)" />
          <circle cx="7" cy="17" r="1.4" />
        </svg>
      );
    case 'sticker':
      return (
        <svg {...commonProps}>
          <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H18a1 1 0 0 1 1 1v10.5A6.5 6.5 0 0 1 12.5 21h-5A2.5 2.5 0 0 1 5 18.5v-13Z" />
          <path d="M12 21v-4.5A2.5 2.5 0 0 1 14.5 14H19" />
        </svg>
      );
    case 'question':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.8-2.5 2-2.5 4M12 17h.01" />
        </svg>
      );
    case 'arrow-right':
      return <svg {...commonProps}><path d="M4 12h16m-6-6 6 6-6 6" /></svg>;
    case 'chevron-down':
      return <svg {...commonProps}><path d="m6 9 6 6 6-6" /></svg>;
    case 'check':
      return <svg {...commonProps}><path d="m5 12 4 4L19 6" /></svg>;
    case 'plus':
      return <svg {...commonProps}><circle cx="12" cy="12" r="9" /><path d="M7 12h10M12 7v10" /></svg>;
    case 'sofa':
      return <svg {...commonProps}><path d="M6 12V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5M6 12a2 2 0 0 0-4 0v6h20v-6a2 2 0 0 0-4 0v3H6v-3ZM5 18v3m14-3v3" /></svg>;
    case 'bed':
      return <svg {...commonProps}><path d="M3 18V6h18v12M3 14h18M3 18v3m18-3v3M7 10h3v4H7Zm7 0h3v4h-3Z" /></svg>;
    case 'utensils':
      return <svg {...commonProps}><path d="M4 3v5a3 3 0 0 0 6 0V3M7 3v18M19 3c-3 3-4 6-4 10h4M19 3v18" /></svg>;
    case 'shower':
      return <svg {...commonProps}><path d="M8 9V7a4 4 0 0 1 8 0v2M6 11h12M8 15v1m4-1v1m4-1v1M6 19v1m6-1v1m6-1v1" /></svg>;
    case 'door':
      return <svg {...commonProps}><path d="M5 21V3h14v18M2 21h20M15 12h.01" /></svg>;
    case 'store':
      return <svg {...commonProps}><path d="M4 10v11h16V10M3 10l2-7h14l2 7M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 3v7m6-7v7M9 21v-6h6v6" /></svg>;
    case 'dots':
      return <svg {...commonProps}><circle cx="4" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="20" cy="12" r="1" /></svg>;
    case 'cart':
      return <svg {...commonProps}><path d="M2 3h3l3 13h11l3-10H6M10 21h.01M18 21h.01" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></svg>;
    case 'ruler':
      return <svg {...commonProps}><path d="m3 16 13-13 5 5L8 21 3 16ZM13 6l2 2m-5 1 2 2m-5 1 2 2m-5 1 2 2" /></svg>;
    case 'pencil-ruler':
      return <svg {...commonProps}><path d="m4 3 17 17-4 1L3 7l1-4Zm12 0 5 5-7 7-5-5 7-7ZM8 14l-5 7 7-5M15 6l2 2M11 10l2 2" /></svg>;
    case 'worker':
      return <svg {...commonProps}><path d="M6 8a6 6 0 0 1 12 0M4 8h16M7 8v3a5 5 0 0 0 10 0V8M3 21v-2a5 5 0 0 1 5-5l4 4 4-4a5 5 0 0 1 5 5v2H3Zm5-3v3m8-3v3" /></svg>;
    case 'bolt':
      return <svg {...commonProps}><path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z" /></svg>;
    case 'calendar':
      return <svg {...commonProps}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M7 2v6m10-6v6" /></svg>;
    case 'clock':
      return <svg {...commonProps}><circle cx="12" cy="12" r="9" /><path d="M12 6v6h5" /></svg>;
    case 'phone':
      return <svg {...commonProps}><path d="m8 3 3 5-3 2c2 3 3 4 6 6l2-3 5 3c1 1-1 5-3 5C11 21 3 13 3 6c0-2 4-4 5-3Z" /></svg>;
    case 'whatsapp':
      return <svg {...commonProps}><path d="M5 19 2 22l1-6a9 9 0 1 1 2 3Z" /><path d="m9 7 1 3-1 1 4 4 1-1 3 1c0 3-3 3-6 1s-5-6-3-8l1-1Z" /></svg>;
    case 'mail':
      return <svg {...commonProps}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></svg>;
    case 'box':
      return <svg {...commonProps}><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 20V12M3 7l9 5 9-5" /></svg>;
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
    materialLabel: optionLabel(MATERIAL_STATUS_OPTIONS, request.materialStatus, 'Material não informado'),
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
    return 'Visita técnica solicitada';
  }

  if (measurementStatus === 'known') {
    return [wallSize, rollCount].filter(Boolean).join(' / ') || 'Medidas informadas depois';
  }

  return 'Medidas a confirmar pelo profissional';
}

function getClientRequestStatusLabel(status) {
  return {
    open: 'Recebendo interessados',
    selected: 'Contato liberado',
    closed: 'Serviço concluído',
    canceled: 'Pedido cancelado',
    expired: 'Pedido expirado',
  }[status] || 'Em acompanhamento';
}

function formatClientRequestDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR');
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
    reasons.push('Serviço compatível');
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
    reasons.push('Agenda disponível');
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
    return { label: 'Disponível', tone: 'available' };
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

function getRegionLabel(installer) {
  return [installer.city, installer.state].filter(Boolean).join(', ') || installer.service_region || 'Região não informada';
}

function getServiceRequestOption(value) {
  return PAPER_TYPE_OPTIONS.find((item) => item.value === value) || null;
}

function getPlaceTypeOption(value) {
  return PLACE_TYPE_OPTIONS.find((item) => item.value === value) || null;
}

export default function Home() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const { notifications, refreshNotifications } = useNotifications();
  const isTrackingRoute = location.pathname === '/cliente/pedido';
  const isAccountRequestsRoute = location.pathname === '/cliente/pedidos';
  const accountHomePath = user?.account_type === 'client' ? '/cliente/pedidos' : '/dashboard';
  const accountLinkLabel = user?.account_type === 'client' ? 'Minha conta' : 'Meu painel';
  const autoLocationRequestedRef = useRef(false);
  const localRequestRestoreRef = useRef(false);
  const accountRequestRestoreRef = useRef(false);
  const previousInterestCountRef = useRef(null);
  const claimedRequestRef = useRef(null);
  const guidedAddressInputRef = useRef(null);
  const previousRequestStepRef = useRef(0);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [directory, setDirectory] = useState({ installers: [], ranking: [], reviews: [], marketplace: null });
  const [loading, setLoading] = useState(true);
  const [, setLocationState] = useState({
    status: 'idle',
    message: 'Ative sua localização para encontrar profissionais mais próximos.',
  });
  const [installersPage, setInstallersPage] = useState(1);
  const [category, setCategory] = useState('all');
  const [quickFilter, setQuickFilter] = useState('all');
  const [sortBy, setSortBy] = useState('rating');
  const [favorites, setFavorites] = useState({});
  const [requestStep, setRequestStep] = useState(0);
  const [serviceRequest, setServiceRequest] = useState(INITIAL_SERVICE_REQUEST);
  const [locationQuery, setLocationQuery] = useState('');
  const [confirmedLocationQuery, setConfirmedLocationQuery] = useState('');
  const [locationOptions, setLocationOptions] = useState([]);
  const [locationSuggestionsOpen, setLocationSuggestionsOpen] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [locationLoadError, setLocationLoadError] = useState('');
  const [guidedLocating, setGuidedLocating] = useState(false);
  const [guidedLocationResolving, setGuidedLocationResolving] = useState(false);
  const [guidedLocationTarget, setGuidedLocationTarget] = useState(null);
  const [guidedLocationAccuracy, setGuidedLocationAccuracy] = useState(null);
  const [requestContact, setRequestContact] = useState(INITIAL_REQUEST_CONTACT);
  const [publishingRequest, setPublishingRequest] = useState(false);
  const [publishedRequest, setPublishedRequest] = useState(null);
  const [showPublishForm, setShowPublishForm] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [requestInterests, setRequestInterests] = useState([]);
  const [loadingInterests, setLoadingInterests] = useState(false);
  const [selectingInterestId, setSelectingInterestId] = useState(null);
  const [serviceProposal, setServiceProposal] = useState(null);
  const [loadingProposal, setLoadingProposal] = useState(false);
  const [respondingProposal, setRespondingProposal] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );
  const [hasGuidedRequest, setHasGuidedRequest] = useState(false);
  const [trackingLookup, setTrackingLookup] = useState({ id: '', token: '' });
  const [trackingLookupLoading, setTrackingLookupLoading] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [accountRequests, setAccountRequests] = useState([]);
  const [loadingAccountRequests, setLoadingAccountRequests] = useState(false);
  const [updatingRequestStatus, setUpdatingRequestStatus] = useState(null);
  const selectedServiceRequest = useMemo(
    () => getServiceRequestOption(serviceRequest.service),
    [serviceRequest.service]
  );
  const requestSnapshot = useMemo(
    () => buildClientRequestSnapshot(serviceRequest),
    [serviceRequest]
  );
  const selectedRooms = useMemo(
    () => getRequestRooms(serviceRequest),
    [serviceRequest]
  );
  const selectedInterest = useMemo(
    () => requestInterests.find((interest) => interest.selected) || null,
    [requestInterests]
  );
  const unreadNotifications = notifications.filter((notification) => !notification.read);

  useEffect(() => {
    if (previousRequestStepRef.current === requestStep) return;
    previousRequestStepRef.current = requestStep;
    if (hasGuidedRequest || isTrackingRoute || isAccountRequestsRoute) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('busca')?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [requestStep, hasGuidedRequest, isTrackingRoute, isAccountRequestsRoute]);

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
      const payload = response.data && typeof response.data === 'object' ? response.data : {};
      setDirectory({
        installers: Array.isArray(payload.installers) ? payload.installers : [],
        ranking: Array.isArray(payload.ranking) ? payload.ranking : [],
        reviews: Array.isArray(payload.reviews) ? payload.reviews : [],
        marketplace: payload.marketplace || null,
      });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível carregar os instaladores.');
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
        message: 'Seu navegador não oferece localização automática. Você pode buscar manualmente.',
      });
      return;
    }

    setLocationState({
      status: 'locating',
      message: 'Buscando sua região para filtrar os instaladores.',
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
              ? `Mostrando profissionais próximos de ${region.label}.`
              : 'Mostrando profissionais da sua região.',
          });

          if (!silent) {
            toast.success(region.label ? `Região encontrada: ${region.label}.` : 'Região encontrada.');
          }

          await loadDirectory(nextFilters);
        } catch (error) {
          setLocationState({
            status: 'error',
            message: error.response?.data?.error || 'Não foi possível localizar sua região agora.',
          });

          if (!silent) {
            toast.error(error.response?.data?.error || 'Não foi possível localizar sua região agora.');
          }
        }
      },
      (error) => {
        const permissionDenied = error.code === 1;
        setLocationState({
          status: permissionDenied ? 'denied' : 'error',
          message: permissionDenied
            ? 'Permita a localização para mostrar primeiro os profissionais da sua região.'
            : 'Não foi possível usar sua localização no momento.',
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
    const query = locationQuery.trim();

    if (
      requestStep !== 2 ||
      query.length < 3 ||
      query === confirmedLocationQuery ||
      guidedLocating ||
      guidedLocationResolving
    ) {
      setLocationSuggestionsOpen(false);
      setLoadingLocations(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingLocations(true);
      setLocationLoadError('');
      setLocationSuggestionsOpen(true);

      try {
        const response = await api.get('/public/location/search', {
          params: { q: query, suggest: 1 },
        });

        if (!cancelled) {
          const suggestions = response.data?.suggestions || [];
          setLocationOptions(suggestions);
          setLocationSuggestionsOpen(suggestions.length > 0);
        }
      } catch (error) {
        if (!cancelled) {
          setLocationOptions([]);
          setLocationSuggestionsOpen(false);
          setLocationLoadError(
            error.response?.data?.error || 'Não foi possível buscar endereços agora.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingLocations(false);
        }
      }
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    confirmedLocationQuery,
    guidedLocating,
    guidedLocationResolving,
    locationQuery,
    requestStep,
  ]);

  const updateServiceRequest = (field, value) => {
    setServiceRequest((current) => ({ ...current, [field]: value }));
  };

  const updateRequestContact = (field, value) => {
    setRequestContact((current) => ({ ...current, [field]: value }));
  };

  const selectLocationOption = (location, { gpsRegionOnly = false, accuracy = null } = {}) => {
    const state = String(location.state || '').toUpperCase();
    const displayName = gpsRegionOnly
      ? [location.city, state].filter(Boolean).join(' - ')
      : location.displayName ||
        [location.addressReference, location.neighborhood, location.city, state]
          .filter(Boolean)
          .join(', ');

    setServiceRequest((current) => ({
      ...current,
      city: location.city || current.city,
      state: state || current.state,
      neighborhood: gpsRegionOnly ? '' : location.neighborhood || '',
      zipCode: gpsRegionOnly ? '' : location.zipCode || '',
      addressReference: gpsRegionOnly ? '' : location.addressReference || displayName,
    }));
    setLocationQuery(displayName);
    setConfirmedLocationQuery(displayName);
    setGuidedLocationAccuracy(gpsRegionOnly && Number.isFinite(Number(accuracy)) ? Number(accuracy) : null);
    setGuidedLocationTarget({
      latitude: location.latitude == null ? null : Number(location.latitude),
      longitude: location.longitude == null ? null : Number(location.longitude),
      label: location.label || displayName,
      city: location.city || '',
      state,
      neighborhood: gpsRegionOnly ? '' : location.neighborhood || '',
    });
    setLocationOptions([]);
    setLocationSuggestionsOpen(false);
    setLocationLoadError('');
  };

  const loadRequestInterests = useCallback(async (request = publishedRequest) => {
    if (!request?.id || !request?.client_access_token) {
      setRequestInterests([]);
      return;
    }

    setLoadingInterests(true);

    try {
      const response = await api.get(`/public/service-requests/${request.id}/interests`, {
        headers: { 'X-Client-Request-Token': request.client_access_token },
      });
      const nextInterests = response.data?.interests || [];
      const previousCount = previousInterestCountRef.current;

      setRequestInterests(nextInterests);

      if (previousCount !== null && nextInterests.length > previousCount) {
        const addedCount = nextInterests.length - previousCount;
        const notificationMessage = `${addedCount} novo${addedCount === 1 ? '' : 's'} instalador${addedCount === 1 ? '' : 'es'} interessado${addedCount === 1 ? '' : 's'} no seu pedido.`;
        toast.success(notificationMessage);

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
          new Notification('Novo interesse no seu pedido', { body: notificationMessage });
        }
      }

      previousInterestCountRef.current = nextInterests.length;
      if (response.data?.request) {
        setPublishedRequest((current) => {
          const nextRequest = current ? { ...current, ...response.data.request } : current;
          if (nextRequest) writePublishedClientRequest(nextRequest);
          return nextRequest;
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível carregar instaladores interessados.');
    } finally {
      setLoadingInterests(false);
    }
  }, [publishedRequest]);

  const loadServiceProposal = useCallback(async (request = publishedRequest) => {
    if (!request?.id || !request?.client_access_token) {
      setServiceProposal(null);
      return;
    }
    setLoadingProposal(true);
    try {
      const response = await api.get(`/public/service-requests/${request.id}/proposal`, {
        headers: { 'X-Client-Request-Token': request.client_access_token },
      });
      setServiceProposal(response.data?.proposal || null);
      if (response.data?.request_status && response.data.request_status !== request.status) {
        const nextRequest = { ...request, status: response.data.request_status };
        setPublishedRequest(nextRequest);
        writePublishedClientRequest(nextRequest);
      }
    } catch (_error) {
      setServiceProposal(null);
    } finally {
      setLoadingProposal(false);
    }
  }, [publishedRequest]);

  const restorePublishedRequest = useCallback(async (request) => {
    if (!request?.id || !request?.client_access_token) {
      return false;
    }

    writePublishedClientRequest(request);
    setPublishedRequest(request);
    setHasGuidedRequest(true);
    setShowPublishForm(false);
    previousInterestCountRef.current = null;

    setServiceRequest((current) => ({
      ...current,
      service: request.service || current.service,
      city: request.city || current.city,
      state: request.state || current.state,
      neighborhood: request.neighborhood || current.neighborhood,
      zipCode: request.zip_code || current.zipCode,
    }));

    await loadRequestInterests(request);
    await loadServiceProposal(request);
    return true;
  }, [loadRequestInterests, loadServiceProposal]);

  const handleTrackingLookup = async (event) => {
    event.preventDefault();
    const id = Number(trackingLookup.id);
    const token = trackingLookup.token.trim();

    if (!Number.isInteger(id) || id <= 0 || token.length < 32) {
      toast.error('Confira o número do pedido e o código de acesso.');
      return;
    }

    setTrackingLookupLoading(true);
    try {
      const response = await api.get(`/public/service-requests/${id}/interests`, {
        headers: { 'X-Client-Request-Token': token },
      });
      await restorePublishedRequest({ ...response.data?.request, id, client_access_token: token });
      toast.success('Pedido encontrado.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Pedido ou código de acesso inválido.');
    } finally {
      setTrackingLookupLoading(false);
    }
  };

  useEffect(() => {
    if (localRequestRestoreRef.current || typeof window === 'undefined') {
      return;
    }

    localRequestRestoreRef.current = true;
    const requestFromHash = readClientRequestTrackingHash(window.location.hash);
    const storedRequest = requestFromHash || readPublishedClientRequest();

    if (requestFromHash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }

    if (storedRequest) {
      restorePublishedRequest(storedRequest).catch(() => null);
    }
  }, [restorePublishedRequest]);

  useEffect(() => {
    if (accountRequestRestoreRef.current || user?.account_type !== 'client') {
      return;
    }

    accountRequestRestoreRef.current = true;

    setLoadingAccountRequests(true);
    api.get('/public/service-requests/mine', { params: { limit: 30 } })
      .then((response) => {
        const requests = response.data?.requests || [];
        setAccountRequests(requests);
        const latestRequest = requests[0];
        if (!readPublishedClientRequest() && latestRequest) return restorePublishedRequest(latestRequest);
        return null;
      })
      .catch(() => setAccountRequests([]))
      .finally(() => setLoadingAccountRequests(false));
  }, [restorePublishedRequest, user?.account_type]);

  useEffect(() => {
    if (
      user?.account_type !== 'client' ||
      !publishedRequest?.id ||
      !publishedRequest?.client_access_token ||
      claimedRequestRef.current === publishedRequest.id
    ) {
      return;
    }

    claimedRequestRef.current = publishedRequest.id;
    api.post(
      `/public/service-requests/${publishedRequest.id}/claim`,
      {},
      { headers: { 'X-Client-Request-Token': publishedRequest.client_access_token } }
    )
      .then((response) => {
        const claimedRequest = response.data?.service_request || response.data?.request;
        if (claimedRequest) {
          const nextRequest = {
            ...publishedRequest,
            ...claimedRequest,
            client_access_token: publishedRequest.client_access_token,
          };
          writePublishedClientRequest(nextRequest);
          setPublishedRequest(nextRequest);
        }
      })
      .catch(() => {
        claimedRequestRef.current = null;
      });
  }, [publishedRequest, user?.account_type]);

  const openNotifications = async () => {
    setShowNotifications((current) => !current);
  };

  const markAllNotificationsRead = async () => {
    if (unreadNotifications.length === 0) return;

    try {
      await api.put('/notifications/read-all');
      await refreshNotifications();
    } catch (_error) {
      toast.error('Não foi possível atualizar os avisos.');
    }
  };

  const handleEnableRequestNotifications = async () => {
    if (typeof Notification === 'undefined') {
      toast('Avisos do navegador não estão disponíveis neste aparelho.');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === 'granted') {
      toast.success('Avisos deste pedido ativados.');
    } else {
      toast('Os avisos continuam disponíveis nesta página.');
    }
  };

  const copyRequestTrackingLink = async () => {
    const trackingHash = buildClientRequestTrackingHash(publishedRequest);
    if (!trackingHash || typeof window === 'undefined') return;

    const trackingUrl = `${window.location.origin}/cliente/pedido${trackingHash}`;

    try {
      await navigator.clipboard.writeText(trackingUrl);
      toast.success('Link de acompanhamento copiado.');
    } catch (_error) {
      toast.error('Não foi possível copiar. Salve esta página nos favoritos.');
    }
  };

  const clearTrackedRequest = () => {
    clearPublishedClientRequest();
    setPublishedRequest(null);
    setRequestInterests([]);
    setHasGuidedRequest(false);
    previousInterestCountRef.current = null;
    toast('Pedido removido deste aparelho. Ele continua salvo no sistema.');
  };

  const updateClientRequestStatus = async (request, status) => {
    if (!request?.id || updatingRequestStatus) return false;
    const actionLabel = status === 'closed' ? 'marcar este serviço como concluído' : 'cancelar este pedido';
    const confirmed = await confirm(`Deseja ${actionLabel}?`);
    if (!confirmed) return false;

    setUpdatingRequestStatus(request.id);
    try {
      const response = await api.patch(
        `/public/service-requests/${request.id}/status`,
        { status },
        request.client_access_token
          ? { headers: { 'X-Client-Request-Token': request.client_access_token } }
          : undefined
      );
      const updatedRequest = { ...request, ...response.data?.request };
      setAccountRequests((current) => current.map((item) => (item.id === request.id ? updatedRequest : item)));
      if (publishedRequest?.id === request.id) {
        setPublishedRequest(updatedRequest);
        writePublishedClientRequest(updatedRequest);
      }
      toast.success(status === 'closed' ? 'Serviço concluído. Agora você pode avaliar o instalador.' : 'Pedido cancelado.');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar o pedido.');
      return false;
    } finally {
      setUpdatingRequestStatus(null);
    }
  };

  const startAnotherRequest = async () => {
    if (publishedRequest && ['open', 'selected'].includes(publishedRequest.status)) {
      const canceled = await updateClientRequestStatus(publishedRequest, 'canceled');
      if (!canceled) return;
    }
    clearTrackedRequest();
    navigate('/cliente');
  };

  const openAccountRequest = async (request) => {
    await restorePublishedRequest(request);
    navigate('/cliente');
  };

  const selectInterestedInstaller = async (interest) => {
    if (!publishedRequest?.id || !publishedRequest?.client_access_token || !interest?.id) {
      return;
    }

    const confirmed = await confirm(
      `Chamar ${interest.display_name}? Essa escolha é final e libera seu WhatsApp e o endereço completo somente para esse instalador.`
    );
    if (!confirmed) return;

    setSelectingInterestId(interest.id);

    try {
      const response = await api.post(
        `/public/service-requests/${publishedRequest.id}/interests/${interest.id}/select`,
        {},
        { headers: { 'X-Client-Request-Token': publishedRequest.client_access_token } }
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
        setPublishedRequest((current) => {
          const nextRequest = { ...current, ...response.data.request };
          writePublishedClientRequest(nextRequest);
          return nextRequest;
        });
      }

      toast.success('Instalador escolhido. Agora vocês já podem conversar pelo WhatsApp.');
      await loadServiceProposal({ ...publishedRequest, ...response.data?.request });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível escolher o instalador.');
    } finally {
      setSelectingInterestId(null);
    }
  };

  const respondToServiceProposal = async (decision) => {
    if (!publishedRequest?.id || !publishedRequest?.client_access_token || !serviceProposal || respondingProposal) return;
    let message = '';
    if (decision === 'request_changes') {
      message = window.prompt('O que você gostaria de ajustar na proposta?') || '';
      if (!message.trim()) return;
    }
    if (decision === 'reject' && !await confirm('Deseja recusar esta proposta?')) return;
    if (decision === 'accept' && !await confirm('Confirmar esta proposta e reservar o horário?')) return;
    setRespondingProposal(true);
    try {
      const response = await api.post(
        `/public/service-requests/${publishedRequest.id}/proposal/respond`,
        { decision, message },
        { headers: { 'X-Client-Request-Token': publishedRequest.client_access_token } }
      );
      setServiceProposal(response.data?.proposal || serviceProposal);
      const nextRequest = { ...publishedRequest, status: response.data?.request_status || publishedRequest.status };
      setPublishedRequest(nextRequest);
      writePublishedClientRequest(nextRequest);
      toast.success(decision === 'accept' ? 'Proposta aceita. Seu horário está confirmado.' : decision === 'request_changes' ? 'Pedido de ajuste enviado.' : 'Proposta recusada.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível responder à proposta.');
    } finally {
      setRespondingProposal(false);
    }
  };

  useEffect(() => {
    if (
      !publishedRequest?.id ||
      !publishedRequest?.client_access_token ||
      !['open', 'selected', 'proposal_sent', 'scheduled', 'in_progress'].includes(publishedRequest.status)
    ) {
      return undefined;
    }

    const interval = setInterval(() => {
      loadRequestInterests(publishedRequest);
      loadServiceProposal(publishedRequest);
    }, 15000);

    return () => clearInterval(interval);
  }, [loadRequestInterests, loadServiceProposal, publishedRequest]);

  const handlePublishServiceRequest = async () => {
    const phoneDigits = requestContact.phone.replace(/\D/g, '');

    if (!requestContact.name.trim()) {
      toast.error('Informe seu nome para publicar a solicitação.');
      return;
    }

    if (phoneDigits.length < 10) {
      toast.error('Informe um WhatsApp válido para o instalador escolhido falar com você.');
      return;
    }

    if (
      requestContact.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestContact.email.trim())
    ) {
      toast.error('Confira o e-mail informado ou deixe o campo vazio.');
      return;
    }

    if (!serviceRequest.city.trim() && !serviceRequest.state.trim()) {
      setRequestStep(2);
      toast.error('Informe a cidade ou estado do serviço.');
      return;
    }

    if (!privacyConsent) {
      toast.error('Confirme os Termos de Uso e a Política de Privacidade.');
      return;
    }

    if (isTurnstileEnabled() && !turnstileToken) {
      toast.error('Conclua a verificação de segurança antes de publicar o pedido.');
      return;
    }

    setPublishingRequest(true);

    try {
      const uploadedPhotos = [];
      for (const photo of serviceRequest.photos || []) {
        if (!photo.file) continue;
        const uploadPayload = new FormData();
        uploadPayload.append('file', photo.file);
        const uploadResponse = await api.post('/public/service-request-uploads', uploadPayload);
        uploadedPhotos.push(uploadResponse.data);
      }

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
        photo_count: uploadedPhotos.length,
        photo_names: uploadedPhotos.map((photo) => photo.original_name),
        photo_urls: uploadedPhotos.map((photo) => photo.url),
        latitude: guidedLocationTarget?.latitude,
        longitude: guidedLocationTarget?.longitude,
        privacy_consent: true,
        turnstile_token: turnstileToken,
      });

      const nextRequest = response.data?.service_request || null;
      setPublishedRequest(nextRequest);
      setRequestInterests([]);
      if (nextRequest) {
        writePublishedClientRequest(nextRequest);
        previousInterestCountRef.current = 0;
        loadRequestInterests(nextRequest);
      }
      toast.success('Pedido publicado. Avisaremos quando um instalador demonstrar interesse.');
    } catch (error) {
      setTurnstileToken('');
      setTurnstileResetKey((current) => current + 1);
      toast.error(error.response?.data?.error || 'Não foi possível publicar a solicitação.');
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
      toast.error(`Adicione no máximo ${MAX_REQUEST_PHOTOS} fotos.`);
      return;
    }

    const selectedFiles = files
      .filter((file) => {
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} não parece ser uma imagem.`);
          return false;
        }

        if (file.size > MAX_REQUEST_PHOTO_SIZE) {
          toast.error(`${file.name} passa de 4 MB.`);
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
                file,
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
    if (requestStep === 0 && !serviceRequest.placeType) {
      toast.error('Escolha onde o serviço será feito para continuar.');
      return false;
    }

    if (requestStep === 0 && !serviceRequest.service) {
      toast.error('Escolha o tipo do papel para continuar.');
      return false;
    }

    if (requestStep === 1 && selectedRooms.length === 0) {
      toast.error('Escolha pelo menos um ambiente para continuar.');
      return false;
    }

    if (requestStep === 1 && !serviceRequest.materialStatus) {
      toast.error('Informe a situação do material para continuar.');
      return false;
    }

    if (requestStep === 1 && !serviceRequest.measurementStatus) {
      toast.error('Escolha se já sabe as medidas ou se prefere visita técnica.');
      return false;
    }

    if (requestStep === 2 && !serviceRequest.city.trim() && !serviceRequest.state.trim()) {
      toast.error('Informe sua cidade ou estado para encontrar profissionais próximos.');
      return false;
    }

    return true;
  };

  const handleRequestNext = () => {
    if (!canAdvanceRequest()) {
      return;
    }

    setRequestStep((current) => Math.min(current + 1, LAST_REQUEST_STEP));
  };

  const handleRequestBack = () => {
    if (requestStep === 0) {
      navigate('/');
      return;
    }
    setRequestStep((current) => Math.max(current - 1, 0));
  };

  const updateGuidedLocationQuery = (value) => {
    setLocationQuery(value);
    setConfirmedLocationQuery('');
    setLocationOptions([]);
    setLocationSuggestionsOpen(false);
    setLocationLoadError('');
    setGuidedLocationTarget(null);
    setGuidedLocationAccuracy(null);
    setServiceRequest((current) => ({
      ...current,
      city: '',
      state: '',
      neighborhood: '',
      zipCode: '',
      addressReference: '',
    }));
  };

  const requestGuidedLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      toast.error('Seu navegador não oferece localização automática.');
      return;
    }

    setGuidedLocating(true);
    setLocationLoadError('');
    setLocationOptions([]);
    setLocationSuggestionsOpen(false);
    setGuidedLocationAccuracy(null);

    getPreciseBrowserPosition()
      .then(async (position) => {
        try {
          const region = await reverseLocation(position.coords.latitude, position.coords.longitude);
          selectLocationOption(region, {
            gpsRegionOnly: true,
            accuracy: position.coords.accuracy,
          });
          toast.success(
            region.city
              ? `Região encontrada: ${region.city}. Confira a rua antes de continuar.`
              : 'Região encontrada. Confira a rua antes de continuar.'
          );
        } catch (error) {
          const message =
            error.response?.data?.error || 'Não foi possível localizar sua região agora.';
          setLocationLoadError(message);
          toast.error(message);
        } finally {
          setGuidedLocating(false);
        }
      })
      .catch((error) => {
        const message =
          error?.code === 1
            ? 'Permita a localização ou digite seu endereço para continuar.'
            : 'Não foi possível obter uma localização precisa. Digite seu endereço.';
        setGuidedLocating(false);
        setLocationLoadError(message);
        toast.error(message);
      });
  };

  const handleGuidedLocationContinue = async () => {
    if (guidedLocating || guidedLocationResolving) return;
    if (
      confirmedLocationQuery &&
      (serviceRequest.city.trim() || serviceRequest.state.trim())
    ) {
      setRequestStep((current) => Math.min(current + 1, LAST_REQUEST_STEP));
      return;
    }

    const query = locationQuery.trim();
    if (query.length < 3) {
      toast.error('Digite sua rua, bairro ou cidade para continuar.');
      return;
    }

    setGuidedLocationResolving(true);
    setLocationLoadError('');

    try {
      const response = await api.get('/public/location/search', {
        params: { q: query },
      });
      selectLocationOption(response.data);
      setRequestStep((current) => Math.min(current + 1, LAST_REQUEST_STEP));
    } catch (error) {
      const message =
        error.response?.data?.error ||
        'Não encontramos esse endereço. Tente incluir a cidade e o estado.';
      setLocationLoadError(message);
      toast.error(message);
    } finally {
      setGuidedLocationResolving(false);
    }
  };

  const handleGuidedSearch = async (event) => {
    event.preventDefault();

    if (!serviceRequest.placeType) {
      setRequestStep(0);
      toast.error('Escolha onde o serviço será feito primeiro.');
      return;
    }

    if (!serviceRequest.service) {
      setRequestStep(0);
      toast.error('Escolha o tipo do papel primeiro.');
      return;
    }

    if (selectedRooms.length === 0 || !serviceRequest.materialStatus || !serviceRequest.measurementStatus) {
      setRequestStep(1);
      toast.error('Complete os detalhes do serviço antes de continuar.');
      return;
    }

    if (!serviceRequest.city.trim() && !serviceRequest.state.trim()) {
      setRequestStep(2);
      toast.error('Informe a região do serviço para enviar aos instaladores próximos.');
      return;
    }

    const nextFilters = {
      search: '',
      city: serviceRequest.city.trim(),
      state: serviceRequest.state.trim().toUpperCase(),
    };

    setFilters(nextFilters);
    setCategory(serviceRequest.service || 'all');
    setQuickFilter('all');
    setSortBy('match');
    setInstallersPage(1);
    setHasGuidedRequest(true);
    setShowPublishForm(true);
    setPublishedRequest(null);
    setRequestInterests([]);
    writeStoredClientRequest(requestSnapshot);

    if (typeof document !== 'undefined') {
      window.requestAnimationFrame(() => {
        document.getElementById('publicar-pedido')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const editGuidedRequest = (step = 1) => {
    setHasGuidedRequest(false);
    setShowPublishForm(false);
    setRequestStep(step);

    if (typeof document !== 'undefined') {
      window.requestAnimationFrame(() => {
        document.getElementById('busca')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
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
    toast.success('Você saiu da conta.');
    navigate('/cliente', { replace: true });
  };

  const isRequestComposer = !hasGuidedRequest && !isTrackingRoute && !isAccountRequestsRoute;

  return (
    <div className={`client-app-page${isRequestComposer ? ' client-request-redesign' : ''}`} id="top">
      <PageMetadata
        canonicalPath="/cliente"
        description="Publique seu pedido de instalação de papel de parede e acompanhe propostas e agendamentos com profissionais verificados."
        noIndex
        title="PapelPerto | Pedido de instalação de papel de parede"
      />
      <div className="client-app-shell">
        <header className="client-app-topbar fade-up">
          <div className="client-app-brand">
            {isRequestComposer ? (
              <Link aria-label="InstalaPro — página inicial" className="request-brand-wordmark" to="/">
                Instala<span>Pro</span>
              </Link>
            ) : <BrandWordmark className="client-app-brand-wordmark" size="sm" />}
          </div>

          <div className="client-app-top-actions">
            {user ? (
              <>
                <div className="client-app-notification-wrap">
                  <button
                    aria-expanded={showNotifications}
                    aria-label="Avisos da conta"
                    className="client-app-notification-button"
                    onClick={openNotifications}
                    type="button"
                  >
                    <AppIcon name="bell" />
                    {unreadNotifications.length > 0 ? <span>{unreadNotifications.length}</span> : null}
                  </button>
                  {showNotifications ? (
                    <div className="client-app-notification-menu">
                      <div className="client-app-notification-menu-head">
                        <strong>Avisos</strong>
                        {unreadNotifications.length > 0 ? (
                          <button onClick={markAllNotificationsRead} type="button">Marcar como lidos</button>
                        ) : null}
                      </div>
                      {notifications.length === 0 ? (
                        <p>Nenhum aviso novo.</p>
                      ) : (
                        notifications.map((notification) => (
                          <article key={notification.id}>
                            <strong>{notification.title}</strong>
                            <span>{notification.message}</span>
                          </article>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
                <Link className="client-app-chip-link" to={accountHomePath}>
                  {accountLinkLabel}
                  {isRequestComposer ? <AppIcon name="chevron-down" /> : null}
                </Link>
                <button className="client-app-chip-link client-app-logout-button" onClick={handleLogout} type="button">
                  Sair
                </button>
              </>
            ) : null}
          </div>
        </header>

        {isAccountRequestsRoute ? (
          <main className="client-app-account-requests fade-up">
            <div className="client-app-account-requests-head">
              <div>
                <p className="client-app-kicker">Minha conta</p>
                <h1>Meus pedidos</h1>
                <p>Acompanhe, conclua ou cancele suas solicitações sem perder o histórico.</p>
              </div>
              <Link className="gold-button" to="/cliente">Criar novo pedido</Link>
            </div>

            {loadingAccountRequests ? <div className="client-app-interest-empty">Carregando seus pedidos...</div> : null}
            {!loadingAccountRequests && accountRequests.length === 0 ? (
              <div className="client-app-interest-empty">
                <strong>Você ainda não publicou pedidos</strong>
                <span>Crie uma solicitação e ela ficará salva nesta página.</span>
              </div>
            ) : null}
            <div className="client-app-account-request-list">
              {accountRequests.map((request) => (
                <article key={request.id}>
                  <div>
                    <span className="status-pill" data-tone={request.status === 'closed' ? 'success' : request.status === 'canceled' || request.status === 'expired' ? 'canceled' : 'scheduled'}>
                      {getClientRequestStatusLabel(request.status)}
                    </span>
                    <strong>Pedido #{request.id} · {request.service_label || request.service}</strong>
                    <p>{[request.neighborhood, request.city, request.state].filter(Boolean).join(', ')}</p>
                    <small>
                      {formatClientRequestDate(request.created_at)} · {request.interests_count || 0}{' '}
                      {Number(request.interests_count || 0) === 1 ? 'interessado' : 'interessados'}
                    </small>
                  </div>
                  <div className="client-app-account-request-actions">
                    <button className="client-app-ghost-button" onClick={() => openAccountRequest(request)} type="button">
                      Ver pedido
                    </button>
                    {request.status === 'open' ? (
                      <button disabled={updatingRequestStatus === request.id} onClick={() => updateClientRequestStatus(request, 'canceled')} type="button">
                        Cancelar
                      </button>
                    ) : null}
                    {request.status === 'selected' ? (
                      <button className="gold-button" disabled={updatingRequestStatus === request.id} onClick={() => updateClientRequestStatus(request, 'closed')} type="button">
                        Marcar concluído
                      </button>
                    ) : null}
                    {request.status === 'closed' && request.selected_installer_id ? (
                      <Link className="gold-button" to={`/installers/${request.selected_installer_id}?pedido=${request.id}#avaliar-instalador`}>
                        Avaliar instalador
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </main>
        ) : null}

        <main hidden={isAccountRequestsRoute}>

        {isTrackingRoute && !hasGuidedRequest ? (
          <section className="client-app-tracking-lookup fade-up">
            <span className="client-app-tracking-lookup-icon" aria-hidden="true">
              <AppIcon name="search" />
            </span>
            <div className="client-app-tracking-lookup-copy">
              <p className="client-app-kicker">Acompanhar pedido</p>
              <h1>Encontre seu pedido</h1>
              <p>Use o número e o código recebidos ao publicar.</p>
            </div>
            <form onSubmit={handleTrackingLookup}>
              <label>
                <span>Número do pedido</span>
                <input
                  inputMode="numeric"
                  onChange={(event) => setTrackingLookup((current) => ({ ...current, id: event.target.value }))}
                  placeholder="Ex.: 123"
                  required
                  value={trackingLookup.id}
                />
              </label>
              <label>
                <span>Código de acesso</span>
                <input
                  autoComplete="off"
                  onChange={(event) => setTrackingLookup((current) => ({ ...current, token: event.target.value }))}
                  placeholder="Cole o código do seu pedido"
                  required
                  value={trackingLookup.token}
                />
              </label>
              <button className="client-app-search-submit" disabled={trackingLookupLoading} type="submit">
                {trackingLookupLoading ? 'Procurando...' : 'Acompanhar pedido'}
              </button>
            </form>
            <div className="client-app-tracking-lookup-footer">
              <span>Não tem um pedido?</span>
              <Link to="/cliente">Criar novo pedido</Link>
              {!user ? <Link to="/cliente/entrar">Entrar na minha conta</Link> : null}
            </div>
          </section>
        ) : null}

        {!hasGuidedRequest && !isTrackingRoute ? (
        <section className="client-app-request-card fade-up" id="busca">
          <div className="client-app-request-head">
            <div>
              <h1>Encontre um instalador</h1>
              <p>Conte o que você precisa e compare os profissionais interessados.</p>
            </div>
            <span className="request-new-badge">Novo pedido</span>
          </div>

          <div className="client-app-request-side">
            <div className="client-app-request-progress" aria-label="Etapas do pedido">
              {REQUEST_STEPS.map((step, index) => (
                <button
                  aria-current={index === requestStep ? 'step' : undefined}
                  className={index === requestStep ? 'is-active' : index < requestStep ? 'is-done' : ''}
                  disabled={index > requestStep}
                  key={step.value}
                  onClick={() => setRequestStep(index)}
                  type="button"
                >
                  <span aria-hidden="true">{index < requestStep ? <AppIcon name="check" /> : index + 1}</span>
                  {step.label}
                </button>
              ))}
            </div>
          </div>

          <form className="client-app-request-form" onSubmit={(event) => {
            if (requestStep === LAST_REQUEST_STEP) {
              handleGuidedSearch(event);
            } else {
              event.preventDefault();
              if (requestStep === 2) handleGuidedLocationContinue();
              else handleRequestNext();
            }
          }}>
            <span className="request-stage-label">Etapa {requestStep + 1} de {REQUEST_STEPS.length}</span>
            {requestStep === 0 ? (
              <div className="client-app-request-panel client-app-request-panel--service">
                <div className="client-app-simple-heading">
                  <div>
                    <h3>Qual serviço você precisa?</h3>
                    <p>Selecione uma opção em cada grupo.</p>
                  </div>
                </div>

                <section className="client-app-choice-section" aria-labelledby="place-type-heading">
                  <div className="client-app-choice-title">
                    <strong id="place-type-heading">Onde será instalado?</strong>
                  </div>
                  <div className="client-app-service-grid client-app-service-grid--place">
                    {PLACE_TYPE_OPTIONS.map((item) => (
                      <button
                        aria-pressed={serviceRequest.placeType === item.value}
                        className={serviceRequest.placeType === item.value ? 'is-selected' : ''}
                        key={item.value}
                        onClick={() => updateServiceRequest('placeType', item.value)}
                        type="button"
                      >
                        <span className="client-app-service-icon">
                          <AppIcon name={item.icon} />
                        </span>
                        <strong>{item.title}</strong>
                        <span>{item.description}</span>
                        {serviceRequest.placeType === item.value ? <span aria-hidden="true" className="request-choice-check">✓</span> : null}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="client-app-choice-section" aria-labelledby="paper-type-heading">
                  <div className="client-app-choice-title">
                    <strong id="paper-type-heading">Qual é o tipo de papel?</strong>
                  </div>
                  <div className="client-app-service-grid client-app-service-grid--paper">
                    {PAPER_TYPE_OPTIONS.map((item) => (
                      <button
                        aria-pressed={serviceRequest.service === item.value}
                        className={serviceRequest.service === item.value ? 'is-selected' : ''}
                        key={item.value}
                        onClick={() => updateServiceRequest('service', item.value)}
                        type="button"
                      >
                        <span className="client-app-service-icon">
                          <AppIcon name={item.icon} />
                        </span>
                        <strong>{item.title}</strong>
                        <span>{item.description}</span>
                        {serviceRequest.service === item.value ? <span aria-hidden="true" className="request-choice-check">✓</span> : null}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}

            {requestStep === 1 ? (
              <RequestDetails request={serviceRequest} rooms={selectedRooms} roomOptions={ROOM_OPTIONS}
                materialOptions={MATERIAL_STATUS_OPTIONS} measurementOptions={MEASUREMENT_OPTIONS}
                onToggleRoom={toggleRequestRoom} onChange={updateServiceRequest}
                onMeasurementChange={updateMeasurementStatus} Icon={AppIcon}>
                <details className="client-app-optional-details">
                  <summary>
                    <AppIcon name="plus" />
                    <span>Adicionar observação ou fotos</span>
                    <small>Opcional</small>
                  </summary>
                  <div className="client-app-optional-details-body">
                    <label className="client-app-request-field client-app-request-field--line client-app-detail-note">
                      <span>Observação rápida</span>
                      <textarea
                        onChange={(event) => updateServiceRequest('details', event.target.value)}
                        placeholder="Ex.: parede lisa, material já comprado"
                        rows="3"
                        value={serviceRequest.details}
                      />
                    </label>

                    <div className="client-app-photo-uploader">
                      <label className="client-app-photo-drop client-app-photo-drop--compact">
                        <input accept="image/*" multiple onChange={handleRequestPhotos} type="file" />
                        <strong>Adicionar fotos</strong>
                        <span>{serviceRequest.photos.length}/{MAX_REQUEST_PHOTOS} adicionadas</span>
                      </label>
                      {serviceRequest.photos.length > 0 ? (
                        <div className="client-app-photo-grid">
                          {serviceRequest.photos.map((photo) => (
                            <figure key={photo.id}>
                              <img alt={`Referência ${photo.name}`} src={photo.preview} />
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
                  </div>
                </details>
              </RequestDetails>
            ) : null}

            {requestStep === 2 ? (
              <div className="client-app-request-panel client-app-request-panel--location">
                <div className="client-app-simple-heading">
                  <div>
                    <h3>Onde será o serviço?</h3>
                    <p>Informe o endereço da instalação.</p>
                  </div>
                </div>

                <div className="request-address-layout">
                    <div className="request-address-field request-editable-field">
                      <label htmlFor="guided-installation-address">
                        Endereço da instalação
                      </label>
                      <div className="request-address-input">
                      <AppIcon name="search" />
                      <input
                        aria-autocomplete="list"
                        aria-controls="guided-location-suggestions"
                        aria-describedby="guided-location-feedback"
                        aria-expanded={locationSuggestionsOpen}
                        autoComplete="off"
                        id="guided-installation-address"
                        ref={guidedAddressInputRef}
                        disabled={guidedLocating || guidedLocationResolving}
                        onBlur={() => window.setTimeout(() => setLocationSuggestionsOpen(false), 120)}
                        onChange={(event) => updateGuidedLocationQuery(event.target.value)}
                        onFocus={() => locationOptions.length > 0 && setLocationSuggestionsOpen(true)}
                        placeholder="Rua, bairro ou cidade"
                        role="combobox"
                        value={locationQuery}
                      />
                      </div>
                      <small
                        className={locationLoadError ? 'is-error' : ''}
                        id="guided-location-feedback"
                        role="status"
                        aria-live="polite"
                      >
                        {locationLoadError ||
                          (guidedLocating
                            ? 'Obtendo uma nova leitura do GPS...'
                            : guidedLocationResolving
                              ? 'Confirmando o endereço informado...'
                              : loadingLocations
                                ? 'Procurando endereços...'
                                : confirmedLocationQuery
                                  ? guidedLocationAccuracy !== null
                                    ? `GPS encontrou ${[serviceRequest.city, serviceRequest.state].filter(Boolean).join(' - ')} (precisão aproximada de ${Math.round(guidedLocationAccuracy)} m). Digite a rua para informar o endereço exato.`
                                    : `Endereço confirmado — ${[serviceRequest.city, serviceRequest.state].filter(Boolean).join(', ')}`
                                  : 'Digite o endereço da instalação ou use sua localização.')}
                      </small>

                      {locationSuggestionsOpen && locationOptions.length > 0 ? (
                        <ul
                          className="request-address-suggestions"
                          id="guided-location-suggestions"
                          role="listbox"
                        >
                          {locationOptions.map((location, index) => (
                            <li key={`${location.latitude}-${location.longitude}-${index}`}>
                              <button
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => selectLocationOption(location)}
                                aria-selected="false"
                                role="option"
                                type="button"
                              >
                                <span className="client-app-pertolar-suggestion-pin" aria-hidden="true">
                                  <AppIcon name="map-pin" />
                                </span>
                                <span>
                                  <strong>{location.label || location.city}</strong>
                                  <small>{location.subtitle || [location.city, location.state].filter(Boolean).join(' - ')}</small>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>

                      <button
                        className="request-locate-button"
                        disabled={guidedLocating || guidedLocationResolving}
                        onClick={requestGuidedLocation}
                        type="button"
                      >
                        <AppIcon name="target" />
                        {guidedLocating ? 'Localizando...' : 'Minha localização'}
                      </button>
                </div>

                {confirmedLocationQuery ? (
                  <div className="request-selected-address">
                    <span className="request-selected-address-pin" aria-hidden="true"><AppIcon name="map-pin" /></span>
                    <div>
                      <strong>{guidedLocationAccuracy !== null ? 'Região encontrada' : 'Endereço selecionado'}</strong>
                      {serviceRequest.addressReference || serviceRequest.neighborhood ? (
                        <span>{[guidedLocationTarget?.label || serviceRequest.addressReference, serviceRequest.neighborhood].filter(Boolean).join(' · ')}</span>
                      ) : null}
                      <span>{[serviceRequest.city, serviceRequest.state].filter(Boolean).join(', ')}</span>
                    </div>
                    <span className="request-address-check" aria-hidden="true"><AppIcon name="check" /></span>
                    <button onClick={() => {
                      guidedAddressInputRef.current?.focus();
                      guidedAddressInputRef.current?.select();
                    }} type="button">Alterar</button>
                  </div>
                ) : null}
                <RequestLocationMap target={guidedLocationTarget} regionOnly={guidedLocationAccuracy !== null} />
              </div>
            ) : null}

            {requestStep === 3 ? (
              <RequestReview request={serviceRequest} snapshot={requestSnapshot}
                locationLabel={guidedLocationTarget?.label}
                urgencyOptions={URGENCY_OPTIONS} contactOptions={CONTACT_PREFERENCE_OPTIONS}
                onChange={updateServiceRequest} onEdit={setRequestStep} Icon={AppIcon} />
            ) : null}

            <div className="client-app-request-actions">
              <p className="request-contact-note">
                <AppIcon name="shield" />
                Você escolhe com quem compartilhar seu contato.
              </p>
              <div className="request-action-buttons">
                <button
                  className="client-app-ghost-button"
                  onClick={handleRequestBack}
                  type="button"
                >
                  Voltar
                </button>
                {requestStep === 2 ? (
                  <button key="location-continue" className="client-app-search-submit" disabled={guidedLocating || guidedLocationResolving}
                    onClick={handleGuidedLocationContinue} type="button">
                    {guidedLocationResolving ? 'Confirmando...' : 'Continuar'} <AppIcon name="arrow-right" />
                  </button>
                ) : requestStep < LAST_REQUEST_STEP ? (
                  <button key="step-continue" className="client-app-search-submit" onClick={handleRequestNext} type="button">
                    Continuar <AppIcon name="arrow-right" />
                  </button>
                ) : (
                  <button key="review-submit" className="client-app-search-submit" type="submit">
                    Continuar para publicar
                    <AppIcon name="arrow-right" />
                  </button>
                )}
              </div>
            </div>
          </form>
        </section>
        ) : null}

        {hasGuidedRequest ? (
          <>
            <section className="client-app-result-overview fade-up" id="resultados">
              <span className="client-app-result-overview-icon" aria-hidden="true">
                <AppIcon name={publishedRequest ? 'check-badge' : 'users'} />
              </span>
              <div>
                <p className="client-app-kicker">Seu pedido</p>
                <h2>
                  {publishedRequest
                    ? 'Seu pedido está publicado'
                    : 'Tudo pronto para receber interessados'}
                </h2>
                <span>
                  {[requestSnapshot.serviceLabel, filters.city, filters.state].filter(Boolean).join(' · ')}
                </span>
              </div>
              <button className="client-app-result-edit" onClick={() => editGuidedRequest(2)} type="button">
                Editar pedido
              </button>
            </section>

            {SHOW_PUBLIC_INSTALLER_DIRECTORY ? (
              filteredInstallers.length > 0 ? (
                <details className="client-app-results-filters fade-up">
                  <summary>
                    <AppIcon name="filter" />
                    Ajustar resultados
                  </summary>
                  <div className="client-app-results-filters-body">
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
                        : 'Minha localização'}
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
                        <option value="match">Mais compatíveis</option>
                        <option value="rating">Melhor avaliados</option>
                        <option value="reviews">Mais avaliações</option>
                        <option value="available">Mais disponíveis</option>
                        <option value="name">Ordem alfabética</option>
                      </select>
                    </label>
                  </div>
                </section>
                  </div>
                </details>
              ) : null
            ) : null}
          </>
        ) : null}

        {SHOW_PUBLIC_INSTALLER_DIRECTORY &&
        hasGuidedRequest &&
        !loading &&
        filteredInstallers.length === 0 &&
        !showPublishForm &&
        !publishedRequest ? (
          <section className="client-app-empty client-app-empty--focused fade-up">
            <span className="client-app-empty-icon" aria-hidden="true">
              <AppIcon name="users" />
            </span>
            <strong>Nenhum profissional verificado neste filtro</strong>
            <p>Você pode publicar o pedido agora. Ele ficará disponível quando um profissional apto atender à sua região.</p>
            <div className="client-app-empty-actions">
              <button className="client-app-search-submit" onClick={() => setShowPublishForm(true)} type="button">
                Receber propostas
              </button>
              <button className="client-app-ghost-button" onClick={() => editGuidedRequest(2)} type="button">
                Alterar localização
              </button>
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
                          <img alt={`Foto de ${installer.display_name}`} decoding="async" loading="lazy" src={installer.installer_photo} />
                        ) : installer.logo ? (
                          <img alt={`Logo de ${installer.display_name}`} decoding="async" loading="lazy" src={installer.logo} />
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
                          <span>({installer.review_count || 0} avaliações)</span>
                        </div>

                        <div className="client-app-match-row">
                          <span className="client-app-match-pill">{matchScore}% compatível</span>
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
                          <span>{isVerified ? 'Perfil verificado' : 'Dados profissionais disponíveis'}</span>
                          <span className="client-app-dot">•</span>
                          <span>{(installer.available_dates || []).length > 0 ? 'Datas disponíveis' : 'Perfil completo'}</span>
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
                        <img alt={`Foto de ${installer.display_name}`} decoding="async" loading="lazy" src={installer.installer_photo} />
                      ) : installer.logo ? (
                        <img alt={`Logo de ${installer.display_name}`} decoding="async" loading="lazy" src={installer.logo} />
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
                        <span>({installer.review_count || 0} avaliações)</span>
                      </div>

                      <div className="client-app-match-row">
                        <span className="client-app-match-pill">{matchScore}% compatível</span>
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
                        <span>{isVerified ? 'Profissional verificado' : 'Perfil profissional disponível'}</span>
                        <span className="client-app-dot">•</span>
                        <span>
                          {(installer.availability_slots || []).length > 0 || (installer.available_dates || []).length > 0
                            ? 'Horários disponíveis'
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

        {hasGuidedRequest && (showPublishForm || publishedRequest) ? (
          <section className="client-app-opportunity-publish fade-up" id="publicar-pedido">
            <div className="client-app-opportunity-copy">
              <p className="client-app-kicker">{publishedRequest ? 'Pedido publicado' : 'Último passo'}</p>
              <h3>{publishedRequest ? 'Instaladores da região já podem responder' : 'Publique para os instaladores da região'}</h3>
              <span>
                {publishedRequest
                  ? 'Quando alguém quiser atender, o perfil aparecerá logo abaixo para você comparar.'
                  : 'Seu telefone e endereço completo ficam privados até você escolher quem chamar.'}
              </span>
            </div>

            {publishedRequest ? (
              <div className="client-app-opportunity-success">
                <strong>Pedido #{publishedRequest.id} publicado</strong>
                <span>Vários profissionais podem demonstrar interesse. Você decide qual deles chamar no final.</span>
                <div className="client-app-tracking-actions">
                  <button className="client-app-ghost-button" onClick={copyRequestTrackingLink} type="button">
                    Copiar link para acompanhar
                  </button>
                  {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' ? (
                    <button className="client-app-ghost-button" onClick={handleEnableRequestNotifications} type="button">
                      Ativar avisos
                    </button>
                  ) : null}
                  {publishedRequest.status === 'selected' ? (
                    <button className="client-app-ghost-button" disabled={updatingRequestStatus === publishedRequest.id} onClick={() => updateClientRequestStatus(publishedRequest, 'closed')} type="button">
                      Marcar serviço concluído
                    </button>
                  ) : null}
                  <button className="client-app-opportunity-cancel" onClick={startAnotherRequest} type="button">
                    {['open', 'selected'].includes(publishedRequest.status) ? 'Cancelar e fazer outro' : 'Fazer outro pedido'}
                  </button>
                </div>
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
                  <span>E-mail para avisos (opcional)</span>
                  <input
                    inputMode="email"
                    onChange={(event) => updateRequestContact('email', event.target.value)}
                    placeholder="voce@email.com"
                    type="email"
                    value={requestContact.email}
                  />
                </label>
                <label className="client-app-request-consent">
                  <input
                    checked={privacyConsent}
                    onChange={(event) => setPrivacyConsent(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    Concordo com os <Link to="/termos">Termos de Uso</Link> e a{' '}
                    <Link to="/privacidade">Política de Privacidade</Link>.
                  </span>
                </label>
                <Turnstile
                  action="publish_service_request"
                  onExpire={() => setTurnstileToken('')}
                  onVerify={setTurnstileToken}
                  resetKey={turnstileResetKey}
                />
                <div className="client-app-opportunity-actions">
                  <button
                    className="client-app-search-submit"
                    disabled={publishingRequest || (isTurnstileEnabled() && !turnstileToken)}
                    onClick={handlePublishServiceRequest}
                    type="button"
                  >
                    {publishingRequest ? 'Publicando...' : 'Publicar pedido'}
                  </button>
                  <button
                    className="client-app-opportunity-cancel"
                    onClick={() => setShowPublishForm(false)}
                    type="button"
                  >
                    Agora não
                  </button>
                </div>
              </div>
            )}

            {selectedInterest ? (
              <section className="client-app-interest-empty mt-4 text-left">
                <strong>{serviceProposal ? 'Proposta e agendamento' : loadingProposal ? 'Procurando proposta...' : 'Aguardando proposta do instalador'}</strong>
                {serviceProposal ? (
                  <div className="mt-3 grid gap-2 text-sm">
                    <span><b>Valor:</b> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(serviceProposal.amount || 0))}</span>
                    <span><b>Horário sugerido:</b> {new Date(serviceProposal.scheduled_start).toLocaleString('pt-BR')} até {new Date(serviceProposal.scheduled_end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span><b>Incluso:</b> {serviceProposal.scope}</span>
                    {serviceProposal.materials ? <span><b>Materiais:</b> {serviceProposal.materials}</span> : null}
                    {serviceProposal.notes ? <span><b>Observações:</b> {serviceProposal.notes}</span> : null}
                    {serviceProposal.status === 'sent' ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button className="gold-button" disabled={respondingProposal} onClick={() => respondToServiceProposal('accept')} type="button">Aceitar e agendar</button>
                        <button className="client-app-ghost-button" disabled={respondingProposal} onClick={() => respondToServiceProposal('request_changes')} type="button">Pedir ajuste</button>
                        <button className="client-app-opportunity-cancel" disabled={respondingProposal} onClick={() => respondToServiceProposal('reject')} type="button">Recusar</button>
                      </div>
                    ) : serviceProposal.status === 'accepted' ? <strong className="mt-2">Horário confirmado. Você receberá atualizações do serviço por aqui.</strong> : serviceProposal.status === 'change_requested' ? <strong className="mt-2">Seu pedido de ajuste foi enviado ao instalador.</strong> : <strong className="mt-2">Esta proposta foi recusada.</strong>}
                  </div>
                ) : <span>O profissional foi avisado para enviar valor, itens inclusos e horário. Você não precisa aceitar nada pelo WhatsApp.</span>}
              </section>
            ) : null}
          </section>
        ) : null}

        {publishedRequest ? (
          <section className="client-app-interest-board fade-up" id="interessados">
            <div className="client-app-interest-head">
              <div>
                <p className="client-app-kicker">Quem se interessou</p>
                <h3>{selectedInterest ? 'Contato liberado' : 'Compare quem quer atender você'}</h3>
                <span>
                  {selectedInterest
                    ? 'Você e o profissional escolhido já podem conversar pelo WhatsApp.'
                    : 'Veja os perfis e chame somente um instalador quando estiver pronto.'}
                </span>
              </div>
              <button className="client-app-ghost-button" onClick={() => loadRequestInterests()} type="button">
                {loadingInterests ? 'Atualizando...' : 'Atualizar'}
              </button>
            </div>

            {requestInterests.length === 0 ? (
              <div className="client-app-interest-empty">
                <strong>Nenhum interessado ainda</strong>
                <span>Volte mais tarde ou ative os avisos desta página.</span>
              </div>
            ) : (
              <div className="client-app-interest-list">
                {requestInterests.map((interest) => (
                  <article className={interest.selected ? 'is-selected' : ''} key={interest.id}>
                    <div className="client-app-interest-avatar">
                      {interest.installer_photo || interest.logo ? (
                        <img alt={`Foto de ${interest.display_name}`} decoding="async" loading="lazy" src={interest.installer_photo || interest.logo} />
                      ) : (
                        <span>{getInitials(interest.display_name)}</span>
                      )}
                    </div>
                    <div className="client-app-interest-copy">
                      <strong>{interest.display_name}</strong>
                      <span>{[interest.city, interest.state].filter(Boolean).join(', ') || 'Região informada no perfil'}</span>
                      <small>
                        {Number(interest.average_rating || 0).toFixed(1)} estrelas · {interest.review_count || 0} avaliações
                      </small>
                    </div>
                    <div className="client-app-interest-actions">
                      <Link
                        className="ghost-button"
                        to={`/installers/${interest.installer_id}?pedido=${publishedRequest.id}`}
                      >
                        Ver perfil
                      </Link>
                      {interest.selected && interest.whatsapp_url ? (
                        <a className="gold-button" href={interest.whatsapp_url} rel="noreferrer" target="_blank">
                          Conversar no WhatsApp
                        </a>
                      ) : (
                        <button
                          className="gold-button"
                          disabled={Boolean(selectedInterest) || selectingInterestId === interest.id}
                          onClick={() => selectInterestedInstaller(interest)}
                          type="button"
                        >
                          {selectingInterestId === interest.id ? 'Liberando contato...' : 'Chamar este instalador'}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {SHOW_PUBLIC_INSTALLER_DIRECTORY && hasGuidedRequest && filteredInstallers.length > 0 && !publishedRequest ? (
          <section className="client-app-trust-strip fade-up">
            <article>
              <AppIcon name="shield" />
              <div>
                <strong>Profissionais verificados</strong>
                <span>Todos passam por análise</span>
              </div>
            </article>
            <article>
              <AppIcon name="star" />
              <div>
                <strong>Avaliações reais</strong>
                <span>Baseadas em clientes</span>
              </div>
            </article>
            <article>
              <AppIcon name="shield" />
              <div>
                <strong>Contato protegido</strong>
                <span>Liberado só após sua escolha</span>
              </div>
            </article>
          </section>
        ) : null}
        </main>
      </div>

      {hasGuidedRequest || user ? (
        <nav className="client-app-mobile-dock">
          <a href="#top">
            <AppIcon name="home" />
            <span>Início</span>
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
                <span>{user.account_type === 'client' ? 'Pedidos' : 'Perfil'}</span>
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
