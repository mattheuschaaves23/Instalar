import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatPanelBadgeCount, getPanelBadgeValue, usePanelBadgeCounts } from '../Layout/panelBadgeCounts';
import {
  formatCurrency,
  formatDateTime,
  formatShortDate,
  formatStatusLabel,
} from '../../utils/formatters';

const CHART_WIDTH = 820;
const CHART_HEIGHT = 280;
const CHART_PADDING_X = 18;
const CHART_PADDING_Y = 24;
const CHART_VIEWS = ['weekly', 'monthly', 'yearly'];
const CHART_VIEW_LABELS = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
};
const MONTH_OPTIONS = [
  { value: 0, label: 'Janeiro' },
  { value: 1, label: 'Fevereiro' },
  { value: 2, label: 'Março' },
  { value: 3, label: 'Abril' },
  { value: 4, label: 'Maio' },
  { value: 5, label: 'Junho' },
  { value: 6, label: 'Julho' },
  { value: 7, label: 'Agosto' },
  { value: 8, label: 'Setembro' },
  { value: 9, label: 'Outubro' },
  { value: 10, label: 'Novembro' },
  { value: 11, label: 'Dezembro' },
];
const fullMonthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
});
const shortMonthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
});

function DashboardIcon({ tone = 'blue', type = 'revenue' }) {
  const paths = {
    revenue: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M14.8 9.4c0-1.2-1-2.1-2.6-2.1-1.6 0-2.7.8-2.7 2.1 0 2.7 5.5 1.6 5.5 4.2 0 1.2-1 2.1-2.8 2.1-1.7 0-2.8-.9-2.9-2.2" />
        <path d="M12 6v12" />
      </>
    ),
    budgets: (
      <>
        <path d="M4 7h2l1.8 8.2a1 1 0 0 0 1 .8h7.7a1 1 0 0 0 1-.8L19 9H8.2" />
        <circle cx="10" cy="19" r="1.3" />
        <circle cx="17" cy="19" r="1.3" />
      </>
    ),
    clients: (
      <>
        <circle cx="9" cy="10" r="2.5" />
        <circle cx="16.5" cy="9" r="2" />
        <path d="M4.8 17.2c.9-2.5 2.8-3.8 5.1-3.8 2.3 0 4.2 1.3 5.1 3.8" />
        <path d="M14 14.1c1.5.2 2.8 1.1 3.5 3.1" />
      </>
    ),
    ticket: (
      <>
        <path d="M7.3 5.8h9.4a1.5 1.5 0 0 1 1.5 1.5v2.1a2.4 2.4 0 0 0 0 5.2v2.1a1.5 1.5 0 0 1-1.5 1.5H7.3a1.5 1.5 0 0 1-1.5-1.5v-2.1a2.4 2.4 0 0 0 0-5.2V7.3a1.5 1.5 0 0 1 1.5-1.5Z" />
        <path d="M12 8.7v6.6" />
        <path d="M10.2 10.4h3.6" />
      </>
    ),
  };

  return (
    <span className={`dashboard-neo-icon dashboard-neo-icon--${tone}`}>
      <svg aria-hidden="true" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="24">
        {paths[type] || paths.revenue}
      </svg>
    </span>
  );
}

function DashboardDockIcon({ type }) {
  const sharedProps = {
    width: 20,
    height: 20,
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
    case 'budgets':
      return (
        <svg {...sharedProps}>
          <path d="M4 7h2l1.8 8.2a1 1 0 0 0 1 .8h7.7a1 1 0 0 0 1-.8L19 9H8.2" />
          <circle cx="10" cy="19" r="1.3" />
          <circle cx="17" cy="19" r="1.3" />
        </svg>
      );
    case 'clients':
      return (
        <svg {...sharedProps}>
          <circle cx="9" cy="10" r="2.5" />
          <circle cx="16.5" cy="9" r="2" />
          <path d="M4.8 17.2c.9-2.5 2.8-3.8 5.1-3.8 2.3 0 4.2 1.3 5.1 3.8" />
          <path d="M14 14.1c1.5.2 2.8 1.1 3.5 3.1" />
        </svg>
      );
    case 'agenda':
      return (
        <svg {...sharedProps}>
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <path d="M8 3v4M16 3v4M3.5 10h17" />
          <path d="M8 13h3M8 16h6" />
        </svg>
      );
    case 'profile':
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

const MOBILE_DOCK_ITEMS = [
  { to: '/dashboard', label: 'Inicio', icon: 'home' },
  { to: '/agenda', label: 'Agenda', icon: 'agenda' },
  { to: '/budgets', label: 'Orçamentos', icon: 'budgets' },
  { to: '/clients', label: 'Clientes', icon: 'clients' },
  { to: '/profile', label: 'Perfil', icon: 'profile' },
];

const ADMIN_MOBILE_DOCK_ITEM = { to: '/admin', label: 'Admin', icon: 'admin' };

const PANEL_NAV_ITEMS = [
  { to: '/dashboard', label: 'Inicio', icon: 'grid', section: 'VISAO GERAL' },
  { to: '/agenda', label: 'Agenda', icon: 'agenda', badgeKey: 'agenda' },
  { to: '/budgets', label: 'Orcamentos', icon: 'file', section: 'OPERACAO' },
  { to: '/clients', label: 'Clientes', icon: 'clients' },
  { to: '/dashboard', label: 'Avaliacoes', icon: 'star' },
  { to: '/profile', label: 'Perfil', icon: 'profile', section: 'CONTA' },
  { to: '/subscription', label: 'Assinatura', icon: 'card' },
  { to: '/notifications', label: 'Notificacoes', icon: 'bell', badgeKey: 'notifications' },
  { to: '/profile', label: 'Configuracoes', icon: 'settings' },
  { to: '/support', label: 'Suporte', icon: 'help' },
];

const ADMIN_NAV_ITEM = { to: '/admin', label: 'Painel ADM', icon: 'admin', section: 'SISTEMA' };

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
    star: <><path d="m12 3.8 2.45 4.95 5.47.8-3.96 3.86.94 5.45L12 16.28l-4.9 2.58.94-5.45-3.96-3.86 5.47-.8z" /></>,
    profile: <><circle cx="12" cy="8" r="3.2" /><path d="M5.4 19c1.5-3 4-4.5 6.6-4.5s5.1 1.5 6.6 4.5" /></>,
    card: <><rect x="4" y="6.5" width="16" height="11" rx="2" /><path d="M4 10h16" /></>,
    bell: <><path d="M18 10.8a6 6 0 0 0-12 0c0 5-2 5.7-2 5.7h16s-2-.7-2-5.7" /><path d="M10 20a2.4 2.4 0 0 0 4 0" /></>,
    settings: <><path d="M12 8.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2Z" /><path d="M19.2 13.4a7.9 7.9 0 0 0 0-2.8l2-1.55-2-3.46-2.43.98a7.25 7.25 0 0 0-2.4-1.39L14 2.6h-4l-.37 2.58a7.25 7.25 0 0 0-2.4 1.39L4.8 5.59l-2 3.46 2 1.55a7.9 7.9 0 0 0 0 2.8l-2 1.55 2 3.46 2.43-.98a7.25 7.25 0 0 0 2.4 1.39L10 21.4h4l.37-2.58a7.25 7.25 0 0 0 2.4-1.39l2.43.98 2-3.46z" /></>,
    help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.8 9.4a2.4 2.4 0 1 1 3.6 2.1c-.9.5-1.4 1.1-1.4 2.2" /><path d="M12 17.2h.01" /></>,
    admin: <><path d="M12 3.8 18.6 7v5c0 4.1-2.7 6.9-6.6 8.2-3.9-1.3-6.6-4.1-6.6-8.2V7L12 3.8Z" /><path d="M9.8 11.8 11.3 13.3 14.8 9.8" /></>,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
    dollar: <><circle cx="12" cy="12" r="8.5" /><path d="M14.8 9.4c0-1.2-1-2.1-2.6-2.1-1.6 0-2.7.8-2.7 2.1 0 2.7 5.5 1.6 5.5 4.2 0 1.2-1 2.1-2.8 2.1-1.7 0-2.8-.9-2.9-2.2" /><path d="M12 6v12" /></>,
    arrow: <><path d="M7 17 17 7" /><path d="M9 7h8v8" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.6V12l3 1.8" /></>,
    pin: <><path d="M19 10.2c0 5-7 10-7 10s-7-5-7-10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10.2" r="2.2" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    chevron: <><path d="m9 6 6 6-6 6" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  };

  return <svg {...sharedProps}>{icons[type] || icons.grid}</svg>;
}

