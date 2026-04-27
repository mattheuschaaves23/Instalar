import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import BrandMark from '../Layout/BrandMark';

const HERO_IMAGE_URL = '/landing/sala-teste-minimalista-luminosa-antes.png';
const AUDIENCE_IMAGE_URL = '/landing/sala-teste-serena-antes.png';

const NAV_ITEMS = [
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'Para clientes', href: '#para-clientes' },
  { label: 'Para instaladores', href: '#para-instaladores' },
  { label: 'Lojas recomendadas', href: '#lojas-recomendadas' },
  { label: 'Blog', href: '#institucional' },
  { label: 'Sobre nós', href: '#sobre-nos' },
  { label: 'Contato', href: '#contato' },
];

const TRUST_ITEMS = [
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
    icon: 'badge',
    title: 'Seguro contratado',
    copy: 'Sua instalação protegida',
  },
];

const HOW_STEPS = [
  {
    icon: 'search',
    title: 'Busque',
    copy: 'Encontre instaladores na sua região',
  },
  {
    icon: 'chat',
    title: 'Compare',
    copy: 'Veja avaliações, preços e portfólios',
  },
  {
    icon: 'calendar',
    title: 'Agende',
    copy: 'Combine dia e hora da instalação',
  },
  {
    icon: 'thumb',
    title: 'Aproveite',
    copy: 'Seu ambiente renovado com qualidade',
  },
];

const FALLBACK_STORES = [
  {
    id: 'leroy-merlin',
    name: 'Leroy Merlin',
    description: 'Diversas marcas e modelos em todo o Brasil.',
    link_url: 'https://www.leroymerlin.com.br/',
    cta_label: 'Visitar loja',
    logo_text: 'LM',
  },
  {
    id: 'novo-ambiente',
    name: 'Novo Ambiente',
    description: 'Papel de parede nacional e importado.',
    link_url: '#',
    cta_label: 'Visitar loja',
    logo_text: 'NA',
  },
  {
    id: 'papel-cia',
    name: 'Papel & Cia',
    description: 'Soluções exclusivas e atendimento especializado.',
    link_url: '#',
    cta_label: 'Visitar loja',
    logo_text: 'P&C',
  },
  {
    id: 'casa-do-papel',
    name: 'Casa do Papel',
    description: 'Variedade e qualidade com ótimo preço.',
    link_url: '#',
    cta_label: 'Visitar loja',
    logo_text: 'CP',
  },
];

const FALLBACK_TESTIMONIALS = [
  {
    id: 'review-1',
    reviewer_name: 'Juliana M.',
    reviewer_region: 'São Paulo, SP',
    comment: 'Encontrei um profissional incrível! O trabalho foi impecável e o atendimento excelente.',
    rating: 5,
  },
  {
    id: 'review-2',
    reviewer_name: 'Carlos A.',
    reviewer_region: 'Curitiba, PR',
    comment: 'Plataforma muito fácil de usar. Consegui comparar preços e escolher o melhor para meu projeto.',
    rating: 5,
  },
  {
    id: 'review-3',
    reviewer_name: 'Fernanda L.',
    reviewer_region: 'Belo Horizonte, MG',
    comment: 'Meu quarto ganhou vida nova! Instalação rápida, limpa e com acabamento perfeito.',
    rating: 5,
  },
];

