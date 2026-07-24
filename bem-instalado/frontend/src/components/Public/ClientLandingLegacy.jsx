import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import './ClientLandingLegacy.css';

const REQUEST_PATH = '/cliente';
const CLIENT_LOGIN_PATH = '/cliente/entrar';
const INSTALLER_LOGIN_PATH = '/instalador/entrar';
const STORE_CONTACT_URL =
  'https://api.whatsapp.com/send?phone=5548999816000&text=Ol%C3%A1%2C%20quero%20anunciar%20minha%20loja%20na%20InstalaPro.';

const fallbackStores = [
  {
    id: 'visibility',
    name: 'Loja 1',
    description: 'Papéis de parede premium e atendimento especializado.',
    image_url: '',
    cta_label: 'Anuncie sua loja',
    link_url: STORE_CONTACT_URL,
  },
  {
    id: 'installers',
    name: 'Loja 2',
    description: 'Transforme ambientes com estilo e qualidade.',
    image_url: '',
    cta_label: 'Anuncie sua loja',
    link_url: STORE_CONTACT_URL,
  },
  {
    id: 'materials',
    name: 'Loja 3',
    description: 'Variedade, tendência e o melhor para seu projeto.',
    image_url: '',
    cta_label: 'Anuncie sua loja',
    link_url: STORE_CONTACT_URL,
  },
  {
    id: 'partner',
    name: 'Loja 4',
    description: 'Sua marca em destaque para clientes e instaladores da sua região.',
    image_url: '',
    cta_label: 'Anuncie sua loja',
    link_url: STORE_CONTACT_URL,
  },
];

function Brand() {
  return (
    <Link aria-label="InstalaPro — início" className="lp2-brand" to="/">
      <img alt="InstalaPro" src="/brand/instalapro-logo-transparent.png" />
    </Link>
  );
}

function Symbol({ type }) {
  const commonProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  };

  const paths = {
    client: (
      <>
        <circle cx="12" cy="8.1" r="3.2" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </>
    ),
    installer: (
      <>
        <rect height="6" rx="2" width="14" x="2.5" y="3.5" />
        <path d="M16.5 6.5H19a2 2 0 0 1 2 2V11a2 2 0 0 1-2 2h-6a2 2 0 0 0-2 2v2" />
        <rect height="4" rx="1" width="5" x="8.5" y="17" />
      </>
    ),
    store: (
      <>
        <path d="M4 21V6.5A1.5 1.5 0 0 1 5.5 5H14v16" />
        <path d="M14 21V3.5A1.5 1.5 0 0 1 15.5 2H19a1 1 0 0 1 1 1V21" />
        <path d="M8 9h2M8 13h2M8 17h2M16 9h1.5M16 13h1.5M16 17h1.5" />
      </>
    ),
  };

  return (
    <span aria-hidden="true" className={`lp2-symbol lp2-symbol-${type}`}>
      <svg {...commonProps}>{paths[type] || paths.client}</svg>
    </span>
  );
}

