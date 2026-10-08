import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import api from '../../services/api';
import PaginationControls from '../Layout/PaginationControls';
import PlanUsage from '../Subscription/PlanUsage';
import ClientForm from './ClientForm';
import { useSubscription } from '../../contexts/SubscriptionContext';

const CLIENTS_PER_PAGE = 6;

function ClientUiIcon({ type }) {
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
    case 'back':
      return (
        <svg {...props}>
          <path d="m14.5 5.5-6 6 6 6" />
        </svg>
      );
    case 'edit':
      return (
        <svg {...props}>
          <path d="m4.5 19.5 4.2-1 9.8-9.8-3.2-3.2-9.8 9.8-1 4.2Z" />
          <path d="m13.8 7 3.2 3.2" />
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
    case 'home':
      return (
        <svg {...props}>
          <path d="M4.5 10.5 12 4l7.5 6.5V19A1.5 1.5 0 0 1 18 20.5h-4.5v-5h-3v5H6A1.5 1.5 0 0 1 4.5 19v-8.5Z" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...props}>
          <path d="M7 3.5v3M17 3.5v3M5 7.5h14M6.5 5.5h11A1.5 1.5 0 0 1 19 7v11.5A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5V7A1.5 1.5 0 0 1 6.5 5.5Z" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'users':
      return (
        <svg {...props}>
          <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM17 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
          <path d="M3.5 18a5.5 5.5 0 0 1 11 0M14 18a4 4 0 0 1 6.5-3.1" />
        </svg>
      );
    case 'more':
      return (
        <svg {...props}>
          <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
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

function buildAddressSummary(client) {
  const line1 = [client.street, client.house_number && `Nº ${client.house_number}`].filter(Boolean).join(', ');
  const line2 = [client.neighborhood, [client.city, client.state].filter(Boolean).join(' - ')].filter(Boolean).join(', ');
  const line3 = client.zip_code ? `CEP ${client.zip_code}` : '';

  return [line1, line2, line3].filter(Boolean).join(' • ') || client.address || 'Não informado';
}

function getClientInitials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function ClientCard({ client, onDelete, onEdit }) {
  return (
    <article className="client-intake-client-card">
      <div className="client-intake-client-head">
        <div className="client-intake-avatar">{getClientInitials(client.name)}</div>

        <div className="client-intake-client-meta">
          <h4>{client.name}</h4>
          <p>{client.phone || 'Telefone não informado'}</p>
        </div>

        <div className="flex gap-2">
          <button aria-label={`Editar ${client.name}`} className="client-intake-delete" onClick={() => onEdit(client)} type="button">
            <ClientUiIcon type="edit" />
          </button>
          <button aria-label={`Excluir ${client.name}`} className="client-intake-delete" onClick={() => onDelete(client.id)} type="button">
            <ClientUiIcon type="trash" />
          </button>
        </div>
      </div>

      <div className="client-intake-client-body">
        <div>
          <span>E-mail</span>
          <strong>{client.email || 'Não informado'}</strong>
        </div>
        <div>
          <span>Endereço</span>
          <strong>{buildAddressSummary(client)}</strong>
        </div>
        <div>
          <span>Observações</span>
          <strong>{client.address_reference || 'Sem observações extras'}</strong>
        </div>
      </div>
    </article>
  );
}

export default function Clients() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshSubscription } = useSubscription();
  const [clients, setClients] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingClient, setEditingClient] = useState(null);
  const isCreateRoute = location.pathname === '/clients/new';
  const [creatingClient, setCreatingClient] = useState(isCreateRoute);

  const loadClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível carregar os clientes.');
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    setCreatingClient(isCreateRoute);
  }, [isCreateRoute]);

  const stats = useMemo(
    () => ({
      total: clients.length,
      withEmail: clients.filter((client) => client.email).length,
      withAddress: clients.filter((client) => client.street && client.city && client.state).length,
    }),
    [clients]
  );

  const handleDelete = async (id) => {
    try {
      await api.delete(`/clients/${id}`);
      toast.success('Cliente removido.');
      setEditingClient((current) => (Number(current?.id) === Number(id) ? null : current));
      await Promise.all([loadClients(), refreshSubscription()]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível remover o cliente.');
    }
  };

  const handleClientSaved = async (savedClient) => {
    if (savedClient?.id) {
      setClients((current) => {
        const alreadyExists = current.some((client) => Number(client.id) === Number(savedClient.id));

        if (!alreadyExists) {
          return [savedClient, ...current];
        }

        return current.map((client) => (
          Number(client.id) === Number(savedClient.id) ? savedClient : client
        ));
      });
    } else {
      await loadClients();
    }

    setEditingClient(null);
    setCreatingClient(false);
    if (isCreateRoute) {
      navigate('/clients', { replace: true });
    }
    refreshSubscription().catch(() => null);
  };

  const closeClientForm = () => {
    setEditingClient(null);
    setCreatingClient(false);
    if (isCreateRoute) {
      navigate('/clients', { replace: true });
    }
  };

  const openClientForm = () => {
    setCreatingClient(true);
    navigate('/clients/new');
  };

  const totalPages = Math.max(1, Math.ceil(clients.length / CLIENTS_PER_PAGE));
  const normalizedPage = Math.min(currentPage, totalPages);
  const start = (normalizedPage - 1) * CLIENTS_PER_PAGE;
  const paginatedClients = clients.slice(start, start + CLIENTS_PER_PAGE);

  return (
    <section className="client-intake-shell">
      <header className="client-intake-topbar fade-up">
        <button aria-label="Voltar ao início" className="client-intake-back" onClick={() => navigate('/dashboard')} type="button">
          <ClientUiIcon type="back" />
        </button>

        <div className="client-intake-topbar-copy">
          <h1>Clientes</h1>
          <p>Consulte e mantenha atualizada a sua carteira</p>
        </div>

        <button aria-label="Novo cliente" className="client-intake-save" onClick={openClientForm} type="button">
          <ClientUiIcon type="plus" />
          <span>Novo cliente</span>
        </button>
      </header>

      <div className="client-intake-layout">
        <div className="client-intake-main">
          <PlanUsage className="fade-up" usageKey="clients" />

          <section className="client-intake-mobile-list fade-up" style={{ animationDelay: '0.08s' }}>
            <div className="client-intake-panel-head">
              <div>
                <p className="client-intake-kicker">Carteira</p>
                <h3>Clientes cadastrados</h3>
              </div>
              <span>{stats.total}</span>
            </div>

            <p className="client-intake-list-intro">
              Cadastre clientes aqui e use-os nos próximos orçamentos.
            </p>

            <div className="client-intake-panel-list">
              {paginatedClients.map((client) => (
                <ClientCard client={client} key={client.id} onDelete={handleDelete} onEdit={setEditingClient} />
              ))}
            </div>

            {clients.length > 0 ? (
              <PaginationControls currentPage={normalizedPage} onPageChange={setCurrentPage} totalPages={totalPages} />
            ) : null}

            {clients.length === 0 ? (
              <div className="client-intake-empty">
                <div className="client-intake-empty-icon">
                  <ClientUiIcon type="users" />
                </div>
                <strong>Nenhum cliente cadastrado</strong>
                <span>Cadastre o primeiro contato para usar nos próximos orçamentos.</span>
                <button className="client-intake-primary mt-5" onClick={openClientForm} type="button">
                  Cadastrar primeiro cliente
                </button>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="client-intake-side fade-up" style={{ animationDelay: '0.08s' }}>
          <section className="client-intake-side-card">
            <div className="client-intake-panel-head">
              <div>
                <p className="client-intake-kicker">Resumo</p>
                <h3>Carteira organizada</h3>
              </div>
            </div>

            <div className="client-intake-stat-grid">
              <article>
                <strong>{stats.total}</strong>
                <span>Total de clientes</span>
              </article>
              <article>
                <strong>{stats.withEmail}</strong>
                <span>Com e-mail</span>
              </article>
              <article>
                <strong>{stats.withAddress}</strong>
                <span>Com endereço completo</span>
              </article>
            </div>
          </section>

          <section className="client-intake-side-card client-intake-side-card--action">
            <p className="client-intake-kicker">Novo atendimento</p>
            <h3>Adicione um cliente</h3>
            <p>Deixe a carteira organizada antes de montar o próximo orçamento.</p>
            <button className="client-intake-primary" onClick={openClientForm} type="button">
              Novo cliente
            </button>
          </section>
        </aside>
      </div>

      {editingClient || creatingClient ? (
        <ClientForm
          client={editingClient}
          onClose={closeClientForm}
          onSaved={handleClientSaved}
        />
      ) : null}

      <nav className="client-intake-mobile-dock" aria-label="Atalhos do painel">
        <Link to="/dashboard">
          <ClientUiIcon type="home" />
          <span>Início</span>
        </Link>
        <Link to="/agenda">
          <ClientUiIcon type="calendar" />
          <span>Agenda</span>
        </Link>
        <Link className="is-primary" to="/budgets/new">
          <ClientUiIcon type="plus" />
          <span>Novo</span>
        </Link>
        <Link className="is-active" to="/clients">
          <ClientUiIcon type="users" />
          <span>Clientes</span>
        </Link>
        <Link to="/profile">
          <ClientUiIcon type="more" />
          <span>Mais</span>
        </Link>
      </nav>
    </section>
  );
}
