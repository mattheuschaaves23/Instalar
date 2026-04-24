import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';
import { formatStatusLabel } from '../../utils/formatters';

const weekLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

function AgendaIcon({ type }) {
  const props = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  switch (type) {
    case 'calendar':
      return (
        <svg {...props}>
          <rect x="3.5" y="5" width="17" height="15" rx="3" />
          <path d="M8 3.5v3M16 3.5v3M3.5 9.5h17" />
        </svg>
      );
    case 'chevron-left':
      return (
        <svg {...props}>
          <path d="m14.5 6.5-5 5.5 5 5.5" />
        </svg>
      );
    case 'chevron-right':
      return (
        <svg {...props}>
          <path d="m9.5 6.5 5 5.5-5 5.5" />
        </svg>
      );
    case 'pin':
      return (
        <svg {...props}>
          <path d="M12 20s6-5.2 6-10.2a6 6 0 1 0-12 0C6 14.8 12 20 12 20Z" />
          <circle cx="12" cy="9.8" r="2.2" />
        </svg>
      );
    case 'route':
      return (
        <svg {...props}>
          <circle cx="6.5" cy="6.5" r="2.2" />
          <circle cx="17.5" cy="17.5" r="2.2" />
          <path d="M8.7 6.5h3.6a2 2 0 0 1 2 2v2.8a2 2 0 0 0 2 2h1.2" />
        </svg>
      );
    case 'copy':
      return (
        <svg {...props}>
          <rect x="8" y="8" width="10" height="11" rx="2.2" />
          <path d="M6.5 15.5H6A2.5 2.5 0 0 1 3.5 13V6A2.5 2.5 0 0 1 6 3.5h7A2.5 2.5 0 0 1 15.5 6v.5" />
        </svg>
      );
    case 'check':
      return (
        <svg {...props}>
          <path d="m5 12.5 4.1 4.1L19 6.8" />
        </svg>
      );
    case 'x':
      return (
        <svg {...props}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...props}>
          <path d="M4.5 7.5h15" />
          <path d="M9.5 3.5h5l1 2.2h-7l1-2.2Z" />
          <path d="M7 7.5v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-10" />
        </svg>
      );
    case 'dots':
      return (
        <svg {...props}>
          <circle cx="12" cy="5" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cloneDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfCalendarWeek(date) {
  const safeDate = cloneDate(date);
  safeDate.setDate(safeDate.getDate() - safeDate.getDay());
  return safeDate;
}

function endOfCalendarWeek(date) {
  return addDays(startOfCalendarWeek(date), 6);
}

function sameDay(first, second) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function sameMonth(first, second) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth();
}

function dateKey(date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function monthLabel(date) {
  const label = date.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function selectedDayLabel(date) {
  const label = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildCalendarDays(viewDate) {
  const start = startOfCalendarWeek(startOfMonth(viewDate));
  const end = endOfCalendarWeek(endOfMonth(viewDate));
  const days = [];

  for (let current = new Date(start); current <= end; current = addDays(current, 1)) {
    days.push(new Date(current));
  }

  return days;
}

function getStatusTone(status) {
  if (status === 'completed') {
    return 'completed';
  }

  if (status === 'canceled') {
    return 'canceled';
  }

  return 'scheduled';
}

function formatPrimaryAddress(destination) {
  if (!destination) {
    return 'Endereco nao informado';
  }

  const street = [destination.street, destination.house_number].filter(Boolean).join(', ');
  return street || destination.full_address || 'Endereco nao informado';
}

function formatSecondaryAddress(destination) {
  if (!destination) {
    return 'Local nao informado';
  }

  return [destination.neighborhood, destination.city, destination.state].filter(Boolean).join(' - ') || 'Local nao informado';
}

function formatTimeLabel(date) {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDateLabel(date) {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

function dayHasItems(dayItems) {
  return Boolean(dayItems && dayItems.length);
}

export default function Agenda() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(cloneDate(new Date()));
  const [openMenuId, setOpenMenuId] = useState(null);

  const loadAgenda = async () => {
    setLoading(true);

    try {
      const response = await api.get('/schedules');
      setItems(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel carregar a agenda.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgenda();
  }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/schedules/${id}/status`, { status });
      toast.success('Agenda atualizada.');
      setOpenMenuId(null);
      loadAgenda();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel atualizar a agenda.');
    }
  };

  const deleteSchedule = async (id) => {
    const confirmed = await confirm({
      title: 'Excluir agendamento',
      message: 'Deseja excluir este agendamento?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/schedules/${id}`);
      toast.success('Agendamento excluido.');
      setOpenMenuId(null);
      loadAgenda();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel excluir o agendamento.');
    }
  };

  const openRoute = (url) => {
    if (!url) {
      toast.error('Endereco insuficiente para abrir rota.');
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copyAddress = async (address) => {
    if (!address) {
      toast.error('Endereco nao informado.');
      return;
    }

    try {
      await navigator.clipboard.writeText(address);
      toast.success('Endereco copiado.');
    } catch (_error) {
      toast.error('Nao foi possivel copiar o endereco.');
    }
  };

  const agendaByDay = useMemo(() => {
    const mapped = {};

    items.forEach((item) => {
      const date = parseDate(item.date);

      if (!date) {
        return;
      }

      const key = dateKey(date);

      if (!mapped[key]) {
        mapped[key] = [];
      }

      mapped[key].push({ ...item, parsedDate: date });
    });

    Object.values(mapped).forEach((dayItems) => {
      dayItems.sort((first, second) => first.parsedDate - second.parsedDate);
    });

    return mapped;
  }, [items]);

  const calendarDays = useMemo(() => buildCalendarDays(viewDate), [viewDate]);
  const selectedItems = agendaByDay[dateKey(selectedDate)] || [];
  const today = cloneDate(new Date());

  const monthItems = useMemo(
    () =>
      items.filter((item) => {
        const date = parseDate(item.date);
        return date ? sameMonth(date, viewDate) : false;
      }),
    [items, viewDate]
  );

  const busyDaysCount = useMemo(() => {
    const unique = new Set(
      monthItems
        .map((item) => parseDate(item.date))
        .filter(Boolean)
        .map((date) => dateKey(date))
    );
    return unique.size;
  }, [monthItems]);

  const nextAppointment = useMemo(() => {
    const now = new Date();

    return [...items]
      .map((item) => ({ ...item, parsedDate: parseDate(item.date) }))
      .filter((item) => item.parsedDate && item.status !== 'canceled' && item.parsedDate >= now)
      .sort((left, right) => left.parsedDate - right.parsedDate)[0];
  }, [items]);

  const handleJumpToToday = () => {
    const nextToday = cloneDate(new Date());
    setSelectedDate(nextToday);
    setViewDate(startOfMonth(nextToday));
  };

  const handleJumpToNext = () => {
    if (!nextAppointment?.parsedDate) {
      handleJumpToToday();
      return;
    }

    setSelectedDate(cloneDate(nextAppointment.parsedDate));
    setViewDate(startOfMonth(nextAppointment.parsedDate));

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <section className="agenda-modern-shell">
      <header className="agenda-modern-hero fade-up">
        <div className="agenda-modern-hero-copy">
          <p className="agenda-modern-eyebrow">Minha agenda</p>
          <h1>Gerencie suas instalacoes com clareza e ritmo.</h1>
          <p>
            Um calendario visual para organizar o mes, acompanhar o dia e agir rapido em cada compromisso.
          </p>
        </div>

        <div className="agenda-modern-hero-metrics">
          <article>
            <span>Instalacoes no mes</span>
            <strong>{monthItems.length}</strong>
          </article>
          <article>
            <span>Dias ocupados</span>
            <strong>{busyDaysCount}</strong>
          </article>
          <article>
            <span>Hoje</span>
            <strong>{selectedItems.length}</strong>
          </article>
        </div>
      </header>

      <div className="agenda-modern-layout">
        <section className="agenda-modern-calendar-card fade-up" id="agenda-calendar">
          <div className="agenda-modern-panel-head">
            <div>
              <p className="agenda-modern-section-label">Calendario</p>
              <h2>{monthLabel(viewDate)}</h2>
            </div>

            <div className="agenda-modern-calendar-controls">
              <button className="agenda-modern-icon-button" onClick={() => setViewDate((current) => addMonths(current, -1))} type="button">
                <AgendaIcon type="chevron-left" />
              </button>
              <button className="agenda-modern-chip-button" onClick={handleJumpToToday} type="button">
                Hoje
              </button>
              <button className="agenda-modern-icon-button" onClick={() => setViewDate((current) => addMonths(current, 1))} type="button">
                <AgendaIcon type="chevron-right" />
              </button>
            </div>
          </div>

          <div className="agenda-modern-legend">
            <span>
              <i className="has-events" />
              Com instalacoes
            </span>
            <span>
              <i className="selected-day" />
              Dia selecionado
            </span>
            <span>
              <i className="today-day" />
              Hoje
            </span>
          </div>

          <div className="agenda-modern-weekdays">
            {weekLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="agenda-modern-calendar-grid">
            {calendarDays.map((day) => {
              const key = dateKey(day);
              const dayItems = agendaByDay[key] || [];
              const isSelected = sameDay(day, selectedDate);
              const isToday = sameDay(day, today);
              const isOutside = !sameMonth(day, viewDate);

              return (
                <button
                  className="agenda-modern-day"
                  data-has-items={dayHasItems(dayItems)}
                  data-outside={isOutside}
                  data-selected={isSelected}
                  data-today={isToday}
                  key={key}
                  onClick={() => {
                    setSelectedDate(day);
                    if (!sameMonth(day, viewDate)) {
                      setViewDate(startOfMonth(day));
                    }
                  }}
                  type="button"
                >
                  <span className="agenda-modern-day-number">{day.getDate()}</span>
                  {dayItems.length ? <span className="agenda-modern-day-marker" /> : null}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="agenda-modern-day-panel fade-up" style={{ animationDelay: '0.06s' }}>
          <div className="agenda-modern-day-head">
            <div>
              <p className="agenda-modern-section-label">Instalacoes do dia</p>
              <div className="agenda-modern-day-title-row">
                <h2>{selectedDayLabel(selectedDate)}</h2>
                <span className="agenda-modern-count-pill">{selectedItems.length}</span>
              </div>
              <p className="agenda-modern-day-copy">
                {selectedItems.length
                  ? `${selectedItems.length} compromisso(s) para esta data.`
                  : 'Nenhum compromisso marcado para este dia.'}
              </p>
            </div>

            <button className="agenda-modern-primary-button" onClick={() => navigate('/budgets/new')} type="button">
              + Agendar instalacao
            </button>
          </div>

          <div className="agenda-modern-appointments">
            {loading ? (
              <div className="agenda-modern-empty-state">Carregando compromissos do calendario...</div>
            ) : null}

            {!loading && selectedItems.length === 0 ? (
              <div className="agenda-modern-empty-state">
                Esse dia esta livre. Escolha outra data no calendario ou crie um novo compromisso.
              </div>
            ) : null}

            {selectedItems.map((item) => {
              const isOpen = openMenuId === item.id;
              const statusTone = getStatusTone(item.status);
              const serviceLabel = item.title || 'Instalacao de papel de parede';

              return (
                <article className={`agenda-modern-appointment ${isOpen ? 'is-open' : ''}`} key={item.id}>
                  <div className="agenda-modern-appointment-main">
                    <div className="agenda-modern-time-block">
                      <strong>{formatTimeLabel(item.parsedDate)}</strong>
                      <span>{formatShortDateLabel(item.parsedDate)}</span>
                    </div>

                    <div className="agenda-modern-appointment-body">
                      <div className="agenda-modern-appointment-top">
                        <div>
                          <h3>{item.client_name || item.title}</h3>
                          <p>{formatPrimaryAddress(item.destination)}</p>
                          <p>{formatSecondaryAddress(item.destination)}</p>
                        </div>

                        <span className="agenda-modern-status" data-tone={statusTone}>
                          {formatStatusLabel(item.status)}
                        </span>
                      </div>

                      <span className="agenda-modern-service-chip">{serviceLabel}</span>

                      <div className="agenda-modern-appointment-meta">
                        <span>
                          <AgendaIcon type="pin" />
                          {item.destination?.reference || 'Sem observacao de rota'}
                        </span>
                      </div>
                    </div>

                    <button
                      className="agenda-modern-menu-button"
                      onClick={() => setOpenMenuId((current) => (current === item.id ? null : item.id))}
                      type="button"
                    >
                      <AgendaIcon type="dots" />
                    </button>
                  </div>

                  <div className="agenda-modern-actions">
                    <button
                      className="agenda-modern-action"
                      onClick={() => openRoute(item.route_links?.google_maps)}
                      type="button"
                    >
                      <AgendaIcon type="route" />
                      GPS
                    </button>
                    <button
                      className="agenda-modern-action"
                      onClick={() => openRoute(item.route_links?.waze)}
                      type="button"
                    >
                      <AgendaIcon type="route" />
                      Waze
                    </button>
                    <button
                      className="agenda-modern-action"
                      onClick={() => copyAddress(item.destination?.full_address || item.destination?.route_query)}
                      type="button"
                    >
                      <AgendaIcon type="copy" />
                      Copiar
                    </button>
                    <button
                      className="agenda-modern-action is-success"
                      onClick={() => updateStatus(item.id, 'completed')}
                      type="button"
                    >
                      <AgendaIcon type="check" />
                      Concluir
                    </button>
                    <button
                      className="agenda-modern-action is-warning"
                      onClick={() => updateStatus(item.id, 'canceled')}
                      type="button"
                    >
                      <AgendaIcon type="x" />
                      Cancelar
                    </button>
                    <button
                      className="agenda-modern-action is-danger"
                      onClick={() => deleteSchedule(item.id)}
                      type="button"
                    >
                      <AgendaIcon type="trash" />
                      Excluir
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </aside>
      </div>

      <section className="agenda-modern-summary-card fade-up" style={{ animationDelay: '0.1s' }}>
        <div className="agenda-modern-summary-icon">
          <AgendaIcon type="calendar" />
        </div>

        <div className="agenda-modern-summary-copy">
          <strong>Voce tem {monthItems.length} instalacoes neste mes</strong>
          <span>
            {nextAppointment?.parsedDate
              ? `Proxima: ${formatShortDateLabel(nextAppointment.parsedDate)} as ${formatTimeLabel(nextAppointment.parsedDate)}`
              : 'Nenhum compromisso futuro confirmado no momento'}
          </span>
        </div>

        <button className="agenda-modern-summary-link" onClick={handleJumpToNext} type="button">
          Ver agenda completa
        </button>
      </section>
    </section>
  );
}
