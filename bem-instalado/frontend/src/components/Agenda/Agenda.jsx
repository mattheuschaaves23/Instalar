import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';
import { notifyPanelBadgeCountsChanged } from '../Layout/panelBadgeCounts';
import { formatStatusLabel } from '../../utils/formatters';
import './Agenda.css';

const weekLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const dayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const fullDayFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' });
const shortDayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
const timeFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const installationCount = (count) => `${count} ${count === 1 ? 'instalação' : 'instalações'}`;

function AgendaIcon({ type }) {
  const paths = {
    previous: <path d="m14.5 6.5-5 5.5 5 5.5" />,
    next: <path d="m9.5 6.5 5 5.5-5 5.5" />,
    pin: <><path d="M12 21s6-5 6-11a6 6 0 1 0-12 0c0 6 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[type]}
    </svg>
  );
}

function parseDate(value) {
  if (!value) return null;
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

function buildCalendarDays(viewDate) {
  const start = startOfCalendarWeek(startOfMonth(viewDate));
  const end = endOfCalendarWeek(endOfMonth(viewDate));
  const days = [];

  for (let current = new Date(start); current <= end; current = addDays(current, 1)) {
    days.push(new Date(current));
  }

  return days;
}

function locationLabel(destination) {
  return [destination?.city, destination?.state].filter(Boolean).join(', ') || destination?.neighborhood || '';
}

function addressLabel(destination) {
  if (!destination) return '';
  return destination.full_address || destination.route_query ||
    [[destination.street, destination.house_number].filter(Boolean).join(', '), locationLabel(destination)].filter(Boolean).join(' · ');
}

function nextDateLabel(date) {
  const { weekday, day, month } = Object.fromEntries(shortDayFormatter.formatToParts(date)
    .filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return `${capitalize(weekday.replace(/\.$/, ''))}, ${day} ${month.replace(/\.$/, '')}. às ${timeFormatter.format(date)}`;
}

async function copyAddress(address) {
  try {
    await navigator.clipboard.writeText(address);
    toast.success('Endereço copiado.');
  } catch {
    toast.error('Não foi possível copiar o endereço.');
  }
}

const saoPauloInput = new Intl.DateTimeFormat('sv-SE', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
});

function AppointmentDetails({ item, onClose, onUpdate, onDelete, onReschedule }) {
  const dialog = useRef(null);
  const titleId = useId();
  const [editing, setEditing] = useState(false);
  const [newDate, setNewDate] = useState(() => saoPauloInput.format(item.parsedDate).replace(' ', 'T'));
  const [dateError, setDateError] = useState('');
  const [changingDate, setChangingDate] = useState(false);
  const address = addressLabel(item.destination);
  const { google_maps: googleMaps, waze } = item.route_links || {};

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  function runAction(action) {
    dialog.current.close();
    action();
  }

  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby={titleId} className="agenda-board-dialog">
      <header>
        <div>
          <h2 id={titleId}>{item.client_name || item.title || 'Detalhes da instalação'}</h2>
          <p>{capitalize(dayFormatter.format(item.parsedDate))} às {timeFormatter.format(item.parsedDate)}</p>
        </div>
        <button className="agenda-board-control" aria-label="Fechar detalhes" type="button" onClick={() => dialog.current.close()}>
          <AgendaIcon type="close" />
        </button>
      </header>
      <dl>
        <div><dt>Serviço</dt><dd>{item.title || 'Instalação de papel de parede'}</dd></div>
        <div><dt>Situação</dt><dd>{item.status === 'in_progress' ? 'Em andamento' : formatStatusLabel(item.status)}</dd></div>
        <div><dt>Endereço</dt><dd>{address || 'Endereço não informado'}</dd></div>
        {item.destination?.reference && <div><dt>Referência do local</dt><dd>{item.destination.reference}</dd></div>}
      </dl>
      {(address || googleMaps || waze) && (
        <div className="agenda-board-dialog-actions" aria-label="Ações de endereço" role="group">
          {googleMaps && <a href={googleMaps} rel="noopener noreferrer" target="_blank">Abrir no Google Maps</a>}
          {waze && <a href={waze} rel="noopener noreferrer" target="_blank">Abrir no Waze</a>}
          {address && <button type="button" onClick={() => copyAddress(address)}>Copiar endereço</button>}
        </div>
      )}
      {editing && (
        <form className="agenda-board-dialog-actions" aria-label="Alterar data do compromisso" onSubmit={async (event) => {
          event.preventDefault();
          if (changingDate) return;
          setChangingDate(true);
          setDateError('');
          try {
            await onReschedule(item.id, newDate);
            dialog.current?.close();
          } catch (error) {
            setDateError(error.response?.data?.error || 'Não foi possível alterar a data.');
          } finally {
            setChangingDate(false);
          }
        }}>
          <label>Nova data e horário (Brasília)<input type="datetime-local" required value={newDate} onChange={(event) => setNewDate(event.target.value)} /></label>
          <button type="submit" disabled={changingDate}>{changingDate ? 'Salvando…' : 'Salvar nova data'}</button>
          <button type="button" disabled={changingDate} onClick={() => setEditing(false)}>Voltar</button>
          {dateError && <p role="alert">{dateError}</p>}
        </form>
      )}
      {!editing && <footer className="agenda-board-dialog-actions" aria-label="Gerenciar agendamento">
        {item.source === 'marketplace' ? <Link to="/opportunities">Abrir pedido</Link> : (
          <>
            {item.status === 'scheduled' && <button type="button" onClick={() => setEditing(true)}>Alterar data e horário</button>}
            {item.status !== 'completed' && <button type="button" onClick={() => runAction(() => onUpdate(item.id, 'completed'))}>Concluir</button>}
            {item.status !== 'canceled' && <button type="button" onClick={() => runAction(() => onUpdate(item.id, 'canceled'))}>Cancelar</button>}
            <button className="agenda-board-danger" type="button" onClick={() => runAction(() => onDelete(item.id))}>Excluir</button>
          </>
        )}
      </footer>}
    </dialog>
  );
}

