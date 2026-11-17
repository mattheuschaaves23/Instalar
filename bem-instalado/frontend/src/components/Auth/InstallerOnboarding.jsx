import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import BrandWordmark from '../Layout/BrandWordmark';

const IS_INSTALLER_APP = process.env.REACT_APP_INSTALLER_APP === 'true';

const slides = [
  {
    eyebrow: 'BEM-VINDO AO INSTALARPRO',
    title: 'Seu próximo serviço começa aqui.',
    copy: 'Encontre pedidos próximos e responda às melhores oportunidades.',
    visual: 'worker',
  },
  {
    eyebrow: 'OPORTUNIDADES',
    title: 'Pedidos da sua região, sem perder tempo.',
    copy: 'Veja distância, tipo de serviço e detalhes antes de demonstrar interesse.',
    visual: 'requests',
  },
  {
    eyebrow: 'TUDO ORGANIZADO',
    title: 'Clientes, agenda e orçamentos em um só app.',
    copy: 'Acompanhe cada atendimento do primeiro contato até a conclusão.',
    visual: 'organize',
  },
];

function RequestsVisual() {
  return (
    <div className="installer-onboarding-phone" aria-hidden="true">
      <div className="installer-onboarding-phone-head">
        <span />
        <i />
      </div>
      <article>
        <span className="installer-onboarding-request-icon">01</span>
        <div>
          <strong>Papel de parede</strong>
          <small>2,4 km de você</small>
        </div>
        <b>novo</b>
      </article>
      <article>
        <span className="installer-onboarding-request-icon">02</span>
        <div>
          <strong>Instalação residencial</strong>
          <small>Hoje, às 14h</small>
        </div>
        <b>novo</b>
      </article>
      <div className="installer-onboarding-phone-action">Ver oportunidades</div>
    </div>
  );
}

function OrganizeVisual() {
  return (
    <div className="installer-onboarding-organize" aria-hidden="true">
      <div className="installer-onboarding-orbit installer-onboarding-orbit-one" />
      <div className="installer-onboarding-orbit installer-onboarding-orbit-two" />
      <article className="installer-onboarding-mini-card is-main">
        <span className="installer-onboarding-check">✓</span>
        <div>
          <small>Próximo atendimento</small>
          <strong>Hoje, 14:30</strong>
        </div>
      </article>
      <article className="installer-onboarding-mini-card is-budget">
        <small>Orçamento enviado</small>
        <strong>R$ 680</strong>
      </article>
      <article className="installer-onboarding-mini-card is-client">
        <span>MC</span>
        <div>
          <small>Novo cliente</small>
          <strong>Mariana Costa</strong>
        </div>
      </article>
    </div>
  );
}

export default function InstallerOnboarding() {
  const navigate = useNavigate();
  const { loading, user } = useAuth();
  const trackRef = useRef(null);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (!loading && (user?.account_type === 'installer' || user?.is_admin)) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, navigate, user]);

  if (!IS_INSTALLER_APP) {
    return <Navigate replace to="/instalador/entrar" />;
  }

  const goToSlide = (index) => {
    const safeIndex = Math.max(0, Math.min(index, slides.length - 1));
    const track = trackRef.current;

    if (track) {
      track.scrollTo({ left: track.clientWidth * safeIndex, behavior: 'smooth' });
    }

    setActiveSlide(safeIndex);
  };

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track?.clientWidth) return;

    const nextIndex = Math.round(track.scrollLeft / track.clientWidth);
    setActiveSlide(Math.max(0, Math.min(nextIndex, slides.length - 1)));
  };

  const handleContinue = () => {
    if (activeSlide === slides.length - 1) {
      navigate('/instalador/entrar');
      return;
    }

    goToSlide(activeSlide + 1);
  };

  return (
    <main className="installer-onboarding-page">
      <header className="installer-onboarding-header">
        <BrandWordmark className="installer-onboarding-logo" size="md" />
        <button onClick={() => navigate('/instalador/entrar')} type="button">
          Pular
        </button>
      </header>

      <section
        aria-label="Apresentação do aplicativo"
        className="installer-onboarding-track"
        onScroll={handleScroll}
        ref={trackRef}
      >
        {slides.map((slide, index) => (
          <article
            aria-hidden={activeSlide !== index}
            className={`installer-onboarding-slide is-${slide.visual}`}
            key={slide.title}
          >
            <div className="installer-onboarding-visual">
              {slide.visual === 'worker' ? (
                <>
                  <img alt="Instalador trabalhando em um ambiente" src="/auth/installer-login-worker-instalarpro-2026.jpg" />
                  <div className="installer-onboarding-worker-badge">
                    <span>✓</span>
                    <div>
                      <small>Novo pedido</small>
                      <strong>Perto de você</strong>
                    </div>
                  </div>
                </>
              ) : null}
              {slide.visual === 'requests' ? <RequestsVisual /> : null}
              {slide.visual === 'organize' ? <OrganizeVisual /> : null}
            </div>

            <div className="installer-onboarding-copy">
              <p>{slide.eyebrow}</p>
              <h1>{slide.title}</h1>
              <span>{slide.copy}</span>
            </div>
          </article>
        ))}
      </section>

      <footer className="installer-onboarding-footer">
        <div className="installer-onboarding-dots" aria-label="Escolher tela">
          {slides.map((slide, index) => (
            <button
              aria-label={`Ir para a tela ${index + 1}`}
              aria-current={activeSlide === index ? 'step' : undefined}
              className={activeSlide === index ? 'is-active' : ''}
              key={slide.title}
              onClick={() => goToSlide(index)}
              type="button"
            />
          ))}
        </div>

        <button className="installer-onboarding-continue" onClick={handleContinue} type="button">
          <span>{activeSlide === slides.length - 1 ? 'Ir para o login' : 'Continuar'}</span>
          <b aria-hidden="true">→</b>
        </button>
      </footer>
    </main>
  );
}
