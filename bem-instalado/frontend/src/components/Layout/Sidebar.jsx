import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import BrandMark from './BrandMark';
import BrandWordmark from './BrandWordmark';

function SidebarIcon({ type }) {
  const sharedProps = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  switch (type) {
    case 'home':
      return (
        <svg {...sharedProps}>
          <path d="M4 11.5 12 5l8 6.5" />
          <path d="M6.5 10.5V19h11v-8.5" />
        </svg>
      );
    case 'operation':
      return (
        <svg {...sharedProps}>
          <rect x="4" y="5" width="6" height="14" rx="2" />
          <rect x="14" y="9" width="6" height="10" rx="2" />
        </svg>
      );
    case 'account':
      return (
        <svg {...sharedProps}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 19c1.6-3 4.2-4.5 6.5-4.5S16.9 16 18.5 19" />
        </svg>
      );
    case 'admin':
      return (
        <svg {...sharedProps}>
          <path d="M12 3.8 18.6 7v5c0 4.1-2.7 6.9-6.6 8.2-3.9-1.3-6.6-4.1-6.6-8.2V7L12 3.8Z" />
          <path d="M9.8 11.8 11.3 13.3 14.8 9.8" />
        </svg>
      );
    default:
      return null;
  }
}

const NAV_GROUPS = [
  {
    key: 'operations',
    icon: 'operation',
    title: 'Operação',
    kicker: 'Rotina comercial e execução',
    items: [
      { to: '/cliente', label: 'Área do cliente', kicker: 'Vitrine pública' },
      { to: '/clients', label: 'Clientes', kicker: 'Relacionamento' },
      { to: '/budgets', label: 'Orçamentos', kicker: 'Comercial' },
      { to: '/agenda', label: 'Agenda', kicker: 'Execução' },
    ],
  },
  {
    key: 'account',
    icon: 'account',
    title: 'Conta',
    kicker: 'Dados, plano e comunicação',
    items: [
      { to: '/profile', label: 'Perfil', kicker: 'Conta e vitrine' },
      { to: '/subscription', label: 'Assinatura', kicker: 'Plano e cobrança' },
      { to: '/notifications', label: 'Notificações', kicker: 'Alertas do painel' },
      { to: '/support', label: 'Suporte', kicker: 'Chat e ideias' },
    ],
  },
];

const ADMIN_GROUP = {
  key: 'admin',
  icon: 'admin',
  title: 'Administração',
  kicker: 'Gestão central da plataforma',
  items: [
    { to: '/admin?section=overview', label: 'Visão geral', kicker: 'Resumo do sistema' },
    { to: '/admin?section=users', label: 'Usuários', kicker: 'Perfis e permissões' },
    { to: '/admin?section=payments', label: 'Pagamentos', kicker: 'Cobrança e status' },
    { to: '/admin?section=stores', label: 'Lojas recomendadas', kicker: 'Carrossel público' },
    { to: '/admin?section=announcements', label: 'Comunicados', kicker: 'Mensagens globais' },
  ],
};

function isItemActive(item, location) {
  const [pathname, queryString] = item.to.split('?');

  if (pathname !== location.pathname) {
    if (pathname === '/budgets' && location.pathname.startsWith('/budgets/')) {
      return true;
    }

    return false;
  }

  if (!queryString) {
    return true;
  }

  return queryString === location.search.replace(/^\?/, '');
}

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  const { user } = useAuth();
  const location = useLocation();

  const groups = useMemo(() => {
    if (user?.is_admin) {
      return [...NAV_GROUPS, ADMIN_GROUP];
    }

    return NAV_GROUPS;
  }, [user?.is_admin]);

  const [openGroups, setOpenGroups] = useState({});

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const toggleGroup = (groupKey) => {
    setOpenGroups((current) => ({ ...current, [groupKey]: !current[groupKey] }));
  };

  return (
    <>
      <button
        aria-label="Fechar menu"
        className={`sidebar-mobile-backdrop ${isOpen ? 'is-open' : ''}`}
        onClick={onClose}
        type="button"
      />

      <aside
        className={`sidebar-shell ${isOpen ? 'is-open' : ''} border-b border-[var(--line)] bg-[rgba(9,8,7,0.94)] md:w-[324px] md:border-b-0 md:border-r`}
      >
        <div className="flex min-h-full flex-col p-4 sm:p-5 md:min-h-screen md:gap-1">
        <div className="mb-4 flex items-center justify-between md:hidden">
          <p className="eyebrow">Navegação</p>
          <button className="ghost-button !min-h-0 !px-3 !py-2 text-xs" onClick={onClose} type="button">
            Fechar
          </button>
        </div>

        <div className="lux-panel fade-up p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Plataforma</p>
              <BrandWordmark className="mt-2" size="lg" />
              <h1 className="sidebar-brand-title mt-3">Painel interno</h1>
            </div>
            <BrandMark className="sidebar-brand-badge" fallback="IL" />
          </div>

          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
            Um sistema mais limpo para organizar a rotina, acompanhar clientes e controlar o negócio sem excesso visual.
          </p>

          <div className="mt-4 rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
            <p className="truncate text-sm font-semibold text-[var(--text)]">{user?.name || 'Conta ativa'}</p>
            <p className="mt-1 truncate text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              {user?.email || 'Instalador'}
            </p>
          </div>
        </div>

        <nav className="sidebar-links mt-5 grid gap-3">
          <NavLink
            className={({ isActive }) =>
              `sidebar-home-link fade-up ${isActive && location.pathname === '/dashboard' ? 'is-active' : ''}`
            }
            onClick={onClose}
            to="/dashboard"
          >
            <span className="sidebar-group-icon">
              <SidebarIcon type="home" />
            </span>
            <div>
              <p className="text-sm font-semibold">Início</p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Visão geral do negócio</p>
            </div>
            <span className="sidebar-home-mark">01</span>
          </NavLink>

          {groups.map((group, groupIndex) => {
            const isOpenGroup = Boolean(openGroups[group.key]);
            const groupActive = group.items.some((item) => isItemActive(item, location));

            return (
              <section
                className={`sidebar-group fade-up ${groupActive ? 'is-active' : ''}`}
                key={group.key}
                style={{ animationDelay: `${0.05 + groupIndex * 0.04}s` }}
              >
                <button
                  aria-expanded={isOpenGroup}
                  className={`sidebar-group-toggle ${groupActive ? 'is-active' : ''}`}
                  onClick={() => toggleGroup(group.key)}
                  type="button"
                >
                  <span className="sidebar-group-icon">
                    <SidebarIcon type={group.icon} />
                  </span>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-semibold">{group.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{group.kicker}</p>
                  </div>
                  <span className={`sidebar-group-chevron ${isOpenGroup ? 'is-open' : ''}`}>⌄</span>
                </button>

                {isOpenGroup ? (
                  <div className="sidebar-group-list">
                    {group.items.map((item) => (
                      <NavLink
                        className={() =>
                          `sidebar-sublink ${isItemActive(item, location) ? 'is-active' : ''}`
                        }
                        key={item.to}
                        onClick={onClose}
                        to={item.to}
                      >
                        <span className="sidebar-sublink-dot" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.label}</p>
                          <p className="mt-1 truncate text-xs text-[var(--muted)]">{item.kicker}</p>
                        </div>
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </nav>
        </div>
      </aside>
    </>
  );
}
