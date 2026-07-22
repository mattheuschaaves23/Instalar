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
  { href: '#avaliacoes', label: 'Antes de escolher' },
  { href: '#faq', label: 'Dúvidas' },
];

const trustStats = [
  {
    icon: 'map-pin-filled',
    number: '01',
    title: [{ text: 'Informe o ' }, { accent: true, text: 'local' }],
    label: 'Diga a cidade e o bairro onde o serviço será feito.',
  },
  {
    icon: 'tag',
    number: '02',
    title: [{ text: 'Receba ' }, { accent: true, text: 'respostas' }],
    label: 'Instaladores que atendem a região podem se interessar.',
  },
  {
    icon: 'user-check',
    number: '03',
    title: [{ text: 'Compare com ' }, { accent: true, text: 'calma' }],
    label: 'Veja o perfil e os trabalhos antes de decidir.',
  },
  {
    icon: 'whatsapp',
    number: '04',
    title: [{ text: 'Chame no ' }, { accent: true, text: 'WhatsApp' }],
    label: 'Seu contato só é liberado para o profissional escolhido.',
  },
];

const steps = [
  {
    number: '01',
    icon: 'clipboard',
    title: 'Conte o que precisa',
    description: 'Informe o ambiente, o tipo de papel e onde será a instalação.',
  },
  {
    number: '02',
    icon: 'users',
    title: 'Aguarde os interessados',
    description: 'O pedido aparece para instaladores que atendem a sua região.',
  },
  {
    number: '03',
    icon: 'message-circle',
    title: 'Escolha com quem falar',
    description: 'Compare os perfis e libere o WhatsApp de quem você escolher.',
  },
];

const features = [
  {
    icon: 'map-pin',
    title: 'Pedido por região',
    description: 'Cidade, estado e bairro ajudam o pedido a aparecer para instaladores mais próximos.',
  },
  {
    icon: 'clipboard',
    title: 'Informações do pedido',
    description: 'O cliente descreve o ambiente, o tipo de papel e se precisa de visita para medir.',
  },
  {
    icon: 'star',
    title: 'Avaliações quando disponíveis',
    description: 'Quando houver avaliações no perfil, elas ajudam a comparar atendimento e acabamento.',
  },
  {
    icon: 'message-circle',
    title: 'Contato Direto',
    description: 'Depois de escolher um interessado, o cliente pode chamar o profissional no WhatsApp.',
  },
  {
    icon: 'users',
    title: 'Instaladores interessados',
    description: 'Os profissionais visualizam oportunidades compatíveis e decidem se querem participar.',
  },
  {
    icon: 'check-circle',
    title: 'Decisão do cliente',
    description: 'O cliente compara os interessados e decide com quem quer seguir a conversa.',
  },
];

const demoStats = [
  { icon: 'users', value: 'Interesse', label: 'Instaladores' },
  { icon: 'star', value: 'Perfil', label: 'Avaliações' },
  { icon: 'trending-up', value: 'Região', label: 'Prioridade' },
];

const choiceGuides = [
  {
    id: 1,
    icon: 'map-pin',
    title: 'Atende a sua região?',
    text: 'Confirme se o instalador atende a sua cidade e se cobra deslocamento.',
    detail: 'Combine isso antes de marcar uma visita.',
  },
  {
    id: 2,
    icon: 'star',
    title: 'Há trabalhos anteriores?',
    text: 'Veja fotos e avaliações quando estiverem disponíveis no perfil.',
    detail: 'Pergunte sobre acabamento e preparação da parede.',
  },
  {
    id: 3,
    icon: 'clipboard',
    title: 'O combinado ficou claro?',
    text: 'Alinhe por escrito o valor, a data, o material e o que será feito.',
    detail: 'Guarde a conversa até a conclusão do serviço.',
  },
];

const faqs = [
  {
    question: 'Como funciona o processo de solicitação?',
    answer: 'Você preenche o pedido com ambiente, material, medidas ou necessidade de visita e localização. Instaladores próximos podem demonstrar interesse. Depois, você escolhe com quem quer conversar pelo WhatsApp.',
  },
  {
    question: 'A solicitação tem custo para o cliente?',
    answer: 'A solicitação pelo site é gratuita para o cliente. O valor final do serviço, prazo e visita são combinados diretamente entre você e o instalador escolhido.',
  },
  {
    question: 'Como escolher um instalador com mais segurança?',
    answer: 'Analise as informações disponíveis no perfil, as avaliações, a região atendida e a conversa pelo WhatsApp. Antes de fechar, confirme o material, o prazo, a visita e os detalhes do local.',
  },
  {
    question: 'E se eu não souber as medidas?',
    answer: 'Você pode informar que precisa de visita técnica. Assim o instalador entende que a medição deve ser confirmada antes do orçamento final.',
  },
  {
    question: 'Aparece para instaladores de qualquer lugar?',
    answer: 'A localização informada no pedido ajuda a priorizar profissionais mais próximos. A disponibilidade depende dos instaladores cadastrados em cada região.',
  },
  {
    question: 'Posso escolher mais de um instalador para avaliar?',
    answer: 'Você pode comparar os interessados antes de decidir quem chamar. O contato direto acontece com o profissional que você escolher.',
  },
];

