import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import PaginationControls from '../Layout/PaginationControls';

const CLIENTS_PER_PAGE = 6;

const BRAZIL_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];

const initialForm = {
  name: '',
  phone: '',
  email: '',
  street: '',
  house_number: '',
  neighborhood: '',
  city: '',
  state: '',
  zip_code: '',
  address_reference: '',
  address: '',
};

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
    case 'save':
      return (
        <svg {...props}>
          <path d="M5 5.5h10l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5.5Z" />
          <path d="M8 5.5V9h6V5.5M8 20.5v-6h8v6" />
        </svg>
      );
    case 'person':
      return (
        <svg {...props}>
          <path d="M12 12a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" />
          <path d="M5 19.5a7 7 0 0 1 14 0" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...props}>
          <path d="M6.5 4.5h2l1.2 4-1.7 1.7a15.7 15.7 0 0 0 5.8 5.8l1.7-1.7 4 1.2v2A1.5 1.5 0 0 1 18 19a13.5 13.5 0 0 1-13-13A1.5 1.5 0 0 1 6.5 4.5Z" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...props}>
          <path d="M4.5 6.5h15v11h-15z" />
          <path d="m5.5 7.5 6.5 5 6.5-5" />
        </svg>
      );
    case 'location':
      return (
        <svg {...props}>
          <path d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z" />
          <circle cx="12" cy="11" r="2.4" />
        </svg>
      );
    case 'pin':
      return (
        <svg {...props}>
          <path d="M12 20.5s5.5-4 5.5-9a5.5 5.5 0 1 0-11 0c0 5 5.5 9 5.5 9Z" />
          <circle cx="12" cy="11.5" r="1.9" />
        </svg>
      );
    case 'note':
      return (
        <svg {...props}>
          <path d="M7 4.5h8l4 4V19A1.5 1.5 0 0 1 17.5 20.5h-11A1.5 1.5 0 0 1 5 19V6A1.5 1.5 0 0 1 6.5 4.5Z" />
          <path d="M13 4.5V9h6M8 12h7M8 15.5h7" />
        </svg>
      );
    case 'search':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 3.5 3.5" />
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