function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const accessRef = useRef(null);

  useEffect(() => {
    const handlePointer = (event) => {
      if (!accessRef.current?.contains(event.target)) setAccessOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        setAccessOpen(false);
        setMobileOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    document.body.classList.toggle('lp2-menu-lock', mobileOpen);

    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
      document.body.classList.remove('lp2-menu-lock');
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  return (
    <header className="lp2-header">
      <Brand />

      <nav aria-label="Navegação principal" className="lp2-nav">
        <a href="#como-funciona">Como funciona</a>
        <a href="#cliente">Para clientes</a>
        <a href="#instalador">Para instaladores</a>
        <a href="#lojista">Para lojistas</a>
        <a href="mailto:beminstaladohd@gmail.com">Dúvidas</a>
      </nav>

      <div className="lp2-access" ref={accessRef}>
        <p>Acesso para clientes<br />e instaladores</p>
        <button
          aria-expanded={accessOpen}
          aria-haspopup="menu"
          className="lp2-access-trigger"
          onClick={() => setAccessOpen((open) => !open)}
          type="button"
        >
          <Symbol type="client" />
          Entrar
        </button>
        <div aria-label="Escolha seu acesso" className={`lp2-access-menu${accessOpen ? ' is-open' : ''}`} role="menu">
          <Link onClick={() => setAccessOpen(false)} role="menuitem" to={CLIENT_LOGIN_PATH}>
            <span>Cliente</span>
            Acompanhar pedidos
          </Link>
          <Link onClick={() => setAccessOpen(false)} role="menuitem" to={INSTALLER_LOGIN_PATH}>
            <span>Instalador</span>
            Abrir painel profissional
          </Link>
        </div>
      </div>

      <button
        aria-controls="lp2-mobile-nav"
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
        className={`lp2-menu-button${mobileOpen ? ' is-open' : ''}`}
        onClick={() => setMobileOpen((open) => !open)}
        type="button"
      >
        <span />
        <span />
      </button>

      <div className={`lp2-mobile-nav${mobileOpen ? ' is-open' : ''}`} id="lp2-mobile-nav">
        <div className="lp2-mobile-nav-head">
          <span>Menu</span>
          <span>InstalaPro®</span>
        </div>
        <nav aria-label="Navegação mobile">
          <a href="#como-funciona" onClick={closeMobile}>Como funciona</a>
          <a href="#cliente" onClick={closeMobile}>Para clientes</a>
          <a href="#instalador" onClick={closeMobile}>Para instaladores</a>
          <a href="#lojista" onClick={closeMobile}>Para lojistas</a>
        </nav>
        <div className="lp2-mobile-access">
          <Link onClick={closeMobile} to={CLIENT_LOGIN_PATH}>Entrar como cliente <span>→</span></Link>
          <Link onClick={closeMobile} to={INSTALLER_LOGIN_PATH}>Entrar como instalador <span>→</span></Link>
          <a href={STORE_CONTACT_URL} onClick={closeMobile} rel="noreferrer" target="_blank">
            Falar sobre minha loja <span>↗</span>
          </a>
        </div>
      </div>
    </header>
  );
}

const roleCards = [
  {
    id: 'cliente',
    type: 'client',
    title: 'Área do cliente',
    description: 'Acompanhe pedidos, converse com instaladores e escolha o profissional ideal.',
    label: 'Ir para clientes',
    to: REQUEST_PATH,
  },
  {
    id: 'instalador',
    type: 'installer',
    title: 'Área do instalador',
    description: 'Recebe solicitações da sua região e gerencia seus atendimentos.',
    label: 'Entrar como instalador',
    to: INSTALLER_LOGIN_PATH,
  },
  {
    id: 'lojista',
    type: 'store',
    title: 'Área do lojista',
    description: 'Anuncia sua loja, ganha visibilidade e gera novos contatos.',
    label: 'Anunciar minha loja',
    href: STORE_CONTACT_URL,
  },
];

function RoleCard({ card }) {
  const content = (
    <>
      <Symbol type={card.type} />
      <span className="lp2-role-copy">
        <h2>{card.title}</h2>
      </span>
      <span className="lp2-role-arrow" aria-hidden="true">→</span>
      <span className="lp2-sr-only">{card.description}</span>
    </>
  );

  return (
    <article className="lp2-role" id={card.id}>
      {card.to ? (
        <Link aria-label={card.label} to={card.to}>{content}</Link>
      ) : (
        <a aria-label={card.label} href={card.href} rel="noreferrer" target="_blank">{content}</a>
      )}
    </article>
  );
}

function StoreCarousel() {
  const [stores, setStores] = useState([]);
  const [position, setPosition] = useState(1);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [visibleCount, setVisibleCount] = useState(() => {
    if (typeof window === 'undefined') return 3;
    if (window.innerWidth < 720) return 1;
    return window.innerWidth < 1120 ? 2 : 3;
  });

  useEffect(() => {
    let active = true;

    api.get('/public/recommended-stores')
      .then((response) => {
        if (!active) return;
        const nextStores = Array.isArray(response.data?.stores)
          ? response.data.stores.slice(0, 8)
          : [];
        setStores(nextStores);
        setPosition(1);
      })
      .catch(() => {
        if (active) setStores([]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const updateVisibleCount = () => {
      if (window.innerWidth < 720) {
        setVisibleCount(1);
      } else if (window.innerWidth < 1120) {
        setVisibleCount(2);
      } else {
        setVisibleCount(3);
      }
    };

    updateVisibleCount();
    window.addEventListener('resize', updateVisibleCount);
    return () => window.removeEventListener('resize', updateVisibleCount);
  }, []);

  const items = stores.length ? stores : fallbackStores;
  const cardCount = Math.min(visibleCount, items.length);
  const pages = items.map((_, pageIndex) => (
    Array.from({ length: cardCount }, (__, slot) => {
      const itemIndex = (pageIndex + slot) % items.length;
      return {
        ...items[itemIndex],
        itemIndex,
      };
    })
  ));
  const trackPages = pages.length > 1
    ? [pages[pages.length - 1], ...pages, pages[0]]
    : pages;
  const currentIndex = pages.length > 1
    ? (position - 1 + pages.length) % pages.length
    : 0;
  const displayPosition = pages.length > 1 ? position : 0;

  useEffect(() => {
    setTransitionEnabled(false);
    setPosition(1);
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setTransitionEnabled(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [cardCount, items.length]);

  useEffect(() => {
    if (paused || items.length < 2) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setTransitionEnabled(true);
      setPosition((index) => index + 1);
    }, 4600);

    return () => window.clearInterval(timer);
  }, [cycle, items.length, paused]);

  const selectSlide = (index) => {
    setTransitionEnabled(true);
    setPosition(((index + pages.length) % pages.length) + 1);
    setCycle((value) => value + 1);
  };

  const move = (direction) => {
    setTransitionEnabled(true);
    setPosition((index) => {
      if (direction > 0 && index >= pages.length + 1) return index;
      if (direction < 0 && index <= 0) return index;
      return index + direction;
    });
    setCycle((value) => value + 1);
  };

  const finishTransition = (event) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;
    if (pages.length < 2) return;

    if (position === 0 || position === pages.length + 1) {
      setTransitionEnabled(false);
      setPosition(position === 0 ? pages.length : 1);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setTransitionEnabled(true));
      });
    }
  };

  return (
    <section
      aria-label="Carrossel de lojas em destaque"
      className="lp2-store-carousel"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
      onFocus={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div aria-live="polite" className="lp2-store-rail-body">
        <button aria-label="Ver loja anterior" className="lp2-store-rail-arrow" onClick={() => move(-1)} type="button">←</button>

        <div className="lp2-store-rail-window">
          <div
            className={`lp2-store-rail-track${transitionEnabled ? '' : ' is-jumping'}`}
            onTransitionEnd={finishTransition}
            style={{
              '--carousel-columns': cardCount,
              '--carousel-offset': `${displayPosition * -100}%`,
            }}
          >
            {trackPages.map((page, pageIndex) => (
              <div
                aria-hidden={pageIndex !== displayPosition}
                className="lp2-store-rail-page"
                key={`page-${pageIndex}`}
              >
                {page.map((store, slot) => (
                  <article className="lp2-store-card" key={`${store.id}-${store.itemIndex}-${slot}`}>
                    <div className={`lp2-store-card-visual${store.image_url ? '' : ' is-fallback'}`}>
                      {store.image_url ? (
                        <img
                          alt={`Vitrine de ${store.name}`}
                          loading={pageIndex === displayPosition ? 'eager' : 'lazy'}
                          onError={(event) => {
                            event.currentTarget.parentElement.classList.add('is-fallback');
                            event.currentTarget.remove();
                          }}
                          src={store.image_url}
                        />
                      ) : null}
                      <Symbol type="store" />
                    </div>
                    <div className="lp2-store-card-content">
                      <h2>{store.name}</h2>
                      <span>{store.description}</span>
                      <a
                        href={store.link_url || STORE_CONTACT_URL}
                        rel="noreferrer"
                        tabIndex={pageIndex === displayPosition ? 0 : -1}
                        target="_blank"
                      >
                        {store.cta_label || 'Visitar loja'} <i aria-hidden="true">↗</i>
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </div>

        <button aria-label="Ver próxima loja" className="lp2-store-rail-arrow" onClick={() => move(1)} type="button">→</button>
      </div>

      <div aria-label="Escolher loja" className="lp2-store-rail-dots">
        {items.map((store, index) => (
          <button
            aria-label={`Ver ${store.name}`}
            aria-pressed={index === currentIndex}
            className={index === currentIndex ? 'is-active' : ''}
            key={store.id}
            onClick={() => selectSlide(index)}
            type="button"
          />
        ))}
      </div>

      {!paused && items.length > 1 ? (
        <div className="lp2-carousel-progress" key={`${currentIndex}-${cycle}`}><span /></div>
      ) : null}
    </section>
  );
}

function Hero() {
  return (
    <section className="lp2-stage" id="como-funciona">
      <div className="lp2-orbits" aria-hidden="true">
        <span />
        <span />
        <i />
        <i />
        <i />
        <i />
      </div>

      <div className="lp2-intro">
        <p className="lp2-badge">
          Clientes, instaladores e lojas no mesmo lugar
        </p>

        <h1>
          Precisa instalar
          <strong>papel de parede?</strong>
        </h1>

        <p className="lp2-copy">
          Você cria seu pedido e instaladores da sua região <em>respondem</em>.<br />
          Lojas parceiras <em>anunciam</em>, ganham visibilidade e <em>geram oportunidades</em>.
        </p>

        <div className="lp2-actions">
          <Link className="lp2-primary" to={REQUEST_PATH}>
            Criar meu pedido <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <div className="lp2-network">
        <div aria-hidden="true" className="lp2-network-rings">
          <span />
          <span />
          <span />
          <i />
          <i />
          <i />
        </div>
        <div aria-hidden="true" className="lp2-network-core">
          <span>Instala</span><strong>Pro</strong>
        </div>
        <div aria-label="Áreas da plataforma" className="lp2-hero-roles" id="acessos">
          {roleCards.map((card) => <RoleCard card={card} key={card.id} />)}
        </div>
      </div>

      <StoreCarousel />
    </section>
  );
}

export default function ClientLandingLegacy() {
  return (
    <div className="lp2-page">
      <a className="lp2-skip-link" href="#conteudo">Pular para o conteúdo</a>
      <Header />
      <main id="conteudo">
        <Hero />
      </main>
    </div>
  );
}
