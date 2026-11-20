import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import api from '../../services/api';
import PaginationControls from '../Layout/PaginationControls';
import { notifyPanelBadgeCountsChanged } from '../Layout/panelBadgeCounts';
import { getWebPushSupport, registerWebPushNotifications, webPushStatusMessage } from '../../services/webPushNotifications';
import { describeNotification, notificationDate, notificationTypes } from './notificationView';
import './Notifications.css';

const PAGE_SIZE = 8;
const tabs = [['all', 'Todas'], ['unread', 'Não lidas'], ['read', 'Lidas']];
const icons = {
  doubleCheck: <><path d="m2 12 4.5 4.5L16 7" /><path d="m12 16.5 1 1L23 7" /></>,
  check: <path d="m5 12 4.5 4.5L19 7" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a7 7 0 0 0 0-3l2-1.4-2-3.4-2.2.9a7 7 0 0 0-2.5-1.4L14.4 3h-4.8l-.3 2.2a7 7 0 0 0-2.5 1.4l-2.2-.9-2 3.4 2 1.4a7 7 0 0 0 0 3l-2 1.4 2 3.4 2.2-.9a7 7 0 0 0 2.5 1.4l.3 2.2h4.8l.3-2.2a7 7 0 0 0 2.5-1.4l2.2.9 2-3.4z" /></>,
  briefcase: <><rect x="2.5" y="6.5" width="19" height="14" rx="2" /><path d="M8 6.5V4.8A1.8 1.8 0 0 1 9.8 3h4.4A1.8 1.8 0 0 1 16 4.8v1.7M3 11l7 2h4l7-2M10 12v2h4v-2" /></>,
  document: <><path d="M14 2.5H6A2 2 0 0 0 4 4.5v15A2 2 0 0 0 6 21.5h12a2 2 0 0 0 2-2v-11zM14 2.5v6h6M8 12h8M8 16h7" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18M7 14h1m4 0h1m4 0h1M7 17h1m4 0h1" /></>,
  bell: <><path d="M18 10a6 6 0 0 0-12 0c0 5-2 6-2 6h16s-2-1-2-6M10 20a2.2 2.2 0 0 0 4 0" /></>,
  down: <path d="m6 9 6 6 6-6" />,
};

