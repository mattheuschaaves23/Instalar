import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import PaginationControls from '../Layout/PaginationControls';
import ClientForm from './ClientForm';
import './Clients.css';

const CLIENTS_PER_PAGE = 6;
const alphabetical = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
const filters = [
  { id: 'all', label: 'Todos' },
  { id: 'complete', label: 'Completos' },
  { id: 'pending', label: 'Dados pendentes' },
];

const tidy = (value) => String(value ?? '').trim();
const normalize = (value) => tidy(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
const digits = (value) => tidy(value).replace(/\D/g, '');

function Icon({ name }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    more: <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill={name === 'more' ? 'currentColor' : 'none'}
    stroke={name === 'more' ? 'none' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function cityOf(client) {
  return [tidy(client.city), tidy(client.state).toUpperCase()].filter(Boolean).join(', ');
}

function statusOf(client) {
  const contact = [client.email, client.phone, client.whatsapp].some((value) => tidy(value));
  const address = [client.zip_code, client.street, client.house_number, client.neighborhood, client.city, client.state].map(tidy);
  const anyAddress = address.some(Boolean) || Boolean(tidy(client.address));
  if (contact && address.every(Boolean)) return { id: 'complete', label: 'Completo' };
  if (!contact && !anyAddress && !tidy(client.document_id) && !tidy(client.contact_name) && !tidy(client.address_reference)) {
    return { id: 'pending', label: 'Só nome' };
  }
  if (!anyAddress) return { id: 'pending', label: 'Sem endereço' };
  if (!contact) return { id: 'pending', label: 'Sem contato' };
  return { id: 'pending', label: 'Endereço incompleto' };
}

function initials(name) {
  return tidy(name).split(/\s+/).slice(0, 2).map((namePart) => Array.from(namePart)[0] || '').join('').toLocaleUpperCase('pt-BR');
}

function addressOf(client) {
  const street = [tidy(client.street), client.house_number && `Nº ${client.house_number}`].filter(Boolean).join(', ');
  const region = [tidy(client.neighborhood), cityOf(client)].filter(Boolean).join(', ');
  const zip = client.zip_code ? `CEP ${client.zip_code}` : '';
  return [street, tidy(client.address), region, zip].filter(Boolean).join(' · ');
}

function ClientActions({ client, onDelete, onEdit }) {
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    const dismiss = (event) => {
      if (menuRef.current?.open && !menuRef.current.contains(event.target)) menuRef.current.open = false;
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('focusin', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('focusin', dismiss);
    };
  }, []);

  const close = () => {
    menuRef.current.open = false;
    triggerRef.current?.focus({ preventScroll: true });
  };

  return (
    <details className="clients-directory-more" ref={menuRef} onKeyDown={(event) => {
      if (event.key === 'Escape' && event.currentTarget.open) {
        event.stopPropagation();
        close();
      }
    }}>
      <summary aria-label={`Mais ações de ${client.name}`} ref={triggerRef}>
        <Icon name="more" />
      </summary>
      <div className="clients-directory-actions-panel">
        <button type="button" onClick={() => { close(); onEdit(client); }}>Editar cadastro</button>
        <button className="clients-directory-danger" type="button" onClick={() => { close(); onDelete(client); }}>Excluir cliente</button>
      </div>
    </details>
  );
}

function ClientDetails({ client, onClose, onEdit }) {
  const title = useId();
  const frame = useRef(null);

  useLayoutEffect(() => {
    if (frame.current && !frame.current.open) frame.current.showModal();
  }, []);

  const fields = [
    ['Telefone', client.phone],
    ['WhatsApp', client.whatsapp],
    ['E-mail', client.email],
    ['Endereço', addressOf(client)],
    ['Observações', client.address_reference],
  ];
  return (
    <dialog aria-labelledby={title} className="clients-directory-dialog" ref={frame} onClose={(event) => {
      if (event.currentTarget.returnValue === 'edit') onEdit(client);
      onClose();
    }}>
      <div className="clients-directory-dialog-head">
        <div>
          <p>Ficha do cliente</p>
          <h2 id={title}>{client.name}</h2>
        </div>
        <button type="button" aria-label="Fechar ficha" onClick={() => frame.current.close()}><Icon name="close" /></button>
      </div>
      <dl>
        {fields.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{tidy(value) || 'Não informado'}</dd></div>
        ))}
      </dl>
      <div className="clients-directory-dialog-footer">
        <button className="clients-directory-primary" type="button" onClick={() => frame.current.close('edit')}>Editar cadastro</button>
      </div>
    </dialog>
  );
}

