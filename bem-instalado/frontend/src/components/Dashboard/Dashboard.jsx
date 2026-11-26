import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { formatCurrency } from '../../utils/formatters';
import { PANEL_BADGE_REFRESH_EVENT } from '../Layout/panelBadgeCounts';
import PlanUsage, { ProFeatureNotice } from '../Subscription/PlanUsage';
import './Dashboard.css';

const REFRESH_INTERVAL = 30_000;
const TIME_ZONE = 'America/Sao_Paulo';
const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortMonthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });
const calendarDayFormatter = new Intl.DateTimeFormat('en-CA', { dateStyle: 'short', timeZone: TIME_ZONE });
const scheduleDayFormatter = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: TIME_ZONE });
const clockFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE });
const compactMoney = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

const ICONS = {
  plus: 'M12 5v14M5 12h14',
  chevron: 'm6 9 6 6 6-6',
  arrow: 'm9 18 6-6-6-6',
  calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  revenue: 'M10 12c0 1.7 2.7 3 6 3s6-1.3 6-3V5m-12 7V5m0 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4M22 5c0 1.7-2.7 3-6 3s-6-1.3-6-3 2.7-3 6-3 6 1.3 6 3ZM10 11c-4-1-8 .4-8 2s2.2 3 5 3c1.1 0 2.1-.2 3-.5M2 13v4c0 1.7 2.2 3 5 3 1.8 0 3.4-.6 4.3-1.4',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 13h8m-8 4h6',
  check: 'M21.6 12a9.6 9.6 0 1 1-19.2 0 9.6 9.6 0 0 1 19.2 0ZM8 12l2.5 2.5L16 9',
  target: 'M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM12 2v5m0 10v5M2 12h5m10 0h5m-10 0h.01',
};

function Icon({ name }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[name]} /></svg>;
}

function monthDate(month) {
  return new Date(`${month}-01T12:00:00Z`);
}

const capitalize = (label) => label.charAt(0).toUpperCase() + label.slice(1);

function appointmentLabel(value) {
  const date = new Date(value);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const dayKey = calendarDayFormatter.format(date);
  const label = dayKey === calendarDayFormatter.format(today) ? 'Hoje'
    : dayKey === calendarDayFormatter.format(tomorrow) ? 'Amanhã'
      : scheduleDayFormatter.format(date).replace('.', '');
  return `${label}, ${clockFormatter.format(date)}`;
}

function useLiveOverview() {
  const [overview, setOverview] = useState(null);
  const [opportunities, setOpportunities] = useState(null);
  const [overviewFailed, setOverviewFailed] = useState(false);
  const [opportunitiesFailed, setOpportunitiesFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    let queued = false;
    let lastRefresh = 0;
    const signal = controller.signal;
    async function refresh(force = false) {
      if (signal.aborted) return;
      if (running) {
        if (force) queued = true;
        return;
      }
      running = true;
      lastRefresh = Date.now();
      const overviewRequest = api.get('/users/dashboard-overview', { signal })
        .then(({ data }) => {
          if (!data?.month || !Array.isArray(data.months) || !Array.isArray(data.upcoming)) throw new Error('Invalid dashboard data');
          if (!signal.aborted) {
            setOverview(data);
            setOverviewFailed(false);
          }
        })
        .catch(() => { if (!signal.aborted) setOverviewFailed(true); });
      const opportunitiesRequest = api.get('/opportunities', { params: { status: 'open', limit: 1 }, signal })
        .then(({ data }) => {
          if (!Number.isInteger(data?.stats?.open) || !Number.isInteger(data?.stats?.selected)) throw new Error('Invalid opportunity counts');
          if (!signal.aborted) {
            setOpportunities(data.stats);
            setOpportunitiesFailed(false);
          }
        })
        .catch(() => { if (!signal.aborted) setOpportunitiesFailed(true); });
      await Promise.all([overviewRequest, opportunitiesRequest]);
      running = false;
      if (queued) {
        queued = false;
        void refresh();
      }
    }
    const refreshOnReturn = () => {
      if (!document.hidden && Date.now() - lastRefresh >= 3_000) void refresh();
    };
    const refreshOnChange = () => { void refresh(true); };
    void refresh();
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, REFRESH_INTERVAL);
    window.addEventListener('focus', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);
    window.addEventListener(PANEL_BADGE_REFRESH_EVENT, refreshOnChange);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
      window.removeEventListener(PANEL_BADGE_REFRESH_EVENT, refreshOnChange);
    };
  }, []);

  return { overview, opportunities, overviewFailed, opportunitiesFailed };
}