export default function Agenda() {
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [viewDate, setViewDate] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => cloneDate(new Date()));
  const [openItem, setOpenItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const changeInProgress = useRef(false);

  useEffect(() => {
    const request = new AbortController();
    const loadAgenda = async () => {
      try {
        const response = await api.get('/schedules', { signal: request.signal });
        if (request.signal.aborted) return;
        setItems(response.data);
        setLoadError('');
      } catch (error) {
        if (request.signal.aborted) return;
        setLoadError(error.response?.data?.error || 'Não foi possível carregar a agenda.');
      } finally {
        if (!request.signal.aborted) setLoading(false);
      }
    };
    void loadAgenda();
    return () => request.abort();
  }, [reload]);

  function refreshAgenda() {
    setLoading(true);
    setLoadError('');
    setReload((current) => current + 1);
  }

  async function reschedule(id, scheduleDate) {
    const { data } = await api.patch(`/schedules/${id}/date`, { schedule_date: scheduleDate });
    const day = parseDate(data.date);
    setItems((current) => current.map((item) => item.id === id ? { ...item, date: data.date } : item));
    if (day) {
      setViewDate(startOfMonth(day));
      setSelectedDate(day);
    }
    toast.success('Nova data salva.');
    notifyPanelBadgeCountsChanged();
  }

  async function changeSchedule(id, status) {
    if (changeInProgress.current) return;
    changeInProgress.current = true;
    try {
      const deleting = status === 'delete';
      if (deleting && !(await confirm({
        title: 'Excluir agendamento',
        message: 'Deseja excluir este agendamento? Essa ação não pode ser desfeita.',
        confirmText: 'Excluir',
        cancelText: 'Cancelar',
        tone: 'danger',
      }))) return;

      setSaving(true);
      if (deleting) await api.delete(`/schedules/${id}`);
      else await api.put(`/schedules/${id}/status`, { status });
      setItems((current) => deleting
        ? current.filter((item) => item.id !== id)
        : current.map((item) => item.id === id ? { ...item, status } : item));
      toast.success(deleting ? 'Agendamento excluído.' : 'Agenda atualizada.');
      notifyPanelBadgeCountsChanged();
    } catch (error) {
      toast.error(error.response?.data?.error ||
        (status === 'delete' ? 'Não foi possível excluir o agendamento.' : 'Não foi possível atualizar a agenda.'));
    } finally {
      setSaving(false);
      changeInProgress.current = false;
    }
  }

  const sortedItems = useMemo(() => items
    .map((item) => ({ ...item, parsedDate: parseDate(item.date) }))
    .filter((item) => item.parsedDate)
    .sort((a, b) => a.parsedDate - b.parsedDate), [items]);

  const agendaByDay = useMemo(() => {
    const days = new Map();
    for (const item of sortedItems) {
      const key = dateKey(item.parsedDate);
      if (!days.has(key)) days.set(key, []);
      days.get(key).push(item);
    }
    return days;
  }, [sortedItems]);

  const calendarDays = useMemo(() => buildCalendarDays(viewDate), [viewDate]);
  const selectedItems = agendaByDay.get(dateKey(selectedDate)) || [];
  const installationTotal = selectedItems.filter((item) => item.status !== 'canceled').length;
  const now = new Date();
  const nextAppointment = sortedItems.find((item) =>
    item.parsedDate >= now && (item.status === 'scheduled' || item.status === 'in_progress'));

  function selectDay(day) {
    setSelectedDate(cloneDate(day));
    if (!sameMonth(day, viewDate)) setViewDate(startOfMonth(day));
  }

  return (
    <section className="agenda-board" aria-label="Agenda de instalações">
      <header className="agenda-board-header">
        <div>
          <h1>Agenda</h1>
          <p>Veja e organize suas instalações.</p>
        </div>
        <Link className="agenda-board-primary" to="/budgets/new">Criar orçamento</Link>
      </header>

      <div className="agenda-board-columns">
        <section className="agenda-board-card" aria-labelledby="agenda-month-title">
          <header className="agenda-board-month">
            <h2 id="agenda-month-title" aria-live="polite">{capitalize(monthFormatter.format(viewDate))}</h2>
            <div className="agenda-board-controls">
              <button aria-label="Mês anterior" className="agenda-board-control" type="button" onClick={() => setViewDate((current) => addMonths(current, -1))}>
                <AgendaIcon type="previous" />
              </button>
              <button className="agenda-board-control agenda-board-today" type="button" onClick={() => selectDay(new Date())}>Hoje</button>
              <button aria-label="Próximo mês" className="agenda-board-control" type="button" onClick={() => setViewDate((current) => addMonths(current, 1))}>
                <AgendaIcon type="next" />
              </button>
            </div>
          </header>

          <div className="agenda-board-calendar" role="group" aria-label="Dias do mês">
            {weekLabels.map((label) => <span className="agenda-board-weekday" aria-hidden="true" key={label}>{label}</span>)}
            {calendarDays.map((day) => {
              const count = (agendaByDay.get(dateKey(day)) || []).filter((item) => item.status !== 'canceled').length;
              const selected = sameDay(day, selectedDate);
              return (
                <button className="agenda-board-day" aria-current={sameDay(day, now) ? 'date' : undefined}
                  aria-pressed={selected} aria-label={`${fullDayFormatter.format(day)}${count ? `, ${installationCount(count)}` : ''}`}
                  data-outside={!sameMonth(day, viewDate)} key={dateKey(day)} type="button" onClick={() => selectDay(day)}>
                  <span className="agenda-board-number">{day.getDate()}</span>
                  {count > 0 && <span className="agenda-board-dot" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <p className="agenda-board-legend"><span className="agenda-board-dot" aria-hidden="true" />Com instalações</p>
        </section>

        <section className="agenda-board-card agenda-board-day-panel" aria-labelledby="agenda-day-title" aria-busy={loading}>
          <div className="agenda-board-day-heading" aria-live="polite">
            <h2 id="agenda-day-title">{capitalize(dayFormatter.format(selectedDate))}</h2>
            {!loading && !loadError && <p>{installationCount(installationTotal)}</p>}
          </div>
          {loading ? <p className="agenda-board-empty" role="status">Carregando compromissos…</p> : null}
          {!loading && loadError && (
            <div className="agenda-board-empty">
              <p role="alert">{loadError}</p>
              <button className="agenda-board-control" type="button" onClick={refreshAgenda}>Tentar novamente</button>
            </div>
          )}
          {!loading && !loadError && (
            selectedItems.length ? (
              <ul className="agenda-board-appointments" aria-label="Instalações do dia">
                {selectedItems.map((item) => {
                  const name = item.client_name || 'Cliente não informado';
                  const hasAddress = addressLabel(item.destination);
                  const location = locationLabel(item.destination);
                  const actionLabel = hasAddress ? 'Ver endereço' : 'Ver detalhes';
                  return (
                    <li className="agenda-board-appointment" key={item.id}>
                      <time dateTime={item.parsedDate.toISOString()}>{timeFormatter.format(item.parsedDate)}</time>
                      <div className="agenda-board-appointment-copy">
                        <h3>{name}</h3>
                        <p>{item.title || 'Instalação de papel de parede'}</p>
                        {location && <p className="agenda-board-location">{location}</p>}
                        {item.status !== 'scheduled' && (
                          <p className="agenda-board-location">{item.status === 'in_progress' ? 'Em andamento' : formatStatusLabel(item.status)}</p>
                        )}
                      </div>
                      <button aria-label={`${actionLabel} de ${name}`} className="agenda-board-address" disabled={saving}
                        type="button" onClick={() => setOpenItem(item)}>
                        <AgendaIcon type="pin" />{actionLabel}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="agenda-board-empty">Nenhuma instalação neste dia. Escolha uma data no calendário.</p>
          )}
          {!loading && !loadError && nextAppointment && (
            <button className="agenda-board-next" type="button" onClick={() => selectDay(nextAppointment.parsedDate)}>
              <span>
                <strong>Próximo compromisso</strong>
                <span>{nextDateLabel(nextAppointment.parsedDate)}</span>
              </span>
              <AgendaIcon type="next" />
            </button>
          )}
        </section>
      </div>
      {openItem && (
        <AppointmentDetails item={openItem} onClose={() => setOpenItem(null)} onUpdate={changeSchedule} onDelete={(id) => changeSchedule(id, 'delete')} onReschedule={reschedule} />
      )}
    </section>
  );
}