function compactCurrency(value) {
  const amount = Number(value || 0);

  if (amount >= 1000) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }

  return formatCurrency(amount);
}

function formatCurrencyWhole(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatReferenceDate(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
    .format(date)
    .replace(/(^|[\s-])([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function endOfDay(date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfWeek(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function endOfWeek(date) {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 6);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date) {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addWeeks(date, weeks) {
  return addDays(date, weeks * 7);
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addYears(date, years) {
  return new Date(date.getFullYear() + years, date.getMonth(), 1);
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getIsoWeekInfo(date) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 4 - (target.getDay() || 7));
  const yearStart = new Date(target.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  return {
    year: target.getFullYear(),
    week: weekNumber,
  };
}

function getWeekKey(date) {
  const { year, week } = getIsoWeekInfo(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function parseWeekKey(value) {
  const match = /^(\d{4})-W(\d{2})$/.exec(value || '');
  if (!match) {
    return new Date();
  }

  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(year, 0, 4);
  const firstWeekStart = startOfWeek(jan4);
  return addWeeks(firstWeekStart, week - 1);
}

function getWeekRangeLabel(date) {
  const start = startOfWeek(date);
  const end = endOfWeek(date);
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

function getChartPeriodStart(view, date) {
  if (view === 'weekly') return startOfWeek(date);
  if (view === 'yearly') return startOfYear(date);
  return startOfMonth(date);
}

function shiftChartDate(view, date, amount) {
  if (view === 'weekly') return addWeeks(date, amount);
  if (view === 'yearly') return addYears(date, amount);
  return addMonths(date, amount);
}

function buildChartSeries(budgets, view, anchorDate) {
  const parsedBudgets = budgets
    .map((budget) => ({
      ...budget,
      _date: new Date(budget.created_at || budget.updated_at || Date.now()),
    }))
    .filter((budget) => !Number.isNaN(budget._date.getTime()));

  if (view === 'weekly') {
    const weekStart = startOfWeek(anchorDate);
    const weekEnd = endOfWeek(anchorDate);
    const series = Array.from({ length: 7 }, (_, index) => {
      const dayStart = addDays(weekStart, index);
      const dayEnd = endOfDay(dayStart);
      const value = parsedBudgets.reduce((total, budget) => {
        if (budget._date >= dayStart && budget._date <= dayEnd) {
          return total + Number(budget.total_amount || 0);
        }
        return total;
      }, 0);

      return {
        label: formatShortDate(dayStart),
        value,
      };
    });

    return {
      series,
      description: 'Evolução diária da semana selecionada.',
      periodLabel: getWeekRangeLabel(anchorDate),
      periodStart: weekStart,
      periodEnd: weekEnd,
    };
  }

  if (view === 'yearly') {
    const yearStart = startOfYear(anchorDate);
    const yearEnd = endOfYear(anchorDate);
    const series = Array.from({ length: 12 }, (_, index) => {
      const monthStart = new Date(anchorDate.getFullYear(), index, 1);
      const monthEnd = endOfMonth(monthStart);
      const value = parsedBudgets.reduce((total, budget) => {
        if (budget._date >= monthStart && budget._date <= monthEnd) {
          return total + Number(budget.total_amount || 0);
        }
        return total;
      }, 0);

      return {
        label: shortMonthFormatter.format(monthStart).replace('.', ''),
        value,
      };
    });

    return {
      series,
      description: 'Evolução mensal ao longo do ano selecionado.',
      periodLabel: `${anchorDate.getFullYear()}`,
      periodStart: yearStart,
      periodEnd: yearEnd,
    };
  }

  const monthStart = startOfMonth(anchorDate);
  const monthEnd = endOfMonth(anchorDate);
  const series = [];

  for (let cursor = new Date(monthStart); cursor <= monthEnd; cursor = addWeeks(cursor, 1)) {
    const bucketStart = new Date(cursor);
    const bucketEnd = endOfWeek(bucketStart);
    const safeEnd = bucketEnd > monthEnd ? monthEnd : bucketEnd;

    const value = parsedBudgets.reduce((total, budget) => {
      if (budget._date >= bucketStart && budget._date <= safeEnd) {
        return total + Number(budget.total_amount || 0);
      }
      return total;
    }, 0);

    series.push({
      label: formatShortDate(bucketStart),
      value,
    });
  }

  return {
    series,
    description: 'Evolução semanal do mês selecionado.',
    periodLabel: fullMonthFormatter.format(anchorDate),
    periodStart: monthStart,
    periodEnd: monthEnd,
  };
}

function buildLineGeometry(series) {
  const values = series.map((item) => Number(item.value || 0));
  const hasValues = values.some((value) => value > 0);
  const maxValue = hasValues ? Math.max(...values, 1) : 1;
  const innerWidth = CHART_WIDTH - CHART_PADDING_X * 2;
  const innerHeight = CHART_HEIGHT - CHART_PADDING_Y * 2;

  const points = series.map((item, index) => {
    const x = CHART_PADDING_X + (innerWidth / Math.max(series.length - 1, 1)) * index;
    const y = hasValues
      ? CHART_PADDING_Y + innerHeight - (innerHeight * Number(item.value || 0)) / maxValue
      : CHART_HEIGHT - CHART_PADDING_Y;
    return {
      ...item,
      x,
      y,
    };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(CHART_HEIGHT - CHART_PADDING_Y).toFixed(2)} L ${points[0].x.toFixed(2)} ${(CHART_HEIGHT - CHART_PADDING_Y).toFixed(2)} Z`;

  const ticks = Array.from({ length: 5 }, (_, index) => {
    const ratio = 1 - index / 4;
    const y = CHART_PADDING_Y + innerHeight * index / 4;
    const value = hasValues ? maxValue * ratio : 0;
    return {
      y,
      label: compactCurrency(value),
    };
  });

  return { points, linePath, areaPath, ticks, hasValues };
}

function buildStatusSegments(budgets) {
  const baseSegments = [
    { key: 'approved', label: 'Aprovados', color: '#f0d28a' },
    { key: 'pending', label: 'Pendentes', color: '#cda349' },
    { key: 'scheduled', label: 'Agendados', color: '#9b7131' },
    { key: 'other', label: 'Outros', color: '#5d4521' },
  ];

  const values = baseSegments.map((segment) => {
    const amount = budgets.reduce((total, budget) => {
      const status = String(budget.status || '').toLowerCase();
      const matches =
        segment.key === 'other'
          ? !['approved', 'pending', 'scheduled'].includes(status)
          : status === segment.key;

      return matches ? total + Number(budget.total_amount || 0) : total;
    }, 0);

    return {
      ...segment,
      value: amount,
    };
  });

  const total = values.reduce((sum, item) => sum + item.value, 0);

  if (total <= 0) {
    return {
      total: 4,
      items: baseSegments.map((segment) => ({ ...segment, value: 1, percentage: 25 })),
      gradient: `conic-gradient(#f0d28a 0deg 90deg, #cda349 90deg 180deg, #9b7131 180deg 270deg, #5d4521 270deg 360deg)`,
    };
  }

  let cursor = 0;
  const items = values.map((segment) => {
    const percentage = (segment.value / total) * 100;
    const start = cursor;
    const end = cursor + percentage * 3.6;
    cursor = end;
    return {
      ...segment,
      percentage,
      start,
      end,
    };
  });

  const gradient = `conic-gradient(${items
    .map((item) => `${item.color} ${item.start}deg ${item.end}deg`)
    .join(', ')})`;

  return { total, items, gradient };
}

export default function Dashboard() {
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);
  const [data, setData] = useState({
    metrics: {
      monthly_revenue: 0,
      installations_this_week: 0,
      completed_this_week: 0,
      available_dates: [],
      ranking_position: null,
      average_rating: 0,
      review_count: 0,
      approved_this_month: 0,
      pending_budgets: 0,
      monthly_goal: 0,
      goal_progress: 0,
      public_profile: true,
      profile_completeness: 0,
    },
    ranking: [],
    profile: {},
  });
  const [budgets, setBudgets] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [chartView, setChartView] = useState('monthly');
  const [chartDate, setChartDate] = useState(() => new Date());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const badgeCounts = usePanelBadgeCounts();
  const notificationBadge = badgeCounts.notifications > 0 ? formatPanelBadgeCount(badgeCounts.notifications) : null;
  const panelNavItems = useMemo(() => (user?.is_admin ? [...PANEL_NAV_ITEMS, ADMIN_NAV_ITEM] : PANEL_NAV_ITEMS), [user?.is_admin]);
  const mobileDockItems = useMemo(
    () => (user?.is_admin ? [...MOBILE_DOCK_ITEMS.slice(0, 4), ADMIN_MOBILE_DOCK_ITEM] : MOBILE_DOCK_ITEMS),
    [user?.is_admin]
  );

  useEffect(() => {
    Promise.all([
      api.get('/users/dashboard'),
      api.get('/budgets').catch(() => ({ data: [] })),
      api.get('/clients').catch(() => ({ data: [] })),
    ])
      .then(([dashboardResponse, budgetsResponse, clientsResponse]) => {
        setData(dashboardResponse.data);
        setBudgets(Array.isArray(budgetsResponse.data) ? budgetsResponse.data : []);
        setClients(Array.isArray(clientsResponse.data) ? clientsResponse.data : []);
      })
      .catch((error) => {
        toast.error(error.response?.data?.error || 'Nao foi possivel carregar o dashboard.');
      });
  }, []);

  const { metrics, ranking } = data;
  const firstName = user?.name?.split(' ')[0] || 'Instalador';
  const periodRangeLabel = `01/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()} - ${String(endOfMonth(today).getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  const clientsWithEmail = clients.filter((client) => Boolean(client.email)).length;
  const budgetsThisMonth = useMemo(() => {
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    return budgets.filter((budget) => {
      const createdAt = new Date(budget.created_at || budget.updated_at || Date.now());
      return !Number.isNaN(createdAt.getTime()) && createdAt >= monthStart && createdAt <= monthEnd;
    });
  }, [budgets, today]);

  const approvedBudgetsThisMonth = budgetsThisMonth.filter((budget) => budget.status === 'approved').length;
  const averageTicket = approvedBudgetsThisMonth
    ? Number(metrics.monthly_revenue || 0) / approvedBudgetsThisMonth
    : budgetsThisMonth.length
      ? budgetsThisMonth.reduce((sum, budget) => sum + Number(budget.total_amount || 0), 0) / budgetsThisMonth.length
      : 0;

  const chartData = useMemo(() => buildChartSeries(budgets, chartView, chartDate), [budgets, chartView, chartDate]);
  const chartSeries = useMemo(() => chartData.series, [chartData]);
  const chartGeometry = useMemo(() => buildLineGeometry(chartSeries), [chartSeries]);
  const segmentData = useMemo(() => buildStatusSegments(budgetsThisMonth), [budgetsThisMonth]);
  const currentPeriodStart = useMemo(() => getChartPeriodStart(chartView, today), [chartView, today]);
  const selectedPeriodStart = useMemo(() => getChartPeriodStart(chartView, chartDate), [chartView, chartDate]);
  const canAdvanceChart = selectedPeriodStart.getTime() < currentPeriodStart.getTime();

  const chartYears = useMemo(() => {
    const budgetYears = budgets
      .map((budget) => new Date(budget.created_at || budget.updated_at || Date.now()))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map((date) => date.getFullYear());

    const currentYear = today.getFullYear();
    const minYear = Math.min(currentYear - 2, ...(budgetYears.length ? budgetYears : [currentYear]));
    const maxYear = Math.max(currentYear, ...(budgetYears.length ? budgetYears : [currentYear]));

    return Array.from({ length: maxYear - minYear + 1 }, (_, index) => maxYear - index);
  }, [budgets, today]);

  const chartWeekOptions = useMemo(() => {
    const budgetDates = budgets
      .map((budget) => new Date(budget.created_at || budget.updated_at || Date.now()))
      .filter((date) => !Number.isNaN(date.getTime()));

    const latestWeek = startOfWeek(today);
    const earliestBudgetWeek = budgetDates.length
      ? startOfWeek(new Date(Math.min(...budgetDates.map((date) => date.getTime()))))
      : addWeeks(latestWeek, -24);
    const fallbackWeek = addWeeks(latestWeek, -24);
    const firstWeek = earliestBudgetWeek < fallbackWeek ? earliestBudgetWeek : fallbackWeek;
    const options = [];

    for (let cursor = new Date(latestWeek); cursor >= firstWeek; cursor = addWeeks(cursor, -1)) {
      options.push({
        value: getWeekKey(cursor),
        label: `Semana ${getIsoWeekInfo(cursor).week} · ${getWeekRangeLabel(cursor)}`,
      });
    }

    const selectedWeekValue = getWeekKey(chartDate);
    if (!options.some((option) => option.value === selectedWeekValue)) {
      options.unshift({
        value: selectedWeekValue,
        label: `Semana ${getIsoWeekInfo(chartDate).week} · ${getWeekRangeLabel(chartDate)}`,
      });
    }

    return options;
  }, [budgets, chartDate, today]);

  const mobileChartTicks = useMemo(() => {
    if (!chartGeometry.ticks.length) {
      return [];
    }

    return chartGeometry.ticks.filter((_, index) => index === 0 || index === 2 || index === 4);
  }, [chartGeometry]);

  const filteredRecentBudgets = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    const sorted = [...budgets].sort(
      (first, second) => new Date(second.created_at || 0).getTime() - new Date(first.created_at || 0).getTime()
    );

    if (!normalizedQuery) {
      return sorted.slice(0, 5);
    }

    return sorted
      .filter((budget) => {
        const haystack = [budget.id, budget.client_name, budget.status]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 5);
  }, [budgets, search]);

  const dashboardCards = [
    {
      label: 'Receita total',
      value: compactCurrency(metrics.monthly_revenue),
      detail: `${metrics.goal_progress || 0}% da meta mensal`,
      tone: 'blue',
      type: 'revenue',
    },
    {
      label: 'Novos orcamentos',
      value: `${budgetsThisMonth.length}`,
      detail: `${metrics.pending_budgets || 0} aguardando retorno`,
      tone: 'green',
      type: 'budgets',
    },
    {
      label: 'Novos clientes',
      value: `${clients.length}`,
      detail: `${clientsWithEmail} com email cadastrado`,
      tone: 'purple',
      type: 'clients',
    },
    {
      label: 'Ticket medio',
      value: compactCurrency(averageTicket),
      detail: `${approvedBudgetsThisMonth || 0} aprovados no mes`,
      tone: 'orange',
      type: 'ticket',
    },
  ];

  const quickSummary = [
    { label: 'Receita', value: formatCurrency(metrics.monthly_revenue), tone: 'positive' },
    {
      label: 'Em aberto',
      value: formatCurrency(
        budgetsThisMonth
          .filter((budget) => ['pending', 'scheduled'].includes(String(budget.status || '').toLowerCase()))
          .reduce((sum, budget) => sum + Number(budget.total_amount || 0), 0)
      ),
      tone: 'neutral',
    },
    {
      label: 'Nota publica',
      value: Number(metrics.average_rating || 0).toFixed(1),
      tone: 'neutral',
    },
    {
      label: 'Disponibilidade',
      value: metrics.available_dates?.length ? `${metrics.available_dates.length} datas` : 'Ajustar',
      tone: metrics.available_dates?.length ? 'positive' : 'warning',
    },
  ];

  const handleChartShift = (direction) => {
    setChartDate((current) => shiftChartDate(chartView, current, direction));
  };

  const handleChartViewChange = (nextView) => {
    if (!CHART_VIEWS.includes(nextView)) {
      return;
    }

    setChartView(nextView);
    setChartDate((current) => getChartPeriodStart(nextView, current));
  };

  const handleChartYearChange = (yearValue) => {
    const nextYear = Number(yearValue);
    if (!Number.isFinite(nextYear)) {
      return;
    }

    setChartDate((current) => new Date(nextYear, current.getMonth(), 1));
  };

  const handleChartMonthChange = (monthValue) => {
    const nextMonth = Number(monthValue);
    if (!Number.isFinite(nextMonth)) {
      return;
    }

    setChartDate((current) => new Date(current.getFullYear(), nextMonth, 1));
  };

  const initials = (user?.name || 'Matheus Chaves')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'MC';
  const pendingBudgets = budgetsThisMonth.filter((budget) => String(budget.status || '').toLowerCase() === 'pending');
  const conversionRate = budgetsThisMonth.length
    ? Math.round((approvedBudgetsThisMonth / budgetsThisMonth.length) * 100)
    : 0;
  const todayAgendaLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' }).format(today);
  const referenceCards = [
    {
      label: 'Receita total',
      mobileLabel: 'Receita',
      value: formatCurrencyWhole(metrics.monthly_revenue),
      detail: `${metrics.goal_progress || 0}% da meta mensal`,
      mobileDetail: `${metrics.goal_progress || 0}% da meta`,
      delta: '+12%',
      type: 'dollar',
      positive: true,
    },
    {
      label: 'Orcamentos enviados',
      mobileLabel: 'Orcamentos',
      value: `${budgetsThisMonth.length}`,
      detail: `${metrics.pending_budgets || pendingBudgets.length} aguardando resposta`,
      mobileDetail: `${metrics.pending_budgets || pendingBudgets.length} pendentes`,
      delta: `+${Math.max(approvedBudgetsThisMonth, 0)}`,
      type: 'file',
      positive: true,
    },
    {
      label: 'Novos clientes',
      mobileLabel: 'Clientes',
      value: `${clients.length}`,
      detail: 'no mes atual',
      mobileDetail: 'este mes',
      delta: `+${clientsWithEmail}`,
      type: 'clients',
      positive: true,
    },
    {
      label: 'Taxa de conversao',
      mobileLabel: 'Conversao',
      value: `${conversionRate}%`,
      detail: 'orcamentos aprovados',
      mobileDetail: 'aprovados',
      delta: '-2%',
      type: 'trend',
      positive: false,
    },
  ];
  const upcomingAppointments = filteredRecentBudgets.slice(0, 3);
  const rankingItems = ranking.length
    ? ranking.slice(0, 4)
    : [
        { id: 'self', ranking_position: metrics.ranking_position || 3, display_name: user?.name || 'Matheus Chaves', average_rating: metrics.average_rating || 4.8 },
      ];

  return (
    <section className={`ref-panel-shell ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
      <aside className="ref-panel-sidebar" aria-label="Navegacao do painel">
        <div className="ref-panel-brand">
          <span className="ref-panel-logo">P</span>
          <strong>PapelPro</strong>
          <button aria-label="Recolher menu" onClick={() => setSidebarCollapsed((current) => !current)} type="button">
            <span>{sidebarCollapsed ? '>' : '<'}</span>
          </button>
        </div>

        <div className="ref-panel-user">
          <span className="ref-panel-avatar">{initials}</span>
          <div>
            <strong>{user?.name || 'Matheus Chaves'}</strong>
            <small>Instalador Pro</small>
          </div>
        </div>

        <nav className="ref-panel-nav">
          {panelNavItems.map((item) => {
            const badge = getPanelBadgeValue(item, badgeCounts);

            return (
              <div className="ref-panel-nav-block" key={`${item.section || ''}-${item.label}`}>
                {item.section ? <p>{item.section}</p> : null}
                <NavLink className={({ isActive }) => `ref-panel-nav-link ${isActive && item.label === 'Inicio' ? 'is-active' : ''}`} to={item.to}>
                  <PanelIcon type={item.icon} />
                  <span>{item.label}</span>
                  {badge !== null ? <em>{badge}</em> : null}
                </NavLink>
              </div>
            );
          })}
        </nav>

        <button className="ref-panel-logout" type="button">
          <PanelIcon type="profile" />
          <span>Sair</span>
        </button>
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
              {formatReferenceDate(today)}
            </span>
            <Link className="ref-panel-bell" to="/notifications">
              <PanelIcon type="bell" size={18} />
              {notificationBadge ? <em>{notificationBadge}</em> : null}
            </Link>
            <Link className="ref-panel-account" to="/profile">
              <span>{initials}</span>
              <strong>{firstName}</strong>
              <PanelIcon type="chevron" size={15} />
            </Link>
          </div>
        </header>

        <header className="ref-panel-mobile-header">
          <button type="button">
            <PanelIcon type="menu" />
          </button>
          <div>
            <span className="ref-panel-logo">P</span>
            <strong>PapelPro</strong>
          </div>
          <nav aria-label="Acoes rapidas do painel">
            <Link to="/dashboard"><PanelIcon type="search" size={18} /></Link>
            <Link to="/notifications"><PanelIcon type="bell" size={18} />{notificationBadge ? <em>{notificationBadge}</em> : null}</Link>
            <Link to="/profile" className="ref-panel-avatar">{initials}</Link>
          </nav>
        </header>

        <main className="ref-panel-content">
          <section className="ref-panel-hero">
            <div>
              <p>Painel do instalador</p>
              <h1>Bom dia, <span>{firstName}</span></h1>
              <h2>Ola, <span>{firstName}</span></h2>
              <small>
                <span className="ref-panel-hero-copy-desktop">
                  Voce tem <strong>{metrics.installations_this_week || upcomingAppointments.length || 3} instalacoes</strong> agendadas para esta semana.
                  Continue assim para alcancar sua meta mensal.
                </span>
                <span className="ref-panel-hero-copy-mobile">
                  Continue assim para alcancar sua <strong>meta mensal</strong>.
                </span>
              </small>
            </div>
            <div className="ref-panel-hero-actions">
              <span className="ref-panel-week-badge"><i />{metrics.installations_this_week || 3} esta semana</span>
              <Link className="ref-panel-primary" to="/budgets/new">
                Novo orcamento <PanelIcon type="arrow" size={16} />
              </Link>
              <Link className="ref-panel-secondary" to="/agenda">Ver agenda</Link>
            </div>
          </section>

          <section className="ref-panel-mobile-section-head">
            <h3>Resumo do mes</h3>
            <Link to="/dashboard">Ver detalhes <PanelIcon type="chevron" size={14} /></Link>
          </section>

          <section className="ref-panel-metrics" aria-label="Resumo do mes">
            {referenceCards.map((card, index) => (
              <article className="ref-panel-metric-card" key={card.label} style={{ animationDelay: `${index * 70}ms` }}>
                <span className="ref-panel-metric-icon">
                  <PanelIcon type={card.type} />
                </span>
                <p>
                  <span className="ref-panel-label-desktop">{card.label}</span>
                  <span className="ref-panel-label-mobile">{card.mobileLabel}</span>
                </p>
                <strong>{card.value}</strong>
                <div>
                  <small>
                    <span className="ref-panel-label-desktop">{card.detail}</span>
                    <span className="ref-panel-label-mobile">{card.mobileDetail}</span>
                  </small>
                  <em data-positive={card.positive}>{card.positive ? '+' : ''}{card.delta.replace('+', '')}</em>
                </div>
              </article>
            ))}
          </section>
          <div className="ref-panel-metric-dots" aria-hidden="true">
            <span className="is-active" />
            <span />
            <span />
            <span />
          </div>

          <section className="ref-panel-grid">
            <article className="ref-panel-card ref-panel-chart-card">
              <div className="ref-panel-card-head">
                <div>
                  <h3>Visao geral de vendas</h3>
                  <p>{chartData.description}</p>
                </div>
                <div className="ref-panel-tabs">
                  {CHART_VIEWS.map((view) => (
                    <button className={chartView === view ? 'is-active' : ''} key={view} onClick={() => handleChartViewChange(view)} type="button">
                      {CHART_VIEW_LABELS[view]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="ref-panel-chart-wrap">
                <svg aria-hidden="true" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
                  {chartGeometry.ticks.map((tick) => (
                    <line className="ref-panel-chart-gridline" key={`grid-${tick.y}`} x1={CHART_PADDING_X} x2={CHART_WIDTH - CHART_PADDING_X} y1={tick.y} y2={tick.y} />
                  ))}
                  <path className="ref-panel-chart-area" d={chartGeometry.areaPath} />
                  <path className="ref-panel-chart-line" d={chartGeometry.linePath} />
                </svg>
              </div>
            </article>

            <article className="ref-panel-card ref-panel-donut-card">
              <div className="ref-panel-card-head">
                <div>
                  <h3>Distribuicao das propostas</h3>
                  <p>Como o valor total do mes esta dividido por status.</p>
                </div>
              </div>
              <div className="ref-panel-donut-row">
                <div className="ref-panel-donut" style={{ background: segmentData.gradient }}>
                  <span>{budgetsThisMonth.length || segmentData.items.length}<small>propostas</small></span>
                </div>
                <div className="ref-panel-legend">
                  {segmentData.items.map((item) => (
                    <p key={item.label}><i style={{ background: item.color }} />{item.label}<strong>{Math.round(item.percentage || 0)}%</strong></p>
                  ))}
                </div>
              </div>
            </article>
          </section>

          <section className="ref-panel-mobile-stack">
            <article className="ref-panel-card ref-panel-agenda-card">
              <div className="ref-panel-card-head is-inline">
                <div className="ref-panel-agenda-title">
                  <PanelIcon type="agenda" size={16} />
                  <h3>Hoje</h3>
                  <span>{todayAgendaLabel}</span>
                </div>
                <Link to="/agenda">Ver agenda <PanelIcon type="chevron" size={14} /></Link>
              </div>
              <div className="ref-panel-agenda-stats">
                <span><strong>{metrics.installations_this_week || upcomingAppointments.length || 3}</strong>esta semana</span>
                <span><strong>{metrics.completed_this_week || 1}</strong>concluidas</span>
                <span><strong>{pendingBudgets.length || 2}</strong>pendentes</span>
              </div>
              <div className="ref-panel-appointment-list">
                {upcomingAppointments.map((budget) => (
                  <article className="ref-panel-appointment" data-status={budget.status} key={budget.id}>
                    <div className="ref-panel-appointment-head">
                      <div>
                        <strong>{budget.client_name || `Orcamento #${budget.id}`}</strong>
                        <small>{budget.rooms_count ? `${budget.rooms_count} ambientes` : '2 ambientes'}</small>
                      </div>
                      <em className="ref-panel-status-pill" data-status={budget.status}>
                        {String(budget.status || '').toLowerCase() === 'approved' ? 'confirmado' : formatStatusLabel(budget.status).toLowerCase()}
                      </em>
                    </div>
                    <div className="ref-panel-appointment-meta">
                      <span><PanelIcon type="clock" size={13} />{budget.scheduled_time || '09:00'}</span>
                      <span><PanelIcon type="pin" size={13} />{budget.address || budget.client_address || 'Rua das Flores, 123'}</span>
                    </div>
                  </article>
                ))}
              </div>
              <Link className="ref-panel-add-appointment" to="/agenda">
                <PanelIcon type="plus" size={17} />
                Agendar instalacao
              </Link>
            </article>

            <article className="ref-panel-card ref-panel-ranking-card">
              <div className="ref-panel-card-head is-inline">
                <h3>Ranking</h3>
                <span>Top instaladores</span>
              </div>
              {rankingItems.map((item, index) => (
                <div className="ref-panel-ranking-row" key={item.id || item.display_name || item.name || `ranking-${index}`}>
                  <em>#{item.ranking_position || 1}</em>
                  <span>{item.display_name || 'Instalador'}</span>
                  <strong>{Number(item.average_rating || 0).toFixed(1)}</strong>
                </div>
              ))}
            </article>

            <article className="ref-panel-card ref-panel-quotes-card">
              <div className="ref-panel-card-head is-inline">
                <h3>Orcamentos recentes</h3>
                <Link to="/budgets">Ver todos</Link>
              </div>
              {filteredRecentBudgets.map((budget) => (
                <Link className="ref-panel-quote-row" key={budget.id} to="/budgets">
                  <span>#{budget.id}</span>
                  <strong>{budget.client_name || 'Cliente nao informado'}</strong>
                  <em>{formatCurrency(budget.total_amount)}</em>
                </Link>
              ))}
            </article>

            <article className="ref-panel-card ref-panel-finance-card">
              <div className="ref-panel-card-head">
                <div>
                  <h3>Resumo financeiro</h3>
                  <p>Leitura rapida do que entra, aberto e desempenho.</p>
                </div>
              </div>
              {quickSummary.map((item) => (
                <div className="ref-panel-finance-row" key={item.label}>
                  <span>{item.label}</span>
                  <strong data-tone={item.tone}>{item.value}</strong>
                </div>
              ))}
            </article>
          </section>
        </main>

        <nav aria-label="Navegacao mobile" className="ref-panel-bottom-nav">
          {mobileDockItems.map((item) => (
            <NavLink className={({ isActive }) => `ref-panel-bottom-tab ${isActive ? 'is-active' : ''}`} key={item.to} to={item.to}>
              <DashboardDockIcon type={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </section>
  );

  return (
    <section className="dashboard-neo-shell">
      <div className="dashboard-neo-toolbar fade-up">
        <label className="dashboard-neo-search">
          <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar no sistema..."
            type="text"
            value={search}
          />
        </label>

        <div className="dashboard-neo-toolbar-actions">
          <div className="dashboard-neo-range">
            <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="18">
              <rect height="15" rx="2" width="18" x="3" y="5" />
              <path d="M8 3v4M16 3v4M3 10h18" />
            </svg>
            <span>{periodRangeLabel}</span>
          </div>

          <Link className="dashboard-neo-primary" to="/budgets/new">
            Novo orçamento
          </Link>
        </div>
      </div>

      <div className="dashboard-neo-frame fade-up" style={{ animationDelay: '0.06s' }}>
        <div className="dashboard-neo-heading">
          <div>
            <p className="dashboard-neo-kicker">Resumo do negócio</p>
            <h1>Dashboard</h1>
            <p>
              Bem-vindo de volta, {firstName}. Acompanhe receita, propostas, clientes e agenda
              em uma leitura mais clara e organizada.
            </p>
            <div className="dashboard-neo-mobile-range">
              <div className="dashboard-neo-range dashboard-neo-range--mobile">
                <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="18">
                  <rect height="15" rx="2" width="18" x="3" y="5" />
                  <path d="M8 3v4M16 3v4M3 10h18" />
                </svg>
                <span>{periodRangeLabel}</span>
              </div>
            </div>
          </div>

          <div className="dashboard-neo-heading-actions">
            <Link className="dashboard-neo-ghost" to="/agenda">
              Ver agenda
            </Link>
            <Link className="dashboard-neo-ghost" to="/clients">
              Ver clientes
            </Link>
          </div>
        </div>

        <div className="dashboard-neo-metrics">
          {dashboardCards.map((card) => (
            <article className="dashboard-neo-card" key={card.label}>
              <div className="dashboard-neo-card-top">
                <DashboardIcon tone={card.tone} type={card.type} />
                <div>
                  <p className="dashboard-neo-card-label">{card.label}</p>
                  <h2>{card.value}</h2>
                </div>
              </div>
              <p className="dashboard-neo-card-foot">{card.detail}</p>
            </article>
          ))}
        </div>

        <div className="dashboard-neo-main-grid">
          <article className="dashboard-neo-panel dashboard-neo-panel--chart">
            <div className="dashboard-neo-panel-head">
              <div>
                <h3>Visão geral de vendas</h3>
                <p>{chartData.description}</p>
              </div>
              <div className="dashboard-neo-panel-tools">
                <div className="dashboard-neo-view-switch" role="tablist" aria-label="Período do gráfico">
                  {CHART_VIEWS.map((view) => (
                    <button
                      aria-selected={chartView === view}
                      className={`dashboard-neo-view-tab ${chartView === view ? 'is-active' : ''}`}
                      key={view}
                      onClick={() => handleChartViewChange(view)}
                      type="button"
                    >
                      {CHART_VIEW_LABELS[view]}
                    </button>
                  ))}
                </div>

                <div className={`dashboard-neo-period-controls ${chartView === 'monthly' ? '' : 'is-single'}`.trim()}>
                  <button
                    aria-label="Período anterior"
                    className="dashboard-neo-nav"
                    onClick={() => handleChartShift(-1)}
                    type="button"
                  >
                    ‹
                  </button>

                  {chartView === 'weekly' ? (
                    <select
                      className="dashboard-neo-select"
                      onChange={(event) => setChartDate(parseWeekKey(event.target.value))}
                      value={getWeekKey(chartDate)}
                    >
                      {chartWeekOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  {chartView === 'monthly' ? (
                    <>
                      <select
                        className="dashboard-neo-select dashboard-neo-select--compact"
                        onChange={(event) => handleChartMonthChange(event.target.value)}
                        value={chartDate.getMonth()}
                      >
                        {MONTH_OPTIONS.map((month) => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>

                      <select
                        className="dashboard-neo-select dashboard-neo-select--year"
                        onChange={(event) => handleChartYearChange(event.target.value)}
                        value={chartDate.getFullYear()}
                      >
                        {chartYears.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : null}

                  {chartView === 'yearly' ? (
                    <select
                      className="dashboard-neo-select dashboard-neo-select--year"
                      onChange={(event) => handleChartYearChange(event.target.value)}
                      value={chartDate.getFullYear()}
                    >
                      {chartYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  <button
                    aria-label="Próximo período"
                    className="dashboard-neo-nav"
                    disabled={!canAdvanceChart}
                    onClick={() => handleChartShift(1)}
                    type="button"
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>

            <div className="dashboard-neo-chart-meta">
              <span className="dashboard-neo-filter">{chartData.periodLabel}</span>
              {!chartGeometry.hasValues ? (
                  <span className="dashboard-neo-chart-empty">Sem valores registrados neste período.</span>
              ) : null}
            </div>

            <div className="dashboard-neo-chart">
              <div className="dashboard-neo-chart-y">
                {chartGeometry.ticks.map((tick) => (
                  <span key={`${tick.label}-${tick.y}`}>{tick.label}</span>
                ))}
              </div>

              <div className="dashboard-neo-chart-main">
                <div className="dashboard-neo-chart-scale-mobile">
                  {mobileChartTicks.map((tick) => (
                    <span key={`mobile-${tick.label}-${tick.y}`}>{tick.label}</span>
                  ))}
                </div>

                <svg aria-hidden="true" className="dashboard-neo-chart-svg" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
                  {chartGeometry.ticks.map((tick) => (
                    <line
                      className="dashboard-neo-chart-gridline"
                      key={`grid-${tick.y}`}
                      x1={CHART_PADDING_X}
                      x2={CHART_WIDTH - CHART_PADDING_X}
                      y1={tick.y}
                      y2={tick.y}
                    />
                  ))}
                  <path className="dashboard-neo-chart-area" d={chartGeometry.areaPath} />
                  <path className="dashboard-neo-chart-line" d={chartGeometry.linePath} />
                  {chartGeometry.points.map((point) => (
                    <circle className="dashboard-neo-chart-point" cx={point.x} cy={point.y} key={point.label} r="4.5" />
                  ))}
                </svg>

                <div className="dashboard-neo-chart-labels">
                  {chartSeries.map((item) => (
                    <span key={item.label}>{item.label}</span>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article className="dashboard-neo-panel dashboard-neo-panel--donut">
            <div className="dashboard-neo-panel-head">
              <div>
                <h3>Distribuição das propostas</h3>
                <p>Como o valor total do mês está dividido por status.</p>
              </div>
              <span className="dashboard-neo-filter">Este mês</span>
            </div>

            <div className="dashboard-neo-donut-layout">
              <div className="dashboard-neo-donut" style={{ background: segmentData.gradient }}>
                <div className="dashboard-neo-donut-hole">
                  <strong>{budgetsThisMonth.length}</strong>
                  <span>propostas</span>
                </div>
              </div>

              <div className="dashboard-neo-legend">
                {segmentData.items.map((segment) => (
                  <article className="dashboard-neo-legend-item" key={segment.label}>
                    <span className="dashboard-neo-legend-mark" style={{ background: segment.color }} />
                    <div>
                      <p>{segment.label}</p>
                      <span>
                        {compactCurrency(segment.value)} ({segment.percentage ? Math.round(segment.percentage) : 25}%)
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </article>
        </div>

        <div className="dashboard-neo-bottom-grid">
          <article className="dashboard-neo-panel">
            <div className="dashboard-neo-panel-head">
              <div>
                <h3>Orçamentos recentes</h3>
                <p>As oportunidades mais novas da operação comercial.</p>
              </div>
              <Link className="dashboard-neo-link" to="/budgets">
                Ver todos
              </Link>
            </div>

            <div className="dashboard-neo-table-wrap">
              <table className="dashboard-neo-table">
                <thead>
                  <tr>
                    <th>Orçamento</th>
                    <th>Cliente</th>
                    <th>Data</th>
                    <th>Status</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecentBudgets.length > 0 ? (
                    filteredRecentBudgets.map((budget) => (
                      <tr key={budget.id}>
                        <td data-label="Orçamento">#{budget.id}</td>
                        <td data-label="Cliente">{budget.client_name || 'Cliente não informado'}</td>
                        <td data-label="Data">{formatDateTime(budget.created_at)}</td>
                        <td data-label="Status">
                          <span className="dashboard-neo-status" data-tone={budget.status}>
                            {formatStatusLabel(budget.status)}
                          </span>
                        </td>
                        <td data-label="Total">{formatCurrency(budget.total_amount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="dashboard-neo-empty-row" colSpan="5">
                        Nenhum orçamento encontrado para esse filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="dashboard-neo-panel dashboard-neo-panel--summary">
            <div className="dashboard-neo-panel-head">
              <div>
                <h3>Resumo financeiro</h3>
                <p>Leitura rápida do que entra, do que está em aberto e do desempenho do perfil.</p>
              </div>
              <span className="dashboard-neo-filter">Hoje</span>
            </div>

            <div className="dashboard-neo-summary-list">
              {quickSummary.map((item) => (
                <div className="dashboard-neo-summary-row" key={item.label}>
                  <span>{item.label}</span>
                  <strong data-tone={item.tone}>{item.value}</strong>
                </div>
              ))}
            </div>

            <div className="dashboard-neo-note">
              <p>
                Ranking público atual: <strong>#{metrics.ranking_position || '--'}</strong>
              </p>
              <p>
                Avaliações recebidas: <strong>{metrics.review_count || 0}</strong>
              </p>
              <p>
                Perfil completo: <strong>{metrics.profile_completeness || 0}%</strong>
              </p>
            </div>

            <div className="dashboard-neo-mini-feed">
              <p className="dashboard-neo-mini-title">Próximas datas disponíveis</p>
              {metrics.available_dates?.length ? (
                metrics.available_dates.slice(0, 4).map((date) => (
                  <span className="dashboard-neo-mini-chip" key={date}>
                    {formatShortDate(date)}
                  </span>
                ))
              ) : (
                <span className="dashboard-neo-mini-chip is-muted">Defina horários no perfil</span>
              )}
            </div>

            {ranking.length > 0 ? (
              <div className="dashboard-neo-top-list">
                <p className="dashboard-neo-mini-title">Melhores instaladores no ranking público</p>
                {ranking.slice(0, 3).map((item, index) => (
                  <div className="dashboard-neo-top-item" key={item.id || item.display_name || item.name || `top-${index}`}>
                    <span>#{item.ranking_position}</span>
                    <p>{item.display_name}</p>
                    <strong>{Number(item.average_rating || 0).toFixed(1)}</strong>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        </div>
      </div>

      <nav aria-label="Atalhos do dashboard" className="dashboard-neo-mobile-dock">
        {MOBILE_DOCK_ITEMS.map((item) => (
          <NavLink
            className={({ isActive }) => `dashboard-neo-mobile-tab ${isActive ? 'is-active' : ''}`}
            key={item.to}
            to={item.to}
          >
            <DashboardDockIcon type={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </section>
  );
}
