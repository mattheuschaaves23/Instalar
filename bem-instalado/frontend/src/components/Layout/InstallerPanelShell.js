import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const MOBILE_DOCK_ITEMS = [
  { to: '/dashboard', label: 'Inicio', icon: 'home' },
  { to: '/agenda', label: 'Agenda', icon: 'agenda' },
  { to: '/budgets', label: 'Orcamentos', icon: 'budgets' },
  { to: '/clients', label: 'Clientes', icon: 'clients' },
  { to: '/profile', label: 'Perfil', icon: 'profile' },
];

const PANEL_NAV_ITEMS = [
  { to: '/dashboard', label: 'Inicio', icon: 'grid', section: 'VISAO GERAL' },
  { to: '/dashboard', label: 'Desempenho', icon: 'trend' },
  { to: '/agenda', label: 'Agenda', icon: 'agenda', badge: 3 },
  { to: '/budgets', label: 'Orcamentos', icon: 'file', section: 'OPERACAO' },
  { to: '/clients', label: 'Clientes', icon: 'clients' },
  { to: '/dashboard', label: 'Avaliacoes', icon: 'star' },
  { to: '/profile', label: 'Perfil', icon: 'profile', section: 'CONTA' },
  { to: '/subscription', label: 'Assinatura', icon: 'card' },
  { to: '/notifications', label: 'Notificacoes', icon: 'bell', badge: 2 },
  { to: '/profile', label: 'Configuracoes', icon: 'settings' },
  { to: '/support', label: 'Suporte', icon: 'help' },
];

function PanelIcon({ type, size = 20 }) {
  const sharedProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  const icons = {
    grid: <><rect x="4" y="4" width="6" height="6" rx="1.2" /><rect x="14" y="4" width="6" height="6" rx="1.2" /><rect x="4" y="14" width="6" height="6" rx="1.2" /><rect x="14" y="14" width="6" height="6" rx="1.2" /></>,
    trend: <><path d="M4 16.5 9 11l4 3 6-7" /><path d="M15 7h4v4" /></>,
    agenda: <><rect x="4" y="5" width="16" height="15" rx="2.4" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    file: <><path d="M7 3.8h7l3 3V20H7z" /><path d="M14 3.8V7h3" /><path d="M9.5 11h5M9.5 15h4" /></>,
    clients: <><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2.2" /><path d="M3.8 19c.9-3.1 2.8-4.7 5.2-4.7s4.3 1.6 5.2 4.7" /><path d="M14.8 15c1.9.4 3.3 1.7 4 4" /></>,
    star: <path d="m12 3.8 2.45 4.95 5.47.8-3.96 3.86.94 5.45L12 16.28l-4.9 2.58.94-5.45-3.96-3.86 5.47-.8z" />,
    profile: <><circle cx="12" cy="8" r="3.2" /><path d="M5.4 19c1.5-3 4-4.5 6.6-4.5s5.1 1.5 6.6 4.5" /></>,
    card: <><rect x="4" y="6.5" width="16" height="11" rx="2" /><path d="M4 10h16" /></>,
    bell: <><path d="M18 10.8a6 6 0 0 0-12 0c0 5-2 5.7-2 5.7h16s-2-.7-2-5.7" /><path d="M10 20a2.4 2.4 0 0 0 4 0" /></>,
    settings: <><path d="M12 8.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2Z" /><path d="M19.2 13.4a7.9 7.9 0 0 0 0-2.8l2-1.55-2-3.46-2.43.98a7.25 7.25 0 0 0-2.4-1.39L14 2.6h-4l-.37 2.58a7.25 7.25 0 0 0-2.4 1.39L4.8 5.59l-2 3.46 2 1.55a7.9 7.9 0 0 0 0 2.8l-2 1.55 2 3.46 2.43-.98a7.25 7.25 0 0 0 2.4 1.39L10 21.4h4l.37-2.58a7.25 7.25 0 0 0 2.4-1.39l2.43.98 2-3.46z" /></>,
    help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.8 9.4a2.4 2.4 0 1 1 3.6 2.1c-.9.5-1.4 1.1-1.4 2.2" /><path d="M12 17.2h.01" /></>,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    chevron: <path d="m9 6 6 6-6 6" />,
    logout: <><path d="M10 6H6.5A1.5 1.5 0 0 0 5 7.5v9A1.5 1.5 0 0 0 6.5 18H10" /><path d="M14 8l4 4-4 4M18 12H9" /></>,
    home: <><path d="M4 11.5 12 5l8 6.5" /><path d="M6.5 10.5V19h11v-8.5" /></>,
    budgets: <><path d="M4 7h2l1.8 8.2a1 1 0 0 0 1 .8h7.7a1 1 0 0 0 1-.8L19 9H8.2" /><circle cx="10" cy="19" r="1.3" /><circle cx="17" cy="19" r="1.3" /></>,
  };

  return <svg {...sharedProps}>{icons[type] || icons.grid}</svg>;
}

