import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRef } from 'react';
import api from '../../services/api';
import BrandMark from '../Layout/BrandMark';
import BrandWordmark from '../Layout/BrandWordmark';

const HERO_IMAGE_URL = '/landing/instalando-mapa-do-brasil.png';
const STORY_IMAGE_URL = '/landing/instaladores-profissionais.png';
const INSTALLER_CARDS_PER_VIEW = 4;
const REVIEW_CARDS_PER_VIEW = 4;
const STORE_CAROUSEL_INTERVAL_MS = 5200;
const INSTALLER_CAROUSEL_INTERVAL_MS = 4200;
const REVIEW_CAROUSEL_INTERVAL_MS = 5600;

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Busque sua região',
    copy: 'Digite cidade, estado ou estilo de instalação.',
  },
  {
    step: '02',
    title: 'Compare perfis',
    copy: 'Veja nota, experiência e fotos de instalações.',
  },
  {
    step: '03',
    title: 'Fale e agende',
    copy: 'Converse no WhatsApp e marque o melhor horário.',
  },
];

const STORY_POINTS = [
  'Instaladores de papel de parede especializados',
  'Comparação simples entre opções',
  'Contato direto sem intermediários',
  'Fotos para validar o acabamento',
];

const HERO_MINI_TOPICS = [
  'Instaladores especializados',
  'Perfis verificados',
  'Avaliações reais de clientes',
  'Contato rápido no WhatsApp',
  'Suporte antes, durante e depois',
];

const HERO_MINI_TOPICS_MOBILE = [
  'Instaladores especializados',
  'Perfis verificados',
  'Avaliações reais de clientes',
  'Contato direto no WhatsApp',
  'Suporte antes e depois',
];

const MOBILE_FEATURE_ITEMS = [
  {
    icon: 'shield',
    title: 'Instaladores especializados',
    copy: 'Profissionais avaliados e experientes',
  },
  {
    icon: 'verified',
    title: 'Perfis verificados',
    copy: 'Segurança e confiança na contratação',
  },
  {
    icon: 'star',
    title: 'Avaliações reais de clientes',
    copy: 'Decida com base em experiências reais',
  },
  {
    icon: 'whatsapp',
    title: 'Contato direto no WhatsApp',
    copy: 'Fale com o instalador sem intermediários',
  },
  {
    icon: 'headset',
    title: 'Suporte antes e depois',
    copy: 'Acompanhamento em todas as etapas',
  },
];

const MOBILE_HERO_STATS = [
  {
    icon: 'users',
    value: '+8.000',
    title: 'Instaladores cadastrados',
  },
  {
    icon: 'award',
    value: '4,9/5',
    title: 'Avaliação média dos clientes',
  },
  {
    icon: 'pin',
    value: 'Todo o Brasil',
    title: 'Presença em todos os estados',
  },
  {
    icon: 'shield',
    value: '100% Seguro',
    title: 'Profissionais verificados',
  },
];

const HOW_IT_WORKS_MOBILE = [
  {
    step: '01',
    title: 'Busque',
    copy: 'Digite cidade ou estado.',
  },
  {
    step: '02',
    title: 'Compare',
    copy: 'Veja nota e fotos reais.',
  },
  {
    step: '03',
    title: 'Agende',
    copy: 'Fale no WhatsApp.',
  },
];

const DESKTOP_NAV_ITEMS = [
  { label: 'Início', href: '#inicio' },
  { label: 'Lojas recomendadas', href: '#lojas-recomendadas' },
  { label: 'Por que escolher', href: '#por-que-escolher' },
  { label: 'Instaladores', href: '#landing-installers' },
  { label: 'Avaliações', href: '#landing-reviews' },
  { label: 'Como funciona', href: '#como-funciona' },
];

const DESKTOP_TRUST_ITEMS = [
  {
    icon: 'shield',
    title: 'Profissionais verificados',
    copy: 'Todos passam por análise',
  },
  {
    icon: 'star',
    title: 'Avaliações reais',
    copy: 'Baseadas em clientes',
  },
  {
    icon: 'pin',
    title: 'Atendimento em',
    copy: 'todo o Brasil',
  },
];

const DESKTOP_HERO_METRICS = [
  {
    icon: 'users',
    value: '+8.000',
    title: 'instaladores cadastrados',
  },
  {
    icon: 'award',
    value: '4,9/5',
    title: 'avaliação média dos clientes',
  },
  {
    icon: 'brazil',
    value: 'Todos os estados',
    title: 'do Brasil',
  },
];

const DESKTOP_WHY_POINTS = [
  {
    icon: 'verified',
    title: 'Profissionais verificados',
    copy: 'Todos os instaladores passam por uma análise completa.',
  },
  {
    icon: 'star',
    title: 'Avaliações reais de clientes',
    copy: 'Decida com base na experiência de quem já contratou.',
  },
  {
    icon: 'whatsapp',
    title: 'Contato direto no WhatsApp',
    copy: 'Fale direto com o instalador, sem intermediários.',
  },
  {
    icon: 'image',
    title: 'Fotos reais dos serviços',
    copy: 'Veja acabamentos reais e tenha mais segurança na escolha.',
  },
];

const DESKTOP_PLATFORM_METRICS = [
  {
    icon: 'users',
    value: '+8.000',
    copyLines: ['instalações', 'realizadas'],
  },
  {
    icon: 'star',
    value: '4,9/5',
    copyLines: ['avaliação média', 'dos clientes'],
  },
  {
    icon: 'brazil',
    value: 'Todo o Brasil',
    copyLines: ['instaladores presentes', 'em todo o país'],
    textOnly: true,
  },
];

const DESKTOP_STORE_FEATURES = [
  {
    icon: 'shield',
    title: 'Produtos originais',
  },
  {
    icon: 'truck',
    title: 'Entrega em todo Brasil',
  },
  {
    icon: 'award',
    title: 'Qualidade garantida',
  },
];

const STORE_RATING_FALLBACKS = {
  'Leroy Merlin': '4,8',
  'Novo Ambiente': '4,7',
  'Papel & Cia': '4,9',
  'Casa do Papel': '4,8',
};

