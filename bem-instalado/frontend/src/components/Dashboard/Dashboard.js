import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
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
      value: formatCurrency(metrics.monthly_revenue),
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
      value: formatCurrency(averageTicket),
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
            placeholder="Buscar cliente, status ou numero do orcamento..."
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
            Novo orcamento
          </Link>
        </div>
      </div>

      <div className="dashboard-neo-frame fade-up" style={{ animationDelay: '0.06s' }}>
        <div className="dashboard-neo-heading">
          <div>
            <p className="dashboard-neo-kicker">Dashboard</p>
            <h1>Bem-vindo de volta, {firstName}.</h1>
            <p>
              Veja receita, propostas, clientes e agenda em uma unica leitura, com foco no que
              realmente precisa de atencao agora.
            </p>
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
                <h3>Visao geral de vendas</h3>
                <p>{chartData.description}</p>
              </div>
              <div className="dashboard-neo-panel-tools">
                <div className="dashboard-neo-view-switch" role="tablist" aria-label="Periodo do grafico">
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
                    aria-label="Periodo anterior"
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
                    aria-label="Proximo periodo"
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
                <span className="dashboard-neo-chart-empty">Sem valores registrados neste periodo.</span>
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
                <h3>Distribuicao das propostas</h3>
                <p>Como o valor total do mes esta dividido por status.</p>
              </div>
              <span className="dashboard-neo-filter">Este mes</span>
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
                <h3>Orcamentos recentes</h3>
                <p>As oportunidades mais novas da operacao comercial.</p>
              </div>
              <Link className="dashboard-neo-link" to="/budgets">
                Ver todos
              </Link>
            </div>

            <div className="dashboard-neo-table-wrap">
              <table className="dashboard-neo-table">
                <thead>
                  <tr>
                    <th>Orcamento</th>
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
                        <td data-label="Orcamento">#{budget.id}</td>
                        <td data-label="Cliente">{budget.client_name || 'Cliente nao informado'}</td>
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
                        Nenhum orcamento encontrado para esse filtro.
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
                <p>Leitura rapida do que entra, do que esta em aberto e do desempenho do perfil.</p>
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
                Ranking publico atual: <strong>#{metrics.ranking_position || '--'}</strong>
              </p>
              <p>
                Avaliacoes recebidas: <strong>{metrics.review_count || 0}</strong>
              </p>
              <p>
                Perfil completo: <strong>{metrics.profile_completeness || 0}%</strong>
              </p>
            </div>

            <div className="dashboard-neo-mini-feed">
              <p className="dashboard-neo-mini-title">Proximas datas disponiveis</p>
              {metrics.available_dates?.length ? (
                metrics.available_dates.slice(0, 4).map((date) => (
                  <span className="dashboard-neo-mini-chip" key={date}>
                    {formatShortDate(date)}
                  </span>
                ))
              ) : (
                <span className="dashboard-neo-mini-chip is-muted">Defina horarios no perfil</span>
              )}
            </div>

            {ranking.length > 0 ? (
              <div className="dashboard-neo-top-list">
                <p className="dashboard-neo-mini-title">Melhores instaladores no ranking publico</p>
                {ranking.slice(0, 3).map((item) => (
                  <div className="dashboard-neo-top-item" key={item.id}>
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
    </section>
  );
}
