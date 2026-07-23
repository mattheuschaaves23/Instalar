import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import InstallAppButton from '../Layout/InstallAppButton';
import './ClientLandingLegacy.css';

const REQUEST_PATH = '/cliente';
const CLIENT_LOGIN_PATH = '/cliente/entrar';
const INSTALLER_LOGIN_PATH = '/instalador/entrar';
const INSTALLER_REGISTER_PATH = '/instalador/cadastro';

const navLinks = [
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#transformacao', label: 'A transformação' },
  { href: '#escolha', label: 'Como escolher' },
  { href: '#faq', label: 'Dúvidas' },
];

const steps = [
  {
    number: '01',
    eyebrow: 'O ponto de partida',
    title: 'Conte onde e o que você quer transformar.',
    text: 'Descreva o ambiente, o papel de parede e a localização do serviço. Se ainda não tiver as medidas, informe que precisa de visita.',
  },
  {
    number: '02',
    eyebrow: 'Conexão por região',
    title: 'Seu pedido encontra profissionais disponíveis.',
    text: 'Instaladores cadastrados que atendem a região podem visualizar a oportunidade e demonstrar interesse.',
  },
  {
    number: '03',
    eyebrow: 'A decisão é sua',
    title: 'Compare perfis antes de abrir a conversa.',
    text: 'Veja informações, trabalhos e avaliações disponíveis. Só depois da sua escolha o contato pelo WhatsApp é liberado.',
  },
];

const choicePoints = [
  {
    number: 'I',
    title: 'Portfólio e acabamento',
    text: 'Observe em fotos como o profissional resolve cantos, recortes, tomadas e encontros do papel.',
  },
  {
    number: 'II',
    title: 'Região e deslocamento',
    text: 'Confirme a área atendida, a necessidade de visita e qualquer custo de deslocamento antes de marcar.',
  },
  {
    number: 'III',
    title: 'Escopo bem combinado',
    text: 'Alinhe preparação da parede, material, prazo e valor diretamente com o instalador escolhido.',
  },
];

const faqs = [
  {
    question: 'O pedido é gratuito para o cliente?',
    answer: 'Sim. Criar o pedido e comparar os profissionais interessados não tem custo. O valor do serviço é combinado diretamente com o instalador escolhido.',
  },
  {
    question: 'Preciso saber a medida exata da parede?',
    answer: 'Não. Você pode informar medidas aproximadas ou indicar no pedido que precisa de uma visita para medir o ambiente.',
  },
  {
    question: 'Meu telefone fica visível para todos?',
    answer: 'Não. O contato é liberado somente depois que você escolhe o profissional com quem deseja conversar.',
  },
  {
    question: 'A InstalaPro executa a instalação?',
    answer: 'A InstalaPro faz a conexão. Condições, valores, materiais, visitas e execução são combinados entre cliente e instalador.',
  },
  {
    question: 'Sou instalador. Como começo?',
    answer: 'Crie seu perfil, informe as regiões que atende e conclua seu cadastro. O acesso pode ser testado gratuitamente por 7 dias.',
  },
];

function useLandingMotion(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const revealItems = [...root.querySelectorAll('[data-reveal]')];
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealItems.forEach((item) => item.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -9% 0px', threshold: 0.12 }
    );

    revealItems.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [rootRef]);
}

