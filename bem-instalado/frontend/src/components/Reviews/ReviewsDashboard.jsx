import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatShortDate } from '../../utils/formatters';

const ratingFilters = ['all', 5, 4, 3, 2, 1];
const REVIEWS_REFRESH_INTERVAL = 30000;
const EMPTY_LIST = [];

function ReviewIcon({ type }) {
  const props = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
    'aria-hidden': 'true',
  };

  const icons = {
    star: <path d="m12 3.8 2.45 4.95 5.47.8-3.96 3.86.94 5.45L12 16.28l-4.9 2.58.94-5.45-3.96-3.86 5.47-.8z" />,
    trend: <><path d="M4 16.5 9 11l4 3 6-7" /><path d="M15 7h4v4" /></>,
    message: <><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H11l-4.5 4v-4A2.5 2.5 0 0 1 4 12.5z" /><path d="M8 8.8h8M8 11.8h5.5" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2.4" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    refresh: <><path d="M20 12a8 8 0 0 1-14.5 4.6" /><path d="M4 12A8 8 0 0 1 18.5 7.4" /><path d="M18.5 3.8v3.6h-3.6" /><path d="M5.5 20.2v-3.6h3.6" /></>,
    external: <><path d="M7 17 17 7" /><path d="M9 7h8v8" /></>,
  };

  return <svg {...props}>{icons[type] || icons.star}</svg>;
}

function RatingStars({ value }) {
  const rating = Math.round(Number(value || 0));

  return (
    <span className="reviews-rating-stars" aria-label={`${rating} de 5`}>
      {[1, 2, 3, 4, 5].map((item) => (
        <svg
          aria-hidden="true"
          className={item <= rating ? 'is-filled' : ''}
          key={item}
          viewBox="0 0 24 24"
        >
          <path d="m12 3.8 2.45 4.95 5.47.8-3.96 3.86.94 5.45L12 16.28l-4.9 2.58.94-5.45-3.96-3.86 5.47-.8z" />
        </svg>
      ))}
    </span>
  );
}

function formatRating(value) {
  return Number(value || 0).toFixed(1).replace('.', ',');
}

function formatPercent(value) {
  const amount = Number(value || 0);
  return `${amount > 0 ? '+' : ''}${amount}%`;
}

