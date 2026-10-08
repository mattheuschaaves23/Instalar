import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import api from '../../services/api';
import './ClientLanding.css';
import PageMetadata from './PageMetadata';

const REQUEST_PATH = '/cliente';
const CLIENT_LOGIN_PATH = '/cliente/entrar';
const INSTALLER_LOGIN_PATH = '/instalador/entrar';
const STORE_CONTACT_URL =
  'https://api.whatsapp.com/send?phone=5548999816000&text=Ol%C3%A1%2C%20quero%20anunciar%20minha%20loja%20na%20InstalaPro.';

const fallbackStores = [
  {
    id: 'showcase-one',
    name: 'Sua loja aqui',
    description: 'Apresente sua coleção para clientes que já estão planejando a instalação.',
    image_url: '',
    cta_label: 'Anunciar minha loja',
    link_url: STORE_CONTACT_URL,
  },
  {
    id: 'showcase-two',
    name: 'Vitrine InstalaPro',
    description: 'Sua marca em destaque no momento em que o projeto começa.',
    image_url: '',
    cta_label: 'Quero participar',
    link_url: STORE_CONTACT_URL,
  },
  {
    id: 'showcase-three',
    name: 'Lojas recomendadas',
    description: 'Papel de parede, curadoria e atendimento especializado.',
    image_url: '',
    cta_label: 'Falar com a InstalaPro',
    link_url: STORE_CONTACT_URL,
  },
];

function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`lp6-header${scrolled ? ' is-scrolled' : ''}`}>
      <Link aria-label="InstalaPro — página inicial" className="lp6-brand" to="/">
        <img alt="InstalaPro" src="/brand/instalapro-logo-transparent.png" />
      </Link>

      <nav aria-label="Navegação principal" className="lp6-nav">
        <a href="#lojas">Lojas</a>
        <a href="#como-funciona">Como funciona</a>
        <Link to={INSTALLER_LOGIN_PATH}>Sou instalador</Link>
      </nav>

      <div className="lp6-header-actions">
        <Link className="lp6-login" to={CLIENT_LOGIN_PATH}>
          Entrar <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section aria-labelledby="lp6-hero-title" className="lp6-hero">
      <div className="lp6-hero-media">
        <img
          alt="Instalador finalizando uma parede elegante com papel de parede escuro"
          fetchPriority="high"
          src="/landing/hero-home-panoramico-v2.jpg"
        />
      </div>
      <div className="lp6-hero-gradient" aria-hidden="true" />
      <div className="lp6-hero-grain" aria-hidden="true" />
      <div className="lp6-hero-light" aria-hidden="true" />

      <div className="lp6-hero-content">
        <p className="lp6-eyebrow"><span /> Instalação de papel de parede</p>
        <h1 id="lp6-hero-title">
          <span>Encontre <em>instaladores</em></span>
          <span>de papel de parede</span>
          <span>na <em>sua região</em></span>
        </h1>
        <p className="lp6-hero-summary">
          A InstalaPro conecta clientes, lojas e instaladores. Solicite atendimento
          gratuitamente e encontre profissionais da sua região com mais praticidade
          e segurança.
        </p>
        <div className="lp6-hero-actions">
          <Link className="lp6-primary-cta" to={REQUEST_PATH}>
            Encontrar instaladores <span aria-hidden="true">→</span>
          </Link>
          <a className="lp6-secondary-cta" href="#como-funciona">
            Ver como funciona
          </a>
        </div>
      </div>
    </section>
  );
}