function Brand({ onClick }) {
  return (
    <Link aria-label="InstalaPro — início" className="lp-brand" onClick={onClick} to="/">
      <img alt="" aria-hidden="true" src="/brand/instalapro-mark.png" />
      <span>Instala<span>Pro</span></span>
    </Link>
  );
}

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    document.body.classList.toggle('lp-menu-lock', menuOpen);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.classList.remove('lp-menu-lock');
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`lp-nav${menuOpen ? ' is-menu-open' : ''}`}>
      <Brand onClick={closeMenu} />

      <nav aria-label="Navegação principal" className="lp-nav-links">
        {navLinks.map((item) => (
          <a href={item.href} key={item.href}>{item.label}</a>
        ))}
      </nav>

      <div className="lp-nav-actions">
        <Link className="lp-nav-login" to={CLIENT_LOGIN_PATH}>Entrar</Link>
        <Link className="lp-button lp-button-small lp-button-light" to={REQUEST_PATH}>
          Pedir instalação
          <span aria-hidden="true">↗</span>
        </Link>
      </div>

      <button
        aria-controls="lp-mobile-menu"
        aria-expanded={menuOpen}
        aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
        className={`lp-menu-trigger${menuOpen ? ' is-open' : ''}`}
        onClick={() => setMenuOpen((open) => !open)}
        type="button"
      >
        <span />
        <span />
      </button>

      <div className={`lp-mobile-menu${menuOpen ? ' is-open' : ''}`} id="lp-mobile-menu">
        <div className="lp-mobile-menu-head">
          <span>Menu</span>
          <span>InstalaPro®</span>
        </div>
        <nav aria-label="Navegação mobile">
          {navLinks.map((item, index) => (
            <a href={item.href} key={item.href} onClick={closeMenu}>
              <span>0{index + 1}</span>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="lp-mobile-menu-actions">
          <Link className="lp-button lp-button-dark" onClick={closeMenu} to={REQUEST_PATH}>
            Encontrar instalador <span aria-hidden="true">→</span>
          </Link>
          <Link onClick={closeMenu} to={INSTALLER_LOGIN_PATH}>Acesso do instalador</Link>
          <Link onClick={closeMenu} to={CLIENT_LOGIN_PATH}>Acompanhar meu pedido</Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const heroRef = useRef(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const handlePointer = (event) => {
      const bounds = hero.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      hero.style.setProperty('--hero-x', x.toFixed(3));
      hero.style.setProperty('--hero-y', y.toFixed(3));
    };

    hero.addEventListener('pointermove', handlePointer);
    return () => hero.removeEventListener('pointermove', handlePointer);
  }, []);

  return (
    <section className="lp-hero" ref={heroRef}>
      <img
        alt="Instalador aplicando papel de parede em um ambiente sofisticado"
        className="lp-hero-image"
        fetchpriority="high"
        src="/landing/hero-installer-editorial.jpg"
      />
      <div className="lp-hero-shade" />
      <div className="lp-hero-orbit" aria-hidden="true">
        <span>PROFISSIONAIS DA SUA REGIÃO • SUA ESCOLHA •</span>
      </div>

      <div className="lp-hero-content">
        <p className="lp-kicker lp-hero-kicker">
          <span />
          Conexão para instalar bem
        </p>
        <h1>
          A parede muda.
          <em>O jeito de encontrar</em>
          quem instala também.
        </h1>
        <p className="lp-hero-copy">
          Conte o que precisa, encontre instaladores que atendem sua região e escolha com quem quer conversar.
        </p>
        <div className="lp-hero-actions">
          <Link className="lp-button lp-button-gold" to={REQUEST_PATH}>
            Encontrar um instalador
            <span aria-hidden="true">↗</span>
          </Link>
          <a className="lp-text-link" href="#como-funciona">
            Entender o processo
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </div>

      <div className="lp-hero-proof" aria-label="Informações importantes">
        <span>Grátis para clientes</span>
        <span>Você decide</span>
        <span>Contato protegido</span>
      </div>

      <p className="lp-scroll-note">
        <span aria-hidden="true" />
        Role para descobrir
      </p>
    </section>
  );
}

function StatementBand() {
  return (
    <section className="lp-statement" aria-label="Manifesto">
      <p data-reveal>
        Não é sobre achar <span>qualquer pessoa.</span>
        <br />
        É sobre encontrar o profissional certo para o seu espaço.
      </p>
      <div className="lp-marquee" aria-hidden="true">
        <div>
          <span>Papel de parede</span><i>✦</i>
          <span>Painéis</span><i>✦</i>
          <span>Revestimentos</span><i>✦</i>
          <span>Transformação</span><i>✦</i>
          <span>Papel de parede</span><i>✦</i>
          <span>Painéis</span><i>✦</i>
          <span>Revestimentos</span><i>✦</i>
          <span>Transformação</span><i>✦</i>
        </div>
      </div>
    </section>
  );
}

function ProcessSection() {
  return (
    <section className="lp-process" id="como-funciona">
      <header className="lp-section-head" data-reveal>
        <p className="lp-kicker"><span /> Simples por desenho</p>
        <h2>Três movimentos.<br /><em>Uma escolha melhor.</em></h2>
        <p>A tecnologia organiza o encontro. A decisão continua humana — e continua sendo sua.</p>
      </header>

      <div className="lp-process-list">
        {steps.map((step, index) => (
          <article data-reveal key={step.number} style={{ '--delay': `${index * 90}ms` }}>
            <div className="lp-step-number">{step.number}</div>
            <div className="lp-step-copy">
              <p>{step.eyebrow}</p>
              <h3>{step.title}</h3>
              <span>{step.text}</span>
            </div>
            <div className="lp-step-arrow" aria-hidden="true">↘</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TransformationSection() {
  return (
    <section className="lp-transformation" id="transformacao">
      <div className="lp-transformation-copy" data-reveal>
        <p className="lp-kicker"><span /> Do vazio ao inesquecível</p>
        <h2>Uma parede pode mudar a <em>atmosfera inteira.</em></h2>
        <p>
          O papel certo transforma o ambiente. A aplicação certa faz a transformação durar.
        </p>
        <Link className="lp-text-link lp-text-link-dark" to={REQUEST_PATH}>
          Começar meu pedido <span aria-hidden="true">↗</span>
        </Link>
      </div>

      <div className="lp-room-comparison" data-reveal>
        <figure className="lp-room lp-room-before">
          <img alt="Sala clara antes da aplicação do papel de parede" loading="lazy" src="/landing/room-before-editorial.jpg" />
          <figcaption><span>Antes</span> Potencial em branco</figcaption>
        </figure>
        <figure className="lp-room lp-room-after">
          <img alt="A mesma sala transformada com papel de parede tropical" loading="lazy" src="/landing/room-after-editorial.jpg" />
          <figcaption><span>Depois</span> Identidade na parede</figcaption>
        </figure>
        <div className="lp-comparison-seal" aria-hidden="true">
          <span>ANTES</span>
          <i>→</i>
          <span>DEPOIS</span>
        </div>
      </div>
    </section>
  );
}

function ChoiceSection() {
  return (
    <section className="lp-choice" id="escolha">
      <div className="lp-choice-title" data-reveal>
        <p className="lp-kicker"><span /> Antes de escolher</p>
        <h2>Repare nos <em>detalhes.</em></h2>
        <p>A plataforma aproxima. Estas perguntas ajudam você a conduzir a conversa com clareza.</p>
      </div>

      <div className="lp-choice-list">
        {choicePoints.map((point, index) => (
          <article data-reveal key={point.number} style={{ '--delay': `${index * 80}ms` }}>
            <span>{point.number}</span>
            <h3>{point.title}</h3>
            <p>{point.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function InstallerSection() {
  return (
    <section className="lp-installer">
      <div className="lp-installer-word" aria-hidden="true">PRO</div>
      <div className="lp-installer-copy" data-reveal>
        <p className="lp-kicker"><span /> Para quem faz acontecer</p>
        <h2>Seu trabalho merece chegar <em>mais longe.</em></h2>
        <p>
          Crie seu perfil, informe as regiões que atende e encontre oportunidades alinhadas ao seu serviço.
        </p>
        <div className="lp-installer-actions">
          <Link className="lp-button lp-button-light" to={INSTALLER_REGISTER_PATH}>
            Testar grátis por 7 dias <span aria-hidden="true">↗</span>
          </Link>
          <Link className="lp-text-link" to={INSTALLER_LOGIN_PATH}>
            Já tenho cadastro <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
      <div className="lp-installer-lines" aria-hidden="true"><span /><span /><span /></div>
    </section>
  );
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="lp-faq" id="faq">
      <header className="lp-faq-heading" data-reveal>
        <p className="lp-kicker"><span /> Sem letras miúdas</p>
        <h2>Perguntas que<br /><em>merecem resposta.</em></h2>
      </header>

      <div className="lp-faq-list" data-reveal>
        {faqs.map((item, index) => {
          const open = openIndex === index;
          return (
            <article className={open ? 'is-open' : ''} key={item.question}>
              <button
                aria-controls={`faq-answer-${index}`}
                aria-expanded={open}
                onClick={() => setOpenIndex(open ? -1 : index)}
                type="button"
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                {item.question}
                <i aria-hidden="true" />
              </button>
              <div id={`faq-answer-${index}`} role="region">
                <p>{item.answer}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="lp-final-cta">
      <div data-reveal>
        <p>Seu ambiente já pode começar a mudar.</p>
        <h2>Encontre quem<br /><em>instala bem.</em></h2>
        <Link className="lp-button lp-button-dark" to={REQUEST_PATH}>
          Fazer meu pedido grátis <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <p aria-hidden="true" className="lp-final-script">transforme.</p>
    </section>
  );
}

function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-main">
        <Brand />
        <p>Conectando bons profissionais<br />a paredes cheias de possibilidades.</p>
        <div className="lp-footer-links">
          <div>
            <span>Clientes</span>
            <Link to={REQUEST_PATH}>Criar pedido</Link>
            <Link to={CLIENT_LOGIN_PATH}>Acompanhar pedido</Link>
          </div>
          <div>
            <span>Instaladores</span>
            <Link to={INSTALLER_REGISTER_PATH}>Criar perfil</Link>
            <Link to={INSTALLER_LOGIN_PATH}>Entrar</Link>
          </div>
          <div>
            <span>Explore</span>
            <a href="#como-funciona">Como funciona</a>
            <a href="#faq">Dúvidas</a>
          </div>
        </div>
      </div>

      <div className="lp-footer-bottom">
        <span>© {new Date().getFullYear()} InstalaPro</span>
        <span>Feito para aproximar.</span>
        <InstallAppButton className="lp-install-app" compact />
      </div>
    </footer>
  );
}

export default function ClientLandingLegacy() {
  const rootRef = useRef(null);
  useLandingMotion(rootRef);

  return (
    <div className="lp-page" ref={rootRef}>
      <a className="lp-skip-link" href="#conteudo">Pular para o conteúdo</a>
      <Navbar />
      <main id="conteudo">
        <Hero />
        <StatementBand />
        <ProcessSection />
        <TransformationSection />
        <ChoiceSection />
        <InstallerSection />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
