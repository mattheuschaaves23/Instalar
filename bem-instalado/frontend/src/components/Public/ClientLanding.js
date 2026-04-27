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

const MOBILE_TRUST_ITEMS = [
  'Especialistas em todo o Brasil',
  'Busca rápida e prática',
  'Mais segurança na escolha',
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

function getInitials(name) {
  return (name || 'IL')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
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
    return 3;
  }

  if (window.innerWidth <= 680) {
    return 1;
  }

  if (window.innerWidth <= 1080) {
    return 2;
  }

  return 3;
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
  const visibleMobileTrustItems = MOBILE_TRUST_ITEMS.slice(0, 3);

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
        <header className="clean-landing-topbar fade-up">
          <div className="clean-landing-brand">
            <BrandMark className="client-brand-mark" />
            <div>
              <BrandWordmark className="client-topbar-wordmark" size="lg" />
              <p>Encontre instaladores de papel de parede perto de você.</p>
            </div>
          </div>

          <div className="clean-landing-top-actions">
            <Link className="ghost-button" to="/instalador/entrar">
              Login instalador
            </Link>
            <Link className="clean-link-action" to="/instalador/cadastro">
              Criar conta
            </Link>
          </div>
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
            <p className="eyebrow">Para clientes</p>
            <h1 className="clean-hero-title">
              {isMobileLayout ? (
                <>
                  Encontre <span className="gold-keyword">instaladores</span> de{' '}
                  <span className="hero-white-keyword">papel de parede</span> com mais <span className="gold-keyword">segurança</span>.
                </>
              ) : (
                <>
                  Encontre <span className="gold-keyword">instaladores</span> de{' '}
                  <span className="gold-keyword">papel de parede</span> com mais <span className="gold-keyword">segurança</span>.
                </>
              )}
            </h1>
            <p className="clean-hero-description">
              {isMobileLayout ? (
                <>
                  Encontre <span className="gold-keyword">instaladores especializados</span>, compare avaliações e fale direto no{' '}
                  <span className="gold-keyword">WhatsApp</span>.
                </>
              ) : (
                <>
                  Compare <span className="gold-keyword">avaliações reais</span>, veja <span className="gold-keyword">portfólios</span> e fale direto no{' '}
                  <span className="gold-keyword">WhatsApp</span> sem perder tempo procurando.
                </>
              )}
            </p>

            <ul className="clean-hero-topics">
              {heroMiniTopics.map((topic, index) => (
                <li className="clean-hero-topic-item" key={topic} style={{ animationDelay: `${0.14 + index * 0.08}s` }}>
                  {topic}
                </li>
              ))}
            </ul>

            <div className="clean-hero-actions">
              <Link className="gold-button clean-cta-main" to="/cliente">
                {isMobileLayout ? 'Encontrar instalador agora' : 'Encontrar instaladores agora'}
              </Link>
            </div>
          </div>
        </section>

        <section className="clean-mobile-trust clean-priority-trust fade-up" style={{ animationDelay: '0.06s' }}>
          {visibleMobileTrustItems.map((item) => (
            <article className="clean-mobile-trust-item" key={item}>
              <span />
              <strong>{item}</strong>
            </article>
          ))}
        </section>

        <section className="clean-stores clean-priority-stores fade-up" style={{ animationDelay: '0.07s' }}>
          <div className="clean-section-head">
            <p className="eyebrow">Lojas recomendadas</p>
            <h2>{isMobileLayout ? 'Lojas para comprar com segurança' : 'Onde comprar com segurança para sua instalação'}</h2>
            <p>
              {isMobileLayout
                ? 'Opções recomendadas pela plataforma.'
                : 'Seleção atualizada pelo administrador da plataforma com as melhores opções do momento.'}
            </p>
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

        <section className="clean-story clean-priority-story fade-up" style={{ animationDelay: '0.08s' }}>
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
                            {Number(installer.average_rating || 0).toFixed(1)} • {installer.review_count} avaliações
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

        <section className="clean-how clean-priority-how fade-up" style={{ animationDelay: '0.2s' }}>
          {howItWorksItems.map((item) => (
            <article key={item.step}>
              <span>{item.step}</span>
              <h4>{item.title}</h4>
              <p>{item.copy}</p>
            </article>
          ))}
        </section>

        {isMobileLayout ? (
          <div className="clean-mobile-sticky-cta">
            <Link className="gold-button clean-mobile-sticky-button" to="/cliente">
              Encontrar instaladores
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