const footerLinks = {
  produto: [
    { label: 'Como funciona', href: '#como-funciona' },
    { label: 'Antes de escolher', href: '#avaliacoes' },
    { label: 'Dúvidas', href: '#faq' },
  ],
  pedido: [
    { label: 'Criar pedido', href: REQUEST_PATH },
    { label: 'Acompanhar meu pedido', href: '/cliente/pedido' },
    { label: 'Entrar como cliente', href: CLIENT_LOGIN_PATH },
  ],
};

function Icon({ name, className = '', filled = false, size = 24 }) {
  const commonProps = {
    className,
    fill: filled ? 'currentColor' : 'none',
    height: size,
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
    width: size,
    xmlns: 'http://www.w3.org/2000/svg',
  };

  switch (name) {
    case 'menu':
      return (
        <svg {...commonProps}>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
    case 'x':
      return (
        <svg {...commonProps}>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      );
    case 'arrow-right':
      return (
        <svg {...commonProps}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg {...commonProps}>
          <path d="m12 3 1.65 4.35L18 9l-4.35 1.65L12 15l-1.65-4.35L6 9l4.35-1.65L12 3Z" />
          <path d="m19 14 .82 2.18L22 17l-2.18.82L19 20l-.82-2.18L16 17l2.18-.82L19 14Z" />
          <path d="m5 13 1 2.7L9 17l-3 1.3L5 21l-1-2.7L1 17l3-1.3L5 13Z" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...commonProps}>
          <path d="M12 3.2 5.4 5.9v5.2c0 4.2 2.8 8 6.6 9.7 3.8-1.7 6.6-5.5 6.6-9.7V5.9L12 3.2Z" />
          <path d="m9.5 12 1.7 1.8 3.4-3.8" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.2V12l3 1.8" />
        </svg>
      );
    case 'clipboard':
      return (
        <svg {...commonProps}>
          <path d="M9 4h6l1 2h2a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 6 6h2l1-2Z" />
          <path d="M9 6h6M8 11h8M8 15h5" />
        </svg>
      );
    case 'tag':
      return (
        <svg {...commonProps} fill="none" stroke="none" viewBox="0 0 64 64">
          <path
            d="M13.6 35.2 35.2 13.6h15.3v15.3L28.9 50.5a5.4 5.4 0 0 1-7.6 0l-7.7-7.7a5.4 5.4 0 0 1 0-7.6Z"
            fill="currentColor"
          />
          <circle cx="45.5" cy="21.2" fill="#0a0a0a" r="3.4" />
          <path
            d="M27.6 39.8c3.5 2.6 9.6-.5 6-4.8-1.8-2.2-6.9-.8-6.9-4.5 0-3.4 5.3-5.3 8.8-2.6"
            fill="none"
            stroke="#0a0a0a"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3.4"
          />
          <path
            d="M31.5 25.4v17"
            fill="none"
            stroke="#0a0a0a"
            strokeLinecap="round"
            strokeWidth="3.4"
          />
        </svg>
      );
    case 'users':
      return (
        <svg {...commonProps}>
          <path d="M16 21v-1.3A4.7 4.7 0 0 0 11.3 15H7.7A4.7 4.7 0 0 0 3 19.7V21" />
          <circle cx="9.5" cy="8" r="3.2" />
          <path d="M21 21v-1.3a4.3 4.3 0 0 0-3.1-4.15" />
          <path d="M15.8 4.9a3.2 3.2 0 0 1 0 6.2" />
        </svg>
      );
    case 'user-check':
      return (
        <svg {...commonProps} fill="none" stroke="none" viewBox="0 0 64 64">
          <circle cx="27.5" cy="21" fill="currentColor" r="10.5" />
          <path
            d="M10 54c1.4-11.8 8-18.1 17.5-18.1 7.1 0 12.7 3.5 15.6 10.3A13 13 0 0 0 36.5 54H10Z"
            fill="currentColor"
          />
          <circle cx="46" cy="45" fill="currentColor" r="11" />
          <path
            d="m40.8 45.2 3.5 3.5 7-8"
            fill="none"
            stroke="#0a0a0a"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
        </svg>
      );
    case 'message-circle':
    case 'message-square':
      return (
        <svg {...commonProps}>
          <path d="M5 6.5h14A1.5 1.5 0 0 1 20.5 8v8A1.5 1.5 0 0 1 19 17.5H9L4.5 20v-4A1.5 1.5 0 0 1 3.5 14.5V8A1.5 1.5 0 0 1 5 6.5Z" />
        </svg>
      );
    case 'handshake':
      return (
        <svg {...commonProps}>
          <path d="M7.5 12.5 10 15a2 2 0 0 0 2.8 0l1.1-1.1" />
          <path d="m14 8 2.5 2.5a2.2 2.2 0 0 1 0 3.1l-3.6 3.6a3 3 0 0 1-4.2 0L4 12.5" />
          <path d="m20 12-4-4-2.4 2.4a2 2 0 0 1-2.8 0L10 9.6 13.6 6H16l4 4" />
          <path d="M3 11 7 7" />
        </svg>
      );
    case 'star':
      return (
        <svg {...commonProps}>
          <path d="m12 3.8 2.45 4.96 5.48.8-3.97 3.86.94 5.46L12 16.5l-4.9 2.58.94-5.46-3.97-3.86 5.48-.8L12 3.8Z" />
        </svg>
      );
    case 'check-circle':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m8.6 12.2 2.2 2.2 4.8-5" />
        </svg>
      );
    case 'search':
      return (
        <svg {...commonProps}>
          <circle cx="11" cy="11" r="6.8" />
          <path d="m20 20-3.7-3.7" />
        </svg>
      );
    case 'zap':
      return (
        <svg {...commonProps}>
          <path d="m13 2-8 12h6l-1 8 9-13h-6l1-7Z" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...commonProps}>
          <path d="M6 9a6 6 0 0 1 12 0v4.2l1.6 2.4a1 1 0 0 1-.83 1.55H5.23a1 1 0 0 1-.83-1.55L6 13.2V9Z" />
          <path d="M10 18a2 2 0 0 0 4 0" />
        </svg>
      );
    case 'trending-up':
      return (
        <svg {...commonProps}>
          <path d="m3 17 6-6 4 4 7-8" />
          <path d="M14 7h6v6" />
        </svg>
      );
    case 'quote':
      return (
        <svg {...commonProps}>
          <path d="M9 7H5.5A2.5 2.5 0 0 0 3 9.5V14h5v-4H5.5" />
          <path d="M21 7h-3.5A2.5 2.5 0 0 0 15 9.5V14h5v-4h-2.5" />
        </svg>
      );
    case 'chevron-left':
      return (
        <svg {...commonProps}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      );
    case 'chevron-right':
      return (
        <svg {...commonProps}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    case 'chevron-down':
      return (
        <svg {...commonProps}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case 'help-circle':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9.8 9.4a2.4 2.4 0 1 1 3.6 2.1c-.9.5-1.4 1-1.4 2" />
          <path d="M12 17h.01" />
        </svg>
      );
    case 'instagram':
      return (
        <svg {...commonProps}>
          <rect height="15" rx="4" width="15" x="4.5" y="4.5" />
          <circle cx="12" cy="12" r="3.3" />
          <path d="M16.8 7.2h.01" />
        </svg>
      );
    case 'twitter':
      return (
        <svg {...commonProps}>
          <path d="M22 5.9c-.7.3-1.4.5-2.2.6.8-.5 1.3-1.2 1.6-2.1-.7.4-1.5.8-2.4 1A3.75 3.75 0 0 0 12.6 8.8c0 .3 0 .6.1.9A10.6 10.6 0 0 1 5 5.8a3.75 3.75 0 0 0 1.2 5 3.6 3.6 0 0 1-1.7-.5v.1a3.75 3.75 0 0 0 3 3.7 3.8 3.8 0 0 1-1.7.1 3.76 3.76 0 0 0 3.5 2.6A7.5 7.5 0 0 1 3 18.3 10.6 10.6 0 0 0 8.7 20c6.9 0 10.7-5.7 10.7-10.7v-.5A7.6 7.6 0 0 0 22 5.9Z" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg {...commonProps}>
          <path d="M16 8a5 5 0 0 1 5 5v6h-3v-6a2 2 0 0 0-4 0v6h-3V9h3v1.4A4 4 0 0 1 16 8Z" />
          <path d="M4 9h3v10H4z" />
          <circle cx="5.5" cy="5.5" r="1.5" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...commonProps}>
          <path d="M4.5 6.5h15v11h-15z" />
          <path d="m5 7 7 6 7-6" />
        </svg>
      );
    case 'map-pin-filled':
      return (
        <svg {...commonProps} fill="none" stroke="none" viewBox="0 0 64 64">
          <path
            d="M32 8c-10.2 0-18.5 8-18.5 18 0 13.2 18.5 30 18.5 30s18.5-16.8 18.5-30C50.5 16 42.2 8 32 8Z"
            fill="currentColor"
          />
          <circle cx="32" cy="26" fill="#0a0a0a" r="6.2" />
          <ellipse cx="32" cy="54" fill="currentColor" opacity="0.76" rx="12.5" ry="4" />
        </svg>
      );
    case 'map-pin':
      return (
        <svg {...commonProps}>
          <path d="M12 21s6-5.33 6-11a6 6 0 1 0-12 0c0 5.67 6 11 6 11Z" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...commonProps}>
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.7 19.7 0 0 1 3.1 5.2 2 2 0 0 1 5.1 3h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.45 2.1L9 10.5a16 16 0 0 0 4.5 4.5l1.2-1.25a2 2 0 0 1 2.1-.45c.8.3 1.6.5 2.5.6a2 2 0 0 1 1.7 2Z" />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg {...commonProps} fill="none" viewBox="0 0 64 64">
          <path
            d="M12.5 54 15.8 43.7A21.5 21.5 0 1 1 24 51.5L12.5 54Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="5"
          />
          <path
            d="M24.5 22.5c.5-1.2 1-1.5 1.8-1.5h2c.6 0 1.1.4 1.4 1.1l2 4.7c.3.7.2 1.3-.3 1.9l-1.4 1.6c-.5.6-.5 1.1 0 1.8 1.6 2.7 4 4.9 7 6.5.8.4 1.3.3 1.9-.4l1.6-1.9c.5-.6 1.2-.8 1.9-.5l4.7 2.2c.7.3 1 .8 1 1.5-.1 2-.8 3.7-2.1 4.9-1.4 1.3-3.5 1.7-6.1 1-6.1-1.6-14.5-7.7-17.1-15.6-1-3-.5-5.6 1.7-7.3Z"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      );
    default:
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