const DESKTOP_SHOWCASE_INSTALLERS = [
  {
    id: 'desktop-installer-1',
    display_name: 'Teste',
    city: 'São Paulo',
    state: 'SP',
    average_rating: 5,
    review_count: 32,
    completed_jobs: 80,
    featured_installer: true,
  },
  {
    id: 'desktop-installer-2',
    display_name: 'Bem Instalado',
    city: 'Curitiba',
    state: 'PR',
    average_rating: 4.9,
    review_count: 27,
    completed_jobs: 60,
    featured_installer: true,
  },
];

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatReviewDate(date) {
  if (!date) {
    return '';
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toLocaleDateString('pt-BR');
}

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) {
    return moneyFormatter.format(0);
  }
  return moneyFormatter.format(amount);
}

function formatRating(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) {
    return '0,0';
  }

  return amount.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function getInitials(name) {
  return (name || 'IL')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function getStoreBrandModifier(name) {
  const normalized = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized.includes('leroy')) {
    return 'is-leroy';
  }

  if (normalized.includes('novo ambiente')) {
    return 'is-novo-ambiente';
  }

  if (normalized.includes('papel') && normalized.includes('cia')) {
    return 'is-papel-cia';
  }

  if (normalized.includes('casa do papel')) {
    return 'is-casa-papel';
  }

  return '';
}

function getTouchPointX(event) {
  const touch = event.changedTouches?.[0] || event.touches?.[0];
  return typeof touch?.clientX === 'number' ? touch.clientX : null;
}

function buildSwipeHandlers(startRef, onPrevious, onNext) {
  return {
    onTouchStart: (event) => {
      startRef.current = getTouchPointX(event);
    },
    onTouchCancel: () => {
      startRef.current = null;
    },
    onTouchEnd: (event) => {
      const startX = startRef.current;
      const endX = getTouchPointX(event);

      startRef.current = null;

      if (startX === null || endX === null) {
        return;
      }

      const delta = endX - startX;
      if (Math.abs(delta) < 42) {
        return;
      }

      if (delta > 0) {
        onPrevious();
        return;
      }

      onNext();
    },
  };
}

function getStoreCardsPerView() {
  if (typeof window === 'undefined') {
    return 4;
  }

  if (window.innerWidth <= 680) {
    return 1;
  }

  if (window.innerWidth <= 1024) {
    return 2;
  }

  if (window.innerWidth <= 1180) {
    return 3;
  }

  return 4;
}

function getInstallerCardsPerView() {
  if (typeof window === 'undefined') {
    return INSTALLER_CARDS_PER_VIEW;
  }

  if (window.innerWidth <= 680) {
    return 1;
  }

  if (window.innerWidth <= 1080) {
    return 2;
  }

  if (window.innerWidth <= 1380) {
    return 3;
  }

  return INSTALLER_CARDS_PER_VIEW;
}

function getReviewCardsPerView() {
  if (typeof window === 'undefined') {
    return REVIEW_CARDS_PER_VIEW;
  }

  if (window.innerWidth <= 680) {
    return 1;
  }

  if (window.innerWidth <= 1080) {
    return 2;
  }

  if (window.innerWidth <= 1380) {
    return 3;
  }

  return REVIEW_CARDS_PER_VIEW;
}

function RatingDots({ value }) {
  const rounded = Math.max(1, Math.round(Number(value || 0)));

  return (
    <div className="clean-stars">
      {Array.from({ length: 5 }).map((_, index) => (
        <span className={index < rounded ? 'is-on' : ''} key={index} />
      ))}
    </div>
  );
}

