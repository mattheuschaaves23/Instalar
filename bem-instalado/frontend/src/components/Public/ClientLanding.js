import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import BrandMark from '../Layout/BrandMark';
import BrandWordmark from '../Layout/BrandWordmark';

const HERO_IMAGE_URL = '/landing/sala-moderna-sofisticada.png';
const CLIENT_EXPERIENCE_IMAGE_URL = '/landing/sala-antes-minimalista.png';
const INSTALLER_EXPERIENCE_IMAGE_URL = '/landing/instaladores-profissionais.png';

const NAV_ITEMS = [
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#para-clientes', label: 'Para clientes' },
  { href: '#para-instaladores', label: 'Para instaladores' },
  { href: '#avaliacoes', label: 'Avaliações' },
];

const TRUST_ITEMS = [
  { title: 'Profissionais verificados', copy: 'Perfis revisados antes de aparecer.' },
  { title: 'Avaliações reais', copy: 'Comentários de clientes da plataforma.' },
  { title: 'Seguro contratado', copy: 'Mais segurança na instalação.' },
];

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Busque',
    copy: 'Digite sua cidade, região ou estilo desejado.',
  },
  {
    step: '2',
    title: 'Compare',
    copy: 'Veja avaliações, portfólios e experiência.',
  },
  {
    step: '3',
    title: 'Agende',
    copy: 'Converse com o instalador e ajuste a data ideal.',
  },
  {
    step: '4',
    title: 'Aproveite',
    copy: 'Receba uma instalação organizada e com acabamento premium.',
  },
];

const FALLBACK_REVIEWS = [
  {
    id: 'fallback-review-1',
    reviewer_name: 'Juliana M.',
    reviewer_region: 'São Paulo, SP',
    rating: 5,
    comment: 'Encontrei um profissional excelente e consegui decidir sem perder tempo.',
    installer_name: 'Cliente verificado',
  },
  {
    id: 'fallback-review-2',
    reviewer_name: 'Carlos A.',
    reviewer_region: 'Curitiba, PR',
    rating: 5,
    comment: 'A plataforma ajudou muito na comparação entre opções e no contato direto.',
    installer_name: 'Cliente verificado',
  },
  {
    id: 'fallback-review-3',
    reviewer_name: 'Fernanda L.',
    reviewer_region: 'Belo Horizonte, MG',
    rating: 5,
    comment: 'Achei rápido, bonito e organizado. O resultado final ficou impecável.',
    installer_name: 'Cliente verificado',
  },
];

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function getInitials(name) {
  return (name || 'IL')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatCompactNumber(value) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return '0';
  }

  return new Intl.NumberFormat('pt-BR', {
    notation: amount >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: amount >= 1000 ? 1 : 0,
  }).format(amount);
}

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) {
    return moneyFormatter.format(0);
  }
  return moneyFormatter.format(amount);
}

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

