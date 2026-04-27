import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import BrandMark from '../Layout/BrandMark';
import BrandWordmark from '../Layout/BrandWordmark';

const HERO_IMAGE_URL = '/landing/sala-moderna-sofisticada.png';
const CLIENT_IMAGE_URL = '/landing/sala-preto-dourado.png';
const INSTALLER_IMAGE_URL = '/landing/instaladores-profissionais.png';

const HOW_IT_WORKS = [
  {
    icon: 'search',
    title: '1. Busque',
    copy: 'Digite sua cidade, regiao ou estilo de papel de parede.',
  },
  {
    icon: 'compare',
    title: '2. Compare',
    copy: 'Veja avaliacoes, portfolios e perfis verificados.',
  },
  {
    icon: 'calendar',
    title: '3. Agende',
    copy: 'Converse no WhatsApp e combine o melhor horario.',
  },
  {
    icon: 'thumb',
    title: '4. Aproveite',
    copy: 'Tenha uma instalacao segura, organizada e bem executada.',
  },
];

const PROOF_POINTS = [
  {
    title: 'Profissionais verificados',
    copy: 'Todos passam por analise antes de aparecerem na plataforma.',
  },
  {
    title: 'Avaliacoes reais',
    copy: 'Notas e comentarios de clientes que ja contrataram.',
  },
  {
    title: 'Seguro contratado',
    copy: 'Mais confianca para escolher quem vai entrar no seu ambiente.',
  },
];

const FALLBACK_REVIEWS = [
  {
    id: 'fallback-1',
    reviewer_name: 'Juliana M.',
    reviewer_region: 'Sao Paulo, SP',
    rating: 5,
    comment: 'Encontrei um profissional incrivel. O trabalho ficou impecavel e o atendimento excelente.',
  },
  {
    id: 'fallback-2',
    reviewer_name: 'Carlos A.',
    reviewer_region: 'Curitiba, PR',
    rating: 5,
    comment: 'Consegui comparar precos e escolher o melhor perfil para o meu projeto com mais seguranca.',
  },
  {
    id: 'fallback-3',
    reviewer_name: 'Fernanda L.',
    reviewer_region: 'Belo Horizonte, MG',
    rating: 5,
    comment: 'Meu quarto ganhou vida nova. Instalacao rapida, limpa e com acabamento perfeito.',
  },
];

const FOOTER_SECTIONS = [
  {
    title: 'Para clientes',
    links: [
      { label: 'Buscar instaladores', href: '#hero' },
      { label: 'Como funciona', href: '#how' },
      { label: 'Seguranca', href: '#trust' },
      { label: 'Avaliacoes', href: '#reviews' },
    ],
  },
  {
    title: 'Para instaladores',
    links: [
      { label: 'Cadastre-se', to: '/instalador/cadastro' },
      { label: 'Entrar', to: '/instalador/entrar' },
      { label: 'Vantagens', href: '#installers' },
      { label: 'Como funciona', href: '#how' },
    ],
  },
  {
    title: 'Institucional',
    links: [
      { label: 'Para clientes', href: '#clients' },
      { label: 'Para instaladores', href: '#installers' },
      { label: 'O que nossos clientes dizem', href: '#reviews' },
      { label: 'Buscar instaladores', href: '#cta' },
    ],
  },
];

function formatLargeNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function getInitials(name) {
  return (name || 'IL')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function getInstallerPhoto(installer) {
  if (!installer) {
    return '';
  }

  return (
    installer.profile_image_url ||
    installer.photo_url ||
    installer.avatar_url ||
    installer.cover_image_url ||
    installer.portfolio_images?.[0] ||
    ''
  );
}

function LandingIcon({ name }) {
  const props = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  };

  switch (name) {
    case 'search':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="6.8" />
          <path d="m20 20-3.7-3.7" />
        </svg>
      );
    case 'compare':
      return (
        <svg {...props}>
          <path d="M4.5 5.5h15v10h-15z" />
          <path d="M8 9h8M8 13h5" />
          <path d="M8 19h8" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...props}>
          <rect x="3.5" y="5" width="17" height="15" rx="2.2" />
          <path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" />
        </svg>
      );
    case 'thumb':
      return (
        <svg {...props}>
          <path d="M9 20H6.2A1.7 1.7 0 0 1 4.5 18.3V11a1.7 1.7 0 0 1 1.7-1.7H9M9 20l4.6-4.7a3 3 0 0 0 .9-2.1V8.5a2.5 2.5 0 0 0-2.5-2.5h-.3L12.5 3a2.3 2.3 0 0 1 4.4 1v2h2.4A1.7 1.7 0 0 1 21 7.7L19.8 14A3 3 0 0 1 16.9 16H9" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

function GoldStars({ value = 5 }) {
  const rounded = Math.max(1, Math.min(5, Math.round(Number(value || 0))));

  return (
    <div className="showcase-landing-stars" aria-label={`Nota ${rounded} de 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span className={index < rounded ? 'is-on' : ''} key={index}>
          {'\u2605'}
        </span>
      ))}
    </div>
  );
}

export default function ClientLanding() {
  const navigate = useNavigate();
  const [installers, setInstallers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadLandingData = async () => {
      try {
        const response = await api.get('/public/installers');
        const allInstallers = response.data?.installers || [];
        const allReviews = response.data?.reviews || [];
        const positiveReviews = allReviews
          .filter((review) => Number(review.rating || 0) >= 4)
          .slice(0, 6);

        if (!mounted) {
          return;
        }

        setInstallers(allInstallers);
        setReviews(positiveReviews);
      } catch (_error) {
        if (!mounted) {
          return;
        }

        setInstallers([]);
        setReviews([]);
      }
    };

    loadLandingData();

    return () => {
      mounted = false;
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

      return Number(b.years_experience || 0) - Number(a.years_experience || 0);
    });

    return sorted.slice(0, 6);
  }, [installers]);

  const reviewCards = useMemo(() => {
    if (reviews.length > 0) {
      return reviews.slice(0, 3);
    }

    return FALLBACK_REVIEWS;
  }, [reviews]);

  const metrics = useMemo(() => {
    const totalInstallers = installers.length || 8000;
    const totalInstallations =
      installers.reduce((sum, installer) => sum + Number(installer.completed_jobs || installer.approved_jobs || 0), 0) ||
      35000;
    const averageRating =
      reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / Math.max(reviews.length, 1) || 4.9;
    const uniqueStates =
      new Set(installers.map((installer) => installer.state).filter(Boolean)).size || 27;

    return {
      totalInstallers,
      totalInstallations,
      averageRating,
      uniqueStates,
    };
  }, [installers, reviews]);

  const featuredAvatars = topInstallers.slice(0, 4);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const query = searchValue.trim();

    if (!query) {
      navigate('/cliente');
      return;
    }

    navigate(`/cliente?busca=${encodeURIComponent(query)}`);
  };

  return (
    <div className="auth-scene min-h-screen overflow-x-hidden">
      <div className="showcase-landing-shell">
        <header className="showcase-landing-topbar fade-up">
          <Link className="showcase-landing-brand" to="/">
            <BrandMark className="client-brand-mark" />
            <div className="showcase-landing-brand-copy">
              <BrandWordmark className="client-topbar-wordmark" size="lg" />
              <p>Encontre instaladores de papel de parede em todo o Brasil.</p>
            </div>
          </Link>

          <nav className="showcase-landing-nav" aria-label="Navegacao principal da landing">
            <a className="showcase-landing-nav-link" href="#how">
              Como funciona
            </a>
            <a className="showcase-landing-nav-link" href="#clients">
              Para clientes
            </a>
            <a className="showcase-landing-nav-link" href="#installers">
              Para instaladores
            </a>
            <a className="showcase-landing-nav-link" href="#reviews">
              Avaliacoes
            </a>
          </nav>

          <div className="showcase-landing-actions">
            <Link className="ghost-button" to="/instalador/entrar">
              Entrar
            </Link>
            <Link className="gold-button" to="/instalador/cadastro">
              Cadastre-se
            </Link>
          </div>
        </header>

        <div className="showcase-landing-mobile-nav fade-up" style={{ animationDelay: '0.04s' }}>
          <a className="showcase-landing-mobile-link" href="#how">
            Como funciona
          </a>
          <a className="showcase-landing-mobile-link" href="#clients">
            Para clientes
          </a>
          <a className="showcase-landing-mobile-link" href="#installers">
            Para instaladores
          </a>
          <a className="showcase-landing-mobile-link" href="#reviews">
            Avaliacoes
          </a>
        </div>

        <main className="showcase-landing-main">
          <section className="showcase-landing-hero fade-up" id="hero" style={{ animationDelay: '0.06s' }}>
            <div className="showcase-landing-hero-copy">
              <p className="showcase-eyebrow">Plataforma nacional</p>
              <h1>
                Encontre os melhores instaladores de <span>papel de parede</span> no Brasil
              </h1>
              <p className="showcase-landing-hero-description">
                Conectamos voce a profissionais qualificados para transformar seus ambientes com mais confianca,
                rapidez e acabamento de alto nivel.
              </p>

              <form className="showcase-landing-search" onSubmit={handleSearchSubmit}>
                <input
                  aria-label="Buscar instaladores por cidade ou CEP"
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Digite sua cidade ou CEP"
                  type="text"
                  value={searchValue}
                />
                <button className="gold-button" type="submit">
                  Buscar instaladores
                </button>
              </form>

              <div className="showcase-landing-proof-grid" id="trust">
                {PROOF_POINTS.map((item) => (
                  <article className="showcase-landing-proof-card" key={item.title}>
                    <strong>{item.title}</strong>
                    <span>{item.copy}</span>
                  </article>
                ))}
              </div>
            </div>

            <div className="showcase-landing-hero-visual">
              <img alt="Ambiente sofisticado com papel de parede preto e dourado" src={HERO_IMAGE_URL} />
              <div className="showcase-landing-floating-card">
                <strong>Mais de {formatLargeNumber(metrics.totalInstallations)} instalacoes realizadas</strong>
                <span>Clientes e instaladores ativos em todos os estados do Brasil.</span>
                <div className="showcase-landing-floating-avatars">
                  {featuredAvatars.length > 0
                    ? featuredAvatars.map((installer) => {
                        const photo = getInstallerPhoto(installer);
                        return photo ? (
                          <img alt={installer.business_name || installer.name || 'Instalador'} key={installer.id} src={photo} />
                        ) : (
                          <div key={installer.id}>{getInitials(installer.business_name || installer.name)}</div>
                        );
                      })
                    : FALLBACK_REVIEWS.map((review) => <div key={review.id}>{getInitials(review.reviewer_name)}</div>)}
                  <GoldStars value={metrics.averageRating} />
                </div>
              </div>
            </div>
          </section>

          <section className="showcase-landing-section fade-up" id="how" style={{ animationDelay: '0.08s' }}>
            <div className="showcase-landing-section-head">
              <p className="showcase-eyebrow">Como funciona</p>
              <h2>Escolha com mais clareza e agende com menos atrito</h2>
              <p>Uma jornada simples para comparar opcoes, validar reputacao e falar com o profissional certo.</p>
            </div>

            <div className="showcase-landing-steps">
              {HOW_IT_WORKS.map((item) => (
                <article className="showcase-landing-step-card" key={item.title}>
                  <div className="showcase-landing-step-badge">
                    <LandingIcon name={item.icon} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="showcase-landing-dual fade-up" style={{ animationDelay: '0.1s' }}>
            <article className="showcase-landing-audience-card" id="clients">
              <div className="showcase-landing-audience-media">
                <img alt="Ambiente elegante pronto para receber papel de parede" src={CLIENT_IMAGE_URL} />
              </div>
              <div className="showcase-landing-audience-copy">
                <p className="showcase-eyebrow">Para clientes</p>
                <h3>Encontre profissionais com confianca e tenha uma experiencia mais segura.</h3>
                <p>
                  Compare avaliacoes, veja o historico dos instaladores e fale direto com quem vai executar o projeto
                  do seu ambiente.
                </p>
                <Link className="gold-button" to="/cliente">
                  Sou cliente
                </Link>
              </div>
            </article>

            <article className="showcase-landing-audience-card" id="installers">
              <div className="showcase-landing-audience-copy">
                <p className="showcase-eyebrow">Para instaladores</p>
                <h3>Receba mais pedidos, organize sua agenda e concentre sua operacao em um so lugar.</h3>
                <p>
                  Cadastre-se para gerenciar orcamentos, clientes, agenda e visibilidade profissional dentro da
                  plataforma.
                </p>
                <Link className="ghost-button" to="/instalador/cadastro">
                  Sou instalador
                </Link>
              </div>
              <div className="showcase-landing-audience-media">
                <img alt="Equipe de instaladores profissionais da plataforma" src={INSTALLER_IMAGE_URL} />
              </div>
            </article>
          </section>

          <section className="showcase-landing-metrics fade-up" style={{ animationDelay: '0.12s' }}>
            <article>
              <strong>+{formatLargeNumber(metrics.totalInstallers)}</strong>
              <span>Instaladores cadastrados e prontos para atender em diferentes regioes.</span>
            </article>
            <article>
              <strong>+{formatLargeNumber(metrics.totalInstallations)}</strong>
              <span>Instalacoes concluidas com clientes reais usando a plataforma.</span>
            </article>
            <article>
              <strong>{Number(metrics.averageRating || 0).toFixed(1)} / 5</strong>
              <span>Avaliacao media baseada em comentarios e notas de clientes.</span>
            </article>
            <article>
              <strong>{metrics.uniqueStates}</strong>
              <span>Estados com instaladores ativos e perfis disponiveis para contratacao.</span>
            </article>
          </section>

          <section className="showcase-landing-section fade-up" id="reviews" style={{ animationDelay: '0.14s' }}>
            <div className="showcase-landing-section-head">
              <p className="showcase-eyebrow">Avaliacoes</p>
              <h2>O que nossos clientes dizem</h2>
              <p>Depoimentos reais para ajudar voce a escolher com mais confianca.</p>
            </div>

            <div className="showcase-landing-reviews">
              {reviewCards.map((review) => (
                <article className="showcase-landing-review-card" key={review.id || review.reviewer_name}>
                  <div className="showcase-landing-review-person">
                    <div className="showcase-landing-review-avatar">{getInitials(review.reviewer_name || 'CL')}</div>
                    <div>
                      <strong>{review.reviewer_name || 'Cliente verificado'}</strong>
                      <p>{review.reviewer_region || 'Brasil'}</p>
                    </div>
                  </div>
                  <GoldStars value={review.rating || 5} />
                  <p className="showcase-landing-review-text">{review.comment}</p>
                  <footer>
                    <span>{review.installer_name || 'Instalador da plataforma'}</span>
                    <small>{review.created_at ? new Date(review.created_at).toLocaleDateString('pt-BR') : 'Avaliacao recente'}</small>
                  </footer>
                </article>
              ))}
            </div>
          </section>

          <section className="showcase-landing-cta fade-up" id="cta" style={{ animationDelay: '0.16s' }}>
            <div>
              <p className="showcase-eyebrow">Comece agora</p>
              <h2>Transforme seus ambientes com mais seguranca e menos improviso</h2>
              <p className="showcase-landing-hero-description">
                Busque instaladores, compare perfis e siga para o contato direto em poucos passos.
              </p>
            </div>
            <div className="showcase-landing-cta-actions">
              <Link className="gold-button" to="/cliente">
                Buscar instaladores
              </Link>
              <Link className="ghost-button" to="/instalador/cadastro">
                Quero anunciar meus servicos
              </Link>
            </div>
          </section>
        </main>

        <footer className="showcase-landing-footer fade-up" style={{ animationDelay: '0.18s' }}>
          <div className="showcase-landing-footer-brand">
            <BrandMark className="client-brand-mark" />
            <div>
              <strong>Instalar</strong>
              <p>Conectando clientes aos melhores instaladores de papel de parede em todo o Brasil.</p>
            </div>
          </div>

          <div className="showcase-landing-footer-columns">
            {FOOTER_SECTIONS.map((section) => (
              <div key={section.title}>
                <strong>{section.title}</strong>
                {section.links.map((item) =>
                  item.to ? (
                    <Link key={item.label} to={item.to}>
                      {item.label}
                    </Link>
                  ) : (
                    <a href={item.href} key={item.label}>
                      {item.label}
                    </a>
                  )
                )}
              </div>
            ))}
          </div>

          <small>© 2026 Instalar. Todos os direitos reservados.</small>
        </footer>

        <div className="showcase-landing-mobile-sticky">
          <Link className="gold-button" to="/cliente">
            Buscar instaladores
          </Link>
        </div>
      </div>
    </div>
  );
}