function ReferenceHeroIcon({ name }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: '1.8',
  };

  switch (name) {
    case 'play':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" {...common} />
          <path d="M10 8.8 16 12l-6 3.2Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'shield':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 3.5 18.5 6v5.9c0 4.1-2.7 7.2-6.5 8.6-3.8-1.4-6.5-4.5-6.5-8.6V6z" {...common} />
        </svg>
      );
    case 'star':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m12 3.9 2.5 5.1 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z" {...common} />
        </svg>
      );
    case 'pin':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 20s6-5.6 6-10.2a6 6 0 1 0-12 0C6 14.4 12 20 12 20Z" {...common} />
          <circle cx="12" cy="9.5" r="2.1" {...common} />
        </svg>
      );
    case 'users':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="9" cy="9" r="3.2" {...common} />
          <path d="M3.8 18c1.1-2.7 3-4 5.2-4s4.1 1.3 5.2 4" {...common} />
          <circle cx="17.2" cy="8.3" r="2.4" {...common} />
          <path d="M15.2 16.2c1.2.2 2.3.8 3.4 1.8" {...common} />
        </svg>
      );
    case 'award':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="10" r="4.6" {...common} />
          <path d="m9.4 14 1.1 5.1L12 18l1.5 1.1 1.1-5.1" {...common} />
          <path d="m12 7.7.8 1.6 1.8.3-1.3 1.2.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.2 1.8-.3z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'truck':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M3.8 6.5h10.4v8.2H3.8z" {...common} />
          <path d="M14.2 9.2h3.1l2.5 2.7v2.8h-5.6" {...common} />
          <circle cx="8" cy="17.2" r="1.7" {...common} />
          <circle cx="17.1" cy="17.2" r="1.7" {...common} />
          <path d="M5 17.2h1.3m3.4 0h5.7" {...common} />
        </svg>
      );
    case 'brazil':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m7.1 4.3 2.8.6 1.4-.8 2.2.7 1.7 1.6 2.4.5.4 1.6-.6 1.3.4 1.3-.9 1.3.5 1.4-1.2 1.6-1.4.5-.6 1.9-1.7.6-1.3-.9-1.5.7-1.1-1-1.8-.2-.7-1.4-1.5-.6-.4-1.6 1.1-1 .2-1.7 1.3-1.3-.4-1.6Z" {...common} />
        </svg>
      );
    case 'group':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="8.5" cy="9" r="2.2" {...common} />
          <circle cx="15.7" cy="9.6" r="1.9" {...common} />
          <path d="M4.2 17.4c.8-2.1 2.3-3.4 4.3-3.4 2 0 3.5 1.3 4.3 3.4" {...common} />
          <path d="M13.6 16.6c.6-1.4 1.6-2.3 3-2.3 1.1 0 2 .5 2.8 1.5" {...common} />
        </svg>
      );
    case 'search':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="10.5" cy="10.5" r="5.7" {...common} />
          <path d="m15 15 4.7 4.7" {...common} />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M20 11.4a8 8 0 0 1-11.8 7l-3.4 1 1.1-3.2A8 8 0 1 1 20 11.4Z" {...common} />
          <path d="M9.4 8.6c.2-.4.4-.5.7-.5h.6c.2 0 .4 0 .5.4l.6 1.4c.1.3.1.4-.1.7l-.4.5c-.2.2-.1.4 0 .6.5 1 1.3 1.9 2.3 2.4.2.1.4.1.6 0l.6-.4c.2-.2.4-.2.7-.1l1.3.6c.3.1.4.3.4.5v.6c0 .3-.2.5-.5.7-.4.2-1 .3-1.6.1-2.8-.9-5.3-3.4-6.2-6.2-.2-.6-.1-1.2.1-1.6Z" {...common} />
        </svg>
      );
    case 'camera':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4.8 7.8h3l1.2-1.8h6l1.2 1.8h3a1.8 1.8 0 0 1 1.8 1.8v7.6A1.8 1.8 0 0 1 19.2 19H4.8A1.8 1.8 0 0 1 3 17.2V9.6a1.8 1.8 0 0 1 1.8-1.8Z" {...common} />
          <circle cx="12" cy="13" r="3.3" {...common} />
        </svg>
      );
    case 'image':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <rect x="4" y="5.5" width="16" height="13" rx="2.4" {...common} />
          <circle cx="9" cy="10" r="1.2" {...common} />
          <path d="m6.8 16 3.2-3.3 2.7 2.6 2.6-2.5 2.2 3.2" {...common} />
        </svg>
      );
    case 'lock':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M7.6 10.2V8.4a4.4 4.4 0 1 1 8.8 0v1.8" {...common} />
          <rect x="5.4" y="10.2" width="13.2" height="9.4" rx="2.2" {...common} />
          <path d="M12 13.3v3.2" {...common} />
        </svg>
      );
    case 'verified':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 3.7 18 6.1v5.4c0 4-2.5 7.1-6 8.7-3.5-1.6-6-4.7-6-8.7V6.1Z" {...common} />
          <path d="m8.8 11.9 2 2 4.4-4.4" {...common} />
        </svg>
      );
    case 'headset':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M5.2 13.4v-1.1a6.8 6.8 0 1 1 13.6 0v1.1" {...common} />
          <path d="M5.6 13h1.9a1.4 1.4 0 0 1 1.4 1.4v3.2A1.4 1.4 0 0 1 7.5 19H5.6A1.6 1.6 0 0 1 4 17.4v-2.8A1.6 1.6 0 0 1 5.6 13Z" {...common} />
          <path d="M16.5 13h1.9a1.6 1.6 0 0 1 1.6 1.6v2.8a1.6 1.6 0 0 1-1.6 1.6h-1.9a1.4 1.4 0 0 1-1.4-1.4v-3.2a1.4 1.4 0 0 1 1.4-1.4Z" {...common} />
          <path d="M9.5 19.2c.7.8 1.6 1.1 2.6 1.1h1.5" {...common} />
        </svg>
      );
    default:
      return null;
  }
}

