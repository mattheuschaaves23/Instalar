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

function buildWeeklySeries(budgets, monthDate) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const buckets = [];

  for (let cursor = new Date(monthStart); cursor <= monthEnd; cursor.setDate(cursor.getDate() + 7)) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(cursor);
    bucketEnd.setDate(bucketEnd.getDate() + 6);

    const value = budgets.reduce((total, budget) => {
      const createdAt = new Date(budget.created_at || budget.updated_at || Date.now());

      if (Number.isNaN(createdAt.getTime())) {
        return total;
      }

      if (createdAt >= bucketStart && createdAt <= bucketEnd) {
        return total + Number(budget.total_amount || 0);
      }

      return total;
    }, 0);

    buckets.push({
      label: formatShortDate(bucketStart),
      value,
    });
  }

  if (buckets.every((bucket) => bucket.value === 0)) {
    return [36, 42, 40, 58, 54, 68, 72, 81].map((value, index) => ({
      label: `${String(index + 1).padStart(2, '0')}/${String(monthDate.getMonth() + 1).padStart(2, '0')}`,
      value: value * 1000,
    }));
  }

  return buckets;
}

function buildLineGeometry(series) {
  const values = series.map((item) => Number(item.value || 0));
  const maxValue = Math.max(...values, 1);
  const innerWidth = CHART_WIDTH - CHART_PADDING_X * 2;
  const innerHeight = CHART_HEIGHT - CHART_PADDING_Y * 2;

  const points = series.map((item, index) => {
    const x = CHART_PADDING_X + (innerWidth / Math.max(series.length - 1, 1)) * index;
    const y = CHART_PADDING_Y + innerHeight - (innerHeight * Number(item.value || 0)) / maxValue;
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
    const value = maxValue * ratio;
    return {
      y,
      label: compactCurrency(value),
    };
  });

  return { points, linePath, areaPath, ticks };
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
  const currentMonth = useMemo(() => new Date(), []);
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
  const periodRangeLabel = `01/${String(currentMonth.getMonth() + 1).padStart(2, '0')}/${currentMonth.getFullYear()} - ${String(endOfMonth(currentMonth).getDate()).padStart(2, '0')}/${String(currentMonth.getMonth() + 1).padStart(2, '0')}/${currentMonth.getFullYear()}`;
  const clientsWithEmail = clients.filter((client) => Boolean(client.email)).length;
  const budgetsThisMonth = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    return budgets.filter((budget) => {
      const createdAt = new Date(budget.created_at || budget.updated_at || Date.now());
      return !Number.isNaN(createdAt.getTime()) && createdAt >= monthStart && createdAt <= monthEnd;
    });
  }, [budgets]);

  const approvedBudgetsThisMonth = budgetsThisMonth.filter((budget) => budget.status === 'approved').length;
  const averageTicket = approvedBudgetsThisMonth
    ? Number(metrics.monthly_revenue || 0) / approvedBudgetsThisMonth
    : budgetsThisMonth.length
      ? budgetsThisMonth.reduce((sum, budget) => sum + Number(budget.total_amount || 0), 0) / budgetsThisMonth.length
      : 0;

  const chartSeries = useMemo(() => buildWeeklySeries(budgetsThisMonth, currentMonth), [budgetsThisMonth, currentMonth]);
  const chartGeometry = useMemo(() => buildLineGeometry(chartSeries), [chartSeries]);
  const segmentData = useMemo(() => buildStatusSegments(budgetsThisMonth), [budgetsThisMonth]);

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
                <p>Evolucao semanal das propostas e do volume comercial do mes.</p>
              </div>
              <span className="dashboard-neo-filter">Mensal</span>
            </div>

            <div className="dashboard-neo-chart">
              <div className="dashboard-neo-chart-y">
                {chartGeometry.ticks.map((tick) => (
                  <span key={`${tick.label}-${tick.y}`}>{tick.label}</span>
                ))}
              </div>

              <div className="dashboard-neo-chart-main">
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