function normalizeZipCode(value) {
  const digits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, 8);

  if (digits.length <= 5) {
    return digits;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
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

function ClientCard({ client, onDelete }) {
  return (
    <article className="client-intake-client-card">
      <div className="client-intake-client-head">
        <div className="client-intake-avatar">{getClientInitials(client.name)}</div>

        <div className="client-intake-client-meta">
          <h4>{client.name}</h4>
          <p>{client.phone || 'Telefone não informado'}</p>
        </div>

        <button className="client-intake-delete" onClick={() => onDelete(client.id)} type="button">
          <ClientUiIcon type="trash" />
        </button>
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
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [currentPage, setCurrentPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [searchingZip, setSearchingZip] = useState(false);

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

  const stats = useMemo(
    () => ({
      total: clients.length,
      withEmail: clients.filter((client) => client.email).length,
      withAddress: clients.filter((client) => client.street && client.city && client.state).length,
    }),
    [clients]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === 'zip_code') {
      setForm((current) => ({ ...current, zip_code: normalizeZipCode(value) }));
      return;
    }

    if (name === 'state') {
      setForm((current) => ({ ...current, state: value.toUpperCase().slice(0, 2) }));
      return;
    }

    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleClear = () => {
    setForm(initialForm);
  };

  const handleZipLookup = async () => {
    const zipDigits = String(form.zip_code || '').replace(/\D/g, '');

    if (zipDigits.length !== 8) {
      toast.error('Informe um CEP válido com 8 números.');
      return;
    }

    setSearchingZip(true);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${zipDigits}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast.error('CEP não encontrado.');
        return;
      }

      setForm((current) => ({
        ...current,
        zip_code: normalizeZipCode(zipDigits),
        street: data.logradouro || current.street,
        neighborhood: data.bairro || current.neighborhood,
        city: data.localidade || current.city,
        state: data.uf || current.state,
      }));

      toast.success('Endereço preenchido com o CEP.');
    } catch (error) {
      toast.error('Não foi possível buscar o CEP agora.');
    } finally {
      setSearchingZip(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Preencha pelo menos nome e telefone.');
      return;
    }

    setSaving(true);

    try {
      await api.post('/clients', form);
      setForm(initialForm);
      setCurrentPage(1);
      toast.success('Cliente cadastrado com sucesso.');
      loadClients();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível salvar o cliente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/clients/${id}`);
      toast.success('Cliente removido.');
      loadClients();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível remover o cliente.');
    }
  };

  const totalPages = Math.max(1, Math.ceil(clients.length / CLIENTS_PER_PAGE));
  const normalizedPage = Math.min(currentPage, totalPages);
  const start = (normalizedPage - 1) * CLIENTS_PER_PAGE;
  const paginatedClients = clients.slice(start, start + CLIENTS_PER_PAGE);

  return (
    <section className="client-intake-shell">
      <header className="client-intake-topbar fade-up">
        <button className="client-intake-back" onClick={() => navigate('/dashboard')} type="button">
          <ClientUiIcon type="back" />
        </button>

        <div className="client-intake-topbar-copy">
          <h1>Novo cliente</h1>
          <p>Cadastre um novo cliente</p>
        </div>

        <button className="client-intake-save" form="client-intake-form" type="submit">
          <ClientUiIcon type="save" />
          <span>Salvar cliente</span>
        </button>
      </header>

      <div className="client-intake-layout">
        <div className="client-intake-main">
          <form className="client-intake-form-shell fade-up" id="client-intake-form" onSubmit={handleSubmit}>
            <div className="client-intake-form-head">
              <div>
                <p className="client-intake-kicker">Cadastro rápido</p>
                <h2>Dados prontos para orçamento, agenda e atendimento</h2>
                <span>Preencha o essencial para manter sua carteira organizada e responder mais rápido.</span>
              </div>

              <div className="client-intake-head-badge">
                <strong>{stats.total}</strong>
                <small>clientes ativos</small>
              </div>
            </div>

            <section className="client-intake-section">
              <div className="client-intake-section-title">
                <div className="client-intake-section-icon">
                  <ClientUiIcon type="person" />
                </div>
                <div>
                  <h3>Dados pessoais</h3>
                  <p>Nome, telefone e e-mail para contato imediato.</p>
                </div>
              </div>

              <div className="client-intake-grid client-intake-grid--personal">
                <label className="client-intake-field client-intake-field--full">
                  <span>Nome completo *</span>
                  <input name="name" onChange={handleChange} placeholder="Ex.: João da Silva" value={form.name} />
                </label>

                <label className="client-intake-field">
                  <span>Telefone *</span>
                  <div className="client-intake-inputwrap">
                    <ClientUiIcon type="phone" />
                    <input name="phone" onChange={handleChange} placeholder="(11) 99999-9999" value={form.phone} />
                  </div>
                </label>

                <label className="client-intake-field">
                  <span>E-mail</span>
                  <div className="client-intake-inputwrap">
                    <ClientUiIcon type="mail" />
                    <input
                      name="email"
                      onChange={handleChange}
                      placeholder="exemplo@email.com"
                      type="email"
                      value={form.email}
                    />
                  </div>
                </label>
              </div>
            </section>

            <section className="client-intake-section">
              <div className="client-intake-section-title">
                <div className="client-intake-section-icon">
                  <ClientUiIcon type="location" />
                </div>
                <div>
                  <h3>Endereço</h3>
                  <p>Use o CEP para preencher rápido e revisar o local da instalação.</p>
                </div>
              </div>

              <div className="client-intake-grid client-intake-grid--zip">
                <label className="client-intake-field">
                  <span>CEP</span>
                  <div className="client-intake-inputwrap">
                    <ClientUiIcon type="pin" />
                    <input name="zip_code" onChange={handleChange} placeholder="00000-000" value={form.zip_code} />
                  </div>
                </label>

                <button
                  className="client-intake-zip-button"
                  disabled={searchingZip}
                  onClick={handleZipLookup}
                  type="button"
                >
                  <ClientUiIcon type="search" />
                  <span>{searchingZip ? 'Buscando...' : 'Buscar CEP'}</span>
                </button>
              </div>

              <div className="client-intake-grid client-intake-grid--address">
                <label className="client-intake-field client-intake-field--wide">
                  <span>Logradouro</span>
                  <input name="street" onChange={handleChange} placeholder="Rua, avenida, etc." value={form.street} />
                </label>

                <label className="client-intake-field client-intake-field--short">
                  <span>Número</span>
                  <input name="house_number" onChange={handleChange} placeholder="123" value={form.house_number} />
                </label>

                <label className="client-intake-field">
                  <span>Bairro</span>
                  <input
                    name="neighborhood"
                    onChange={handleChange}
                    placeholder="Ex.: Centro"
                    value={form.neighborhood}
                  />
                </label>

                <label className="client-intake-field">
                  <span>Cidade</span>
                  <input name="city" onChange={handleChange} placeholder="Ex.: São Paulo" value={form.city} />
                </label>

                <label className="client-intake-field">
                  <span>Estado</span>
                  <select name="state" onChange={handleChange} value={form.state}>
                    <option value="">Selecione</option>
                    {BRAZIL_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="client-intake-section">
              <div className="client-intake-section-title">
                <div className="client-intake-section-icon">
                  <ClientUiIcon type="note" />
                </div>
                <div>
                  <h3>Informações adicionais</h3>
                  <p>Detalhes úteis para localização, acesso e atendimento no dia.</p>
                </div>
              </div>

              <div className="client-intake-grid">
                <label className="client-intake-field client-intake-field--full">
                  <span>Observações</span>
                  <textarea
                    name="address_reference"
                    onChange={handleChange}
                    placeholder="Ex.: portão preto, bloco B, tocar interfone 3."
                    rows="4"
                    value={form.address_reference}
                  />
                </label>

                <label className="client-intake-field client-intake-field--full">
                  <span>Endereço livre (opcional)</span>
                  <textarea
                    name="address"
                    onChange={handleChange}
                    placeholder="Complemento livre para o cadastro"
                    rows="3"
                    value={form.address}
                  />
                </label>
              </div>

              <div className="client-intake-actions">
                <button className="client-intake-primary" disabled={saving} type="submit">
                  {saving ? 'Salvando...' : 'Salvar cliente'}
                </button>
                <button className="client-intake-secondary" onClick={handleClear} type="button">
                  Limpar campos
                </button>
              </div>
            </section>
          </form>

          <section className="client-intake-mobile-list fade-up" style={{ animationDelay: '0.08s' }}>
            <div className="client-intake-panel-head">
              <div>
                <p className="client-intake-kicker">Carteira</p>
                <h3>Clientes cadastrados</h3>
              </div>
              <span>{stats.total}</span>
            </div>

            <div className="client-intake-panel-list">
              {paginatedClients.map((client) => (
                <ClientCard client={client} key={client.id} onDelete={handleDelete} />
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
                <span>Assim que você salvar os primeiros contatos, eles vão aparecer organizados aqui.</span>
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

          <section className="client-intake-side-card client-intake-side-card--list">
            <div className="client-intake-panel-head">
              <div>
                <p className="client-intake-kicker">Clientes recentes</p>
                <h3>Últimos cadastros</h3>
              </div>
              <span>{stats.total}</span>
            </div>

            <div className="client-intake-panel-list">
              {paginatedClients.map((client) => (
                <ClientCard client={client} key={client.id} onDelete={handleDelete} />
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
                <span>Os próximos contatos salvos vão aparecer aqui para consulta rápida.</span>
              </div>
            ) : null}
          </section>
        </aside>
      </div>

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