function GoldStars({ value = 5 }) {
  const rating = Math.max(1, Math.round(Number(value || 0)));

  return (
    <div className="showcase-landing-stars" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <span className={index < rating ? 'is-on' : ''} key={index}>
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
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadLandingData = async () => {
      try {
        const response = await api.get('/public/installers');
        const allInstallers = response.data?.installers || [];
        const recentReviews = response.data?.reviews || [];

        if (!mounted) {
          return;
        }

        setInstallers(allInstallers);
        setReviews(recentReviews.filter((review) => Number(review.rating || 0) >= 4).slice(0, 6));
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

      const ratingDiff = Number(b.average_rating || 0) - Number(a.average_rating || 0);
      if (ratingDiff !== 0) {
        return ratingDiff;
      }

      const reviewCountDiff = Number(b.review_count || 0) - Number(a.review_count || 0);
      if (reviewCountDiff !== 0) {
        return reviewCountDiff;
      }

      return Number(b.completed_jobs || 0) - Number(a.completed_jobs || 0);
    });

    return sorted.slice(0, 3);
  }, [installers]);

  const selectedReviews = useMemo(() => {
    if (reviews.length > 0) {
      return reviews.slice(0, 3);
    }

    return FALLBACK_REVIEWS;
  }, [reviews]);

  const metrics = useMemo(() => {
    const totalInstallers = installers.length;
    const completedInstallations = installers.reduce(
      (sum, installer) => sum + Number(installer.completed_jobs || installer.approved_jobs || 0),
      0
    );
    const reviewAverage =
      reviews.length > 0
        ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
        : installers.reduce((sum, installer) => sum + Number(installer.average_rating || 0), 0) /
          Math.max(installers.length, 1);
    const uniqueStates = new Set(installers.map((installer) => installer.state).filter(Boolean)).size;

    return {
      totalInstallers,
      completedInstallations,
      reviewAverage: Number.isFinite(reviewAverage) && reviewAverage > 0 ? reviewAverage : 4.9,
      uniqueStates,
    };
  }, [installers, reviews]);

  const heroFloatingCopy = useMemo(() => {
    if (metrics.completedInstallations > 0) {
      return `${formatCompactNumber(metrics.completedInstallations)} instalações com avaliação positiva`;
    }

    if (metrics.totalInstallers > 0) {
      return `${formatCompactNumber(metrics.totalInstallers)} perfis já disponíveis`;
    }

    return 'Instaladores avaliados com mais segurança';
  }, [metrics.completedInstallations, metrics.totalInstallers]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const normalized = searchValue.trim();

    if (normalized) {
      navigate(`/cliente?busca=${encodeURIComponent(normalized)}`);
      return;
    }

    navigate('/cliente');
  };

  return (
    <div className="auth-scene min-h-screen overflow-x-hidden">
      <div className="showcase-landing-shell">
        <header className="showcase-landing-topbar fade-up">
          <Link className="showcase-landing-brand" to="/">
            <BrandMark className="client-brand-mark" />
            <div className="showcase-landing-brand-copy">
              <BrandWordmark className="client-topbar-wordmark" size="lg" />
              <p>Encontre instaladores no Brasil</p>
            </div>
          </Link>

          <nav className="showcase-landing-nav" aria-label="Navegação da landing">
            {NAV_ITEMS.map((item) => (
              <a className="showcase-landing-nav-link" href={item.href} key={item.label}>
                {item.label}
              </a>
            ))}
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

        <div className="showcase-landing-mobile-nav fade-up" style={{ animationDelay: '0.02s' }}>
          {NAV_ITEMS.map((item) => (
            <a className="showcase-landing-mobile-link" href={item.href} key={item.label}>
              {item.label}
            </a>
          ))}
        </div>

        <main className="showcase-landing-main">
          <section className="showcase-landing-hero fade-up" style={{ animationDelay: '0.04s' }}>
            <div className="showcase-landing-hero-copy">
              <p className="showcase-eyebrow">Plataforma de conexão premium</p>
              <h1>
                Encontre os melhores instaladores de <span>papel de parede</span> no Brasil
              </h1>
              <p className="showcase-landing-hero-description">
                Conectamos você a profissionais qualificados para transformar seus ambientes com mais segurança,
                clareza e acabamento profissional.
              </p>

              <form className="showcase-landing-search" onSubmit={handleSearchSubmit}>
                <input
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Digite sua cidade ou CEP"
                  type="text"
                  value={searchValue}
                />
                <button className="gold-button" type="submit">
                  Buscar instaladores
                </button>
              </form>

              <div className="showcase-landing-proof-grid">
                {TRUST_ITEMS.map((item) => (
                  <article className="showcase-landing-proof-card" key={item.title}>
                    <strong>{item.title}</strong>
                    <span>{item.copy}</span>
                  </article>
                ))}
              </div>
            </div>

            <div className="showcase-landing-hero-visual">
              <img alt="Sala sofisticada com papel de parede elegante" src={HERO_IMAGE_URL} />
              <div className="showcase-landing-floating-card">
                <strong>{heroFloatingCopy}</strong>
                <span>Escolha com mais confiança usando nota, experiência e contato rápido.</span>
                <div className="showcase-landing-floating-avatars">
                  {topInstallers.slice(0, 4).map((installer) =>
                    installer.installer_photo || installer.logo ? (
                      <img
                        alt={installer.display_name}
                        key={installer.id}
                        src={installer.installer_photo || installer.logo}
                      />
                    ) : (
                      <div key={installer.id}>{getInitials(installer.display_name)}</div>
                    )
                  )}
                  {topInstallers.length === 0 ? <div>IL</div> : null}
                </div>
              </div>
            </div>
          </section>

          <section className="showcase-landing-section fade-up" id="como-funciona" style={{ animationDelay: '0.08s' }}>
            <div className="showcase-landing-section-head">
              <p className="showcase-eyebrow">Como funciona</p>
              <h2>Um caminho simples até o instalador certo</h2>
            </div>

            <div className="showcase-landing-steps">
              {HOW_IT_WORKS.map((item) => (
                <article className="showcase-landing-step-card" key={item.step}>
                  <div className="showcase-landing-step-badge">{item.step}</div>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="showcase-landing-dual fade-up" style={{ animationDelay: '0.1s' }}>
            <article className="showcase-landing-audience-card" id="para-clientes">
              <div className="showcase-landing-audience-media">
                <img alt="Ambiente elegante para clientes" src={CLIENT_EXPERIENCE_IMAGE_URL} />
              </div>
              <div className="showcase-landing-audience-copy">
                <p className="showcase-eyebrow">Para clientes</p>
                <h3>Encontre profissionais de confiança para o seu projeto.</h3>
                <p>Veja perfis, avaliações e converse no WhatsApp antes de decidir.</p>
                <Link className="gold-button" to="/cliente">
                  Sou cliente
                </Link>
              </div>
            </article>

            <article className="showcase-landing-audience-card" id="para-instaladores">
              <div className="showcase-landing-audience-copy">
                <p className="showcase-eyebrow">Para instaladores</p>
                <h3>Receba mais pedidos e organize agenda, clientes e orçamentos.</h3>
                <p>Uma área profissional para crescer com mais controle e presença online.</p>
                <Link className="ghost-button" to="/instalador/cadastro">
                  Sou instalador
                </Link>
              </div>
              <div className="showcase-landing-audience-media">
                <img alt="Instaladores profissionais prontos para atender" src={INSTALLER_EXPERIENCE_IMAGE_URL} />
              </div>
            </article>
          </section>

          <section className="showcase-landing-metrics fade-up" style={{ animationDelay: '0.12s' }}>
            <article>
              <strong>{metrics.totalInstallers > 0 ? `+${formatCompactNumber(metrics.totalInstallers)}` : '0'}</strong>
              <span>Instaladores cadastrados</span>
            </article>
            <article>
              <strong>
                {metrics.completedInstallations > 0 ? `+${formatCompactNumber(metrics.completedInstallations)}` : '0'}
              </strong>
              <span>Instalações realizadas</span>
            </article>
            <article>
              <strong>{metrics.reviewAverage.toFixed(1)} / 5</strong>
              <span>Avaliação média dos clientes</span>
            </article>
            <article>
              <strong>{metrics.uniqueStates > 0 ? `${metrics.uniqueStates} estados` : 'Cobertura nacional'}</strong>
              <span>Presença em todo o Brasil</span>
            </article>
          </section>

          <section className="showcase-landing-section fade-up" style={{ animationDelay: '0.14s' }}>
            <div className="showcase-landing-section-head">
              <p className="showcase-eyebrow">Instaladores em destaque</p>
              <h2>Perfis que já estão gerando confiança na plataforma</h2>
            </div>

            <div className="showcase-landing-installers">
              {topInstallers.length > 0 ? (
                topInstallers.map((installer) => (
                  <article className="showcase-landing-installer-card" key={installer.id}>
                    <div className="showcase-landing-installer-top">
                      {installer.installer_photo || installer.logo ? (
                        <img
                          alt={installer.display_name}
                          className="showcase-landing-installer-avatar"
                          src={installer.installer_photo || installer.logo}
                        />
                      ) : (
                        <div className="showcase-landing-installer-avatar showcase-landing-installer-fallback">
                          {getInitials(installer.display_name)}
                        </div>
                      )}
                      <div>
                        <h3>{installer.display_name}</h3>
                        <p>
                          {[installer.city, installer.state].filter(Boolean).join(' • ') || 'Região não informada'}
                        </p>
                      </div>
                    </div>

                    <GoldStars value={installer.average_rating} />

                    <div className="showcase-landing-installer-meta">
                      <span>{Number(installer.average_rating || 0).toFixed(1)} de nota</span>
                      <span>{Number(installer.review_count || 0)} avaliações</span>
                      <span>{formatMoney(installer.base_service_cost)} base</span>
                    </div>

                    <p className="showcase-landing-installer-copy">
                      {installer.installation_method || 'Instalação profissional com acabamento limpo e atendimento direto.'}
                    </p>

                    <Link className="ghost-button" to={`/installers/${installer.id}`}>
                      Ver perfil
                    </Link>
                  </article>
                ))
              ) : (
                <div className="empty-state !p-4 text-sm">Os instaladores em destaque aparecerão aqui automaticamente.</div>
              )}
            </div>
          </section>

          <section className="showcase-landing-section fade-up" id="avaliacoes" style={{ animationDelay: '0.16s' }}>
            <div className="showcase-landing-section-head">
              <p className="showcase-eyebrow">O que nossos clientes dizem</p>
              <h2>Avaliações reais para facilitar sua decisão</h2>
            </div>

            <div className="showcase-landing-reviews">
              {selectedReviews.map((review) => (
                <article className="showcase-landing-review-card" key={review.id}>
                  <div className="showcase-landing-review-person">
                    <div className="showcase-landing-review-avatar">{getInitials(review.reviewer_name || 'CL')}</div>
                    <div>
                      <strong>{review.reviewer_name || 'Cliente verificado'}</strong>
                      <p>{review.reviewer_region || 'Brasil'}</p>
                    </div>
                  </div>
                  <GoldStars value={review.rating} />
                  <p className="showcase-landing-review-text">“{review.comment}”</p>
                  <footer>
                    <span>{review.installer_name || 'Atendimento verificado'}</span>
                    <small>{formatReviewDate(review.created_at)}</small>
                  </footer>
                </article>
              ))}
            </div>
          </section>

          <section className="showcase-landing-cta fade-up" style={{ animationDelay: '0.18s' }}>
            <div>
              <p className="showcase-eyebrow">Pronto para transformar seu ambiente?</p>
              <h2>Encontre o instalador ideal para o seu projeto hoje mesmo.</h2>
            </div>
            <div className="showcase-landing-cta-actions">
              <Link className="gold-button" to="/cliente">
                Buscar instaladores
              </Link>
              <Link className="ghost-button" to="/instalador/cadastro">
                Quero me cadastrar
              </Link>
            </div>
          </section>
        </main>

        <footer className="showcase-landing-footer fade-up" style={{ animationDelay: '0.2s' }}>
          <div className="showcase-landing-footer-brand">
            <BrandMark className="client-brand-mark" />
            <div>
              <BrandWordmark className="client-topbar-wordmark" size="lg" />
              <p>Conectando clientes aos melhores instaladores de papel de parede em todo o Brasil.</p>
            </div>
          </div>

          <div className="showcase-landing-footer-columns">
            <div>
              <strong>Para clientes</strong>
              <a href="#como-funciona">Como funciona</a>
              <Link to="/cliente">Buscar instaladores</Link>
              <a href="#avaliacoes">Avaliações</a>
            </div>
            <div>
              <strong>Para instaladores</strong>
              <Link to="/instalador/cadastro">Cadastre-se</Link>
              <Link to="/instalador/entrar">Entrar</Link>
              <Link to="/dashboard">Painel profissional</Link>
            </div>
            <div>
              <strong>Institucional</strong>
              <a href="#para-clientes">Para clientes</a>
              <a href="#para-instaladores">Para instaladores</a>
              <a href="#como-funciona">Etapas</a>
            </div>
          </div>
        </footer>

        <div className="showcase-landing-mobile-sticky">
          <button className="gold-button" onClick={() => navigate('/cliente')} type="button">
            Buscar instaladores
          </button>
        </div>
      </div>
    </div>
  );
}