function SmartLink({ href, children, className = '', onClick, ...props }) {
  if (href?.startsWith('/')) {
    return (
      <Link className={className} onClick={onClick} to={href} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <a className={className} href={href || '#'} onClick={onClick} {...props}>
      {children}
    </a>
  );
}

function AnimatedSection({ children, className = '', delay = 0, direction = 'up' }) {
  return (
    <div
      className={`landing-reveal landing-reveal-${direction} ${className}`}
      style={{ '--landing-delay': `${delay}s` }}
    >
      {children}
    </div>
  );
}

function StaggerContainer({ children, className = '' }) {
  return <div className={`landing-stagger ${className}`}>{children}</div>;
}

function LogoMark({ compact = false }) {
  return (
    <SmartLink aria-label="InstalaPro - início" href="/" className="group inline-flex items-center">
      <img
        alt="Logo InstalaPro"
        className={compact ? 'h-auto w-12' : 'h-auto w-[clamp(10.5rem,18vw,13.5rem)]'}
        src={compact ? '/brand/instalapro-mark.png' : '/brand/instalapro-logo.png'}
      />
    </SmartLink>
  );
}

function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <nav className={`landing-navbar fixed left-0 right-0 top-0 z-50 transition-all duration-500 ${isScrolled ? 'glass-strong py-3' : 'py-5'}`}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center justify-between">
            <LogoMark />

            <div className="hidden items-center gap-8 xl:flex">
              {navLinks.map((link) => (
                <SmartLink
                  className="group relative text-sm text-white/70 transition-colors hover:text-white"
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 h-px w-0 bg-gradient-to-r from-[#cda349] to-[#f0d28a] transition-all group-hover:w-full" />
                </SmartLink>
              ))}
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              <InstallAppButton
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#cda349]/35 px-5 text-sm font-semibold text-[#f0d28a] transition-all hover:border-[#f0d28a]/70 hover:bg-[#cda349]/10"
                compact
              />
              <SmartLink
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-semibold text-white/85 transition-all hover:border-[#cda349]/50 hover:bg-white/5 hover:text-white"
                href={CLIENT_LOGIN_PATH}
              >
                Login cliente
              </SmartLink>
              <SmartLink
                className="btn-shine relative inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-[#cda349] to-[#d8ad55] px-5 text-sm font-semibold text-black shadow-lg shadow-[#cda349]/20 transition-all hover:scale-105 hover:shadow-[#cda349]/35"
                href={INSTALLER_LOGIN_PATH}
              >
                Login instalador
              </SmartLink>
              <SmartLink
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#cda349]/35 px-5 text-sm font-semibold text-[#f0d28a] transition-all hover:border-[#f0d28a]/70 hover:bg-[#cda349]/10"
                href={REQUEST_PATH}
              >
                Encontrar instalador
              </SmartLink>
            </div>

            <div className="landing-navbar-mobile-actions flex items-center gap-1.5 lg:hidden">
              <SmartLink
                aria-label="Entrar como cliente"
                className="landing-navbar-mobile-login inline-flex min-h-10 items-center justify-center rounded-full border border-white/15 px-2 text-[11px] font-semibold text-white/85 transition-all hover:border-[#cda349]/50 hover:bg-white/5 hover:text-white"
                href={CLIENT_LOGIN_PATH}
              >
                Cliente
              </SmartLink>
              <SmartLink
                aria-label="Entrar como instalador"
                className="landing-navbar-mobile-register inline-flex min-h-10 items-center justify-center rounded-full bg-gradient-to-r from-[#cda349] to-[#d8ad55] px-2 text-[11px] font-semibold text-black shadow-lg shadow-[#cda349]/20"
                href={INSTALLER_LOGIN_PATH}
              >
                Instalador
              </SmartLink>
              <button
                aria-label={isMobileOpen ? 'Fechar menu' : 'Abrir menu'}
                className="relative z-50 p-2 text-white"
                onClick={() => setIsMobileOpen((current) => !current)}
                type="button"
              >
                <Icon name={isMobileOpen ? 'x' : 'menu'} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {isMobileOpen ? (
        <div className="landing-mobile-menu fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />
          <div className="absolute right-0 top-0 h-full w-4/5 max-w-sm bg-[#0a0a0a] p-6 pt-24 shadow-2xl shadow-black">
            <div className="flex flex-col gap-6">
              {navLinks.map((link) => (
                <SmartLink
                  className="text-2xl font-medium text-white/80 transition-colors hover:text-[#cda349]"
                  href={link.href}
                  key={link.href}
                  onClick={() => setIsMobileOpen(false)}
                >
                  {link.label}
                </SmartLink>
              ))}
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d8ad55]">
                Escolha seu acesso
              </p>
              <div className="grid grid-cols-1 gap-3">
                <SmartLink
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-4 text-base font-semibold text-white/85"
                  href={CLIENT_LOGIN_PATH}
                  onClick={() => setIsMobileOpen(false)}
                >
                  Entrar como cliente
                </SmartLink>
                <SmartLink
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#cda349] to-[#d8ad55] px-4 text-base font-semibold text-black"
                  href={INSTALLER_LOGIN_PATH}
                  onClick={() => setIsMobileOpen(false)}
                >
                  Entrar como instalador
                </SmartLink>
              </div>
              <SmartLink
                className="text-center text-sm font-semibold text-white/65 underline decoration-white/20 underline-offset-4 transition-colors hover:text-[#f0d28a]"
                href={INSTALLER_REGISTER_PATH}
                onClick={() => setIsMobileOpen(false)}
              >
                Primeiro acesso? Cadastrar instalador
              </SmartLink>
              <SmartLink
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#cda349] to-[#d8ad55] px-6 py-3 text-base font-semibold text-black"
                href={REQUEST_PATH}
                onClick={() => setIsMobileOpen(false)}
              >
                Abrir PapelPerto
              </SmartLink>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Hero() {
  const containerRef = useRef(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const handleMouseMove = (event) => {
      const rect = container.getBoundingClientRect();
      setMousePosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };

    container.addEventListener('mousemove', handleMouseMove);
    return () => container.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section className="landing-hero relative flex min-h-screen items-center justify-center overflow-hidden pt-20" ref={containerRef}>
      <div
        className="pointer-events-none absolute hidden h-[600px] w-[600px] rounded-full opacity-30 md:block"
        style={{
          background: 'radial-gradient(circle, rgba(205, 163, 73, 0.15), transparent 70%)',
          left: mousePosition.x - 300,
          top: mousePosition.y - 300,
          transition: 'left 0.3s ease-out, top 0.3s ease-out',
        }}
      />

      <div className="landing-hero-material" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="absolute inset-0 grid-pattern opacity-30" />
      <div className="absolute left-1/4 top-1/4 h-72 w-72 rounded-full bg-[#cda349]/10 blur-[100px] animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-[#d8ad55]/10 blur-[120px] animate-pulse-glow" style={{ animationDelay: '2s' }} />
      <div className="landing-hero-content relative z-10 mx-auto max-w-7xl px-6 py-24 text-left">
        <AnimatedSection delay={0.1}>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            <span className="text-balance">Precisa instalar </span>
            <span className="text-[#d8ad55]">papel de parede?</span>
          </h1>
        </AnimatedSection>

        <AnimatedSection delay={0.2}>
          <p className="mt-6 max-w-2xl text-base text-white/60 sm:text-xl text-pretty">
            Conte onde será o serviço. Instaladores da sua região podem responder,
            e você escolhe com quem conversar.
          </p>
        </AnimatedSection>

        <AnimatedSection
          className="landing-hero-actions mt-10 flex flex-col items-start justify-start gap-4 sm:flex-row"
          delay={0.3}
        >
          <SmartLink
            className="landing-hero-primary btn-shine group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#cda349] via-[#d8ad55] to-[#cda349] bg-[length:200%_100%] px-8 py-4 text-base font-semibold text-black shadow-lg shadow-[#cda349]/25 transition-all hover:bg-right hover:shadow-[#cda349]/40"
            href={REQUEST_PATH}
          >
            Criar meu pedido
            <Icon className="h-5 w-5 transition-transform group-hover:translate-x-1" name="arrow-right" size={20} />
          </SmartLink>
          <SmartLink
            className="landing-hero-secondary group inline-flex items-center gap-2 rounded-full glass px-8 py-4 text-base font-semibold text-white/90 transition-all hover:bg-white/10"
            href="#como-funciona"
          >
            Entender como funciona
          </SmartLink>
        </AnimatedSection>

      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
    </section>
  );
}

function TrustSection() {
  return (
    <section className="landing-trust-section relative overflow-hidden" aria-label="Fluxo de contratação">
      <div className="landing-trust-bg" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="landing-trust-timeline">
          <svg
            aria-hidden="true"
            className="landing-trust-connectors"
            preserveAspectRatio="none"
            viewBox="0 0 1000 120"
          >
            <path d="M188 64 C226 36 270 36 318 64" />
            <circle cx="318" cy="64" r="4.2" />
            <path d="M438 64 C476 36 520 36 568 64" />
            <circle cx="568" cy="64" r="4.2" />
            <path d="M688 64 C726 36 770 36 818 64" />
            <circle cx="688" cy="64" r="4.2" />
          </svg>

          <StaggerContainer className="landing-trust-grid">
          {trustStats.map((stat) => (
            <article className="landing-trust-item" key={stat.number}>
              <div className="landing-trust-orb">
                <Icon className="landing-trust-icon" name={stat.icon} size={76} />
              </div>
              <div className="landing-trust-copy">
                <span>{stat.number}</span>
                <h3>
                  {stat.title.map((part, index) => (
                    <span className={part.accent ? 'landing-trust-accent' : undefined} key={`${stat.number}-${index}`}>
                      {part.text}
                    </span>
                  ))}
                </h3>
                <p>{stat.label}</p>
                <i aria-hidden="true" />
              </div>
            </article>
          ))}
          </StaggerContainer>
        </div>
      </div>
    </section>
  );
}

function SectionBadge({ icon, children }) {
  return (
    <span className="mb-6 inline-flex items-center gap-2 rounded-full glass-gold px-4 py-2 text-sm text-white/70">
      <Icon className="h-4 w-4 text-[#cda349]" name={icon} size={16} />
      {children}
    </span>
  );
}

function HowItWorksSection() {
  return (
    <section className="landing-process-section relative overflow-hidden py-24 sm:py-32" id="como-funciona">
      <div className="absolute inset-0 grid-pattern opacity-20" />
      <div className="absolute left-1/4 top-0 h-[600px] w-[600px] rounded-full bg-[#cda349]/5 blur-[200px]" />
      <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-[#d8ad55]/5 blur-[200px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <AnimatedSection className="landing-section-head mb-16 text-center sm:mb-20">
          <h2 className="mb-6 text-3xl font-bold text-white sm:text-4xl lg:text-5xl text-balance">
            Como o pedido funciona
          </h2>
          <p className="mx-auto max-w-2xl text-base text-white/50 sm:text-lg text-pretty">
            Você não precisa escolher um profissional às pressas. Primeiro publica o pedido,
            depois compara quem demonstrou interesse.
          </p>
        </AnimatedSection>

        <StaggerContainer className="landing-process-grid grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, index) => (
            <div className="landing-process-step group relative h-full" key={step.number}>
              {index < steps.length - 1 && (index + 1) % 3 !== 0 ? (
                <div className="absolute left-full top-14 z-0 hidden h-px w-full bg-gradient-to-r from-[#cda349]/20 to-transparent lg:block" />
              ) : null}

              <div className="landing-process-card relative h-full overflow-hidden rounded-2xl p-6 glass card-premium sm:p-8">
                <div className="landing-process-watermark absolute -right-4 -top-4 select-none text-[120px] font-bold leading-none text-[#cda349]/[0.03]">
                  {step.number}
                </div>

                <div className="relative mb-6">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#cda349] to-[#d8ad55] opacity-30 blur-xl transition-opacity group-hover:opacity-50" />
                  <div className="relative inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-r from-[#cda349] to-[#d8ad55]">
                    <Icon className="h-7 w-7 text-black" name={step.icon} size={28} />
                  </div>
                </div>

                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#cda349]/20 bg-[#cda349]/10 px-3 py-1 text-xs font-medium">
                  <span className="text-[#cda349]">Passo {step.number}</span>
                </div>

                <h3 className="mb-3 text-xl font-semibold text-white">{step.title}</h3>
                <p className="leading-relaxed text-white/50">{step.description}</p>
              </div>
            </div>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const leftFeatures = features.slice(0, 3);
  const rightFeatures = features.slice(3);

  return (
    <section className="landing-match-section relative overflow-hidden py-24 sm:py-32" id="beneficios">
      <div className="absolute inset-0 grid-pattern opacity-20" />
      <div className="landing-match-arc landing-match-arc-left" />
      <div className="landing-match-arc landing-match-arc-right" />
      <div className="absolute left-0 top-1/3 h-[520px] w-[520px] rounded-full bg-[#cda349]/10 blur-[180px]" />
      <div className="absolute bottom-0 right-0 h-[520px] w-[520px] rounded-full bg-[#d8ad55]/10 blur-[180px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <AnimatedSection className="landing-section-head landing-match-header mb-16 text-center sm:mb-20">
          <SectionBadge icon="zap">Recursos do pedido</SectionBadge>
          <h2 className="mb-6 text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl text-balance">
            Tudo que você precisa para <span className="gradient-text-gold">encontrar o profissional ideal</span>
          </h2>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-white/60 sm:text-xl text-pretty">
            A plataforma organiza localização, detalhes do pedido e interessados
            para você escolher com <strong>mais segurança e praticidade.</strong>
          </p>
        </AnimatedSection>

        <div className="landing-match-map">
          <svg
            aria-hidden="true"
            className="landing-match-connectors"
            preserveAspectRatio="none"
            viewBox="0 0 1217 581"
          >
            <path className="landing-match-connector-path" d="M391 75 C468 75 452 290 522 290" />
            <path className="landing-match-connector-path" d="M391 290 H522" />
            <path className="landing-match-connector-path" d="M391 505 C468 505 452 290 522 290" />
            <path className="landing-match-connector-path" d="M826 75 C749 75 765 290 695 290" />
            <path className="landing-match-connector-path" d="M826 290 H695" />
            <path className="landing-match-connector-path" d="M826 505 C749 505 765 290 695 290" />
          </svg>

          <div className="landing-match-list landing-match-list-left">
            {leftFeatures.map((feature, index) => (
              <article className="landing-match-item" data-side="left" key={feature.title}>
                <div className="landing-match-orb">
                  <Icon name={feature.icon} size={42} />
                </div>
                <div className="landing-match-copy">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="landing-match-center" aria-hidden="true">
            <div className="landing-match-radar">
              <span />
              <span />
              <span />
            </div>
            <div className="landing-match-core">
              <Icon name="users" size={70} />
              <div className="landing-match-stars">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Icon filled key={index} name="star" size={18} />
                ))}
              </div>
              <strong>PEDIDO COMPATÍVEL</strong>
            </div>
          </div>

          <div className="landing-match-list landing-match-list-right">
            {rightFeatures.map((feature, index) => (
              <article className="landing-match-item" data-side="right" key={feature.title}>
                <div className="landing-match-orb">
                  <Icon name={feature.icon} size={42} />
                </div>
                <div className="landing-match-copy">
                  <span>{String(index + 4).padStart(2, '0')}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <AnimatedSection className="landing-match-note" delay={0.18}>
          <div className="landing-match-note-icon">
            <Icon name="shield" size={34} />
          </div>
          <div>
            <strong>Mais <span>clareza</span>, mais <span>praticidade</span>, para você escolher com segurança.</strong>
            <p>É assim que o pedido chega a instaladores compatíveis com a região e o serviço.</p>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}

function DemoSection() {
  const shouldRenderDemoSection = false;

  if (!shouldRenderDemoSection) {
    return null;
  }

  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div className="absolute inset-0 grid-pattern opacity-20" />
      <div className="absolute right-0 top-1/4 h-[500px] w-[500px] rounded-full bg-[#cda349]/10 blur-[150px]" />
      <div className="absolute bottom-1/4 left-0 h-[400px] w-[400px] rounded-full bg-[#d8ad55]/10 blur-[150px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <AnimatedSection className="mb-16 text-center">
          <SectionBadge icon="zap">Interface Moderna</SectionBadge>
          <h2 className="mb-6 text-3xl font-bold text-white sm:text-4xl lg:text-5xl text-balance">
            Uma experiência <span className="gradient-text-gold">completamente nova</span>
          </h2>
          <p className="mx-auto max-w-2xl text-base text-white/50 sm:text-lg text-pretty">
            Dashboard intuitivo que coloca você no controle de todo o processo,
            do primeiro contato até a conclusão do projeto.
          </p>
        </AnimatedSection>

        <AnimatedSection delay={0.2}>
          <div className="relative mx-auto max-w-5xl">
            <div className="absolute -inset-4 bg-gradient-to-r from-[#cda349]/20 via-[#d8ad55]/20 to-[#f0d28a]/20 opacity-60 blur-3xl" />
            <div className="relative overflow-hidden rounded-3xl gradient-border-gold">
              <div className="bg-[#0a0a0a]/90 p-4 backdrop-blur-xl sm:p-6 lg:p-8">
                <div className="mb-6 flex items-center justify-between border-b border-white/5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                  </div>
                  <div className="hidden items-center gap-4 sm:flex">
                    <div className="h-8 w-32 rounded-lg bg-white/5" />
                    <div className="h-8 w-8 rounded-full bg-gradient-to-r from-[#cda349] to-[#d8ad55]" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
                  <div className="space-y-4 sm:space-y-6 lg:col-span-2">
                    <div className="grid grid-cols-3 gap-3 sm:gap-4">
                      {demoStats.map((stat, index) => (
                        <div className="rounded-xl p-3 glass sm:p-4 landing-rise" key={stat.label} style={{ '--landing-delay': `${0.5 + index * 0.1}s` }}>
                          <Icon className="mb-2 h-5 w-5 text-[#cda349]" name={stat.icon} size={20} />
                          <div className="text-xl font-bold text-white sm:text-2xl">{stat.value}</div>
                          <div className="text-xs text-white/40">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl p-4 glass landing-rise sm:p-6" style={{ '--landing-delay': '0.8s' }}>
                      <div className="mb-4 flex items-start justify-between">
                        <div>
                          <h4 className="text-base font-semibold text-white sm:text-lg">Instalação Sala de Estar</h4>
                          <p className="text-sm text-white/40">São Paulo, SP</p>
                        </div>
                        <span className="inline-flex items-center rounded-full bg-green-500/20 px-3 py-1 text-xs font-medium text-green-400">
                          Em andamento
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-lg font-semibold text-white sm:text-xl">25m²</div>
                          <div className="text-xs text-white/40">Área</div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-white sm:text-xl">12</div>
                          <div className="text-xs text-white/40">Interessados</div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-white sm:text-xl">3 dias</div>
                          <div className="text-xs text-white/40">Prazo</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 sm:space-y-6">
                    <div className="rounded-xl p-4 glass landing-rise" style={{ '--landing-delay': '0.9s' }}>
                      <div className="mb-4 flex items-center gap-2">
                        <Icon className="h-4 w-4 text-[#cda349]" name="bell" size={16} />
                        <span className="text-sm font-medium text-white">Notificações</span>
                      </div>
                      <div className="space-y-3">
                        {[1, 2].map((item) => (
                          <div className="flex items-start gap-3 rounded-lg bg-white/5 p-2" key={item}>
                            <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gradient-to-r from-[#cda349] to-[#d8ad55]" />
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 h-2 w-20 rounded bg-white/20" />
                              <div className="h-2 w-full rounded bg-white/10" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl p-4 glass landing-rise" style={{ '--landing-delay': '1s' }}>
                      <div className="mb-4 flex items-center gap-2">
                        <Icon className="h-4 w-4 text-[#cda349]" name="message-square" size={16} />
                        <span className="text-sm font-medium text-white">Mensagens</span>
                        <span className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#cda349] text-xs text-black">3</span>
                      </div>
                      <div className="space-y-2">
                        {[1, 2, 3].map((item) => (
                          <div className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/5" key={item}>
                            <div className="h-8 w-8 rounded-full bg-gradient-to-r from-[#cda349] to-[#d8ad55]" />
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 h-2 w-16 rounded bg-white/20" />
                              <div className="h-2 w-24 rounded bg-white/10" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="landing-guides-section relative overflow-hidden py-24 sm:py-32" id="avaliacoes">
      <div className="absolute inset-0 grid-pattern opacity-20" />
      <div className="absolute left-0 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-[#cda349]/5 blur-[200px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <AnimatedSection className="landing-section-head mb-16 text-center">
          <h2 className="mb-6 text-3xl font-bold text-white sm:text-4xl lg:text-5xl text-balance">
            Antes de escolher, confira três pontos
          </h2>
          <p className="mx-auto max-w-2xl text-base text-white/50 sm:text-lg text-pretty">
            A decisão é sua. Use o perfil e a conversa para confirmar o que importa no serviço.
          </p>
        </AnimatedSection>

        <div className="relative">
          <div className="overflow-hidden">
            <div className="landing-guides-grid grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {choiceGuides.map((guide) => (
                <div className="landing-guide-card-shell group relative" key={guide.id}>
                  <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-[#cda349]/20 to-[#d8ad55]/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="landing-guide-card relative h-full rounded-2xl p-6 glass card-premium sm:p-8">
                    <Icon className="absolute right-6 top-6 h-8 w-8 text-white/5" name={guide.icon} size={32} />
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#cda349]/15 text-[#d8ad55]">
                      <Icon className="h-6 w-6" name={guide.icon} size={24} />
                    </div>
                    <h3 className="mb-3 text-lg font-semibold text-white">{guide.title}</h3>
                    <p className="mb-6 text-sm leading-relaxed text-white/60 sm:text-base">
                      {guide.text}
                    </p>
                    <div className="flex items-start gap-3 border-t border-white/5 pt-4 text-sm leading-relaxed text-white/45">
                      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#cda349]" name="check-circle" size={16} />
                      <span>{guide.detail}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <section className="landing-faq-section relative overflow-hidden py-24 sm:py-32" id="faq">
      <div className="absolute inset-0 grid-pattern opacity-20" />
      <div className="absolute right-0 top-1/4 h-[500px] w-[500px] rounded-full bg-[#cda349]/5 blur-[200px]" />

      <div className="relative z-10 mx-auto max-w-4xl px-6">
        <AnimatedSection className="landing-section-head mb-16 text-center">
          <h2 className="mb-6 text-3xl font-bold text-white sm:text-4xl lg:text-5xl text-balance">
            Dúvidas comuns
          </h2>
          <p className="mx-auto max-w-2xl text-base text-white/50 sm:text-lg text-pretty">
            O que acontece depois que você publica um pedido.
          </p>
        </AnimatedSection>

        <StaggerContainer className="landing-faq-list space-y-4">
          {faqs.map((faq, index) => (
            <div className="group" key={faq.question}>
              <button
                aria-expanded={openIndex === index}
                className="landing-faq-item w-full rounded-2xl p-6 text-left transition-all glass hover:bg-white/5"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                type="button"
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="pr-4 text-base font-semibold text-white sm:text-lg">{faq.question}</h3>
                  <Icon
                    className={`h-5 w-5 flex-shrink-0 text-white/50 transition-transform duration-300 ${openIndex === index ? 'rotate-180' : ''}`}
                    name="chevron-down"
                    size={20}
                  />
                </div>
                {openIndex === index ? (
                  <div className="landing-faq-answer overflow-hidden">
                    <p className="mt-4 border-t border-white/5 pt-4 leading-relaxed text-white/50">
                      {faq.answer}
                    </p>
                  </div>
                ) : null}
              </button>
            </div>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="landing-cta-section relative overflow-hidden py-24 sm:py-32" id="solicitar">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#cda349]/5 to-[#cda349]/10" />
        <div className="absolute inset-0 grid-pattern opacity-30" />
      </div>

      <div className="absolute left-1/4 top-1/4 h-72 w-72 rounded-full bg-[#cda349]/20 blur-[120px] animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-[#d8ad55]/20 blur-[150px] animate-pulse-glow" style={{ animationDelay: '2s' }} />

      <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
        <AnimatedSection>
          <h2 className="mb-6 text-3xl font-bold text-white sm:text-4xl lg:text-6xl text-balance">
            Quer publicar seu pedido?
          </h2>

          <p className="mx-auto mb-10 max-w-2xl text-base text-white/50 sm:text-lg text-pretty">
            Leva poucos minutos. O pedido é gratuito para o cliente e você escolhe quem chamar.
          </p>

          <SmartLink
            className="btn-shine group relative inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[#cda349] via-[#d8ad55] to-[#f0d28a] px-10 py-5 text-lg font-semibold text-black shadow-xl shadow-[#cda349]/25 transition-all hover:scale-105 hover:shadow-[#cda349]/40"
            href={REQUEST_PATH}
          >
            Criar pedido
            <Icon className="h-5 w-5 transition-transform group-hover:translate-x-1" name="arrow-right" size={20} />
          </SmartLink>

        </AnimatedSection>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="landing-footer relative border-t border-white/5">
      <div className="absolute inset-0 grid-pattern opacity-10" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <LogoMark />

            <p className="mb-6 mt-6 max-w-sm leading-relaxed text-white/40">
              Encontre instaladores de papel de parede que atendem a sua região.
            </p>
          </div>

          <div className="lg:col-span-8">
            <div className="grid grid-cols-2 gap-8">
              {Object.entries(footerLinks).map(([group, links]) => (
                <div key={group}>
                  <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
                    {group === 'produto' ? 'Informações' : 'Pedido'}
                  </h4>
                  <ul className="space-y-3">
                    {links.map((link) => (
                      <li key={link.label}>
                        <SmartLink className="text-sm text-white/40 transition-colors hover:text-white" href={link.href}>
                          {link.label}
                        </SmartLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
          <p className="text-sm text-white/30">
            © {new Date().getFullYear()} InstalaPro. Todos os direitos reservados.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-white/40">
            <SmartLink className="transition-colors hover:text-white" href="/privacidade">Privacidade</SmartLink>
            <SmartLink className="transition-colors hover:text-white" href="/termos">Termos de uso</SmartLink>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function ClientLandingLegacy() {
  return (
    <div className="literal-landing min-h-screen overflow-hidden bg-[#0a0a0a] text-white">
      <div className="aurora-bg" />
      <Navbar />
      <main>
        <Hero />
        <HowItWorksSection />
        <TestimonialsSection />
        <FaqSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