function getInitials(name) {
  return (name || 'PP')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatLocation(installer) {
  const location = [installer.city, installer.state].filter(Boolean).join(', ');
  return location || 'Brasil';
}

function formatInstallerName(installer, index) {
  return (
    installer.display_name ||
    installer.business_name ||
    installer.name ||
    installer.full_name ||
    `Instalador ${index + 1}`
  );
}

function LandingIcon({ name, className = '' }) {
  switch (name) {
    case 'menu':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
        </svg>
      );
    case 'location':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <path
            d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <circle cx="12" cy="10" fill="currentColor" r="2.2" />
        </svg>
      );
    case 'shield':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <path
            d="M12 3 5 6v5.3c0 4.4 3 8.5 7 9.7 4-1.2 7-5.3 7-9.7V6l-7-3Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case 'star':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <path
            d="m12 3 2.8 5.7 6.2.9-4.5 4.3 1.1 6.1L12 17.2 6.4 20l1.1-6.1L3 9.6l6.2-.9L12 3Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case 'badge':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <path
            d="M12 3 6.5 5.5v6c0 3.6 2.2 7 5.5 8.5 3.3-1.5 5.5-4.9 5.5-8.5v-6L12 3Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <path d="m9.5 12 1.7 1.7 3.4-3.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      );
    case 'search':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      );
    case 'chat':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <path
            d="M6 18.5 3.5 21V6.5A2.5 2.5 0 0 1 6 4h12A2.5 2.5 0 0 1 20.5 6.5v8A2.5 2.5 0 0 1 18 17H6Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <path d="M8 9.5h8M8 13h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      );
    case 'calendar':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <rect height="15" rx="2.8" stroke="currentColor" strokeWidth="1.8" width="17" x="3.5" y="5.5" />
          <path d="M7.5 3.5v4M16.5 3.5v4M3.5 9.5h17M9 13l1.5 1.5L15 10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      );
    case 'thumb':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <path
            d="M9 10V6.5A2.5 2.5 0 0 1 11.5 4H12l1.3 5h5.2A1.5 1.5 0 0 1 20 10.7l-1 6.1A2.5 2.5 0 0 1 16.5 19H9"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <path d="M5 9h4v10H5z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      );
    case 'user':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5 19a7 7 0 0 1 14 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      );
    case 'installer':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <path d="M6.5 19V9.5L12 5l5.5 4.5V19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M9 19v-4.5h6V19M4 10.5h16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      );
    case 'people':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <circle cx="8" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="16.5" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3.5 19a5 5 0 0 1 9 0M13.5 18a4.2 4.2 0 0 1 7 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      );
    case 'check':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="m8.8 12.1 2.2 2.2 4.3-4.3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      );
    case 'pin':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <path
            d="M12 20.5s5.5-4.8 5.5-10a5.5 5.5 0 1 0-11 0c0 5.2 5.5 10 5.5 10Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <circle cx="12" cy="10.5" fill="currentColor" r="2" />
        </svg>
      );
    case 'newsletter':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <rect height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="5" />
          <path d="m4.5 7.5 7.5 6 7.5-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      );
    case 'arrow':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <path d="M6 12h12M13 6l6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      );
    case 'instagram':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <rect height="16" rx="4" stroke="currentColor" strokeWidth="1.8" width="16" x="4" y="4" />
          <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="17.2" cy="6.8" fill="currentColor" r="1" />
        </svg>
      );
    case 'facebook':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <path d="M13.5 20v-7h2.8l.4-3h-3.2V8.2c0-.9.3-1.5 1.6-1.5h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.4V10H7.5v3h2.6v7h3.4Z" fill="currentColor" />
        </svg>
      );
    case 'youtube':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <path d="M20.5 8.2c-.2-1.2-1.1-2.1-2.3-2.3C16.6 5.5 12 5.5 12 5.5s-4.6 0-6.2.4c-1.2.2-2.1 1.1-2.3 2.3C3 9.8 3 12 3 12s0 2.2.5 3.8c.2 1.2 1.1 2.1 2.3 2.3 1.6.4 6.2.4 6.2.4s4.6 0 6.2-.4c1.2-.2 2.1-1.1 2.3-2.3.5-1.6.5-3.8.5-3.8s0-2.2-.5-3.8Z" stroke="currentColor" strokeWidth="1.6" />
          <path d="m10 15 5-3-5-3v6Z" fill="currentColor" />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <path d="M20 12a8 8 0 0 1-11.8 7l-4.2 1 1.1-4A8 8 0 1 1 20 12Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M9.4 8.9c.2-.4.5-.4.7-.4h.6c.2 0 .4 0 .6.4.2.4.7 1.6.8 1.7.1.2.1.4 0 .6-.1.2-.2.4-.4.5l-.4.4c-.1.1-.2.3-.1.5.1.2.6 1 1.2 1.5.8.8 1.5 1 1.7 1.1.2.1.4 0 .5-.1l.6-.8c.1-.2.3-.2.5-.2s1.4.7 1.7.8c.3.1.5.2.6.4.1.2.1 1-.2 1.6-.3.6-1.6 1-2.2 1-.6 0-1.3 0-3-.8-1.7-.8-2.9-2.8-3-3-.1-.2-1.2-1.6-1.2-3.1 0-1.5.8-2.2 1.1-2.5Z" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}