function DashboardAds() {
  const [ads, setAds] = useState([]);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/public/dashboard-ads', { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted || !Array.isArray(data?.ads)) return;
        setAds(data.ads.filter((ad) => ad?.title && ['image', 'video', 'text'].includes(ad.media_type)));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (ads.length < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((value) => (value + 1) % ads.length);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [ads.length]);
  const ad = ads[index];
  if (!ad) return null;
  const hasMedia = ad.media_url && (ad.media_type === 'image' || ad.media_type === 'video');
  return (
    <aside className="do-card do-sponsor" aria-label="Patrocinado">
      {hasMedia && (
        <div className="do-sponsor-media">
          {ad.media_type === 'image'
            ? <img alt="" decoding="async" src={ad.media_url} />
            : <video aria-label={ad.title} key={ad.media_url} controls playsInline preload="none" src={ad.media_url} />}
        </div>
      )}
      <div className="do-sponsor-caption">
        <div className="do-sponsor-copy">
          <span>Patrocinado</span>
          <strong>{ad.title}</strong>
          {ad.description && <p>{ad.description}</p>}
        </div>
        {ad.link_url && <a className="do-button" href={ad.link_url} rel="noopener noreferrer" target="_blank">{ad.cta_label || 'Conhecer'}</a>}
      </div>
    </aside>
  );
}