function Icon({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}

function NotificationRow({ item, busy, onRead }) {
  const { path, label, icon, type } = describeNotification(item);
  const time = notificationDate(item.created_at);
  return (
    <li className="notifications-row" data-unread={!item.read}>
      <span className="notifications-row-icon" aria-hidden="true"><span className="notifications-dot" /><Icon name={icon} size={27} /></span>
      <div className="notifications-copy">
        <h3>{item.title}{!item.read ? <span className="sr-only"> (não lida)</span> : null}</h3>
        <p>{item.message}</p>
      </div>
      <time className="notifications-time" dateTime={time.iso} title={time.full}>{time.label}</time>
      {path || !item.read ? (
        <div className="notifications-row-actions">
          {path ? <Link
            className={`notifications-button notifications-action${!item.read && type === 'orders' ? ' is-primary' : ''}`}
            onClick={() => { if (!item.read) void onRead(item.id); }}
            to={path}
          >{label}</Link> : null}
          {!item.read ? <button
            aria-label={`Marcar ${item.title} como lida`}
            className={`notifications-button${path ? ' notifications-row-check' : ' notifications-action'}`}
            disabled={busy}
            onClick={() => void onRead(item.id)}
            title="Marcar como lida"
            type="button"
          ><Icon name="check" size={17} />{path ? null : 'Marcar como lida'}</button> : null}
        </div>
      ) : null}
    </li>
  );
}

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [readFilter, setReadFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [preferences, setPreferences] = useState(false);
  const [webPush, setWebPush] = useState(() => getWebPushSupport());
  const [activatingWebPush, setActivatingWebPush] = useState(false);

  useEffect(() => {
    const control = new AbortController();
    setLoading(true);
    setLoadError('');
    api.get('/notifications', { signal: control.signal })
      .then(({ data }) => {
        if (!control.signal.aborted) setItems(Array.isArray(data) ? data : data?.notifications || []);
      })
      .catch((error) => {
        if (!control.signal.aborted) setLoadError(error.response?.data?.error || 'Não foi possível carregar as notificações.');
      })
      .finally(() => { if (!control.signal.aborted) setLoading(false); });
    return () => control.abort();
  }, [retry]);

  const markAsRead = useCallback(async (id) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMutationError('');
    try {
      await api.put(id == null ? '/notifications/read-all' : `/notifications/${id}/read`);
      setItems((current) => current.map((item) => id == null || item.id === id ? { ...item, read: true } : item));
      notifyPanelBadgeCountsChanged();
    } catch (error) {
      setMutationError(error.response?.data?.error || 'Não foi possível atualizar a leitura. Tente novamente.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, []);

  const activateWebPush = async () => {
    if (activatingWebPush) return;
    setActivatingWebPush(true);
    try {
      const result = await registerWebPushNotifications();
      setWebPush({ ...getWebPushSupport(), ...result });
      if (result.enabled) toast.success('Notificações do navegador ativadas.');
      else if (result.permission === 'denied') toast.error('As notificações foram bloqueadas no navegador.');
      else toast.error(result.permission === 'default' ? 'A permissão para notificações não foi concedida.' : webPushStatusMessage(result));
    } catch {
      toast.error('Não foi possível ativar as notificações agora.');
    } finally {
      setActivatingWebPush(false);
    }
  };

  const unread = items.filter((item) => !item.read).length;
  const filtered = items.filter((item) =>
    (readFilter === 'all' || Boolean(item.read) === (readFilter === 'read')) &&
    (typeFilter === 'all' || describeNotification(item).type === typeFilter),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const groups = [
    ['Hoje', visible.filter((item) => notificationDate(item.created_at).today)],
    ['Anteriores', visible.filter((item) => !notificationDate(item.created_at).today)],
  ];

  return (
    <section aria-labelledby="notifications-title" className="notifications-inbox">
      <header className="notifications-heading">
        <div><h1 id="notifications-title">Notificações</h1><p>Acompanhe seus pedidos e atualizações.</p></div>
        <div className="notifications-heading-actions">
          <button className="notifications-button" disabled={busy || !unread} onClick={() => void markAsRead()} type="button"><Icon name="doubleCheck" />Marcar todas como lidas</button>
          <button aria-controls="notifications-preferences" aria-expanded={preferences} className="notifications-button" onClick={() => setPreferences((value) => !value)} type="button"><Icon name="settings" />Preferências</button>
        </div>
      </header>

      <section className="notifications-preferences" hidden={!preferences} id="notifications-preferences" aria-label="Preferências de notificações">
        <div><h2>Avisos no navegador</h2><p aria-live="polite">{webPushStatusMessage(webPush)}</p></div>
        <button className="notifications-button" disabled={!webPush.supported || activatingWebPush || webPush.enabled} onClick={activateWebPush} type="button">
          {activatingWebPush ? 'Ativando…' : webPush.enabled ? 'Ativado neste navegador' : 'Ativar notificações'}
        </button>
      </section>

      <div className="notifications-toolbar">
        <div className="notifications-tabs" role="group" aria-label="Filtrar por leitura">
          {tabs.map(([value, label]) => <button aria-pressed={readFilter === value} key={value} onClick={() => { setReadFilter(value); setCurrentPage(1); }} type="button">
            {label}{value === 'unread' && unread > 0 ? <span className="notifications-count">{unread}</span> : null}
          </button>)}
        </div>
        <label className="notifications-type-filter">
          <select aria-label="Filtrar por tipo" onChange={(event) => { setTypeFilter(event.target.value); setCurrentPage(1); }} value={typeFilter}>
            {notificationTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <Icon name="down" size={18} />
        </label>
      </div>

      {mutationError ? <p className="notifications-error" role="alert">{mutationError}</p> : null}
      {loadError ? <div className="notifications-empty" role="alert"><p>{loadError}</p><button className="notifications-button" onClick={() => setRetry((value) => value + 1)} type="button">Tentar novamente</button></div>
        : loading ? <p className="notifications-empty" role="status">Carregando notificações…</p>
          : visible.length ? (
            <div className="notifications-list">
              {groups.map(([label, list], index) => list.length ? (
                <section key={label} aria-labelledby={`notifications-group-${index}`}>
                  <h2 id={`notifications-group-${index}`}>{label}</h2>
                  <ul>{list.map((item) => <NotificationRow busy={busy} item={item} key={item.id} onRead={markAsRead} />)}</ul>
                </section>
              ) : null)}
            </div>
          ) : <p className="notifications-empty" role="status">{readFilter === 'unread' ? 'Nenhuma notificação não lida neste filtro.' : items.length ? 'Nenhuma notificação neste filtro.' : 'Nenhuma notificação por enquanto.'}</p>}

      {totalPages > 1 ? <PaginationControls currentPage={page} onPageChange={setCurrentPage} totalPages={totalPages} /> : null}
    </section>
  );
}