function RatingStars({ rating, compact = false }) {
  const active = Math.max(1, Math.round(Number(rating || 0)));

  return (
    <div className={`showcase-landing-stars ${compact ? 'is-compact' : ''}`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span className={index < active ? 'is-on' : ''} key={index}>
          ★
        </span>
      ))}
    </div>
  );
}

export default function ClientLanding() {
  const navigate = useNavigate();
  const [installers, setInstallers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [recommendedStores, setRecommendedStores] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [isMobileLayout, setIsMobileLayout] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.innerWidth <= 860;
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);

  useEffect(() => {
    let mounted = true;

    const loadLandingData = async () => {
      try {
        const response = await api.get('/public/installers');
        if (!mounted) {
          return;
        }

        setInstallers(response.data?.installers || []);
        setReviews((response.data?.reviews || []).filter((review) => Number(review.rating || 0) >= 4));
        setRecommendedStores(response.data?.recommended_stores || []);
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
      const mobile = window.innerWidth <= 860;
      setIsMobileLayout(mobile);
      if (!mobile) {
        setIsMenuOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const topInstallers = useMemo(() => {
    return [...installers]
      .sort((a, b) => {
        const featuredDiff = Number(Boolean(b.featured_installer)) - Number(Boolean(a.featured_installer));
        if (featuredDiff !== 0) {
          return featuredDiff;
        }

        const ratingDiff = Number(b.average_rating || 0) - Number(a.average_rating || 0);
        if (ratingDiff !== 0) {
          return ratingDiff;
        }

        const reviewCountDiff = Number(b.review_count || 0) - Number(a.review_count || 0);
        if (reviewCountDiff !== 0) {
          return reviewCountDiff;
        }

        return Number(b.completed_jobs || b.approved_jobs || 0) - Number(a.completed_jobs || a.approved_jobs || 0);
      })
      .slice(0, 8);
  }, [installers]);

  const installerCards = useMemo(() => {
    return topInstallers.slice(0, 6).map((installer, index) => ({
      id: installer.id || `installer-${index}`,
      name: formatInstallerName(installer, index),
      location: formatLocation(installer),
      rating: Number(installer.average_rating || 4.9),
      reviewCount: Number(installer.review_count || 0),
      description:
        installer.installation_method ||
        installer.bio ||
        installer.short_bio ||
        (index === 0
          ? 'Especialista em papéis importados e texturizados.'
          : index === 1
            ? 'Especialista em papéis vinílicos e laváveis.'
            : 'Especialista em papéis personalizados.'),
      image: installer.installer_photo || installer.logo || null,
      profileLink: installer.id ? `/installers/${installer.id}` : '/cliente',
    }));
  }, [topInstallers]);

  const activeStores = useMemo(() => {
    const filteredStores = recommendedStores.filter((store) => Boolean(store?.is_active));
    if (filteredStores.length === 0) {
      return FALLBACK_STORES;
    }

    const normalized = filteredStores.slice(0, 4).map((store, index) => ({
      id: store.id || `store-${index}`,
      name: store.name || `Loja ${index + 1}`,
      description: store.description || 'Loja recomendada pela plataforma para compra de papel de parede.',
      link_url: store.link_url || '#',
      cta_label: store.cta_label || 'Visitar loja',
      image_url: store.image_url || '',
      logo_text: getInitials(store.name || `Loja ${index + 1}`),
    }));

    if (normalized.length >= 4) {
      return normalized;
    }

    return [...normalized, ...FALLBACK_STORES.slice(normalized.length)];
  }, [recommendedStores]);

  const testimonialCards = useMemo(() => {
    const normalized = reviews.slice(0, 4).map((review, index) => ({
      id: review.id || `review-${index}`,
      reviewer_name: review.reviewer_name || `Cliente ${index + 1}`,
      reviewer_region: review.reviewer_region || 'Brasil',
      comment: review.comment || 'Atendimento excelente e instalação impecável.',
      rating: Number(review.rating || 5),
    }));

    return normalized.length > 0 ? normalized : FALLBACK_TESTIMONIALS;
  }, [reviews]);

  useEffect(() => {
    if (activeReviewIndex > testimonialCards.length - 1) {
      setActiveReviewIndex(0);
    }
  }, [testimonialCards.length, activeReviewIndex]);

  const heroScore = useMemo(() => {
    const ratings = testimonialCards.map((review) => Number(review.rating || 0)).filter((rating) => rating > 0);
    if (ratings.length === 0) {
      return '4,9';
    }

    const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    return average.toFixed(1).replace('.', ',');
  }, [testimonialCards]);

  const heroAvatars = installerCards.slice(0, 4);

  const platformStats = [
    {
      icon: 'people',
      value: installers.length > 24 ? `+${installers.length.toLocaleString('pt-BR')}` : '+8.000',
      label: 'Instaladores cadastrados',
    },
    {
      icon: 'check',
      value:
        installers.reduce((sum, installer) => sum + Number(installer.completed_jobs || installer.approved_jobs || 0), 0) > 200
          ? `+${installers
              .reduce((sum, installer) => sum + Number(installer.completed_jobs || installer.approved_jobs || 0), 0)
              .toLocaleString('pt-BR')}`
          : '+35.000',
      label: 'Instalações realizadas',
    },
    {
      icon: 'star',
      value: `${heroScore} / 5`,
      label: 'Avaliação média dos clientes',
    },
    {
      icon: 'pin',
      value: 'Todos os estados',
      label: 'Presença em todo o Brasil',
    },
  ];

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const query = searchValue.trim();
    navigate(query ? `/cliente?q=${encodeURIComponent(query)}` : '/cliente');
  };

  const currentMobileReview = testimonialCards[activeReviewIndex] || testimonialCards[0];

  return (
    <div className="auth-scene min-h-screen overflow-x-hidden">
      <div className="showcase-landing-shell">
        <header className="showcase-landing-topbar fade-up">
          <Link className="showcase-landing-brand" to="/">
            <BrandMark className="client-brand-mark" />
            <div className="showcase-landing-brand-copy">
              <strong>Papel na Parede</strong>
              <p>Conectando clientes aos melhores instaladores do Brasil</p>
            </div>
          </Link>

          {!isMobileLayout ? (
            <nav className="showcase-landing-nav" aria-label="Navegação principal">
              {NAV_ITEMS.map((item) => (
                <a className="showcase-landing-nav-link" href={item.href} key={item.label}>
                  {item.label}
                </a>
              ))}
            </nav>
          ) : null}

          <div className="showcase-landing-actions">
            {!isMobileLayout ? (
              <>
                <Link className="ghost-button" to="/instalador/entrar">
                  Entrar
                </Link>
                <Link className="gold-button" to="/instalador/cadastro">
                  Cadastre-se
                </Link>
              </>
            ) : (
              <button
                aria-expanded={isMenuOpen}
                aria-label="Abrir menu"
                className="showcase-landing-menu-toggle"
                onClick={() => setIsMenuOpen((current) => !current)}
                type="button"
              >
                <LandingIcon className="showcase-landing-menu-icon" name="menu" />
              </button>
            )}
          </div>
        </header>

        {isMobileLayout && isMenuOpen ? (
          <div className="showcase-landing-mobile-drawer fade-up">
            <nav className="showcase-landing-mobile-nav" aria-label="Navegação mobile">
              {NAV_ITEMS.map((item) => (
                <a
                  className="showcase-landing-mobile-link"
                  href={item.href}
                  key={item.label}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="showcase-landing-mobile-actions">
              <Link className="ghost-button" onClick={() => setIsMenuOpen(false)} to="/instalador/entrar">
                Entrar
              </Link>
              <Link className="gold-button" onClick={() => setIsMenuOpen(false)} to="/instalador/cadastro">
                Cadastre-se
              </Link>
            </div>
          </div>
        ) : null}

        <main className="showcase-landing-main">
          <section className="showcase-landing-hero fade-up" style={{ animationDelay: '0.04s' }}>
            <div className="showcase-landing-hero-grid">
              <div className="showcase-landing-hero-copy">
                <div className="showcase-landing-badge">
                  <LandingIcon className="showcase-landing-badge-icon" name="star" />
                  <span>A plataforma Nº1 de instalação de papel de parede no Brasil</span>
                </div>

                <h1>
                  Encontre os melhores instaladores de <span>papel de parede</span> no Brasil
                </h1>

                <p className="showcase-landing-hero-description">
                  Conectamos você a profissionais qualificados para transformar seus ambientes com perfeição e segurança.
                </p>

                <form className="showcase-landing-search" onSubmit={handleSearchSubmit}>
                  <label className="showcase-landing-search-field">
                    <LandingIcon className="showcase-landing-search-icon" name="location" />
                    <input
                      onChange={(event) => setSearchValue(event.target.value)}
                      placeholder="Digite sua cidade ou CEP"
                      type="text"
                      value={searchValue}
                    />
                  </label>
                  <button className="gold-button" type="submit">
                    Buscar instaladores
                  </button>
                </form>
              </div>

              <div className="showcase-landing-hero-visual">
                <img alt="Sala com papel de parede e decoração elegante" src={HERO_IMAGE_URL} />
                <div className="showcase-landing-floating-card">
                  <strong>Mais de 5.000 instalações</strong>
                  <span>realizadas com sucesso</span>
                  <div className="showcase-landing-floating-avatars">
                    <div className="showcase-landing-avatar-list">
                      {heroAvatars.map((installer) =>
                        installer.image ? (
                          <img alt={installer.name} key={installer.id} src={installer.image} />
                        ) : (
                          <div key={installer.id}>{getInitials(installer.name)}</div>
                        )
                      )}
                    </div>
                    <div className="showcase-landing-floating-rating">
                      <RatingStars compact rating={heroScore} />
                      <strong>{heroScore}/5</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="showcase-landing-proof-grid">
              {TRUST_ITEMS.map((item) => (
                <article className="showcase-landing-proof-card" key={item.title}>
                  <div className="showcase-landing-proof-icon">
                    <LandingIcon className="showcase-landing-proof-icon-svg" name={item.icon} />
                  </div>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.copy}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="showcase-landing-section fade-up" id="como-funciona" style={{ animationDelay: '0.08s' }}>
            <div className="showcase-landing-section-head showcase-landing-section-head-centered">
              <h2>Como funciona</h2>
              <div className="showcase-landing-divider" />
            </div>

            <div className="showcase-landing-steps">
              {HOW_STEPS.map((step, index) => (
                <div className="showcase-landing-step-wrap" key={step.title}>
                  <article className="showcase-landing-step-card">
                    <div className="showcase-landing-step-badge">
                      <LandingIcon className="showcase-landing-step-icon" name={step.icon} />
                    </div>
                    <h3>
                      {index + 1}. {step.title}
                    </h3>
                    <p>{step.copy}</p>
                  </article>
                  {index < HOW_STEPS.length - 1 ? (
                    <div aria-hidden="true" className="showcase-landing-step-arrow">
                      <LandingIcon className="showcase-landing-step-arrow-icon" name="arrow" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="showcase-landing-combo fade-up" style={{ animationDelay: '0.12s' }}>
            <div className="showcase-landing-combo-media">
              <img alt="Ambiente acolhedor com poltrona e papel de parede" src={AUDIENCE_IMAGE_URL} />
            </div>

            <div className="showcase-landing-combo-panels">
              <article className="showcase-landing-audience-card showcase-landing-audience-card-slim" id="para-clientes">
                <div className="showcase-landing-audience-copy">
                  <div className="showcase-landing-section-mini">
                    <LandingIcon className="showcase-landing-section-mini-icon" name="user" />
                    <h3>Para clientes</h3>
                  </div>
                  <p>
                    Encontre profissionais de confiança e tenha a melhor experiência na instalação do seu papel de parede.
                  </p>
                  <Link className="gold-button" to="/cliente">
                    Sou cliente
                  </Link>
                </div>
              </article>

              <article className="showcase-landing-audience-card showcase-landing-audience-card-slim" id="para-instaladores">
                <div className="showcase-landing-audience-copy">
                  <div className="showcase-landing-section-mini">
                    <LandingIcon className="showcase-landing-section-mini-icon" name="installer" />
                    <h3>Para instaladores</h3>
                  </div>
                  <p>
                    Cadastre-se e receba mais pedidos de instalação. Gerencie sua agenda, orçamentos e clientes em um só lugar.
                  </p>
                  <Link className="ghost-button" to="/instalador/cadastro">
                    Sou instalador
                  </Link>
                </div>
              </article>
            </div>

            <div className="showcase-landing-metrics">
              {platformStats.map((item) => (
                <article key={item.label}>
                  <div className="showcase-landing-metric-icon">
                    <LandingIcon className="showcase-landing-metric-icon-svg" name={item.icon} />
                  </div>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="showcase-landing-market fade-up" style={{ animationDelay: '0.16s' }}>
            <div className="showcase-landing-market-column" id="instaladores-destaque">
              <div className="showcase-landing-inline-head">
                <h2>Instaladores em destaque</h2>
                <Link to="/cliente">Ver todos</Link>
              </div>

              <div className="showcase-landing-installer-scroller">
                <div className="showcase-landing-installers">
                  {installerCards.map((installer) => (
                    <article className="showcase-landing-installer-card" key={installer.id}>
                      <div className="showcase-landing-installer-top">
                        {installer.image ? (
                          <img
                            alt={`Foto de ${installer.name}`}
                            className="showcase-landing-installer-avatar"
                            src={installer.image}
                          />
                        ) : (
                          <div className="showcase-landing-installer-avatar showcase-landing-installer-fallback">
                            {getInitials(installer.name)}
                          </div>
                        )}
                        <div>
                          <h3>{installer.name}</h3>
                          <p>{installer.location}</p>
                        </div>
                      </div>

                      <div className="showcase-landing-installer-rating">
                        <RatingStars rating={installer.rating} />
                        <span>
                          {installer.rating.toFixed(1).replace('.', ',')}
                          {installer.reviewCount > 0 ? ` (${installer.reviewCount})` : ''}
                        </span>
                      </div>

                      <p className="showcase-landing-installer-copy">{installer.description}</p>

                      <Link className="ghost-button" to={installer.profileLink}>
                        Ver perfil
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            </div>

            <div className="showcase-landing-market-column" id="lojas-recomendadas">
              <div className="showcase-landing-inline-head">
                <h2>Lojas recomendadas</h2>
                <a href="#footer-newsletter">Ver todas</a>
              </div>

              <div className="showcase-landing-store-grid">
                {activeStores.map((store) => (
                  <article className="showcase-landing-store-card" key={store.id}>
                    <div className="showcase-landing-store-logo">
                      {store.image_url ? (
                        <img alt={store.name} src={store.image_url} />
                      ) : (
                        <span>{store.logo_text}</span>
                      )}
                    </div>
                    <h3>{store.name}</h3>
                    <p>{store.description}</p>
                    <a href={store.link_url} rel="noopener noreferrer" target="_blank">
                      {store.cta_label}
                    </a>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="showcase-landing-section fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="showcase-landing-section-head showcase-landing-section-head-centered">
              <h2>O que nossos clientes dizem</h2>
              <div className="showcase-landing-divider" />
            </div>

            {!isMobileLayout ? (
              <div className="showcase-landing-reviews">
                {testimonialCards.slice(0, 3).map((review) => (
                  <article className="showcase-landing-review-card" key={review.id}>
                    <div className="showcase-landing-review-person">
                      <div className="showcase-landing-review-avatar">{getInitials(review.reviewer_name)}</div>
                      <div>
                        <strong>{review.reviewer_name}</strong>
                        <p>{review.reviewer_region}</p>
                      </div>
                    </div>
                    <RatingStars rating={review.rating} />
                    <p className="showcase-landing-review-text">"{review.comment}"</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="showcase-landing-review-single">
                <article className="showcase-landing-review-card">
                  <div className="showcase-landing-review-person">
                    <div className="showcase-landing-review-avatar">{getInitials(currentMobileReview.reviewer_name)}</div>
                    <div>
                      <strong>{currentMobileReview.reviewer_name}</strong>
                      <p>{currentMobileReview.reviewer_region}</p>
                    </div>
                  </div>
                  <RatingStars rating={currentMobileReview.rating} />
                  <p className="showcase-landing-review-text">"{currentMobileReview.comment}"</p>
                </article>

                <div className="showcase-landing-review-dots">
                  {testimonialCards.map((review, index) => (
                    <button
                      aria-label={`Mostrar depoimento ${index + 1}`}
                      className={index === activeReviewIndex ? 'is-active' : ''}
                      key={review.id}
                      onClick={() => setActiveReviewIndex(index)}
                      type="button"
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="showcase-landing-cta fade-up" style={{ animationDelay: '0.24s' }}>
            <div className="showcase-landing-cta-copy">
              <div className="showcase-landing-cta-icon">
                <LandingIcon className="showcase-landing-cta-icon-svg" name="calendar" />
              </div>
              <div>
                <h2>Transforme seus ambientes hoje mesmo</h2>
                <p>Encontre o instalador ideal para o seu projeto.</p>
              </div>
            </div>

            <div className="showcase-landing-cta-actions">
              <Link className="gold-button" to="/cliente">
                Buscar instaladores
              </Link>
            </div>
          </section>
        </main>

        <footer className="showcase-landing-footer fade-up" id="institucional" style={{ animationDelay: '0.28s' }}>
          <div className="showcase-landing-footer-top">
            <div className="showcase-landing-footer-brand" id="sobre-nos">
              <div className="showcase-landing-footer-logo">
                <BrandMark className="client-brand-mark" />
                <strong>Papel na Parede</strong>
              </div>
              <p>Conectando clientes aos melhores instaladores de papel de parede em todo o Brasil.</p>
              <div className="showcase-landing-socials">
                <a aria-label="Instagram" href="https://instagram.com" rel="noopener noreferrer" target="_blank">
                  <LandingIcon className="showcase-landing-social-icon" name="instagram" />
                </a>
                <a aria-label="Facebook" href="https://facebook.com" rel="noopener noreferrer" target="_blank">
                  <LandingIcon className="showcase-landing-social-icon" name="facebook" />
                </a>
                <a aria-label="YouTube" href="https://youtube.com" rel="noopener noreferrer" target="_blank">
                  <LandingIcon className="showcase-landing-social-icon" name="youtube" />
                </a>
                <a aria-label="WhatsApp" href="https://wa.me/5548999816000" rel="noopener noreferrer" target="_blank">
                  <LandingIcon className="showcase-landing-social-icon" name="whatsapp" />
                </a>
              </div>
            </div>

            <div className="showcase-landing-footer-columns">
              <div>
                <strong>Para clientes</strong>
                <Link to="/cliente">Buscar instaladores</Link>
                <a href="#como-funciona">Como funciona</a>
                <a href="#lojas-recomendadas">Lojas recomendadas</a>
                <a href="#footer-faq">Perguntas frequentes</a>
              </div>
              <div>
                <strong>Para instaladores</strong>
                <Link to="/instalador/cadastro">Cadastre-se</Link>
                <a href="#para-instaladores">Vantagens</a>
                <a href="#como-funciona">Como funciona</a>
                <a href="#contato">Central de ajuda</a>
              </div>
              <div id="contato">
                <strong>Institucional</strong>
                <a href="#sobre-nos">Sobre nós</a>
                <a href="#institucional">Blog</a>
                <a href="mailto:contato@papelnaparede.com.br">Contato</a>
                <a href="#termos">Termos de uso</a>
                <a href="#privacidade">Política de privacidade</a>
              </div>
            </div>
          </div>

          <form
            className="showcase-landing-newsletter"
            id="footer-newsletter"
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="showcase-landing-newsletter-copy">
              <div className="showcase-landing-section-mini">
                <LandingIcon className="showcase-landing-section-mini-icon" name="newsletter" />
                <strong>Receba novidades</strong>
              </div>
              <p>Fique por dentro de dicas, novidades e ofertas.</p>
            </div>
            <div className="showcase-landing-newsletter-form">
              <input placeholder="Seu melhor e-mail" type="email" />
              <button className="gold-button" type="submit">
                Enviar
              </button>
            </div>
          </form>

          <small>© 2024 Papel na Parede. Todos os direitos reservados.</small>
        </footer>
      </div>
    </div>
  );
}