function SalesChart({ series }) {
  const areaId = useId();
  const maximum = Math.max(1, ...series.map((point) => Number(point.revenue)));
  const magnitude = 10 ** Math.floor(Math.log10(maximum / 2));
  const step = [1, 2, 2.5, 5, 10].map((unit) => unit * magnitude).find((unit) => unit >= maximum / 2);
  const cap = step * 2;
  const points = series.map((point, index) => ({
    ...point,
    x: 500 * index / Math.max(1, series.length - 1),
    y: 164 - (Number(point.revenue) / cap) * 160,
  }));
  const line = points.map(({ x, y }) => `${x},${y}`).join(' ');
  const label = (point) => `${monthFormatter.format(monthDate(point.month))}: ${formatCurrency(point.revenue)}`;
  return (
    <figure className="do-sales-chart" role="img" aria-label={`Valores aprovados por mês. ${points.map(label).join('; ')}`}>
      <div className="do-chart-axis" aria-hidden="true">
        {[cap, step, 0].map((value) => <span key={value}>R$ {compactMoney.format(value)}</span>)}
      </div>
      <div className="do-chart-inner" aria-hidden="true">
        <div className="do-chart-plot">
          <div className="do-chart-grid" />
          <strong className="do-chart-value">{formatCurrency(points.at(-1).revenue)}</strong>
          <svg viewBox="-6 0 512 168" preserveAspectRatio="none">
            <defs>
              <linearGradient id={areaId} x1="0" x2="0" y1="0" y2="1" gradientUnits="objectBoundingBox">
                <stop offset="0%" stopColor="currentColor" stopOpacity=".34" />
                <stop offset="100%" stopColor="currentColor" stopOpacity=".09" />
              </linearGradient>
            </defs>
            <polygon points={`0,164 ${line} 500,164`} fill={`url(#${areaId})`} />
            <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2.6" vectorEffect="non-scaling-stroke" />
          </svg>
          {points.map((point) => (
            <span className="do-chart-point" title={label(point)} key={point.month}
              style={{ left: `${((point.x + 6) / 512) * 100}%`, top: `${point.y / 168 * 100}%` }} />
          ))}
        </div>
        <div className="do-chart-months">
          {points.map((point, index) => (
            <span className={index % 2 === 1 && index < points.length - 1 && points.length > 6 ? 'do-chart-skip' : undefined} key={point.month}>
              {capitalize(shortMonthFormatter.format(monthDate(point.month)).replace('.', ''))}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}

const PROPOSAL_STATES = [
  { key: 'approved', name: 'Aprovadas' },
  { key: 'pending', name: 'Pendentes' },
  { key: 'rejected', name: 'Rejeitadas' },
];
const proposalTotal = (data) => data.approved + data.pending + data.rejected;

function ProposalChart({ data }) {
  const total = proposalTotal(data);
  let weight = 0;
  const segments = PROPOSAL_STATES.map(({ key, name }) => {
    const count = data[key];
    const share = total ? count / total : 0;
    const start = weight;
    weight += share;
    const theta = (start + share / 2) * 2 * Math.PI;
    return { key, name, count, share, start, end: weight, theta };
  });
  const activeSegments = segments.filter((segment) => segment.count > 0);
  const fill = activeSegments.length > 1 ? `conic-gradient(${activeSegments.map((s) =>
    `var(--do-${s.key}) ${s.start * 100}% ${s.end * 100}%`).join(', ')})` : undefined;
  const solid = activeSegments.length === 1 ? `var(--do-${activeSegments[0].key})` : undefined;
  return (
    <div className="do-proposals">
      <div className="do-proposal-donut" aria-hidden="true" style={{ backgroundImage: fill, backgroundColor: solid }}>
        <div className="do-donut-center"><strong>{total}</strong><span>{total === 1 ? 'proposta' : 'propostas'}</span></div>
        {segments.filter((s) => s.share >= 0.14).map((s) => (
          <span key={s.key} className={`do-donut-label is-${s.key}`}
            style={{ left: `${50 + Math.sin(s.theta) * 40}%`, top: `${50 - Math.cos(s.theta) * 40}%` }}>
            {percentFormatter.format(s.share)}
          </span>
        ))}
      </div>
      {total > 0 && <div className="do-proposal-bar" aria-hidden="true">
        {segments.filter((s) => s.count > 0).map((s) => (
          <span key={s.key} className={`is-${s.key}`} style={{ flexBasis: `${s.share * 100}%` }}>
            {s.share >= 0.16 ? percentFormatter.format(s.share) : ''}
          </span>
        ))}
      </div>}
      <ul className="do-proposal-legend" aria-label="Propostas por situação">
        {segments.map((s) => (
          <li key={s.key}><i className={`is-${s.key}`} aria-hidden="true" /><span>{s.name}</span>
            <strong title={percentFormatter.format(s.share)}>{s.count}<span className="sr-only"> ({percentFormatter.format(s.share)})</span></strong>
          </li>
        ))}
      </ul>
      {!total && <p className="do-note">Nenhuma proposta neste mês.</p>}
    </div>
  );
}

function DashboardContent() {
  const { isPro } = useSubscription();
  const { overview, opportunities, overviewFailed, opportunitiesFailed } = useLiveOverview();
  const [monthChoice, setMonthChoice] = useState('');
  const [chartLength, setChartLength] = useState(6);
  const months = overview?.months ?? [];
  const month = months.slice(-12).some((item) => item.month === monthChoice) ? monthChoice : overview?.month;
  const monthIndex = months.findIndex((item) => item.month === month);
  const current = months[monthIndex];
  const series = current ? months.slice(Math.max(0, monthIndex + 1 - chartLength), monthIndex + 1) : [];
  const total = current ? proposalTotal(current) : 0;
  const metrics = [
    { label: 'Receita aprovada', icon: 'revenue', value: current && formatCurrency(current.revenue), tip: 'Soma dos valores aprovados neste mês, não dos pagamentos recebidos.' },
    { label: 'Propostas aprovadas', icon: 'file', value: current && `${current.approved} de ${total}`, tip: 'Orçamentos criados neste mês, sem contar rascunhos.' },
    { label: 'Taxa de aprovação', icon: 'check', value: current && (total ? percentFormatter.format(current.approved / total) : '—'), tip: 'Propostas aprovadas divididas pelas propostas criadas no mês, sem os rascunhos.' },
    { label: 'Instalações agendadas', icon: 'calendar', value: current?.installations, tip: 'Instalações da agenda neste mês, sem incluir cancelamentos.' },
  ];
  const monthOptions = months.slice(-12).reverse();

  return (
    <section className="dashboard-overview">
      <header className="do-header">
        <h1>Dashboard</h1>
        <div className="do-controls">
          <label className="do-picker do-month">
            <Icon name="calendar" />
            <select aria-label="Mês dos indicadores" value={month ?? ''} disabled={!monthOptions.length}
              onChange={(event) => setMonthChoice(event.target.value === overview?.month ? '' : event.target.value)}>
              {!monthOptions.length && <option value="">Mês dos indicadores</option>}
              {monthOptions.map((item) => <option key={item.month} value={item.month}>{capitalize(monthFormatter.format(monthDate(item.month)))}</option>)}
            </select>
            <Icon name="chevron" />
          </label>
          <Link className="do-button is-primary" to="/budgets/new"><Icon name="plus" /> Novo orçamento</Link>
        </div>
      </header>
      <DashboardAds />
      {overviewFailed && <p role="status" className="do-alert">
        {overview ? 'Não foi possível atualizar o painel. Mostrando os últimos dados disponíveis.' : 'Não foi possível carregar os indicadores e a agenda.'}{' '}
        <button className="do-retry" onClick={() => window.dispatchEvent(new Event(PANEL_BADGE_REFRESH_EVENT))} type="button">Tentar de novo</button>
      </p>}
      <section className="do-indicators" aria-label="Indicadores do mês" aria-busy={!overview && !overviewFailed}>
        {metrics.map(({ label, icon, value, tip }) => (
          <div className={`do-card do-kpi is-${icon}`} key={label} title={tip}>
            <Icon name={icon} />
            <div><span>{label}</span><strong>{value ?? '—'}</strong></div>
          </div>
        ))}
      </section>
      <PlanUsage usageKey="monthly_budgets" compact />

      {isPro ? (
        <div className="do-charts">
          <section className="do-card do-sales">
            <header className="do-card-heading">
              <div><h2>Evolução das vendas</h2><p>Valores aprovados por mês</p></div>
              <label className="do-picker">
                <select aria-label="Período do gráfico" value={chartLength} onChange={(event) => setChartLength(Number(event.target.value))}>
                  {[3, 6, 12].map((value) => <option key={value} value={value}>Últimos {value} meses</option>)}
                </select>
                <Icon name="chevron" />
              </label>
            </header>
            {series.length ? <SalesChart series={series} /> : <p className="do-note do-chart-placeholder">{overviewFailed ? 'Histórico indisponível.' : 'Carregando histórico de vendas…'}</p>}
          </section>
          <section className="do-card do-distribution">
            <header className="do-card-heading"><h2>Situação das propostas</h2></header>
            {current ? <ProposalChart data={current} /> : <p className="do-note do-chart-placeholder">{overviewFailed ? 'Propostas indisponíveis.' : 'Carregando propostas…'}</p>}
          </section>
        </div>
      ) : <ProFeatureNotice title="Gráficos no plano Pro">Veja a evolução das vendas e a situação das suas propostas em gráficos.</ProFeatureNotice>}

      <div className="do-operations">
        <section className="do-card do-operation">
          <Icon name="calendar" />
          <div>
            <h2>Próximas instalações</h2>
            {overview?.upcoming.length ? (
              <ul>
                {overview.upcoming.map((item) => (
                  <li key={item.id}><time dateTime={item.date}>{appointmentLabel(item.date)}</time> — {item.client_name || 'Cliente não informado'}</li>
                ))}
              </ul>
            ) : <p>{overview ? 'Nenhuma instalação agendada.' : overviewFailed ? 'Agenda indisponível.' : 'Carregando agenda…'}</p>}
          </div>
          <Link className="do-button" to="/agenda">Ver agenda <Icon name="arrow" /></Link>
        </section>
        <section className="do-card do-operation">
          <Icon name="target" />
          <div>
            <h2>Oportunidades</h2>
            {opportunities ? (
              <ul>
                <li>{opportunities.open} {opportunities.open === 1 ? 'pedido disponível' : 'pedidos disponíveis'}</li>
                <li>{opportunities.selected} {opportunities.selected === 1 ? 'pedido em que escolheram você' : 'pedidos em que escolheram você'}</li>
              </ul>
            ) : <p>{opportunitiesFailed ? 'Oportunidades indisponíveis.' : 'Carregando oportunidades…'}</p>}
            {opportunities && opportunitiesFailed && <p className="do-note">Última atualização disponível.</p>}
          </div>
          <Link className="do-button" to="/opportunities">Ver oportunidades <Icon name="arrow" /></Link>
        </section>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  return <DashboardContent key={user?.id ?? 'account'} />;
}
