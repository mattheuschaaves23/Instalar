import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';
import PaginationControls from '../Layout/PaginationControls';
import {
  formatCurrency,
  formatDateTime,
  formatShortDate,
  formatStatusLabel,
} from '../../utils/formatters';

const initialOverview = {
  metrics: {},
  recent_users: [],
  recent_payments: [],
  recent_budgets: [],
  recent_service_requests: [],
};

const initialAnnouncement = {
  title: '',
  message: '',
  type: 'info',
};

const initialStoreForm = {
  name: '',
  description: '',
  image_url: '',
  link_url: '',
  cta_label: 'Ir ao site',
  sort_order: 0,
  is_active: true,
};

const USERS_PER_PAGE = 6;
const PAYMENTS_PER_PAGE = 6;
const REQUESTS_PER_PAGE = 8;
const initialUserFilters = { q: '', status: 'all', account_type: 'all' };
const initialPaymentFilters = { q: '', status: 'all' };
const initialRequestFilters = { q: '', status: 'all' };
const initialPagination = { page: 1, limit: 1, total: 0, total_pages: 1 };

function AdminPanelIcon({ type }) {
  const sharedProps = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
    'aria-hidden': 'true',
  };

  const icons = {
    overview: <><rect x="4" y="4" width="6" height="6" rx="1.2" /><rect x="14" y="4" width="6" height="6" rx="1.2" /><rect x="4" y="14" width="6" height="6" rx="1.2" /><rect x="14" y="14" width="6" height="6" rx="1.2" /></>,
    users: <><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2.2" /><path d="M3.8 19c.9-3.1 2.8-4.7 5.2-4.7s4.3 1.6 5.2 4.7" /><path d="M14.8 15c1.9.4 3.3 1.7 4 4" /></>,
    payments: <><circle cx="12" cy="12" r="8.5" /><path d="M14.8 9.4c0-1.2-1-2.1-2.6-2.1-1.6 0-2.7.8-2.7 2.1 0 2.7 5.5 1.6 5.5 4.2 0 1.2-1 2.1-2.8 2.1-1.7 0-2.8-.9-2.9-2.2" /><path d="M12 6v12" /></>,
    requests: <><path d="M6 4h12v16H6z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
    stores: <><path d="M5 9.2 6.2 4h11.6L19 9.2" /><path d="M5 9.2h14v9.3a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5Z" /><path d="M8.4 13h7.2" /></>,
    announcements: <><path d="M5 10.5v3a2 2 0 0 0 2 2h2.2l4.8 3.2v-13L9.2 8H7a2 2 0 0 0-2 2.5Z" /><path d="M17 9.2c.8.6 1.3 1.5 1.3 2.6s-.5 2-1.3 2.6" /></>,
  };

  return <svg {...sharedProps}>{icons[type] || icons.overview}</svg>;
}

