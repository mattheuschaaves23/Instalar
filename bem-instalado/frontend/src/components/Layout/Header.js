import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';

const routeCopy = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle: 'Resumo comercial e operacional da semana.',
  },
  '/clients': {
    title: 'Clientes',
    subtitle: 'Carteira de contatos, histórico e relacionamento.',
  },
  '/budgets': {
    title: 'Orçamentos',
    subtitle: 'Propostas, aprovações e envio para o cliente.',
  },
  '/budgets/new': {
    title: 'Novo orçamento',
    subtitle: 'Monte uma proposta clara, rápida e profissional.',
  },
  '/agenda': {
    title: 'Agenda',
    subtitle: 'Visual mensal com foco no dia e na execução.',
  },
  '/profile': {
    title: 'Perfil do instalador',
    subtitle: 'Dados de confiança, vitrine pública e horários vagos.',
  },
  '/subscription': {
    title: 'Assinatura',
    subtitle: 'Plano, pagamento e status de acesso.',
  },
  '/support': {
    title: 'Suporte',
    subtitle: 'Conversa direta com administrador e envio de ideias.',
  },
  '/notifications': {
    title: 'Notificações',
    subtitle: 'Tudo o que mudou no seu painel.',
  },
  '/admin': {
    title: 'Administrador',
    subtitle: 'Gestão completa da plataforma.',
  },
};

const adminSectionCopy = {
  overview: {
    title: 'Administrador',
    subtitle: 'Visão consolidada da operação, pagamentos e atividade recente.',
  },
  users: {
    title: 'Administrador',
    subtitle: 'Usuários, permissões, perfis públicos e confiança da vitrine.',
  },
  payments: {
    title: 'Administrador',
    subtitle: 'Acompanhamento de cobranças, pendências e confirmações.',
  },
  stores: {
    title: 'Administrador',
    subtitle: 'Curadoria das lojas recomendadas exibidas na área pública.',
  },
  announcements: {
    title: 'Administrador',
    subtitle: 'Comunicados globais para orientar toda a base de usuários.',
  },
};

export default function Header({ onOpenMenu = () => {} }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { notifications } = useNotifications();
  const unread = notifications.filter((item) => !item.read).length;
  const adminSection = new URLSearchParams(location.search).get('section') || 'overview';
  const isDashboardRoute = location.pathname === '/dashboard';

  const currentCopy =
    location.pathname === '/admin'
      ? adminSectionCopy[adminSection] || adminSectionCopy.overview
      : routeCopy[location.pathname]
        ? routeCopy[location.pathname]
        : location.pathname.startsWith('/budgets/')
          ? routeCopy['/budgets/new']
          : routeCopy['/dashboard'];

  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date());

  return (
    <header
      className={`panel-topbar border-b backdrop-blur-xl ${
        isDashboardRoute
          ? 'panel-topbar--dashboard border-[#e7d7b1] bg-[rgba(255,251,244,0.94)]'
          : 'border-[var(--line)] bg-[rgba(8,8,7,0.72)]'
      }`}
    >
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-8 xl:px-10">
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-3 md:mb-0 md:block">
            <p className="eyebrow">Painel interno</p>
            <button
              className={`ghost-button !min-h-0 !px-3 !py-2 text-xs md:hidden ${
                isDashboardRoute ? 'dashboard-topbar-chip dashboard-topbar-chip--button' : ''
              }`}
              onClick={onOpenMenu}
              type="button"
            >
              Menu
            </button>
          </div>

          <h2 className="mt-2 text-2xl font-semibold text-[var(--text)]">{currentCopy.title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{currentCopy.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`hidden rounded-full px-4 py-2 text-sm sm:inline-flex ${
              isDashboardRoute
                ? 'dashboard-topbar-chip'
                : 'border border-[var(--line)] bg-[rgba(255,255,255,0.02)] text-[var(--muted)]'
            }`}
          >
            {formattedDate}
          </span>

          <span
            className={`rounded-full px-4 py-2 text-sm ${
              isDashboardRoute
                ? 'dashboard-topbar-chip'
                : 'border border-[var(--line)] bg-[rgba(255,255,255,0.02)] text-[var(--muted)]'
            }`}
          >
            Alertas: <strong className="text-[var(--gold-strong)]">{unread}</strong>
          </span>

          <div
            className={`flex items-center gap-3 rounded-full px-3 py-2 ${
              isDashboardRoute
                ? 'dashboard-topbar-user'
                : 'border border-[var(--line)] bg-[rgba(255,255,255,0.02)]'
            }`}
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                isDashboardRoute
                  ? 'dashboard-topbar-avatar'
                  : 'border border-[var(--line)] bg-[var(--gold-soft)] text-[var(--gold-strong)]'
              }`}
            >
              {user?.name?.slice(0, 2).toUpperCase() || 'IL'}
            </div>

            <div className="hidden min-w-0 sm:block">
              <p className="max-w-[10rem] truncate text-sm font-semibold text-[var(--text)]">{user?.name || 'Instalador'}</p>
              <p className="text-xs text-[var(--muted)]">Conta conectada</p>
            </div>

            <button
              className={`ghost-button !min-h-0 !px-4 !py-2 text-xs ${
                isDashboardRoute ? 'dashboard-topbar-chip dashboard-topbar-chip--button' : ''
              }`}
              onClick={logout}
              type="button"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