export default function Clients() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isPro, planAccess, refreshSubscription } = useSubscription();
  const confirm = useConfirm();
  const [response, setResponse] = useState({ clients: [], loading: true, error: '' });
  const [reloadCount, setReloadCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [sort, setSort] = useState('az');
  const [editingClient, setEditingClient] = useState(null);
  const [viewingClient, setViewingClient] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const isCreateRoute = pathname === '/clients/new';

  useEffect(() => {
    const request = new AbortController();
    api.get('/clients', { signal: request.signal }).then(({ data }) => {
      if (!request.signal.aborted) setResponse({ clients: data, loading: false, error: '' });
    }).catch((error) => {
      if (!request.signal.aborted) {
        setResponse((current) => ({ ...current, loading: false, error: error.response?.data?.error || 'Não foi possível carregar os clientes.' }));
      }
    });
    return () => request.abort();
  }, [reloadCount]);

  function reload() {
    setResponse((current) => ({ ...current, loading: true, error: '' }));
    setReloadCount((value) => value + 1);
  }

  const { clients, loading, error } = response;
  const { entries, cities, counts } = useMemo(() => {
    const citiesByKey = new Map();
    const entries = clients.map((client) => {
      const label = cityOf(client);
      const cityKey = normalize(label);
      const contact = tidy(client.email) || tidy(client.whatsapp) || tidy(client.phone);
      if (client.city && !citiesByKey.has(cityKey)) citiesByKey.set(cityKey, label);
      return { client, cityKey, contact, label, status: statusOf(client) };
    });
    const complete = entries.filter(({ status }) => status.id === 'complete').length;
    return {
      entries,
      cities: [...citiesByKey.entries()].sort(([, a], [, b]) => alphabetical.compare(a, b)),
      counts: { all: entries.length, complete, pending: entries.length - complete },
    };
  }, [clients]);

  const citySelection = cities.some(([key]) => key === city) ? city : '';
  const results = useMemo(() => {
    const query = normalize(search);
    const phoneSearch = /^[+()\s\d.-]+$/.test(search) ? digits(search) : '';
    return entries.filter(({ client, cityKey, status }) => (
      (selectedFilter === 'all' || status.id === selectedFilter) &&
      (!citySelection || cityKey === citySelection) &&
      (!query || [client.name, client.email, client.phone, client.whatsapp, client.contact_name].some((value) => normalize(value).includes(query)) ||
        (phoneSearch && [client.phone, client.whatsapp].some((value) => digits(value).includes(phoneSearch))))
    )).sort((a, b) => {
      if (sort === 'recent') return (Date.parse(b.client.created_at) || 0) - (Date.parse(a.client.created_at) || 0) || b.client.id - a.client.id;
      const byName = alphabetical.compare(a.client.name, b.client.name);
      return (sort === 'za' ? -byName : byName) || a.client.id - b.client.id;
    });
  }, [citySelection, entries, search, selectedFilter, sort]);

  const updateFilter = (setter, value) => {
    setter(value);
    setCurrentPage(1);
  };
  const clearFilters = () => {
    setSearch('');
    setSelectedFilter('all');
    setCity('');
    setCurrentPage(1);
  };

  const handleDelete = async (client) => {
    if (deletingId !== null) return;
    const approved = await confirm({
      title: 'Excluir cliente?',
      message: `Excluir ${client.name} também pode remover os orçamentos e os agendamentos vinculados ao cadastro. Essa ação não pode ser desfeita.`,
      confirmText: 'Excluir cliente',
      tone: 'danger',
    });
    if (!approved) return;
    setDeletingId(client.id);
    try {
      await api.delete(`/clients/${client.id}`);
      setResponse((current) => ({ ...current, clients: current.clients.filter((other) => other.id !== client.id) }));
      toast.success('Cliente removido.');
      void refreshSubscription().catch(() => null);
    } catch (failure) {
      toast.error(failure.response?.data?.error || 'Não foi possível remover o cliente.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleClientSaved = (client) => {
    if (client?.id) {
      setResponse((current) => {
        const exists = current.clients.some((other) => Number(other.id) === Number(client.id));
        const updated = exists
          ? current.clients.map((other) => (Number(other.id) === Number(client.id) ? client : other))
          : [client, ...current.clients];
        return { ...current, clients: updated };
      });
    } else reload();
    void refreshSubscription().catch(() => null);
  };

  const closeClientForm = () => {
    setEditingClient(null);
    if (isCreateRoute) navigate('/clients', { replace: true });
  };

  const totalPages = Math.max(1, Math.ceil(results.length / CLIENTS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const firstResult = (page - 1) * CLIENTS_PER_PAGE;
  const visible = results.slice(firstResult, firstResult + CLIENTS_PER_PAGE);
  const hasFilters = search.trim() || citySelection || selectedFilter !== 'all';
  const clientLimit = isPro ? null : planAccess?.limits?.clients;

  return (
    <section className="clients-directory">
      <div className="clients-directory-content">
        <header className="clients-directory-head">
          <div>
            <h1>Clientes</h1>
            <p>Encontre contatos e atualize seus cadastros.</p>
          </div>
          <button className="clients-directory-primary" type="button" onClick={() => navigate('/clients/new')}>
            <Icon name="plus" /> Novo cliente
          </button>
        </header>

        <div className="clients-directory-tabs" role="group" aria-label="Filtrar por situação do cadastro">
          {filters.map(({ id, label }) => (
            <button key={id} type="button" aria-pressed={id === selectedFilter} onClick={() => updateFilter(setSelectedFilter, id)}>
              {label}<span className="clients-directory-count">{loading && !clients.length ? '–' : counts[id]}</span>
            </button>
          ))}
        </div>

        <div className="clients-directory-tools">
          <div className="clients-directory-search">
            <Icon name="search" />
            <input aria-label="Buscar clientes" type="search" placeholder="Buscar por nome, telefone ou e-mail"
              value={search} onChange={(event) => updateFilter(setSearch, event.target.value)} />
          </div>
          <div className="clients-directory-select">
            <select aria-label="Filtrar por cidade" value={citySelection} onChange={(event) => updateFilter(setCity, event.target.value)}>
              <option value="">Todas as cidades</option>
              {cities.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <Icon name="chevron" />
          </div>
          <div className="clients-directory-select">
            <select aria-label="Ordenar clientes" value={sort} onChange={(event) => updateFilter(setSort, event.target.value)}>
              <option value="az">Nome: A–Z</option>
              <option value="za">Nome: Z–A</option>
              <option value="recent">Mais recentes</option>
            </select>
            <Icon name="chevron" />
          </div>
        </div>

        <div className="clients-directory-list" aria-busy={loading}>
          <table className="clients-directory-table" aria-label="Clientes cadastrados" role="table">
            <thead role="rowgroup">
              <tr role="row"><th scope="col" role="columnheader">Cliente</th><th scope="col" role="columnheader">Contato</th><th scope="col" role="columnheader">Localização</th><th scope="col" role="columnheader">Cadastro</th><th scope="col" role="columnheader">Ações</th></tr>
            </thead>
            <tbody role="rowgroup">
              {!loading && !error ? visible.map(({ client, contact, label, status }) => (
                <tr key={client.id} role="row">
                  <th scope="row" role="rowheader">
                    <span className="clients-directory-person">
                      <span aria-hidden="true" className="clients-directory-avatar">{initials(client.name)}</span>
                      <span title={client.name}>{client.name}</span>
                    </span>
                  </th>
                  <td className="clients-directory-row-contact" data-empty={!contact} role="cell" title={contact || undefined}>
                    <span>{contact || '—'}</span>
                  </td>
                  <td className="clients-directory-row-city" data-empty={!label} role="cell"><span>{label || '—'}</span></td>
                  <td className="clients-directory-row-status" role="cell"><span className="clients-directory-status" data-status={status.id}>{status.label}</span></td>
                  <td className="clients-directory-row-actions" role="cell">
                    <div className="clients-directory-row-buttons">
                      <button className="clients-directory-view" type="button" aria-label={`Ver ficha de ${client.name}`} onClick={() => setViewingClient(client)}>Ver ficha</button>
                      <span aria-hidden="true" className="clients-directory-action-divider">·</span>
                      <ClientActions client={client} onDelete={handleDelete} onEdit={setEditingClient} />
                    </div>
                  </td>
                </tr>
              )) : null}
            </tbody>
          </table>

          {loading ? <div className="clients-directory-empty" role="status">Carregando clientes…</div> : null}
          {!loading && error ? (
            <div className="clients-directory-empty">
              <p role="alert">{error}</p>
              <button type="button" onClick={reload}>Tentar novamente</button>
            </div>
          ) : null}
          {!loading && !error && !results.length ? (
            <div className="clients-directory-empty">
              <strong>{hasFilters ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</strong>
              {hasFilters ? <button type="button" onClick={clearFilters}>Limpar filtros</button>
                : <p>Use “Novo cliente” para adicionar o primeiro contato.</p>}
            </div>
          ) : null}
          {!loading && !error ? (
            <footer className="clients-directory-list-footer">
              <span role="status">{results.length} {results.length === 1 ? 'cliente' : 'clientes'}</span>
              {Number.isInteger(clientLimit) ? (
                <div className="clients-directory-quota">
                  {clients.length} de {clientLimit} no plano Grátis
                  <Link to="/subscription">Conhecer o Pro</Link>
                </div>
              ) : null}
              <PaginationControls currentPage={page} onPageChange={setCurrentPage} totalPages={totalPages} />
            </footer>
          ) : null}
        </div>

      </div>

      {viewingClient ? <ClientDetails client={viewingClient} onClose={() => setViewingClient(null)} onEdit={setEditingClient} /> : null}
      {editingClient || isCreateRoute ? (
        <ClientForm client={editingClient} onClose={closeClientForm} onSaved={handleClientSaved} />
      ) : null}
    </section>
  );
}