function StoreCard({ duplicate, store }) {
  const href = store.link_url || STORE_CONTACT_URL;
  const label = store.cta_label || 'Conhecer loja';

  return (
    <article className="lp6-store-card">
      <a
        aria-label={`${label}: ${store.name}`}
        href={href}
        rel="noreferrer"
        tabIndex={duplicate ? -1 : 0}
        target="_blank"
      >
        <div className={`lp6-store-visual${store.image_url ? '' : ' is-empty'}`}>
          {store.image_url ? (
            <img
              alt=""
              loading="lazy"
              onError={(event) => {
                event.currentTarget.parentElement.classList.add('is-empty');
                event.currentTarget.remove();
              }}
              src={store.image_url}
            />
          ) : null}
          <div className="lp6-store-monogram" aria-hidden="true">
            <span>{store.name?.slice(0, 1) || 'I'}</span>
          </div>
          <small>Seleção InstalaPro</small>
        </div>
        <div className="lp6-store-copy">
          <div>
            <h3>{store.name}</h3>
            <p>{store.description || 'Papel de parede e atendimento especializado.'}</p>
          </div>
          <span className="lp6-store-arrow" aria-hidden="true">↗</span>
        </div>
      </a>
    </article>
  );
}

function StoreCarousel() {
  const [stores, setStores] = useState([]);
  const groupRef = useRef(null);
  const trackRef = useRef(null);

  useEffect(() => {
    let active = true;

    api.get('/public/recommended-stores')
      .then((response) => {
        if (!active) return;
        const nextStores = Array.isArray(response.data?.stores)
          ? response.data.stores.filter((store) => store?.is_active !== false).slice(0, 20)
          : [];
        setStores(nextStores);
      })
      .catch(() => {
        if (active) setStores([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const items = useMemo(() => {
    const source = stores.length ? stores : fallbackStores;
    return Array.from(
      { length: Math.max(5, source.length) },
      (_, index) => ({ ...source[index % source.length], instance: index })
    );
  }, [stores]);

  useEffect(() => {
    const track = trackRef.current;
    const group = groupRef.current;
    if (!track || !group) return undefined;

    let animationFrame;
    let previousTime = performance.now();
    let offset = 0;

    const moveCarousel = (currentTime) => {
      const elapsed = Math.min(50, currentTime - previousTime);
      const gap = Number.parseFloat(window.getComputedStyle(track).columnGap) || 0;
      const loopDistance = group.getBoundingClientRect().width + gap;

      previousTime = currentTime;
      if (loopDistance > 0) {
        offset = (offset + elapsed * 0.026) % loopDistance;
        track.style.transform = `translate3d(${-offset}px, 0, 0)`;
      }

      animationFrame = window.requestAnimationFrame(moveCarousel);
    };

    animationFrame = window.requestAnimationFrame(moveCarousel);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      track.style.removeProperty('transform');
    };
  }, [items]);

  const renderGroup = (duplicate = false) => (
    <div
      aria-hidden={duplicate}
      className="lp6-store-group"
      ref={duplicate ? undefined : groupRef}
    >
      {items.map((store) => (
        <StoreCard
          duplicate={duplicate}
          key={`${duplicate ? 'copy' : 'main'}-${store.id}-${store.instance}`}
          store={store}
        />
      ))}
    </div>
  );

  return (
    <div
      aria-label="Carrossel automático de lojas recomendadas"
      className="lp6-carousel"
      role="region"
    >
      <div className="lp6-carousel-track" ref={trackRef}>
        {renderGroup(false)}
        {renderGroup(true)}
      </div>
    </div>
  );
}

function Stores() {
  return (
    <section aria-labelledby="lp6-stores-title" className="lp6-stores" id="lojas">
      <div className="lp6-section-heading" data-reveal="rise">
        <p><span>Curadoria</span> para o seu projeto</p>
        <h2 id="lp6-stores-title">Lojas recomendadas.</h2>
        <a href={STORE_CONTACT_URL} rel="noreferrer" target="_blank">
          Anunciar minha loja <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div data-reveal="scale">
        <StoreCarousel />
      </div>
    </section>
  );
}

const processSteps = [
  {
    number: '01',
    title: 'Conte o que precisa.',
    text: 'Crie seu pedido com localização, medidas e detalhes do ambiente.',
  },
  {
    number: '02',
    title: 'Receba interessados.',
    text: 'Instaladores próximos encontram o projeto e demonstram interesse.',
  },
  {
    number: '03',
    title: 'Escolha quem chamar.',
    text: 'Compare os profissionais disponíveis e decida com quem conversar.',
  },
];

function Process() {
  return (
    <section aria-labelledby="lp6-process-title" className="lp6-process" id="como-funciona">
      <div className="lp6-process-intro" data-reveal="left">
        <p>Simples do início ao fim</p>
        <h2 id="lp6-process-title">
          Do pedido
          <em>à parede.</em>
        </h2>
      </div>

      <ol className="lp6-process-list">
        {processSteps.map((step) => (
          <li
            data-reveal="rise"
            key={step.number}
            style={{ '--lp6-reveal-delay': `${Number(step.number) * 110}ms` }}
          >
            <span>{step.number}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="lp6-final-cta" data-reveal="left">
        <p>Seu projeto pode começar agora.</p>
        <Link to={REQUEST_PATH}>
          Publicar meu pedido <span aria-hidden="true">→</span>
        </Link>
      </div>

      <footer className="lp6-footer" data-reveal="rise">
        <img alt="InstalaPro" src="/brand/instalapro-logo-transparent.png" />
        <p>Conecta quem precisa com quem sabe instalar.</p>
        <nav aria-label="Links institucionais">
          <Link to="/privacidade">Privacidade</Link>
          <Link to="/termos">Termos</Link>
          <a href="mailto:instalaproo@gmail.com">Contato</a>
        </nav>
        <span>© {new Date().getFullYear()} InstalaPro</span>
      </footer>
    </section>
  );
}

export default function ClientLanding() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousMotion = root.dataset.siteMotion;

    root.dataset.siteMotion = 'smooth';

    return () => {
      if (previousMotion) {
        root.dataset.siteMotion = previousMotion;
      } else {
        delete root.dataset.siteMotion;
      }
    };
  }, []);

  useEffect(() => {
    const page = document.querySelector('.lp6-page');
    if (!page) return undefined;

    const revealElements = Array.from(page.querySelectorAll('[data-reveal]'));
    let observer;

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
      );
      revealElements.forEach((element) => observer.observe(element));
    } else {
      revealElements.forEach((element) => element.classList.add('is-visible'));
    }

    const hero = page.querySelector('.lp6-hero');
    const finePointer = window.matchMedia('(min-width: 821px) and (pointer: fine)');

    const handlePointerMove = (event) => {
      if (!hero || !finePointer.matches) return;
      const bounds = hero.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
      const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
      hero.style.setProperty('--lp6-shift-x', `${(0.5 - x) * 12}px`);
      hero.style.setProperty('--lp6-shift-y', `${(0.5 - y) * 8}px`);
      hero.style.setProperty('--lp6-light-x', `${x * 100}%`);
      hero.style.setProperty('--lp6-light-y', `${y * 100}%`);
    };

    const resetPointer = () => {
      if (!hero) return;
      hero.style.setProperty('--lp6-shift-x', '0px');
      hero.style.setProperty('--lp6-shift-y', '0px');
      hero.style.setProperty('--lp6-light-x', '68%');
      hero.style.setProperty('--lp6-light-y', '40%');
    };

    hero?.addEventListener('pointermove', handlePointerMove, { passive: true });
    hero?.addEventListener('pointerleave', resetPointer);

    return () => {
      observer?.disconnect();
      hero?.removeEventListener('pointermove', handlePointerMove);
      hero?.removeEventListener('pointerleave', resetPointer);
    };
  }, []);

  return (
    <div className="lp6-page">
      <PageMetadata
        canonicalPath="/"
        description="Encontre instaladores de papel de parede verificados, envie seu pedido e acompanhe proposta e agendamento em um só lugar."
        title="InstalaPro | Encontre instaladores de papel de parede"
      />
      <a className="lp6-skip-link" href="#conteudo">Pular para o conteúdo</a>
      <Header />
      <main id="conteudo">
        <Hero />
        <Stores />
        <Process />
      </main>
    </div>
  );
}