function getInitials(name) {
  return String(name || 'Matheus Chaves')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'MC';
}

function formatPanelDate(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
    .format(date)
    .replace(/(^|[\s-])([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
}

function isActiveRoute(pathname, item) {
  if (item.to === '/dashboard') {
    return pathname === '/dashboard' && item.label === 'Inicio';
  }

  if (item.to === '/budgets') {
    return pathname.startsWith('/budgets');
  }

  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function SidebarContent({ allowCollapse = false, collapsed = false, initials, onNavigate, onToggleCollapse, userName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    onNavigate?.();
    navigate('/instalador/entrar', { replace: true });
  };

  return (
    <>
      <div className="ref-panel-brand">
        <span className="ref-panel-logo">P</span>
        <strong>PapelPro</strong>
        <button aria-label={allowCollapse ? 'Recolher menu' : 'Fechar menu'} onClick={onToggleCollapse || onNavigate} type="button">
          <span>{allowCollapse && collapsed ? '>' : '<'}</span>
        </button>
      </div>

      <div className="ref-panel-user">
        <span className="ref-panel-avatar">{initials}</span>
        <div>
          <strong>{userName}</strong>
          <small>Instalador Pro</small>
        </div>
      </div>

      <nav className="ref-panel-nav">
        {PANEL_NAV_ITEMS.map((item) => (
          <div className="ref-panel-nav-block" key={`${item.section || ''}-${item.label}`}>
            {item.section ? <p>{item.section}</p> : null}
            <NavLink
              className={`ref-panel-nav-link ${isActiveRoute(location.pathname, item) ? 'is-active' : ''}`}
              onClick={onNavigate}
              to={item.to}
            >
              <PanelIcon type={item.icon} />
              <span>{item.label}</span>
              {item.badge ? <em>{item.badge}</em> : null}
            </NavLink>
          </div>
        ))}
      </nav>

      <button className="ref-panel-logout" onClick={handleLogout} type="button">
        <PanelIcon type="logout" />
        <span>Sair</span>
      </button>
    </>
  );
}

export default function InstallerPanelShell({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const today = useMemo(() => new Date(), []);
  const initials = getInitials(user?.name);
  const firstName = user?.name?.split(' ')[0] || 'Matheus';
  const userName = user?.name || 'Matheus Chaves';

  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileDrawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileDrawerOpen]);

  return (
    <section className={`ref-panel-shell ref-panel-route-shell ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
      <aside className="ref-panel-sidebar" aria-label="Navegacao do painel">
        <SidebarContent
          allowCollapse
          collapsed={sidebarCollapsed}
          initials={initials}
          onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
          userName={userName}
        />
      </aside>

      <div className={`ref-panel-drawer-backdrop ${mobileDrawerOpen ? 'is-open' : ''}`} onClick={() => setMobileDrawerOpen(false)} />
      <aside className={`ref-panel-mobile-drawer ${mobileDrawerOpen ? 'is-open' : ''}`} aria-label="Menu mobile do painel">
        <SidebarContent initials={initials} onNavigate={() => setMobileDrawerOpen(false)} userName={userName} />
      </aside>

      <div className="ref-panel-main">
        <header className="ref-panel-topbar">
          <label className="ref-panel-search">
            <PanelIcon type="search" size={18} />
            <input onChange={(event) => setSearch(event.target.value)} placeholder="Buscar clientes, orcamentos..." type="search" value={search} />
          </label>
          <div className="ref-panel-top-actions">
            <span className="ref-panel-date">
              <PanelIcon type="agenda" size={17} />
              {formatPanelDate(today)}
            </span>
            <Link className="ref-panel-bell" to="/notifications">
              <PanelIcon type="bell" size={18} />
              <em>2</em>
            </Link>
            <Link className="ref-panel-account" to="/profile">
              <span>{initials}</span>
              <strong>{firstName}</strong>
              <PanelIcon type="chevron" size={15} />
            </Link>
          </div>
        </header>

        <header className="ref-panel-mobile-header">
          <button aria-label="Abrir menu" onClick={() => setMobileDrawerOpen(true)} type="button">
            <PanelIcon type="menu" />
          </button>
          <div>
            <span className="ref-panel-logo">P</span>
            <strong>PapelPro</strong>
          </div>
          <nav aria-label="Acoes rapidas do painel">
            <Link to={location.pathname}><PanelIcon type="search" size={18} /></Link>
            <Link to="/notifications"><PanelIcon type="bell" size={18} /><em /></Link>
            <Link to="/profile" className="ref-panel-avatar">{initials}</Link>
          </nav>
        </header>

        <main className="ref-panel-content ref-panel-route-content">
          {children}
        </main>

        <nav aria-label="Navegacao mobile" className="ref-panel-bottom-nav">
          {MOBILE_DOCK_ITEMS.map((item) => (
            <NavLink className={({ isActive }) => `ref-panel-bottom-tab ${isActive ? 'is-active' : ''}`} key={item.to} to={item.to}>
              <PanelIcon type={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </section>
  );
}