function PageIntro({ title, description, stats = [] }) {
  return (
    <section className="admin-modern-hero">
      <div className="admin-modern-hero-copy">
        <p>Administração</p>
        <h1>{title || 'Painel ADM'}</h1>
        <small>{description}</small>
      </div>

      <div className="admin-modern-hero-metrics" aria-label="Resumo administrativo">
        {stats.map((stat) => (
          <article key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            {stat.detail ? <small>{stat.detail}</small> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export default function AdminDashboard() {
  const confirm = useConfirm();
  const storeFormRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState(initialOverview);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [recommendedStores, setRecommendedStores] = useState([]);
  const [applicationErrors, setApplicationErrors] = useState([]);
  const [userFilters, setUserFilters] = useState(initialUserFilters);
  const [paymentFilters, setPaymentFilters] = useState(initialPaymentFilters);
  const [requestFilters, setRequestFilters] = useState(initialRequestFilters);
  const [announcement, setAnnouncement] = useState(initialAnnouncement);
  const [storeForm, setStoreForm] = useState(initialStoreForm);
  const [editingStoreId, setEditingStoreId] = useState(null);
  const [usersPage, setUsersPage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [requestsPage, setRequestsPage] = useState(1);
  const [usersPagination, setUsersPagination] = useState(initialPagination);
  const [paymentsPagination, setPaymentsPagination] = useState(initialPagination);
  const [requestsPagination, setRequestsPagination] = useState(initialPagination);

  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [savingUserId, setSavingUserId] = useState(null);
  const [savingPaymentId, setSavingPaymentId] = useState(null);
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [loadingStores, setLoadingStores] = useState(false);
  const [savingStore, setSavingStore] = useState(false);

  const loadOverview = useCallback(async () => {
    const response = await api.get('/admin/overview');
    setOverview(response.data || initialOverview);
  }, []);

  const loadUsers = useCallback(async (nextFilters = initialUserFilters, page = 1) => {
    setLoadingUsers(true);

    try {
      const response = await api.get('/admin/users', {
        params: {
          q: nextFilters.q,
          status: nextFilters.status,
          account_type: nextFilters.account_type,
          page,
          limit: USERS_PER_PAGE,
        },
      });

      setUsers(response.data?.users || []);
      setUsersPagination(response.data?.pagination || initialPagination);
      setUsersPage(page);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadPayments = useCallback(async (nextFilters = initialPaymentFilters, page = 1) => {
    setLoadingPayments(true);

    try {
      const response = await api.get('/admin/payments', {
        params: {
          q: nextFilters.q,
          status: nextFilters.status,
          page,
          limit: PAYMENTS_PER_PAGE,
        },
      });

      setPayments(response.data?.payments || []);
      setPaymentsPagination(response.data?.pagination || initialPagination);
      setPaymentsPage(page);
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  const loadRecommendedStores = useCallback(async () => {
    setLoadingStores(true);

    try {
      const response = await api.get('/admin/recommended-stores');
      setRecommendedStores(response.data?.stores || []);
    } finally {
      setLoadingStores(false);
    }
  }, []);

  const loadServiceRequests = useCallback(async (nextFilters = initialRequestFilters, page = 1) => {
    setLoadingRequests(true);
    try {
      const response = await api.get('/admin/service-requests', {
        params: { ...nextFilters, page, limit: REQUESTS_PER_PAGE },
      });
      setServiceRequests(response.data?.requests || []);
      setRequestsPagination(response.data?.pagination || initialPagination);
      setRequestsPage(page);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  const loadApplicationErrors = useCallback(async () => {
    const response = await api.get('/admin/system/errors', { params: { limit: 30 } });
    setApplicationErrors(response.data?.errors || []);
  }, []);

  useEffect(() => {
    setLoading(true);

    Promise.all([loadOverview(), loadUsers(), loadPayments(), loadServiceRequests(), loadRecommendedStores(), loadApplicationErrors()])
      .catch((error) => {
        toast.error(error.response?.data?.error || 'Não foi possível carregar o painel administrativo.');
      })
      .finally(() => setLoading(false));
  }, [loadApplicationErrors, loadOverview, loadPayments, loadRecommendedStores, loadServiceRequests, loadUsers]);

  const resolveApplicationError = async (errorId) => {
    try {
      await api.patch(`/admin/system/errors/${errorId}/resolve`);
      setApplicationErrors((current) => current.filter((item) => item.id !== errorId));
      toast.success('Erro marcado como resolvido.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar o erro.');
    }
  };

  const handleUserFilterChange = (event) => {
    setUserFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handlePaymentFilterChange = (event) => {
    setPaymentFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleRequestFilterChange = (event) => {
    setRequestFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleUserFilterSubmit = async (event) => {
    event.preventDefault();
    setUsersPage(1);

    try {
      await loadUsers(userFilters, 1);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível aplicar o filtro de usuários.');
    }
  };

  const handlePaymentFilterSubmit = async (event) => {
    event.preventDefault();
    setPaymentsPage(1);

    try {
      await loadPayments(paymentFilters, 1);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível aplicar o filtro de pagamentos.');
    }
  };

  const updatePublicProfile = async (targetUserId, nextPublicProfile) => {
    setSavingUserId(targetUserId);

    try {
      await api.patch(`/admin/users/${targetUserId}/public-profile`, {
        public_profile: nextPublicProfile,
      });

      toast.success('Perfil público atualizado.');
      await Promise.all([loadUsers(userFilters), loadOverview()]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar o perfil público.');
    } finally {
      setSavingUserId(null);
    }
  };

  const updateSubscription = async (targetUserId, nextStatus) => {
    setSavingUserId(targetUserId);

    try {
      await api.patch(`/admin/users/${targetUserId}/subscription`, {
        status: nextStatus,
      });

      toast.success('Assinatura atualizada.');
      await Promise.all([loadUsers(userFilters), loadOverview()]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar a assinatura.');
    } finally {
      setSavingUserId(null);
    }
  };

  const updateAdminRole = async (targetUserId, nextIsAdmin) => {
    setSavingUserId(targetUserId);

    try {
      await api.patch(`/admin/users/${targetUserId}/admin`, {
        is_admin: nextIsAdmin,
      });

      toast.success(nextIsAdmin ? 'Usuário promovido para admin.' : 'Permissão de admin removida.');
      await Promise.all([loadUsers(userFilters), loadOverview()]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível alterar permissão administrativa.');
    } finally {
      setSavingUserId(null);
    }
  };

  const updateTrust = async (targetUserId, payload) => {
    setSavingUserId(targetUserId);

    try {
      await api.patch(`/admin/users/${targetUserId}/trust`, payload);
      toast.success('Selo de confiança atualizado.');
      await Promise.all([loadUsers(userFilters), loadOverview()]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar o selo de confiança.');
    } finally {
      setSavingUserId(null);
    }
  };

  const handleRequestFilterSubmit = async (event) => {
    event.preventDefault();
    setRequestsPage(1);

    try {
      await loadServiceRequests(requestFilters, 1);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível aplicar o filtro de pedidos.');
    }
  };

  const updateServiceRequestStatus = async (requestId, status) => {
    try {
      await api.patch(`/admin/service-requests/${requestId}/status`, { status });
      toast.success('Status do pedido atualizado.');
      await Promise.all([loadServiceRequests(requestFilters, requestsPage), loadOverview()]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar o pedido.');
    }
  };

  const openInstallerCertificate = async (targetUser) => {
    if (!targetUser.certificate_file) return;
    if (!targetUser.certificate_file.startsWith('/api/')) {
      try {
        const certificateUrl = new URL(targetUser.certificate_file);
        if (!['http:', 'https:'].includes(certificateUrl.protocol)) throw new Error('invalid_protocol');
        window.open(certificateUrl.toString(), '_blank', 'noopener,noreferrer');
      } catch (_error) {
        toast.error('O endereço deste certificado é inválido. Peça um novo envio ao instalador.');
      }
      return;
    }

    const viewer = window.open('', '_blank', 'noopener,noreferrer');
    try {
      const response = await api.get(targetUser.certificate_file.replace(/^\/api/, ''), { responseType: 'blob' });
      const objectUrl = URL.createObjectURL(response.data);
      if (viewer) viewer.location = objectUrl;
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      viewer?.close();
      toast.error(error.response?.data?.error || 'Não foi possível abrir o certificado.');
    }
  };

  const confirmPublicProfileAction = async (targetUser) => {
    const nextPublicProfile = !targetUser.public_profile;
    const actionLabel = nextPublicProfile ? 'mostrar na vitrine pública' : 'ocultar da vitrine pública';
    const confirmed = await confirm(
      `Confirma ${actionLabel} o usuário ${targetUser.name}?`
    );

    if (!confirmed) {
      return;
    }

    await updatePublicProfile(targetUser.id, nextPublicProfile);
  };

  const confirmSubscriptionAction = async (targetUser) => {
    const nextStatus = targetUser.subscription_status === 'active' ? 'inactive' : 'active';
    const actionLabel = nextStatus === 'active' ? 'ativar a assinatura' : 'suspender a assinatura';
    const confirmed = await confirm(
      `Confirma ${actionLabel} de ${targetUser.name}?`
    );

    if (!confirmed) {
      return;
    }

    await updateSubscription(targetUser.id, nextStatus);
  };

  const confirmAdminRoleAction = async (targetUser) => {
    const nextIsAdmin = !targetUser.is_admin;
    const actionLabel = nextIsAdmin ? 'tornar admin' : 'remover permissão de admin';
    const confirmed = await confirm(
      `Confirma ${actionLabel} para ${targetUser.name}?`
    );

    if (!confirmed) {
      return;
    }

    await updateAdminRole(targetUser.id, nextIsAdmin);
  };

  const confirmFeaturedInstallerAction = async (targetUser) => {
    const nextFeatured = !targetUser.featured_installer;
    const actionLabel = nextFeatured ? 'destacar este instalador na vitrine' : 'remover o destaque na vitrine';
    const confirmed = await confirm(`Confirma ${actionLabel} para ${targetUser.name}?`);

    if (!confirmed) {
      return;
    }

    await updateTrust(targetUser.id, { featured_installer: nextFeatured });
  };

  const confirmCertificationAction = async (targetUser) => {
    const nextVerified = !targetUser.certification_verified;

    if (nextVerified && !targetUser.has_certificate) {
      toast.error('Este instalador ainda não enviou certificado.');
      return;
    }

    const actionLabel = nextVerified ? 'validar o certificado deste instalador' : 'remover a validação do certificado';
    const confirmed = await confirm(`Confirma ${actionLabel} para ${targetUser.name}?`);

    if (!confirmed) {
      return;
    }

    await updateTrust(targetUser.id, { certification_verified: nextVerified });
  };

  const deleteUser = async (targetUser) => {
    const confirmed = await confirm(
      `Arquivar o usuário ${targetUser.name}?\n\nO acesso será bloqueado, mas os dados poderão ser restaurados pelo administrador.`
    );

    if (!confirmed) {
      return;
    }

    setSavingUserId(targetUser.id);

    try {
      await api.delete(`/admin/users/${targetUser.id}`);
      toast.success('Usuário arquivado com sucesso.');
      await Promise.all([loadUsers(userFilters), loadOverview(), loadPayments(paymentFilters)]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível excluir o usuário.');
    } finally {
      setSavingUserId(null);
    }
  };

  const restoreUser = async (targetUser) => {
    const confirmed = await confirm(`Restaurar o acesso de ${targetUser.name}?`);
    if (!confirmed) return;
    setSavingUserId(targetUser.id);
    try {
      await api.patch(`/admin/users/${targetUser.id}/restore`);
      toast.success('Usuário restaurado. A verificação e a vitrine continuam desativadas por segurança.');
      await Promise.all([loadUsers(userFilters), loadOverview()]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível restaurar o usuário.');
    } finally {
      setSavingUserId(null);
    }
  };

  const updatePaymentStatus = async (paymentId, status) => {
    setSavingPaymentId(paymentId);

    try {
      await api.patch(`/admin/payments/${paymentId}/status`, { status });
      toast.success(`Pagamento marcado como ${formatStatusLabel(status).toLowerCase()}.`);
      await Promise.all([loadPayments(paymentFilters), loadOverview(), loadUsers(userFilters)]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar o pagamento.');
    } finally {
      setSavingPaymentId(null);
    }
  };

  const confirmPaymentStatus = async (paymentId, status) => {
    const confirmed = await confirm(
      `Confirma alterar este pagamento para "${formatStatusLabel(status).toLowerCase()}"?`
    );

    if (!confirmed) {
      return;
    }

    await updatePaymentStatus(paymentId, status);
  };

  const handleAnnouncementChange = (event) => {
    setAnnouncement((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleAnnouncementSubmit = async (event) => {
    event.preventDefault();

    if (!announcement.title.trim() || !announcement.message.trim()) {
      toast.error('Preencha título e mensagem para enviar o comunicado.');
      return;
    }

    setSendingAnnouncement(true);

    try {
      const response = await api.post('/admin/announcements', {
        title: announcement.title.trim(),
        message: announcement.message.trim(),
        type: announcement.type,
      });

      const delivered = response.data?.delivered_count || 0;
      toast.success(`Comunicado enviado para ${delivered} usuários.`);
      setAnnouncement(initialAnnouncement);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível enviar o comunicado.');
    } finally {
      setSendingAnnouncement(false);
    }
  };

  const handleStoreFormChange = (event) => {
    const { name, value, type, checked } = event.target;

    setStoreForm((current) => ({
      ...current,
      [name]:
        type === 'checkbox'
          ? checked
          : name === 'sort_order'
            ? Number(value)
            : value,
    }));
  };

  const resetStoreForm = () => {
    setStoreForm(initialStoreForm);
    setEditingStoreId(null);
  };

  const startStoreEdit = (store) => {
    setEditingStoreId(store.id);
    setStoreForm({
      name: store.name || '',
      description: store.description || '',
      image_url: store.image_url || '',
      link_url: store.link_url || '',
      cta_label: store.cta_label || 'Ir ao site',
      sort_order: Number(store.sort_order || 0),
      is_active: Boolean(store.is_active),
    });

    window.requestAnimationFrame(() => {
      storeFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    toast.success(`Editando loja: ${store.name}`);
  };

  const handleStoreSubmit = async (event) => {
    event.preventDefault();

    if (!storeForm.name.trim()) {
      toast.error('Informe o nome da loja recomendada.');
      return;
    }

    setSavingStore(true);

    try {
      const payload = {
        name: storeForm.name.trim(),
        description: storeForm.description.trim(),
        image_url: storeForm.image_url.trim(),
        link_url: storeForm.link_url.trim(),
        cta_label: storeForm.cta_label.trim() || 'Ir ao site',
        sort_order: Number(storeForm.sort_order || 0),
        is_active: Boolean(storeForm.is_active),
      };

      if (editingStoreId) {
        await api.patch(`/admin/recommended-stores/${editingStoreId}`, payload);
        toast.success('Loja recomendada atualizada.');
      } else {
        await api.post('/admin/recommended-stores', payload);
        toast.success('Loja recomendada criada.');
      }

      await loadRecommendedStores();
      resetStoreForm();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível salvar a loja recomendada.');
    } finally {
      setSavingStore(false);
    }
  };

  const handleToggleStoreStatus = async (store) => {
    const nextStatus = !store.is_active;
    const confirmed = await confirm(
      `Confirma ${nextStatus ? 'ativar' : 'desativar'} a loja recomendada ${store.name}?`
    );

    if (!confirmed) {
      return;
    }

    setSavingStore(true);

    try {
      await api.patch(`/admin/recommended-stores/${store.id}`, { is_active: nextStatus });
      toast.success(nextStatus ? 'Loja ativada no carrossel.' : 'Loja removida do carrossel.');
      await loadRecommendedStores();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar o status da loja.');
    } finally {
      setSavingStore(false);
    }
  };

  const handleDeleteStore = async (store) => {
    const confirmed = await confirm(`Tem certeza que deseja excluir a loja recomendada ${store.name}?`);

    if (!confirmed) {
      return;
    }

    setSavingStore(true);

    try {
      await api.delete(`/admin/recommended-stores/${store.id}`);
      toast.success('Loja recomendada removida.');
      await loadRecommendedStores();

      if (editingStoreId === store.id) {
        resetStoreForm();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível excluir a loja recomendada.');
    } finally {
      setSavingStore(false);
    }
  };

  const metrics = overview.metrics || {};
  const totalUsersPages = usersPagination.total_pages || 1;
  const normalizedUsersPage = Math.min(usersPage, totalUsersPages);
  const paginatedUsers = users;

  const totalPaymentsPages = paymentsPagination.total_pages || 1;
  const normalizedPaymentsPage = Math.min(paymentsPage, totalPaymentsPages);
  const paginatedPayments = payments;
  const adminSection = searchParams.get('section') || 'overview';
  const adminSections = [
    { key: 'overview', label: 'Visão geral', detail: 'Métricas e atividade recente' },
    { key: 'requests', label: 'Pedidos', detail: 'Solicitações e interessados' },
    { key: 'users', label: 'Usuários', detail: 'Perfis, permissões e confiança' },
    { key: 'payments', label: 'Pagamentos', detail: 'Cobrança, pendências e status' },
    { key: 'stores', label: 'Lojas recomendadas', detail: 'Carrossel público e vitrine' },
    { key: 'announcements', label: 'Comunicados', detail: 'Mensagens globais da plataforma' },
    { key: 'monitoring', label: 'Monitoramento', detail: 'Erros reais do site e da API' },
  ];
  const activeAdminSection = adminSections.find((item) => item.key === adminSection) || adminSections[0];

  if (loading) {
    return (
      <section className="admin-modern-shell">
        <div className="admin-modern-empty">Carregando painel administrativo...</div>
      </section>
    );
  }

  return (
    <section className="admin-modern-shell">
      <PageIntro
        description="Acompanhe pedidos, usuários, pagamentos e o funcionamento do InstalaPro em um só lugar."
        eyebrow="Administrador"
        stats={[
          {
            label: 'Pedidos abertos',
            value: `${metrics.open_service_requests || 0}`,
            detail: `${metrics.total_service_requests || 0} pedidos no total`,
          },
          {
            label: 'Instaladores públicos',
            value: `${metrics.public_installers || 0}`,
            detail: `${metrics.certified_installers || 0} com certificado verificado`,
          },
          {
            label: 'Receita do mês',
            value: formatCurrency(metrics.monthly_revenue || 0),
            detail: `${metrics.paid_this_month_count || 0} pagamentos confirmados`,
          },
        ]}
        title="Painel administrativo"
      />

      <nav aria-label="Áreas administrativas" className="admin-section-nav fade-up" style={{ animationDelay: '0.05s' }}>
        {adminSections.map((section) => (
          <button
            aria-current={activeAdminSection.key === section.key ? 'page' : undefined}
            aria-label={`${section.label}: ${section.detail}`}
            className={`admin-section-tab ${activeAdminSection.key === section.key ? 'is-active' : ''}`}
            key={section.key}
            onClick={() => setSearchParams({ section: section.key })}
            title={section.detail}
            type="button"
          >
            <span className="admin-section-tab-icon"><AdminPanelIcon type={section.key} /></span>
            <span className="admin-section-tab-label">{section.label}</span>
          </button>
        ))}
      </nav>

      <header className="admin-current-section fade-up" style={{ animationDelay: '0.07s' }}>
        <p>{activeAdminSection.label}</p>
        <span>{activeAdminSection.detail}</span>
      </header>

      <div className="admin-modern-body">
        <section className={`admin-content-section ${['overview', 'requests', 'payments'].includes(activeAdminSection.key) ? 'grid gap-6' : 'hidden'}`}>
          {activeAdminSection.key === 'overview' ? (
          <article className="admin-content-panel lux-panel fade-up p-6">
            <p className="eyebrow">Indicadores da plataforma</p>

            <div className="summary-strip mt-5">
              <article className="summary-strip-item">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Usuários cadastrados</p>
                <p className="metric-value admin-metric-value mt-2">{metrics.total_users || 0}</p>
              </article>

              <article className="summary-strip-item">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Contas de cliente</p>
                <p className="metric-value admin-metric-value mt-2">{metrics.total_clients || 0}</p>
              </article>

              <article className="summary-strip-item">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Pagamentos pendentes</p>
                <p className="metric-value admin-metric-value mt-2">{metrics.pending_payments || 0}</p>
              </article>

              <article className="summary-strip-item">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Certificados verificados</p>
                <p className="metric-value admin-metric-value mt-2">{metrics.certified_installers || 0}</p>
              </article>

              <article className="summary-strip-item">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Suporte aberto</p>
                <p className="metric-value admin-metric-value mt-2">{metrics.support_open_conversations || 0}</p>
              </article>
            </div>
          </article>
          ) : null}

          {activeAdminSection.key === 'overview' ? (
          <article className="admin-content-panel lux-panel fade-up p-6" style={{ animationDelay: '0.06s' }}>
            <p className="eyebrow">Atividade recente</p>

            <div className="admin-activity-grid mt-5 md:grid-cols-3">
              <section className="admin-activity-column">
                <p className="text-sm font-semibold text-[var(--text)]">Novos usuários</p>

                <div className="admin-activity-list mt-3">
                  {(overview.recent_users || []).map((item) => (
                    <div className="admin-activity-entry" key={item.id}>
                      <p className="text-sm text-[var(--text)]">{item.name}</p>
                      <p className="text-xs text-[var(--muted)]">{item.email}</p>
                      <p className="text-xs text-[var(--muted)]">{formatDateTime(item.created_at)}</p>
                    </div>
                  ))}
                  {(overview.recent_users || []).length === 0 ? (
                    <p className="admin-activity-empty">Nenhum cadastro recente.</p>
                  ) : null}
                </div>
              </section>

              <section className="admin-activity-column">
                <p className="text-sm font-semibold text-[var(--text)]">Pagamentos</p>

                <div className="admin-activity-list mt-3">
                  {(overview.recent_payments || []).map((item) => (
                    <div className="admin-activity-entry" key={item.id}>
                      <p className="text-sm text-[var(--text)]">{item.user_name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {formatCurrency(item.amount)} • {formatStatusLabel(item.status)}
                      </p>
                      <p className="text-xs text-[var(--muted)]">{formatDateTime(item.created_at)}</p>
                    </div>
                  ))}
                  {(overview.recent_payments || []).length === 0 ? (
                    <p className="admin-activity-empty">Nenhum pagamento recente.</p>
                  ) : null}
                </div>
              </section>

              <section className="admin-activity-column">
                <p className="text-sm font-semibold text-[var(--text)]">Pedidos de clientes</p>

                <div className="admin-activity-list mt-3">
                  {(overview.recent_service_requests || []).map((item) => (
                    <div className="admin-activity-entry" key={item.id}>
                      <p className="text-sm text-[var(--text)]">
                        #{item.id} • {item.service_label || 'Serviço'}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {item.client_name} • {formatStatusLabel(item.status)}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {[item.city, item.state].filter(Boolean).join(' - ')} • {item.interests_count || 0} interessado(s)
                      </p>
                    </div>
                  ))}
                  {(overview.recent_service_requests || []).length === 0 ? (
                    <p className="admin-activity-empty">Nenhum pedido recente.</p>
                  ) : null}
                </div>
              </section>
            </div>
          </article>
          ) : null}

          {activeAdminSection.key === 'requests' ? (
          <article className="admin-content-panel lux-panel fade-up p-6">
            <p className="eyebrow">Pedidos de clientes</p>

            <form className="admin-filter-bar mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_auto]" onSubmit={handleRequestFilterSubmit}>
              <input
                className="field-input"
                name="q"
                onChange={handleRequestFilterChange}
                placeholder="Buscar cliente, serviço, cidade ou telefone"
                value={requestFilters.q}
              />
              <select className="field-select" name="status" onChange={handleRequestFilterChange} value={requestFilters.status}>
                <option value="all">Todos os status</option>
                <option value="open">Abertos</option>
                <option value="selected">Instalador escolhido</option>
                <option value="closed">Fechados</option>
                <option value="canceled">Cancelados</option>
              </select>
              <button className="ghost-button" type="submit">Filtrar</button>
            </form>

            <div className="mt-5 grid gap-3">
              {loadingRequests ? <div className="empty-state">Atualizando pedidos...</div> : null}
              {!loadingRequests && serviceRequests.length === 0 ? (
                <div className="empty-state">Nenhum pedido encontrado com esse filtro.</div>
              ) : null}
              {!loadingRequests && serviceRequests.length > 0 ? (
                <div className="list-surface">
                  {serviceRequests.map((item) => (
                    <article className="list-row" key={item.id}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 grid gap-3">
                          <div>
                            <p className="font-semibold text-[var(--text)]">#{item.id} • {item.service_label || item.service || 'Serviço'}</p>
                            <p className="text-xs text-[var(--muted)]">{item.client_name} • {item.client_email || item.client_phone}</p>
                            <p className="text-xs text-[var(--muted)]">{formatDateTime(item.created_at)}</p>
                          </div>
                          <div className="admin-data-grid">
                            <p>Região: {[item.neighborhood, item.city, item.state].filter(Boolean).join(' - ') || '-'}</p>
                            <p>Interessados: {item.interests_count || 0}</p>
                            <p>Conta vinculada: {item.account_email || 'Pedido anônimo'}</p>
                            <p>Escolhido: {item.selected_installer_name || 'Ainda não'}</p>
                          </div>
                        </div>
                        <div className="action-cluster grid gap-2 lg:w-48">
                          <span className="status-pill" data-tone={item.status}>{formatStatusLabel(item.status)}</span>
                          {item.status === 'open' ? (
                            <button className="ghost-button !min-h-0 !px-3 !py-2 text-xs" onClick={() => updateServiceRequestStatus(item.id, 'closed')} type="button">
                              Fechar pedido
                            </button>
                          ) : item.status !== 'selected' ? (
                            <button className="ghost-button !min-h-0 !px-3 !py-2 text-xs" onClick={() => updateServiceRequestStatus(item.id, 'open')} type="button">
                              Reabrir pedido
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
              {serviceRequests.length > 0 ? (
                <PaginationControls
                  currentPage={requestsPage}
                  onPageChange={(page) => loadServiceRequests(requestFilters, page)}
                  totalPages={requestsPagination.total_pages || 1}
                />
              ) : null}
            </div>
          </article>
          ) : null}

          {activeAdminSection.key === 'payments' ? (
          <article className="admin-content-panel lux-panel fade-up p-6" style={{ animationDelay: '0.08s' }}>
            <p className="eyebrow">Gestão de pagamentos</p>

            <form className="admin-filter-bar mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_auto]" onSubmit={handlePaymentFilterSubmit}>
              <input
                className="field-input"
                name="q"
                onChange={handlePaymentFilterChange}
                placeholder="Buscar por nome, email ou ID externo"
                value={paymentFilters.q}
              />

              <select
                className="field-select"
                name="status"
                onChange={handlePaymentFilterChange}
                value={paymentFilters.status}
              >
                <option value="all">Todos os status</option>
                <option value="pending">Pendentes</option>
                <option value="paid">Pagos</option>
                <option value="failed">Falhos</option>
                <option value="canceled">Cancelados</option>
              </select>

              <button className="ghost-button" type="submit">
                Filtrar
              </button>
            </form>

            <div className="mt-5 grid gap-3">
              {loadingPayments ? <div className="empty-state">Atualizando pagamentos...</div> : null}

              {!loadingPayments && payments.length === 0 ? (
                <div className="empty-state">Nenhum pagamento encontrado com esse filtro.</div>
              ) : null}

              {!loadingPayments && paginatedPayments.length > 0 ? (
                <div className="list-surface">
                  {paginatedPayments.map((item) => (
                    <article className="list-row" key={item.id}>
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 grid gap-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[var(--text)]">{item.user_name}</p>
                              <p className="truncate text-xs text-[var(--muted)]">{item.user_email}</p>
                              <p className="text-xs text-[var(--muted)]">{formatDateTime(item.created_at)}</p>
                            </div>

                            <span className="status-pill" data-tone={item.status}>
                              {formatStatusLabel(item.status)}
                            </span>
                          </div>

                          <div className="admin-data-grid">
                            <p>Valor: {formatCurrency(item.amount)}</p>
                            <p>Método: {item.method || '-'}</p>
                            <p>Provedor: {item.provider || '-'}</p>
                            <p>ID externo: {item.external_id || '-'}</p>
                          </div>
                        </div>

                        <details className="admin-row-actions lg:w-48">
                          <summary>Alterar status</summary>
                          <div className="action-cluster mt-2 grid gap-2">
                            <button
                              className="gold-button w-full !min-h-0 !px-3 !py-2 text-xs"
                              disabled={savingPaymentId === item.id}
                              onClick={() => confirmPaymentStatus(item.id, 'paid')}
                              type="button"
                            >
                              Marcar pago
                            </button>

                            <button
                              className="ghost-button w-full !min-h-0 !px-3 !py-2 text-xs"
                              disabled={savingPaymentId === item.id}
                              onClick={() => confirmPaymentStatus(item.id, 'pending')}
                              type="button"
                            >
                              Voltar pendente
                            </button>

                            <button
                              className="ghost-button w-full !min-h-0 !px-3 !py-2 text-xs"
                              disabled={savingPaymentId === item.id}
                              onClick={() => confirmPaymentStatus(item.id, 'failed')}
                              type="button"
                            >
                              Marcar falha
                            </button>

                            <button
                              className="danger-button w-full !min-h-0 !px-3 !py-2 text-xs"
                              disabled={savingPaymentId === item.id}
                              onClick={() => confirmPaymentStatus(item.id, 'canceled')}
                              type="button"
                            >
                              Cancelar
                            </button>
                          </div>
                        </details>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

              {payments.length > 0 ? (
                <PaginationControls
                  currentPage={normalizedPaymentsPage}
                  onPageChange={(page) => loadPayments(paymentFilters, page)}
                  totalPages={totalPaymentsPages}
                />
              ) : null}
            </div>
          </article>
          ) : null}
        </section>

        <aside className={`${['users', 'stores', 'announcements', 'monitoring'].includes(activeAdminSection.key) ? 'grid gap-6' : 'hidden'}`}>
          {activeAdminSection.key === 'users' ? (
          <section className="admin-content-panel lux-panel fade-up p-6" style={{ animationDelay: '0.1s' }}>
            <p className="eyebrow">Gestão de usuários</p>

            <form className="admin-filter-bar admin-user-filters mt-5 grid gap-3" onSubmit={handleUserFilterSubmit}>
              <input
                className="field-input"
                name="q"
                onChange={handleUserFilterChange}
                placeholder="Buscar por nome ou email"
                value={userFilters.q}
              />

              <select
                className="field-select"
                name="status"
                onChange={handleUserFilterChange}
                value={userFilters.status}
              >
                <option value="all">Todos os status</option>
                <option value="active">Assinatura ativa</option>
                <option value="inactive">Assinatura inativa</option>
                <option value="canceled">Assinatura cancelada</option>
              </select>

              <select
                className="field-select"
                name="account_type"
                onChange={handleUserFilterChange}
                value={userFilters.account_type}
              >
                <option value="all">Todos os tipos de conta</option>
                <option value="installer">Instaladores</option>
                <option value="client">Clientes</option>
              </select>

              <button className="ghost-button w-full" type="submit">
                Aplicar filtros
              </button>
            </form>

            <div className="mt-5 grid gap-3">
              {loadingUsers ? <div className="empty-state">Atualizando usuários...</div> : null}

              {!loadingUsers && users.length === 0 ? (
                <div className="empty-state">Nenhum usuário encontrado com esse filtro.</div>
              ) : null}

              {!loadingUsers && paginatedUsers.length > 0 ? (
                <div className="list-surface">
                  {paginatedUsers.map((item) => (
                    <article className="list-row" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--text)]">{item.name}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{item.email}</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                      {item.account_type === 'client' ? 'Cliente' : 'Instalador'}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">Criado em {formatShortDate(item.created_at)}</p>
                    {item.deleted_at ? <p className="mt-1 text-xs font-semibold text-[var(--danger)]">Arquivado em {formatShortDate(item.deleted_at)}</p> : null}
                  </div>

                    <span className="status-pill" data-tone={item.subscription_status}>
                      {formatStatusLabel(item.subscription_status)}
                    </span>
                  </div>

                  <div className="admin-data-grid mt-3">
                    <p>Orçamentos: {item.budgets_count} · {item.approved_count} aprovados</p>
                    <p>Vitrine: {item.public_profile ? 'Perfil público' : 'Perfil oculto'}</p>
                    <p>Certificado: {item.certification_verified ? 'Verificado' : item.has_certificate ? 'Aguardando análise' : 'Não enviado'}</p>
                    <p>Acesso: {item.is_admin ? 'Administrador' : 'Usuário comum'}</p>
                  </div>

                  <details className="admin-row-actions mt-4">
                    <summary>Gerenciar usuário</summary>
                    <div className="action-cluster mt-3 grid gap-2 sm:grid-cols-2">
                    {item.account_type === 'installer' && item.has_certificate ? (
                      <button
                        className="ghost-button w-full !min-h-0 !px-3 !py-2 text-xs"
                        onClick={() => openInstallerCertificate(item)}
                        type="button"
                      >
                        Abrir certificado
                      </button>
                    ) : null}
                    {item.account_type === 'installer' ? <button
                      className="ghost-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingUserId === item.id || Boolean(item.deleted_at)}
                      onClick={() => confirmPublicProfileAction(item)}
                      type="button"
                    >
                      {item.public_profile ? 'Ocultar vitrine' : 'Mostrar na vitrine'}
                    </button> : null}

                    {item.account_type === 'installer' ? <button
                      className="gold-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingUserId === item.id || Boolean(item.deleted_at)}
                      onClick={() => confirmSubscriptionAction(item)}
                      type="button"
                    >
                      {item.subscription_status === 'active' ? 'Suspender assinatura' : 'Ativar assinatura'}
                    </button> : null}

                    {item.account_type === 'installer' ? <button
                      className="ghost-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingUserId === item.id || Boolean(item.deleted_at)}
                      onClick={() => confirmFeaturedInstallerAction(item)}
                      type="button"
                    >
                      {item.featured_installer ? 'Remover destaque' : 'Destacar instalador'}
                    </button> : null}

                    {item.account_type === 'installer' ? <button
                      className="ghost-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingUserId === item.id || Boolean(item.deleted_at) || (!item.has_certificate && !item.certification_verified)}
                      onClick={() => confirmCertificationAction(item)}
                      type="button"
                    >
                      {item.certification_verified ? 'Remover selo certificado' : 'Validar certificado'}
                    </button> : null}

                    <button
                      className="ghost-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingUserId === item.id || Boolean(item.deleted_at)}
                      onClick={() => confirmAdminRoleAction(item)}
                      type="button"
                    >
                      {item.is_admin ? 'Remover admin' : 'Tornar admin'}
                    </button>

                    {item.deleted_at ? (
                      <button
                        className="gold-button w-full !min-h-0 !px-3 !py-2 text-xs"
                        disabled={savingUserId === item.id}
                        onClick={() => restoreUser(item)}
                        type="button"
                      >
                        Restaurar usuário
                      </button>
                    ) : (
                      <button
                        className="danger-button w-full !min-h-0 !px-3 !py-2 text-xs"
                        disabled={savingUserId === item.id}
                        onClick={() => deleteUser(item)}
                        type="button"
                      >
                        Arquivar usuário
                      </button>
                    )}
                    </div>
                  </details>
                    </article>
                  ))}
                </div>
              ) : null}

              {users.length > 0 ? (
                <PaginationControls
                  currentPage={normalizedUsersPage}
                  onPageChange={(page) => loadUsers(userFilters, page)}
                  totalPages={totalUsersPages}
                />
              ) : null}
            </div>
          </section>
          ) : null}

          {activeAdminSection.key === 'stores' ? (
          <section className="admin-content-panel admin-store-panel lux-panel fade-up p-6" style={{ animationDelay: '0.12s' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="eyebrow">Lojas recomendadas</p>
              {editingStoreId ? (
                <button className="ghost-button !min-h-0 !px-3 !py-2 text-xs" onClick={resetStoreForm} type="button">
                  Cancelar edição
                </button>
              ) : null}
            </div>

            <form className="admin-form-surface mt-5 grid gap-3" onSubmit={handleStoreSubmit} ref={storeFormRef}>
              <input
                autoFocus={Boolean(editingStoreId)}
                className="field-input"
                name="name"
                onChange={handleStoreFormChange}
                placeholder="Nome da loja"
                value={storeForm.name}
              />

              <textarea
                className="field-textarea"
                name="description"
                onChange={handleStoreFormChange}
                placeholder="Descrição curta para aparecer no carrossel"
                rows={3}
                value={storeForm.description}
              />

              <input
                className="field-input"
                name="image_url"
                onChange={handleStoreFormChange}
                placeholder="URL da imagem"
                value={storeForm.image_url}
              />

              <input
                className="field-input"
                name="link_url"
                onChange={handleStoreFormChange}
                placeholder="URL de destino da loja"
                value={storeForm.link_url}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="field-input"
                  name="cta_label"
                  onChange={handleStoreFormChange}
                  placeholder="Texto do botão (ex: Visitar loja)"
                  value={storeForm.cta_label}
                />

                <input
                  className="field-input"
                  min={-99}
                  name="sort_order"
                  onChange={handleStoreFormChange}
                  placeholder="Ordem de exibição"
                  type="number"
                  value={storeForm.sort_order}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <input
                  checked={storeForm.is_active}
                  name="is_active"
                  onChange={handleStoreFormChange}
                  type="checkbox"
                />
                Mostrar no carrossel público
              </label>

              <button className="gold-button w-full" disabled={savingStore} type="submit">
                {savingStore
                  ? 'Salvando...'
                  : editingStoreId
                    ? 'Atualizar loja recomendada'
                    : 'Adicionar loja recomendada'}
              </button>
            </form>

            <div className="mt-5 grid gap-3">
              {loadingStores ? <div className="empty-state">Carregando lojas recomendadas...</div> : null}

              {!loadingStores && recommendedStores.length === 0 ? (
                <div className="empty-state">Nenhuma loja recomendada cadastrada ainda.</div>
              ) : null}

              {!loadingStores && recommendedStores.length > 0 ? (
                <div className="list-surface admin-store-surface">
                  {recommendedStores.map((store) => (
                    <article
                      className={`admin-store-card list-row admin-store-row ${
                    editingStoreId === store.id ? 'admin-store-card-editing' : ''
                      }`}
                      key={store.id}
                    >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text)]">{store.name}</p>
                      <p className="text-xs text-[var(--muted)]">Ordem: {store.sort_order}</p>
                    </div>

                    <span className="status-pill" data-tone={store.is_active ? 'paid' : 'canceled'}>
                      {store.is_active ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>

                  {editingStoreId === store.id ? (
                    <p className="admin-store-editing-note mt-2">Modo edição ativo</p>
                  ) : null}

                  {store.image_url ? (
                    <div className="admin-store-preview mt-3">
                      <img alt={`Preview da loja ${store.name}`} loading="lazy" src={store.image_url} />
                    </div>
                  ) : null}

                  {store.description ? (
                    <p className="admin-store-description mt-3 text-sm text-[var(--muted)]">{store.description}</p>
                  ) : null}

                  <div className="admin-store-meta mt-3 grid gap-1 text-xs text-[var(--muted)]">
                    <p>Imagem: {store.image_url || '-'}</p>
                    <p>Link: {store.link_url || '-'}</p>
                    <p>CTA: {store.cta_label || 'Ir ao site'}</p>
                  </div>

                  <div className="admin-store-actions mt-4 grid gap-2 sm:grid-cols-3">
                    <button
                      className="ghost-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingStore}
                      onClick={() => startStoreEdit(store)}
                      type="button"
                    >
                      Editar
                    </button>

                    <button
                      className="ghost-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingStore}
                      onClick={() => handleToggleStoreStatus(store)}
                      type="button"
                    >
                      {store.is_active ? 'Desativar' : 'Ativar'}
                    </button>

                    <button
                      className="danger-button w-full !min-h-0 !px-3 !py-2 text-xs"
                      disabled={savingStore}
                      onClick={() => handleDeleteStore(store)}
                      type="button"
                    >
                      Excluir
                    </button>
                  </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
          ) : null}

          {activeAdminSection.key === 'announcements' ? (
          <section className="admin-content-panel admin-announcement-panel lux-panel fade-up p-6" style={{ animationDelay: '0.14s' }}>
            <p className="eyebrow">Comunicado global</p>

            <form className="admin-form-surface mt-5 grid gap-3" onSubmit={handleAnnouncementSubmit}>
              <input
                className="field-input"
                name="title"
                onChange={handleAnnouncementChange}
                placeholder="Título do comunicado"
                value={announcement.title}
              />

              <select
                className="field-select"
                name="type"
                onChange={handleAnnouncementChange}
                value={announcement.type}
              >
                <option value="info">Informação</option>
                <option value="success">Sucesso</option>
                <option value="warning">Aviso</option>
              </select>

              <textarea
                className="field-textarea"
                name="message"
                onChange={handleAnnouncementChange}
                placeholder="Mensagem que será enviada para todos os usuários"
                rows={4}
                value={announcement.message}
              />

              <button className="gold-button w-full" disabled={sendingAnnouncement} type="submit">
                {sendingAnnouncement ? 'Enviando...' : 'Enviar para todos'}
              </button>
            </form>
          </section>
          ) : null}

          {activeAdminSection.key === 'monitoring' ? (
          <section className="admin-content-panel lux-panel fade-up p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Erros não resolvidos</p>
                <p className="mt-2 text-sm text-[var(--muted)]">Falhas do navegador e da API aparecem aqui sem senhas, tokens ou dados de contato.</p>
              </div>
              <button className="ghost-button !min-h-0 !px-3 !py-2 text-xs" onClick={loadApplicationErrors} type="button">
                Atualizar
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {applicationErrors.length === 0 ? <div className="empty-state">Nenhum erro pendente.</div> : null}
              {applicationErrors.map((item) => (
                <article className="list-row" key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text)]">{item.message}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {item.source} · {item.method || 'CLIENT'} {item.route || ''} · {formatDateTime(item.created_at)}
                      </p>
                    </div>
                    <span className="status-pill" data-tone="failed">{item.status_code || 'JS'}</span>
                  </div>
                  <button className="ghost-button mt-4 !min-h-0 !px-3 !py-2 text-xs" onClick={() => resolveApplicationError(item.id)} type="button">
                    Marcar como resolvido
                  </button>
                </article>
              ))}
            </div>
          </section>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
