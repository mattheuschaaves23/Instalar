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
    name: 'Sua loja aqui',
    description: 'Apresente seus papéis de parede para clientes que já estão planejando uma instalação.',
    cta_label: 'Quero anunciar',
    link_url: STORE_CONTACT_URL,
  },
  {
    id: 'installers',
    name: 'Mais conexões',
    description: 'Aproxime sua marca de instaladores e gere oportunidades na região em que atua.',
    cta_label: 'Falar com a InstalaPro',
    link_url: STORE_CONTACT_URL,
  },
  {
    id: 'materials',
    name: 'Materiais em destaque',
    description: 'Dê visibilidade aos seus produtos dentro de uma jornada pronta para transformar ambientes.',
    cta_label: 'Anunciar minha loja',
    link_url: STORE_CONTACT_URL,
  },
];

function Brand() {
  return (
    <Link aria-label="InstalaPro — início" className="lp2-brand" to="/">
      <img alt="InstalaPro" src="/brand/instalapro-logo.png" />
    </Link>
  );
}

function Symbol({ type }) {
  return <span aria-hidden="true" className={`lp2-symbol lp2-symbol-${type}`} />;
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
    description: 'Acompanhe pedidos, compare interessados e escolha o profissional ideal.',
    label: 'Ir para clientes',
    to: REQUEST_PATH,
  },
  {
    id: 'instalador',
    type: 'installer',
    title: 'Área do instalador',
    description: 'Receba solicitações da sua região e organize seus atendimentos.',
    label: 'Entrar como instalador',
    to: INSTALLER_LOGIN_PATH,
  },
  {
    id: 'lojista',
    type: 'store',
    title: 'Área do lojista',
    description: 'Anuncie sua loja, ganhe visibilidade e gere novos contatos.',
    label: 'Anunciar minha loja',
    href: STORE_CONTACT_URL,
  },
];

function RoleCard({ card, index }) {
  const content = (
    <>
      <span className="lp2-role-index">0{index + 1}</span>
      <Symbol type={card.type} />
      <h2>{card.title}</h2>
      <i />
      <p>{card.description}</p>
      <span className="lp2-role-arrow" aria-hidden="true">→</span>
      <span className="lp2-sr-only">{card.label}</span>
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

function Hero() {
  return (
    <section className="lp2-stage" id="como-funciona">
      <div className="lp2-orbits" aria-hidden="true">
        <span />
        <span />
        <i />
        <i />
        <i />
      </div>

      <div className="lp2-intro">
        <p className="lp2-badge">
          <span aria-hidden="true">◎</span>
          Conectamos instaladores, lojas e clientes
        </p>

        <h1>
          Precisa instalar
          <strong>papel de parede?</strong>
        </h1>

        <div aria-label="Fluxo da plataforma" className="lp2-flow">
          <span><Symbol type="client" /> Cliente</span>
          <i aria-hidden="true">↔</i>
          <span><Symbol type="installer" /> Instalador</span>
          <i aria-hidden="true">↔</i>
          <span><Symbol type="store" /> Loja</span>
        </div>

        <p className="lp2-copy">
          Você cria seu pedido e instaladores da sua região <em>respondem.</em>
          <br />
          Lojas parceiras <em>anunciam</em>, ganham visibilidade e <em>geram oportunidades.</em>
        </p>

        <div className="lp2-actions">
          <Link className="lp2-primary" to={REQUEST_PATH}>
            Criar meu pedido <span aria-hidden="true">→</span>
          </Link>
          <a className="lp2-secondary" href="#cliente">
            <span aria-hidden="true">↓</span>
            Conhecer as áreas
          </a>
        </div>
      </div>

      <div className="lp2-roles">
        {roleCards.map((card, index) => <RoleCard card={card} index={index} key={card.id} />)}
      </div>
    </section>
  );
}

function StoreRail() {
  const [stores, setStores] = useState([]);
  const [page, setPage] = useState(0);
  const railRef = useRef(null);

  useEffect(() => {
    let active = true;

    api.get('/public/recommended-stores')
      .then((response) => {
        if (active) setStores(Array.isArray(response.data?.stores) ? response.data.stores : []);
      })
      .catch(() => {
        if (active) setStores([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const items = stores.length ? stores : fallbackStores;
  const scroll = (direction) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ behavior: 'smooth', left: direction * rail.clientWidth * 0.82 });
  };
  const updatePage = () => {
    const rail = railRef.current;
    if (!rail) return;
    const maxScroll = Math.max(rail.scrollWidth - rail.clientWidth, 1);
    setPage(Math.round((rail.scrollLeft / maxScroll) * Math.min(items.length - 1, 3)));
  };

  return (
    <section aria-label="Lojas em destaque" className="lp2-store-showcase">
      <button aria-label="Ver lojas anteriores" className="lp2-rail-arrow lp2-rail-arrow-prev" onClick={() => scroll(-1)} type="button">‹</button>

      <div className="lp2-store-rail" onScroll={updatePage} ref={railRef}>
        {items.map((store) => (
          <article className="lp2-store-card" key={store.id}>
            <div className="lp2-store-visual">
              {store.image_url ? (
                <img alt="" loading="lazy" src={store.image_url} />
              ) : (
                <Symbol type="store" />
              )}
            </div>
            <div>
              <h2>{store.name}</h2>
              <p>{store.description}</p>
              <a href={store.link_url || STORE_CONTACT_URL} rel="noreferrer" target="_blank">
                {store.cta_label || 'Visitar loja'} <span aria-hidden="true">↗</span>
              </a>
            </div>
          </article>
        ))}
      </div>

      <button aria-label="Ver próximas lojas" className="lp2-rail-arrow lp2-rail-arrow-next" onClick={() => scroll(1)} type="button">›</button>

      <div aria-hidden="true" className="lp2-rail-dots">
        {[0, 1, 2, 3].map((dot) => <span className={page === dot ? 'is-active' : ''} key={dot} />)}
      </div>
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
        <StoreRail />
      </main>
    </div>
  );
}