export default function ClientLanding() {
  const [installers, setInstallers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [recommendedStores, setRecommendedStores] = useState([]);
  const [storesPerView, setStoresPerView] = useState(getStoreCardsPerView);
  const [isMobileLayout, setIsMobileLayout] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.innerWidth <= 760;
  });
  const [installerCardsPerView, setInstallerCardsPerView] = useState(getInstallerCardsPerView);
  const [reviewCardsPerView, setReviewCardsPerView] = useState(getReviewCardsPerView);
  const [activeStoreIndex, setActiveStoreIndex] = useState(0);
  const [activeInstallerIndex, setActiveInstallerIndex] = useState(0);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [openedStoreCardId, setOpenedStoreCardId] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const storeTouchStartRef = useRef(null);
  const installerTouchStartRef = useRef(null);
  const reviewTouchStartRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const loadLandingData = async () => {
      try {
        const response = await api.get('/public/installers');
        const allInstallers = response.data?.installers || [];
        const recentReviews = response.data?.reviews || [];
        const stores = response.data?.recommended_stores || [];

        const positiveReviews = recentReviews
          .filter((review) => Number(review.rating || 0) >= 4)
          .slice(0, 6);

        if (!mounted) {
          return;
        }

        setInstallers(allInstallers);
        setReviews(positiveReviews);
        setRecommendedStores(stores);
      } catch (_error) {
        if (!mounted) {
          return;
        }

        setInstallers([]);
        setReviews([]);
        setRecommendedStores([]);
      }
    };

    loadLandingData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setStoresPerView(getStoreCardsPerView());
      setIsMobileLayout(window.innerWidth <= 760);
      setInstallerCardsPerView(getInstallerCardsPerView());
      setReviewCardsPerView(getReviewCardsPerView());
      if (window.innerWidth > 760) {
        setIsMobileMenuOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const topInstallers = useMemo(() => {
    const sorted = [...installers].sort((a, b) => {
        const featuredDiff = Number(Boolean(b.featured_installer)) - Number(Boolean(a.featured_installer));
        if (featuredDiff !== 0) {
          return featuredDiff;
        }

        const reviewedDiff = Number(Number(b.review_count || 0) > 0) - Number(Number(a.review_count || 0) > 0);
        if (reviewedDiff !== 0) {
          return reviewedDiff;
        }

        const ratingDiff = Number(b.average_rating || 0) - Number(a.average_rating || 0);
        if (ratingDiff !== 0) {
          return ratingDiff;
        }

        const reviewCountDiff = Number(b.review_count || 0) - Number(a.review_count || 0);
        if (reviewCountDiff !== 0) {
          return reviewCountDiff;
        }

        const completedJobsDiff = Number(b.completed_jobs || 0) - Number(a.completed_jobs || 0);
        if (completedJobsDiff !== 0) {
          return completedJobsDiff;
        }

        const approvedJobsDiff = Number(b.approved_jobs || 0) - Number(a.approved_jobs || 0);
        if (approvedJobsDiff !== 0) {
          return approvedJobsDiff;
        }

        return Number(b.years_experience || 0) - Number(a.years_experience || 0);
      });

    return sorted.slice(0, 8);
  }, [installers]);

  const activeStores = useMemo(
    () => recommendedStores.filter((store) => Boolean(store?.is_active)),
    [recommendedStores]
  );

  const isTouchDevice = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.matchMedia('(hover: none), (pointer: coarse)').matches;
  }, []);
  const storeCardWidth = 100 / Math.max(storesPerView, 1);
  const maxStoreIndex = useMemo(
    () => Math.max(0, activeStores.length - storesPerView),
    [activeStores.length, storesPerView]
  );
  const storeSlidePositions = useMemo(
    () => Array.from({ length: maxStoreIndex + 1 }, (_, index) => index),
    [maxStoreIndex]
  );

  const maxInstallerIndex = useMemo(
    () => Math.max(0, topInstallers.length - installerCardsPerView),
    [topInstallers.length, installerCardsPerView]
  );
  const installerSlidePositions = useMemo(
    () => Array.from({ length: maxInstallerIndex + 1 }, (_, index) => index),
    [maxInstallerIndex]
  );
  const installerCardWidth = 100 / Math.max(installerCardsPerView, 1);
  const maxReviewIndex = useMemo(
    () => Math.max(0, reviews.length - reviewCardsPerView),
    [reviews.length, reviewCardsPerView]
  );
  const reviewSlidePositions = useMemo(
    () => Array.from({ length: maxReviewIndex + 1 }, (_, index) => index),
    [maxReviewIndex]
  );
  const reviewCardWidth = 100 / Math.max(reviewCardsPerView, 1);
  const heroMiniTopics = isMobileLayout ? HERO_MINI_TOPICS_MOBILE : HERO_MINI_TOPICS;
  const storyPoints = STORY_POINTS;
  const howItWorksItems = isMobileLayout ? HOW_IT_WORKS_MOBILE : HOW_IT_WORKS;
  const desktopShowcaseStores = useMemo(
    () =>
      activeStores.map((store, index) => ({
        ...store,
        id: store.id || `desktop-store-${index}`,
        rating:
          typeof store.rating === 'string' || typeof store.rating === 'number'
            ? String(store.rating).replace('.', ',')
            : STORE_RATING_FALLBACKS[store.name] || '4,8',
      })),
    [activeStores]
  );
  const desktopShowcaseInstallers = DESKTOP_SHOWCASE_INSTALLERS;

  useEffect(() => {
    if (maxStoreIndex <= 0) {
      setActiveStoreIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveStoreIndex((current) => (current >= maxStoreIndex ? 0 : current + 1));
    }, STORE_CAROUSEL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [maxStoreIndex]);

  useEffect(() => {
    if (activeStoreIndex > maxStoreIndex) {
      setActiveStoreIndex(0);
    }
  }, [activeStoreIndex, maxStoreIndex]);

  useEffect(() => {
    if (maxInstallerIndex <= 0) {
      setActiveInstallerIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveInstallerIndex((current) => (current >= maxInstallerIndex ? 0 : current + 1));
    }, INSTALLER_CAROUSEL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [maxInstallerIndex]);

  useEffect(() => {
    if (activeInstallerIndex > maxInstallerIndex) {
      setActiveInstallerIndex(0);
    }
  }, [activeInstallerIndex, maxInstallerIndex]);

  useEffect(() => {
    if (maxReviewIndex <= 0) {
      setActiveReviewIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveReviewIndex((current) => (current >= maxReviewIndex ? 0 : current + 1));
    }, REVIEW_CAROUSEL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [maxReviewIndex]);

  useEffect(() => {
    if (activeReviewIndex > maxReviewIndex) {
      setActiveReviewIndex(0);
    }
  }, [activeReviewIndex, maxReviewIndex]);

  const goToPreviousStore = () => {
    setActiveStoreIndex((current) => (current <= 0 ? maxStoreIndex : current - 1));
  };

  const goToNextStore = () => {
    setActiveStoreIndex((current) => (current >= maxStoreIndex ? 0 : current + 1));
  };

  const goToPreviousInstaller = () => {
    setActiveInstallerIndex((current) => (current <= 0 ? maxInstallerIndex : current - 1));
  };

  const goToNextInstaller = () => {
    setActiveInstallerIndex((current) => (current >= maxInstallerIndex ? 0 : current + 1));
  };

  const goToPreviousReview = () => {
    setActiveReviewIndex((current) => (current <= 0 ? maxReviewIndex : current - 1));
  };

  const goToNextReview = () => {
    setActiveReviewIndex((current) => (current >= maxReviewIndex ? 0 : current + 1));
  };

  const storeSwipeHandlers = buildSwipeHandlers(storeTouchStartRef, goToPreviousStore, goToNextStore);
  const installerSwipeHandlers = buildSwipeHandlers(
    installerTouchStartRef,
    goToPreviousInstaller,
    goToNextInstaller
  );
  const reviewSwipeHandlers = buildSwipeHandlers(reviewTouchStartRef, goToPreviousReview, goToNextReview);

  return (
    <div className="auth-scene min-h-screen overflow-x-hidden">
      <div className="clean-landing-shell">
        {isMobileLayout ? (
          <>
            <header className="clean-landing-topbar fade-up">
              <div className="clean-mobile-ref-header">
                <div className="clean-mobile-ref-brand">
                  <BrandMark className="client-brand-mark clean-mobile-ref-mark" />
                  <BrandWordmark className="client-topbar-wordmark clean-mobile-ref-wordmark" size="lg" />
                </div>

                <button
                  aria-expanded={isMobileMenuOpen}
                  aria-label="Abrir menu"
                  className={`clean-mobile-ref-burger ${isMobileMenuOpen ? 'is-open' : ''}`}
                  onClick={() => setIsMobileMenuOpen((current) => !current)}
                  type="button"
                >
                  <span />
                  <span />
                  <span />
                </button>
              </div>

              {isMobileMenuOpen ? (
                <nav className="clean-mobile-ref-menu">
                  {DESKTOP_NAV_ITEMS.map((item) => (
                    <a href={item.href} key={item.label} onClick={() => setIsMobileMenuOpen(false)}>
                      {item.label}
                    </a>
                  ))}
                  <div className="clean-mobile-ref-menu-actions">
                    <Link className="ghost-button" onClick={() => setIsMobileMenuOpen(false)} to="/cliente/entrar">
                      Entrar
                    </Link>
                    <Link className="gold-button" onClick={() => setIsMobileMenuOpen(false)} to="/instalador/cadastro">
                      Cadastre-se
                    </Link>
                  </div>
                </nav>
              ) : null}
            </header>

            <section className="clean-hero fade-up" style={{ animationDelay: '0.05s' }}>
              <img
                alt="Instalador aplicando papel de parede com mapa do Brasil"
                className="clean-hero-image"
                decoding="async"
                fetchPriority="high"
                loading="eager"
                src={HERO_IMAGE_URL}
              />
              <div className="clean-hero-overlay" />

              <div className="clean-hero-content">
                <div className="clean-mobile-ref-badge">
                  <ReferenceHeroIcon name="group" />
                  <span>Para clientes</span>
                </div>
                <h1 className="clean-hero-title">
                  <span className="clean-mobile-ref-title-line">Encontre</span>
                  <span className="clean-mobile-ref-title-line gold-keyword">instaladores</span>
                  <span className="clean-mobile-ref-title-line">de papel de parede</span>
                  <span className="clean-mobile-ref-title-line gold-keyword">com mais segurança.</span>
                </h1>
                <p className="clean-hero-description">
                  <span className="clean-mobile-ref-copy-line">
                    Encontre <span className="gold-keyword">instaladores especializados</span>,
                  </span>
                  <span className="clean-mobile-ref-copy-line">
                    compare avaliações e fale direto no <span className="gold-keyword">WhatsApp</span>.
                  </span>
                </p>

                <ul className="clean-mobile-ref-feature-list">
                  {MOBILE_FEATURE_ITEMS.map((item, index) => (
                    <li className="clean-mobile-ref-feature-item" key={item.title} style={{ animationDelay: `${0.14 + index * 0.07}s` }}>
                      <span className="clean-mobile-ref-feature-icon">
                        <ReferenceHeroIcon name={item.icon} />
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.copy}</span>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="clean-mobile-ref-actions">
                  <Link className="clean-mobile-ref-primary-cta" to="/cliente">
                    <span className="clean-mobile-ref-primary-icon">
                      <ReferenceHeroIcon name="search" />
                    </span>
                    <span>Encontrar instalador agora</span>
                  </Link>

                  <a className="clean-mobile-ref-secondary-cta" href="#landing-installers">
                    <span className="clean-mobile-ref-secondary-icon">
                      <ReferenceHeroIcon name="group" />
                    </span>
                    <span>Ver instaladores mais bem avaliados</span>
                    <strong aria-hidden="true">›</strong>
                  </a>
                </div>

                <div className="clean-mobile-ref-metrics-card">
                  {MOBILE_HERO_STATS.map((item) => (
                    <article className="clean-mobile-ref-metric" key={item.title}>
                      <span className="clean-mobile-ref-metric-icon">
                        <ReferenceHeroIcon name={item.icon} />
                      </span>
                      <strong>{item.value}</strong>
                      <span>{item.title}</span>
                    </article>
                  ))}
                </div>

                <div className="clean-mobile-ref-assurance">
                  <ReferenceHeroIcon name="shield" />
                  <span>Sua instalação com mais tranquilidade do início ao fim.</span>
                </div>
              </div>
            </section>
          </>
        ) : (
          <>
            <header className="clean-landing-reference-topbar fade-up">
              <div className="clean-reference-brand">
                <BrandMark className="client-brand-mark clean-reference-brand-mark" />
                <strong>Papel na Parede</strong>
              </div>

              <nav className="clean-reference-nav" aria-label="Navegação principal">
                {DESKTOP_NAV_ITEMS.map((item) => (
                  <a href={item.href} key={item.label}>
                    {item.label}
                  </a>
                ))}
              </nav>

              <div className="clean-reference-actions">
                <Link className="ghost-button clean-reference-ghost" to="/cliente/entrar">
                  Entrar
                </Link>
                <Link className="gold-button clean-reference-gold" to="/instalador/cadastro">
                  Cadastre-se
                </Link>
              </div>
            </header>

            <section className="clean-reference-hero fade-up" id="inicio" style={{ animationDelay: '0.05s' }}>
              <div className="clean-reference-hero-copy">
                <div className="clean-reference-badge">
                  <ReferenceHeroIcon name="group" />
                  <span>Para clientes</span>
                </div>

                <h1 className="clean-reference-title">
                  <span className="is-light">Encontre</span>
                  <span className="is-gold">instaladores</span>
                  <span className="is-gold">de papel de parede</span>
                  <span className="is-light">com mais</span>
                  <span className="is-gold">segurança.</span>
                </h1>

                <p className="clean-reference-description">
                  Compare avaliações reais, veja portfólios e fale direto no WhatsApp sem perder tempo procurando.
                </p>

                <div className="clean-reference-actions-row">
                  <Link className="clean-reference-cta-primary" to="/cliente">
                    <span>Encontrar instaladores agora</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>

                <div className="clean-reference-trust-row">
                  {DESKTOP_TRUST_ITEMS.map((item) => (
                    <article className="clean-reference-trust-item" key={item.title}>
                      <div className="clean-reference-trust-icon">
                        <ReferenceHeroIcon name={item.icon} />
                      </div>
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.copy}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="clean-reference-hero-media">
                <img
                  alt="Instalador aplicando papel de parede com mapa do Brasil"
                  className="clean-reference-hero-image"
                  decoding="async"
                  fetchPriority="high"
                  loading="eager"
                  src={HERO_IMAGE_URL}
                />
                <div className="clean-reference-hero-glow" />
              </div>

            </section>
          </>
        )}

        {isMobileLayout ? (
          <section className="clean-stores clean-priority-stores fade-up" id="lojas-recomendadas" style={{ animationDelay: '0.07s' }}>
            <div className="clean-section-head">
              <p className="eyebrow">Lojas recomendadas</p>
              <h2>Lojas para comprar com segurança</h2>
              <p>Opções recomendadas pela plataforma.</p>
            </div>

            {activeStores.length > 0 ? (
              <div className="clean-stores-carousel" {...(isTouchDevice ? storeSwipeHandlers : {})}>
                <div
                  className="clean-stores-track"
                  style={{ transform: `translateX(-${activeStoreIndex * storeCardWidth}%)` }}
                >
                  {activeStores.map((store, index) => (
                    <article
                      className="clean-store-slide"
                      key={store.id || `${store.name}-${index}`}
                      style={{ flex: `0 0 ${storeCardWidth}%` }}
                    >
                      <div
                        className={`clean-store-card ${
                          openedStoreCardId === store.id ? 'is-open' : ''
                        }`}
                        onClick={() => {
                          if (!isTouchDevice) {
                            return;
                          }
                          setOpenedStoreCardId((current) => (current === store.id ? null : store.id));
                        }}
                        onKeyDown={(event) => {
                          if (!isTouchDevice) {
                            return;
                          }
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setOpenedStoreCardId((current) => (current === store.id ? null : store.id));
                          }
                        }}
                        role={isTouchDevice ? 'button' : undefined}
                        tabIndex={isTouchDevice ? 0 : undefined}
                      >
                        <div className="clean-store-media">
                          {store.image_url ? (
                            <img alt={store.name || 'Loja recomendada'} loading="lazy" src={store.image_url} />
                          ) : (
                            <div className="clean-store-fallback">{getInitials(store.name || 'Loja')}</div>
                          )}
                        </div>

                        <div className="clean-store-content">
                          <h3 className="clean-store-title">{store.name}</h3>
                          <div className="clean-store-reveal">
                            <p>{store.description || 'Loja recomendada para papel de parede e composição do ambiente.'}</p>
                          </div>
                          {store.link_url ? (
                            <a
                              className="clean-store-link"
                              href={store.link_url}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              {store.cta_label || 'Ir ao site'}
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {maxStoreIndex > 0 ? (
                  <div className="clean-stores-dots">
                    {storeSlidePositions.map((index) => (
                      <button
                        aria-label={`Mostrar grupo ${index + 1} de lojas recomendadas`}
                        className={index === activeStoreIndex ? 'is-active' : ''}
                        key={`store-dot-${index}`}
                        onClick={() => setActiveStoreIndex(index)}
                        type="button"
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="empty-state !p-4 text-sm">As lojas recomendadas aparecerão aqui automaticamente.</div>
            )}
          </section>
        ) : (
          <section className="clean-reference-store-panel fade-up" id="lojas-recomendadas" style={{ animationDelay: '0.07s' }}>
            <div className="clean-reference-store-layout">
              <div className="clean-reference-store-copy">
                <div className="clean-reference-panel-head">
                  <h2 className="clean-reference-store-title-only">
                    Lojas <span className="is-gold">recomendadas</span>
                  </h2>
                </div>
              </div>

              {desktopShowcaseStores.length > 0 ? (
                <>
                  <div className={`clean-reference-store-shell ${maxStoreIndex <= 0 ? 'is-static no-nav' : ''}`}>
                    {maxStoreIndex > 0 ? (
                      <button
                        aria-label="Mostrar lojas recomendadas anteriores"
                        className="clean-reference-arrow"
                        onClick={goToPreviousStore}
                        type="button"
                      >
                        ‹
                      </button>
                    ) : null}

                    <div className="clean-reference-store-window" {...(isTouchDevice ? storeSwipeHandlers : {})}>
                      {maxStoreIndex > 0 ? (
                        <div
                          className="clean-reference-store-track"
                          style={{ transform: `translateX(-${activeStoreIndex * storeCardWidth}%)` }}
                        >
                          {desktopShowcaseStores.map((store, index) => (
                            <article
                              className="clean-reference-store-slide"
                              key={store.id || `${store.name}-${index}`}
                              style={{ flex: `0 0 ${storeCardWidth}%` }}
                            >
                              <div className="clean-reference-store-card">
                                <span className="clean-reference-store-pill">
                                  <ReferenceHeroIcon name="star" />
                                  Recomendada
                                </span>

                                <div className="clean-reference-store-logo">
                                  {store.image_url ? (
                                    <div className={`clean-reference-brand-logo ${getStoreBrandModifier(store.name)}`}>
                                      <img alt={store.name || 'Loja recomendada'} loading="lazy" src={store.image_url} />
                                    </div>
                                  ) : (
                                    <div className={`clean-reference-brand-logo ${getStoreBrandModifier(store.name)}`}>
                                      <span>{store.name || getInitials(store.name || 'Loja')}</span>
                                    </div>
                                  )}
                                </div>

                                <h3>{store.name}</h3>
                                <div className="clean-reference-store-rating">
                                  <span className="clean-reference-stars">★★★★★</span>
                                  <span>{store.rating}</span>
                                </div>

                                {store.link_url ? (
                                  <a
                                    className="clean-reference-store-link"
                                    href={store.link_url}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                  >
                                    {(store.cta_label || 'Ver loja').replace(/ir ao site/i, 'Ver loja')} →
                                  </a>
                                ) : (
                                  <span className="clean-reference-store-link is-disabled">Ver loja →</span>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div
                          className="clean-reference-store-grid"
                          style={{ ['--store-columns']: Math.min(desktopShowcaseStores.length, storesPerView) }}
                        >
                          {desktopShowcaseStores.map((store, index) => (
                            <article className="clean-reference-store-slide" key={store.id || `${store.name}-${index}`}>
                              <div className="clean-reference-store-card">
                                <span className="clean-reference-store-pill">
                                  <ReferenceHeroIcon name="star" />
                                  Recomendada
                                </span>

                                <div className="clean-reference-store-logo">
                                  {store.image_url ? (
                                    <div className={`clean-reference-brand-logo ${getStoreBrandModifier(store.name)}`}>
                                      <img alt={store.name || 'Loja recomendada'} loading="lazy" src={store.image_url} />
                                    </div>
                                  ) : (
                                    <div className={`clean-reference-brand-logo ${getStoreBrandModifier(store.name)}`}>
                                      <span>{store.name || getInitials(store.name || 'Loja')}</span>
                                    </div>
                                  )}
                                </div>

                                <h3>{store.name}</h3>
                                <div className="clean-reference-store-rating">
                                  <span className="clean-reference-stars">★★★★★</span>
                                  <span>{store.rating}</span>
                                </div>

                                {store.link_url ? (
                                  <a
                                    className="clean-reference-store-link"
                                    href={store.link_url}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                  >
                                    {(store.cta_label || 'Ver loja').replace(/ir ao site/i, 'Ver loja')} →
                                  </a>
                                ) : (
                                  <span className="clean-reference-store-link is-disabled">Ver loja →</span>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>

                    {maxStoreIndex > 0 ? (
                      <button
                        aria-label="Mostrar próximas lojas recomendadas"
                        className="clean-reference-arrow"
                        onClick={goToNextStore}
                        type="button"
                      >
                        ›
                      </button>
                    ) : null}
                  </div>

                  {maxStoreIndex > 0 ? (
                    <div className="clean-reference-pager">
                      {storeSlidePositions.map((index) => (
                        <button
                          aria-label={`Mostrar grupo ${index + 1} de lojas recomendadas`}
                          className={index === activeStoreIndex ? 'is-active' : ''}
                          key={`desktop-store-dot-${index}`}
                          onClick={() => setActiveStoreIndex(index)}
                          type="button"
                        />
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="clean-reference-empty-state">
                  <strong>Lojas recomendadas em atualização</strong>
                  <p>As lojas que você cadastrar e ativar no painel do administrador aparecerão aqui automaticamente.</p>
                </div>
              )}

              <div className="clean-reference-store-benefits" aria-label="Benefícios das lojas recomendadas">
                {DESKTOP_STORE_FEATURES.map((item) => (
                  <article className="clean-reference-store-benefit" key={item.title}>
                    <div className="clean-reference-mini-icon">
                      <ReferenceHeroIcon name={item.icon} />
                    </div>
                    <strong>{item.title}</strong>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {isMobileLayout ? (
          <section className="clean-story clean-priority-story fade-up" id="por-que-escolher" style={{ animationDelay: '0.08s' }}>
            <div className="clean-story-text">
              <p className="eyebrow">Por que escolher</p>
              <h2>Mais clareza para decidir, mais segurança para contratar.</h2>
              <p>
                A plataforma foi feita para ser objetiva: você encontra os melhores profissionais, compara rápido e conversa direto com quem vai fazer a instalação.
              </p>

              <ul>
                {storyPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>

            <div className="clean-story-media">
              <img alt="Instaladores de papel de parede profissionais" src={STORY_IMAGE_URL} />
            </div>
          </section>
        ) : (
          <section className="clean-desktop-why-showcase fade-up" id="por-que-escolher" style={{ animationDelay: '0.08s' }}>
            <div className="clean-desktop-why-copy">
              <p className="clean-desktop-why-eyebrow">POR QUE ESCOLHER</p>

              <h2 className="clean-desktop-why-title">
                <span className="is-light">Mais </span>
                <span className="is-gold">clareza</span>
                <span className="is-light"> para decidir.</span>
                <br />
                <span className="is-light">Mais </span>
                <span className="is-gold">segurança</span>
                <span className="is-light"> para contratar.</span>
              </h2>

              <p className="clean-desktop-why-description">
                Nossa plataforma conecta você aos melhores instaladores de papel de parede da sua região. Compare, converse e contrate sem intermediários.
              </p>

              <span className="clean-desktop-why-rule" />

              <ul className="clean-desktop-why-list">
                {DESKTOP_WHY_POINTS.map((point) => (
                  <li key={point.title}>
                    <span className="clean-desktop-why-icon">
                      <ReferenceHeroIcon name={point.icon} />
                    </span>

                    <div className="clean-desktop-why-list-copy">
                      <strong>{point.title}</strong>
                      <p>{point.copy}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <Link className="clean-desktop-why-cta" to="/cliente">
                <span>ENCONTRAR INSTALADOR</span>
                <span className="clean-desktop-why-cta-arrow">→</span>
              </Link>

              <div className="clean-desktop-why-note">
                <span className="clean-desktop-why-note-icon">
                  <ReferenceHeroIcon name="lock" />
                </span>
                <span>Sua segurança é a nossa prioridade.</span>
              </div>
            </div>

            <div className="clean-desktop-why-media-shell">
              <div className="clean-desktop-why-photo">
                <img alt="Equipe de instaladores de papel de parede" src={STORY_IMAGE_URL} />
              </div>

              <div className="clean-desktop-why-stats">
                {DESKTOP_PLATFORM_METRICS.map((metric, index) => (
                  <article className={`clean-desktop-why-stat${metric.textOnly ? ' is-text-heavy' : ''}`} key={metric.value}>
                    <span className="clean-desktop-why-stat-icon">
                      <ReferenceHeroIcon name={metric.icon} />
                    </span>
                    <strong>{metric.value}</strong>
                    <p>
                      {metric.copyLines.map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </p>
                    {index < DESKTOP_PLATFORM_METRICS.length - 1 ? <span className="clean-desktop-why-stat-divider" /> : null}
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="clean-installers clean-priority-installers fade-up" id="landing-installers" style={{ animationDelay: '0.14s' }}>
          <div className="clean-section-head">
            <p className="eyebrow">Em destaque</p>
            <h2>
              {isMobileLayout
                ? 'Instaladores de papel de parede em destaque'
                : 'Melhores instaladores de papel de parede da plataforma'}
            </h2>
            <p>{isMobileLayout ? 'Perfis com nota, cidade e experiência.' : 'Perfis organizados com nota, cidade, portfólio e contato direto.'}</p>
          </div>

          <div className="clean-installers-grid">
            {topInstallers.length > 0 ? (
              <div className="clean-installers-carousel" {...(isTouchDevice ? installerSwipeHandlers : {})}>
                <div
                  className="clean-installers-track"
                  style={{ transform: `translateX(-${activeInstallerIndex * installerCardWidth}%)` }}
                >
                  {topInstallers.map((installer) => (
                    <article
                      className="clean-installer-slide"
                      key={installer.id}
                      style={{ flex: `0 0 ${installerCardWidth}%` }}
                    >
                      <div className="clean-installer-card">
                        <div className="clean-installer-top">
                          {installer.installer_photo ? (
                            <img
                              alt={`Foto de ${installer.display_name}`}
                              className="clean-installer-avatar"
                              src={installer.installer_photo}
                            />
                          ) : installer.logo ? (
                            <img alt={`Logo de ${installer.display_name}`} className="clean-installer-avatar" src={installer.logo} />
                          ) : (
                            <div className="clean-installer-avatar clean-installer-fallback">{getInitials(installer.display_name)}</div>
                          )}
                          <div>
                            <h3>{installer.display_name}</h3>
                            <p>{[installer.city, installer.state].filter(Boolean).join(' - ') || 'Região não informada'}</p>
                          </div>
                        </div>

                        <div className="clean-installer-rating">
                          <RatingDots value={installer.average_rating} />
                          <span>
                            {formatRating(installer.average_rating)} • {installer.review_count} avaliações
                          </span>
                        </div>

                        {isMobileLayout ? (
                          <p className="clean-installer-mobile-bio">
                            {installer.installation_method || 'Instalação profissional com acabamento limpo e cuidadoso.'}
                          </p>
                        ) : null}

                        <div className="clean-installer-details">
                          <p>
                            <span>Método</span>
                            {installer.installation_method || 'Instalação profissional por ambiente'}
                          </p>
                          <p>
                            <span>Experiência</span>
                            {Number(installer.years_experience || 0) > 0
                              ? `${installer.years_experience} anos`
                              : 'Em atualização'}
                          </p>
                          <p>
                            <span>Atendimento</span>
                            {installer.service_hours || 'Horário informado no perfil completo'}
                          </p>
                          <p>
                            <span>Preço base</span>
                            {formatMoney(installer.base_service_cost)}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {maxInstallerIndex > 0 ? (
                  <div className="clean-installers-dots">
                    {installerSlidePositions.map((index) => (
                      <button
                        aria-label={`Mostrar grupo ${index + 1} de instaladores`}
                        className={index === activeInstallerIndex ? 'is-active' : ''}
                        key={`dot-${index}`}
                        onClick={() => setActiveInstallerIndex(index)}
                        type="button"
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="empty-state !p-4 text-sm">Ainda não há instaladores públicos disponíveis no momento.</div>
            )}
          </div>
        </section>

        <section className="clean-reviews clean-priority-reviews fade-up" id="landing-reviews" style={{ animationDelay: '0.17s' }}>
          <div className="clean-section-head">
            <p className="eyebrow">Avaliações</p>
            <h2>{isMobileLayout ? 'Clientes satisfeitos' : 'Clientes satisfeitos com a experiência'}</h2>
          </div>

          <div className="clean-reviews-grid">
            {reviews.length > 0 ? (
              <div className="clean-reviews-carousel" {...(isTouchDevice ? reviewSwipeHandlers : {})}>
                <div
                  className="clean-reviews-track"
                  style={{ transform: `translateX(-${activeReviewIndex * reviewCardWidth}%)` }}
                >
                  {reviews.map((review) => (
                    <article
                      className="clean-review-slide"
                      key={review.id}
                      style={{ flex: `0 0 ${reviewCardWidth}%` }}
                    >
                      <div className="clean-review-item">
                        <div className="clean-review-head">
                          <div className="clean-review-person">
                            <div className="clean-review-avatar">{getInitials(review.reviewer_name || 'CV')}</div>
                            <div className="clean-review-person-copy">
                              <strong>{review.reviewer_name || 'Cliente verificado'}</strong>
                              <p className="clean-review-meta">
                                {review.installer_name}
                                {review.reviewer_region ? ` • ${review.reviewer_region}` : ''}
                              </p>
                            </div>
                          </div>
                          <span>{review.rating}/5</span>
                        </div>
                        <p className="clean-review-text">{review.comment || 'Atendimento excelente e instalação impecável.'}</p>
                        <p className="clean-review-date">{formatReviewDate(review.created_at)}</p>
                      </div>
                    </article>
                  ))}
                </div>

                {maxReviewIndex > 0 ? (
                  <div className="clean-reviews-dots">
                    {reviewSlidePositions.map((index) => (
                      <button
                        aria-label={`Mostrar grupo ${index + 1} de avaliações`}
                        className={index === activeReviewIndex ? 'is-active' : ''}
                        key={`review-dot-${index}`}
                        onClick={() => setActiveReviewIndex(index)}
                        type="button"
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="empty-state !p-4 text-sm">As avaliações positivas aparecerão aqui automaticamente.</div>
            )}
          </div>
        </section>

        <section className="clean-how clean-priority-how fade-up" id="como-funciona" style={{ animationDelay: '0.2s' }}>
          {howItWorksItems.map((item) => (
            <article key={item.step}>
              <span>{item.step}</span>
              <h4>{item.title}</h4>
              <p>{item.copy}</p>
            </article>
          ))}
        </section>

        {null}
      </div>
    </div>
  );
}