function formatMonthLabel(monthKey) {
  const date = new Date(`${monthKey || ''}-02T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return monthKey || '-';
  }

  return new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '');
}

function getInitials(name) {
  return String(name || 'Cliente')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'CL';
}

function ReviewsLoadingState() {
  return (
    <section className="reviews-dashboard-shell">
      <div className="reviews-dashboard-empty">
        <span><ReviewIcon type="refresh" /></span>
        <strong>Carregando avaliacoes</strong>
        <p>Buscando nota media, distribuicao e comentarios recentes.</p>
      </div>
    </section>
  );
}

export default function ReviewsDashboard() {
  const isReviewsMountedRef = useRef(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterRating, setFilterRating] = useState('all');

  const loadReviews = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const response = await api.get('/users/reviews-dashboard');

      if (isReviewsMountedRef.current) {
        setData(response.data);
      }
    } catch (error) {
      if (!silent && isReviewsMountedRef.current) {
        toast.error(error.response?.data?.error || 'Nao foi possivel carregar as avaliacoes.');
      }
    } finally {
      if (!silent && isReviewsMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let lastAttentionRefreshAt = 0;
    isReviewsMountedRef.current = true;
    loadReviews();

    const refreshSilently = () => loadReviews({ silent: true });
    const refreshAfterAttentionReturn = () => {
      const now = Date.now();

      if (document.hidden || now - lastAttentionRefreshAt < 5000) {
        return;
      }

      lastAttentionRefreshAt = now;
      refreshSilently();
    };
    const refreshWhenVisible = () => {
      if (!document.hidden) {
        refreshAfterAttentionReturn();
      }
    };
    const interval = setInterval(() => {
      if (!document.hidden) {
        refreshSilently();
      }
    }, REVIEWS_REFRESH_INTERVAL);

    window.addEventListener('focus', refreshAfterAttentionReturn);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      isReviewsMountedRef.current = false;
      clearInterval(interval);
      window.removeEventListener('focus', refreshAfterAttentionReturn);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadReviews]);

  const summary = data?.summary || {};
  const reviews = data?.reviews || EMPTY_LIST;
  const distribution = data?.rating_distribution || EMPTY_LIST;
  const monthlySeries = data?.monthly_series || EMPTY_LIST;
  const maxMonthlyCount = useMemo(
    () => Math.max(1, ...monthlySeries.map((item) => Number(item.review_count || 0))),
    [monthlySeries]
  );
  const filteredReviews = useMemo(() => {
    if (filterRating === 'all') {
      return reviews;
    }

    return reviews.filter((review) => Number(review.rating || 0) === Number(filterRating));
  }, [filterRating, reviews]);

  if (loading) {
    return <ReviewsLoadingState />;
  }

  const metrics = [
    {
      label: 'Avaliacoes totais',
      value: summary.review_count || 0,
      detail: summary.last_review_at ? `Ultima em ${formatShortDate(summary.last_review_at)}` : 'Ainda sem avaliacoes',
      icon: 'star',
    },
    {
      label: 'Este mes',
      value: summary.current_month_count || 0,
      detail: `${formatPercent(summary.monthly_delta)} vs. mes anterior`,
      icon: 'trend',
    },
    {
      label: 'Ultimos 3 dias',
      value: summary.recent_3_count || 0,
      detail: 'Movimento recente do perfil',
      icon: 'calendar',
    },
    {
      label: 'Com comentario',
      value: `${summary.comment_rate || 0}%`,
      detail: `${summary.commented_count || 0} relatos escritos`,
      icon: 'message',
    },
  ];

  return (
    <section className="reviews-dashboard-shell">
      <div className="reviews-dashboard-hero fade-up">
        <div className="reviews-dashboard-hero-copy">
          <p>Avaliacoes</p>
          <h1>Painel de avaliacoes</h1>
          <span>
            Acompanhe a reputacao do seu perfil publico, veja a evolucao das notas e leia os comentarios mais recentes dos clientes.
          </span>
          <div className="reviews-dashboard-actions">
            {data?.profile?.id ? (
              <Link to={`/installers/${data.profile.id}`}>
                <ReviewIcon type="external" />
                Ver perfil publico
              </Link>
            ) : null}
            <button
              onClick={() => loadReviews()}
              type="button"
            >
              <ReviewIcon type="refresh" />
              Atualizar
            </button>
          </div>
        </div>

        <div className="reviews-dashboard-score-card">
          <span>Nota media</span>
          <strong>{formatRating(summary.average_rating)}</strong>
          <RatingStars value={summary.average_rating} />
          <p>{summary.review_count || 0} avaliacoes recebidas</p>
        </div>
      </div>

      <div className="reviews-dashboard-metrics">
        {metrics.map((metric, index) => (
          <article className="reviews-dashboard-metric fade-up" key={metric.label} style={{ animationDelay: `${0.05 + index * 0.03}s` }}>
            <span><ReviewIcon type={metric.icon} /></span>
            <div>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </div>
          </article>
        ))}
      </div>

      <div className="reviews-dashboard-grid">
        <article className="reviews-dashboard-panel fade-up" style={{ animationDelay: '0.1s' }}>
          <div className="reviews-dashboard-panel-head">
            <div>
              <p>Evolucao mensal</p>
              <h2>Volume de avaliacoes</h2>
            </div>
            <span>6 meses</span>
          </div>
          <div className="reviews-month-chart">
            {monthlySeries.map((item) => {
              const height = Math.max(8, (Number(item.review_count || 0) / maxMonthlyCount) * 100);

              return (
                <div className="reviews-month-column" key={item.month}>
                  <div className="reviews-month-bar-track">
                    <span style={{ height: `${height}%` }} />
                  </div>
                  <strong>{item.review_count || 0}</strong>
                  <small>{formatMonthLabel(item.month)}</small>
                </div>
              );
            })}
          </div>
        </article>

        <article className="reviews-dashboard-panel fade-up" style={{ animationDelay: '0.14s' }}>
          <div className="reviews-dashboard-panel-head">
            <div>
              <p>Distribuicao</p>
              <h2>Notas recebidas</h2>
            </div>
            <span>{formatRating(summary.average_rating)}/5</span>
          </div>
          <div className="reviews-rating-breakdown">
            {distribution.map((item) => (
              <div className="reviews-rating-row" key={item.rating}>
                <span>{item.rating}</span>
                <div>
                  <em style={{ width: `${item.percentage || 0}%` }} />
                </div>
                <strong>{item.review_count || 0}</strong>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="reviews-dashboard-panel reviews-dashboard-list-panel fade-up" style={{ animationDelay: '0.18s' }}>
        <div className="reviews-dashboard-panel-head reviews-dashboard-list-head">
          <div>
            <p>Historico</p>
            <h2>Avaliacoes recentes</h2>
          </div>
          <div className="reviews-filter-tabs" aria-label="Filtrar por nota">
            {ratingFilters.map((item) => (
              <button
                className={filterRating === item ? 'is-active' : ''}
                key={item}
                onClick={() => setFilterRating(item)}
                type="button"
              >
                {item === 'all' ? 'Todas' : `${item}/5`}
              </button>
            ))}
          </div>
        </div>

        {filteredReviews.length ? (
          <div className="reviews-list">
            {filteredReviews.map((review) => (
              <article className="reviews-list-item" key={review.id || `${review.reviewer_name}-${review.created_at}`}>
                <div className="reviews-list-avatar">{getInitials(review.reviewer_name)}</div>
                <div className="reviews-list-copy">
                  <div>
                    <strong>{review.reviewer_name || 'Cliente verificado'}</strong>
                    <span>{review.reviewer_region || 'Regiao nao informada'}</span>
                  </div>
                  <p>{review.comment || 'Avaliacao enviada sem comentario adicional.'}</p>
                  <small>{formatShortDate(review.created_at)}</small>
                </div>
                <div className="reviews-list-score">
                  <strong>{review.rating}/5</strong>
                  <RatingStars value={review.rating} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="reviews-dashboard-empty reviews-dashboard-empty--compact">
            <span><ReviewIcon type="star" /></span>
            <strong>Nenhuma avaliacao nesse filtro</strong>
            <p>Quando clientes enviarem novas avaliacoes, elas aparecem aqui automaticamente.</p>
          </div>
        )}
      </article>
    </section>
  );
}
