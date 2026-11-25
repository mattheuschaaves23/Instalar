import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';
import { formatStatusLabel } from '../../utils/formatters';
import { AdminHeading, getAdminSection } from './AdminWorkspace';
import {
  AdminAdvertising, AdminAnnouncements, AdminMonitoring, AdminOverview, AdminPayments, AdminRequests, AdminUsers, AdminVerifications,
} from './AdminViews';

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

const initialDashboardAdForm = {
  title: '',
  description: '',
  media_type: 'image',
  media_url: '',
  link_url: '',
  cta_label: 'Conhecer',
  sort_order: 0,
  is_active: true,
};

const USERS_PER_PAGE = 6;
const PAYMENTS_PER_PAGE = 6;
const REQUESTS_PER_PAGE = 8;
const initialUserFilters = { q: '', status: 'all', account_type: 'all' };
const initialPaymentFilters = { q: '', status: 'all', period: 'all' };
const initialRequestFilters = { q: '', status: 'all', origin: 'all' };
const initialPagination = { page: 1, limit: 1, total: 0, total_pages: 1 };

export default function AdminDashboard() {
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const section = getAdminSection(searchParams);
  const adTab = searchParams.get('tab') === 'ads' ? 'ads' : 'stores';
  const pendingPaymentShortcut = section === 'payments' && searchParams.get('status') === 'pending';
  const [failures, setFailures] = useState({});
  const [verificationStatus, setVerificationStatus] = useState('pending');
  const [verificationSearch, setVerificationSearch] = useState('');
  const [verificationRows, setVerificationRows] = useState({});
  const [loadingVerifications, setLoadingVerifications] = useState({});
  const [loadingErrors, setLoadingErrors] = useState(true);
  const [errorsUpdatedAt, setErrorsUpdatedAt] = useState(null);
  const [resolvingErrorId, setResolvingErrorId] = useState(null);
  const [savingRequestId, setSavingRequestId] = useState(null);
  const rejectionResolveRef = useRef(null);
  const [rejecting, setRejecting] = useState(null);
  const [overview, setOverview] = useState(initialOverview);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [recommendedStores, setRecommendedStores] = useState([]);
  const [dashboardAds, setDashboardAds] = useState([]);
  const [applicationErrors, setApplicationErrors] = useState([]);
  const [userFilters, setUserFilters] = useState(initialUserFilters);
  const [paymentFilters, setPaymentFilters] = useState(initialPaymentFilters);
  const [requestFilters, setRequestFilters] = useState(initialRequestFilters);
  const [announcement, setAnnouncement] = useState(initialAnnouncement);
  const [storeForm, setStoreForm] = useState(initialStoreForm);
  const [dashboardAdForm, setDashboardAdForm] = useState(initialDashboardAdForm);
  const [editingStoreId, setEditingStoreId] = useState(null);
  const [editingDashboardAdId, setEditingDashboardAdId] = useState(null);
  const [storeMode, setStoreMode] = useState(null);
  const [adMode, setAdMode] = useState(null);
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
  const [loadingDashboardAds, setLoadingDashboardAds] = useState(false);
  const [savingDashboardAd, setSavingDashboardAd] = useState(false);

  const fetchAdmin = useCallback(async (key, endpoint, config) => {
    try {
      const response = await api.get(endpoint, config);
      setFailures((current) => current[key] ? { ...current, [key]: '' } : current);
      return response;
    } catch (error) {
      setFailures((current) => ({ ...current, [key]: error.response?.data?.error || 'Não foi possível carregar. Tente novamente.' }));
      throw error;
    }
  }, []);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchAdmin('overview', '/admin/overview');
      setOverview(response.data || initialOverview);
    } finally {
      setLoading(false);
    }
  }, [fetchAdmin]);

  const loadUsers = useCallback(async (nextFilters = initialUserFilters, page = 1) => {
    setLoadingUsers(true);

    try {
      const response = await fetchAdmin('users', '/admin/users', {
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
      setUsersPage(Math.min(page, response.data?.pagination?.total_pages || 1));
    } finally {
      setLoadingUsers(false);
    }
  }, [fetchAdmin]);

  const loadVerifications = useCallback(async (status = 'pending') => {
    setLoadingVerifications((current) => ({ ...current, [status]: true }));
    try {
      const response = await fetchAdmin(`verifications-${status}`, '/admin/installer-verifications', {
        params: { status, limit: 50 },
      });
      setVerificationRows((current) => ({ ...current, [status]: response.data?.verifications || [] }));
    } finally {
      setLoadingVerifications((current) => ({ ...current, [status]: false }));
    }
  }, [fetchAdmin]);

  const loadPayments = useCallback(async (nextFilters = initialPaymentFilters, page = 1) => {
    setLoadingPayments(true);

    try {
      const response = await fetchAdmin('payments', '/admin/payments', {
        params: {
          q: nextFilters.q,
          status: nextFilters.status,
          period: nextFilters.period,
          page,
          limit: PAYMENTS_PER_PAGE,
        },
      });

      setPayments(response.data?.payments || []);
      setPaymentsPagination(response.data?.pagination || initialPagination);
      setPaymentsPage(Math.min(page, response.data?.pagination?.total_pages || 1));
    } finally {
      setLoadingPayments(false);
    }
  }, [fetchAdmin]);

  const loadRecommendedStores = useCallback(async () => {
    setLoadingStores(true);

    try {
      const response = await fetchAdmin('stores', '/admin/recommended-stores');
      setRecommendedStores(response.data?.stores || []);
    } finally {
      setLoadingStores(false);
    }
  }, [fetchAdmin]);

  const loadDashboardAds = useCallback(async () => {
    setLoadingDashboardAds(true);

    try {
      const response = await fetchAdmin('ads', '/admin/dashboard-ads');
      setDashboardAds(response.data?.ads || []);
    } finally {
      setLoadingDashboardAds(false);
    }
  }, [fetchAdmin]);

  const loadServiceRequests = useCallback(async (nextFilters = initialRequestFilters, page = 1) => {
    setLoadingRequests(true);
    try {
      const response = await fetchAdmin('requests', '/admin/service-requests', {
        params: { ...nextFilters, page, limit: REQUESTS_PER_PAGE },
      });
      setServiceRequests(response.data?.requests || []);
      setRequestsPagination(response.data?.pagination || initialPagination);
      setRequestsPage(Math.min(page, response.data?.pagination?.total_pages || 1));
    } finally {
      setLoadingRequests(false);
    }
  }, [fetchAdmin]);

  const loadApplicationErrors = useCallback(async () => {
    setLoadingErrors(true);
    try {
      const response = await fetchAdmin('monitoring', '/admin/system/errors', { params: { limit: 30 } });
      setApplicationErrors(response.data?.errors || []);
      setErrorsUpdatedAt(new Date());
    } finally {
      setLoadingErrors(false);
    }
  }, [fetchAdmin]);

  useEffect(() => {
    void Promise.allSettled([loadOverview(), loadUsers(), loadVerifications(), loadServiceRequests(), loadRecommendedStores(), loadDashboardAds(), loadApplicationErrors()]);
  }, [loadApplicationErrors, loadDashboardAds, loadOverview, loadRecommendedStores, loadServiceRequests, loadUsers, loadVerifications]);

  useEffect(() => {
    const filters = { ...initialPaymentFilters, status: pendingPaymentShortcut ? 'pending' : 'all' };
    setPaymentFilters(filters);
    void loadPayments(filters).catch(() => {});
  }, [loadPayments, pendingPaymentShortcut]);

  useEffect(() => () => {
    rejectionResolveRef.current?.('');
    rejectionResolveRef.current = null;
  }, []);

  const finishRejection = (value) => {
    const close = rejectionResolveRef.current;
    rejectionResolveRef.current = null;
    setRejecting(null);
    close?.(value);
  };

  const resolveApplicationError = async (errorId) => {
    setResolvingErrorId(errorId);
    try {
      await api.patch(`/admin/system/errors/${errorId}/resolve`);
      setApplicationErrors((current) => current.filter((item) => item.id !== errorId));
      toast.success('Erro marcado como resolvido.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar o erro.');
    } finally {
      setResolvingErrorId(null);
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
      await Promise.all([loadUsers(userFilters, usersPage), loadOverview()]);
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
      await Promise.all([loadUsers(userFilters, usersPage), loadOverview()]);
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
      await Promise.all([loadUsers(userFilters, usersPage), loadOverview()]);
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
      await Promise.all([loadUsers(userFilters, usersPage), loadOverview()]);
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

  const updateServiceRequestStatus = async (item, status) => {
    const action = status === 'open' ? 'reabrir' : 'fechar';
    if (!(await confirm(`Confirma ${action} o pedido #${item.id}?`))) return;
    const requestId = item.id;
    setSavingRequestId(requestId);
    try {
      await api.patch(`/admin/service-requests/${requestId}/status`, { status });
      toast.success('Status do pedido atualizado.');
      await Promise.all([loadServiceRequests(requestFilters, requestsPage), loadOverview()]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar o pedido.');
    } finally {
      setSavingRequestId(null);
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
    const actionLabel = nextStatus === 'active' ? 'ativar o plano Pro' : 'voltar para o plano Grátis';
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

  const confirmCertificationAction = async (targetUser, { publish = false } = {}) => {
    const nextVerified = !targetUser.certification_verified;

    if (nextVerified && !targetUser.has_certificate) {
      toast.error('Este instalador ainda não enviou certificado.');
      return;
    }

    const actionLabel = nextVerified ? (publish ? 'validar o certificado e publicar o perfil' : 'validar o certificado deste instalador') : 'remover a validação do certificado';
    const confirmed = await confirm(`Confirma ${actionLabel} para ${targetUser.name}?`);

    if (!confirmed) {
      return;
    }

    if (!nextVerified) {
      await updateTrust(targetUser.id, { certification_verified: false });
      return;
    }

    setSavingUserId(targetUser.id);
    try {
      await api.post(`/admin/installer-verifications/${targetUser.id}/decision`, { decision: 'approve', publish });
      toast.success(publish ? 'Certificado aprovado e perfil publicado na vitrine.' : 'Certificado aprovado.');
      await Promise.all([loadUsers(userFilters, usersPage), loadVerifications(), loadOverview()]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível aprovar o certificado.');
    } finally {
      setSavingUserId(null);
    }
  };

  const rejectCertificationAction = async (targetUser) => {
    if (!targetUser.has_certificate) return;
    if (rejectionResolveRef.current) return;
    const reason = await new Promise((resolve) => {
      rejectionResolveRef.current = resolve;
      setRejecting(targetUser);
    });
    if (!reason?.trim()) return;
    setSavingUserId(targetUser.id);
    try {
      await api.post(`/admin/installer-verifications/${targetUser.id}/decision`, { decision: 'reject', reason: reason.trim() });
      toast.success('Certificado recusado e instalador avisado.');
      await Promise.all([loadUsers(userFilters, usersPage), loadVerifications(), loadOverview()]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível recusar o certificado.');
    } finally {
      setSavingUserId(null);
    }
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
      await Promise.all([loadUsers(userFilters, usersPage), loadOverview(), loadPayments(paymentFilters, paymentsPage)]);
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
      await Promise.all([loadUsers(userFilters, usersPage), loadOverview()]);
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
      await Promise.all([loadPayments(paymentFilters, paymentsPage), loadOverview(), loadUsers(userFilters, usersPage)]);
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

    const payload = { title: announcement.title.trim(), message: announcement.message.trim(), type: announcement.type };
    if (!(await confirm({
      title: 'Revisar comunicado',
      message: `“${payload.title}” será enviado para todos os usuários. Confirma o envio?`,
      confirmText: 'Enviar para todos',
    }))) return;

    setSendingAnnouncement(true);
    try {
      const response = await api.post('/admin/announcements', payload);

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
    setStoreMode(null);
  };

  const startStoreEdit = (store) => {
    setEditingStoreId(store.id);
    setStoreMode('edit');
    setStoreForm({
      name: store.name || '',
      description: store.description || '',
      image_url: store.image_url || '',
      link_url: store.link_url || '',
      cta_label: store.cta_label || 'Ir ao site',
      sort_order: Number(store.sort_order || 0),
      is_active: Boolean(store.is_active),
    });

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

  const handleDashboardAdFormChange = (event) => {
    const { name, value, type, checked } = event.target;

    setDashboardAdForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : name === 'sort_order' ? Number(value) : value,
    }));
  };

  const resetDashboardAdForm = () => {
    setDashboardAdForm(initialDashboardAdForm);
    setEditingDashboardAdId(null);
    setAdMode(null);
  };

  const startDashboardAdEdit = (ad) => {
    setEditingDashboardAdId(ad.id);
    setAdMode('edit');
    setDashboardAdForm({
      title: ad.title || '',
      description: ad.description || '',
      media_type: ad.media_type || 'image',
      media_url: ad.media_url || '',
      link_url: ad.link_url || '',
      cta_label: ad.cta_label || 'Conhecer',
      sort_order: Number(ad.sort_order || 0),
      is_active: Boolean(ad.is_active),
    });

  };

  const handleDashboardAdSubmit = async (event) => {
    event.preventDefault();

    if (!dashboardAdForm.title.trim()) {
      toast.error('Informe o título da propaganda.');
      return;
    }

    if (dashboardAdForm.media_type !== 'text' && !dashboardAdForm.media_url.trim()) {
      toast.error('Informe a URL da imagem ou do vídeo.');
      return;
    }

    setSavingDashboardAd(true);

    try {
      const payload = {
        title: dashboardAdForm.title.trim(),
        description: dashboardAdForm.description.trim(),
        media_type: dashboardAdForm.media_type,
        media_url: dashboardAdForm.media_url.trim(),
        link_url: dashboardAdForm.link_url.trim(),
        cta_label: dashboardAdForm.cta_label.trim() || 'Conhecer',
        sort_order: Number(dashboardAdForm.sort_order || 0),
        is_active: Boolean(dashboardAdForm.is_active),
      };

      if (editingDashboardAdId) {
        await api.patch(`/admin/dashboard-ads/${editingDashboardAdId}`, payload);
        toast.success('Propaganda atualizada.');
      } else {
        await api.post('/admin/dashboard-ads', payload);
        toast.success('Propaganda criada.');
      }

      await loadDashboardAds();
      resetDashboardAdForm();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível salvar a propaganda.');
    } finally {
      setSavingDashboardAd(false);
    }
  };

  const handleToggleDashboardAdStatus = async (ad) => {
    const nextStatus = !ad.is_active;
    const confirmed = await confirm(
      `Confirma ${nextStatus ? 'ativar' : 'desativar'} a propaganda ${ad.title}?`
    );

    if (!confirmed) {
      return;
    }

    setSavingDashboardAd(true);

    try {
      await api.patch(`/admin/dashboard-ads/${ad.id}`, { is_active: nextStatus });
      toast.success(nextStatus ? 'Propaganda ativada no dashboard.' : 'Propaganda removida do dashboard.');
      await loadDashboardAds();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar a propaganda.');
    } finally {
      setSavingDashboardAd(false);
    }
  };

  const handleDeleteDashboardAd = async (ad) => {
    const confirmed = await confirm(`Tem certeza que deseja excluir a propaganda ${ad.title}?`);

    if (!confirmed) {
      return;
    }

    setSavingDashboardAd(true);

    try {
      await api.delete(`/admin/dashboard-ads/${ad.id}`);
      toast.success('Propaganda removida.');
      await loadDashboardAds();

      if (editingDashboardAdId === ad.id) {
        resetDashboardAdForm();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível excluir a propaganda.');
    } finally {
      setSavingDashboardAd(false);
    }
  };

  const retry = (action) => (...args) => { void action(...args).catch(() => {}); };
  const pending = verificationRows.pending || [];
  const store = {
    items: recommendedStores, loading: loadingStores, error: failures.stores, retry: retry(loadRecommendedStores),
    saving: savingStore, mode: storeMode, startNew: () => { resetStoreForm(); setStoreMode('new'); },
    startEdit: startStoreEdit, closeEditor: resetStoreForm, values: storeForm, onChange: handleStoreFormChange,
    submit: handleStoreSubmit, toggle: handleToggleStoreStatus, remove: handleDeleteStore,
  };
  const ad = {
    items: dashboardAds, loading: loadingDashboardAds, error: failures.ads, retry: retry(loadDashboardAds),
    saving: savingDashboardAd, mode: adMode, startNew: () => { resetDashboardAdForm(); setAdMode('new'); },
    startEdit: startDashboardAdEdit, closeEditor: resetDashboardAdForm, values: dashboardAdForm, onChange: handleDashboardAdFormChange,
    submit: handleDashboardAdSubmit, toggle: handleToggleDashboardAdStatus, remove: handleDeleteDashboardAd,
  };
  const changeAdTab = (tab) => {
    if (savingStore || savingDashboardAd) return;
    setSearchParams({ section: 'advertising', ...(tab === 'ads' ? { tab } : {}) });
  };

  return <section className="ip-admin-page">
    <AdminHeading section={section} />
    {section === 'overview' ? <AdminOverview overview={overview} pending={pending} errors={applicationErrors}
      failures={{ ...failures, verifications: failures['verifications-pending'] }}
      loading={loading} onRetry={retry(loadOverview)} /> : null}
    {section === 'requests' ? <AdminRequests items={serviceRequests} loading={loadingRequests} error={failures.requests}
      onRetry={() => retry(loadServiceRequests)(requestFilters, requestsPage)} onPage={(page) => retry(loadServiceRequests)(requestFilters, page)}
      page={requestsPage} pagination={requestsPagination} filters={requestFilters} onChange={handleRequestFilterChange}
      onSubmit={handleRequestFilterSubmit} onStatus={updateServiceRequestStatus} busyId={savingRequestId} /> : null}
    {section === 'verifications' ? <AdminVerifications items={verificationRows[verificationStatus] || []}
      loading={loadingVerifications[verificationStatus]} error={failures['verifications-' + verificationStatus]}
      onRetry={() => retry(loadVerifications)(verificationStatus)} status={verificationStatus}
      onStatus={(status) => { setVerificationStatus(status); setVerificationSearch(''); retry(loadVerifications)(status); }}
      search={verificationSearch} onSearch={setVerificationSearch} savingId={savingUserId} pendingCount={pending.length}
      onApprove={(item, options) => confirmCertificationAction({ ...item, has_certificate: Boolean(item.certificate_file) }, options)}
      onReject={(item) => rejectCertificationAction({ ...item, has_certificate: Boolean(item.certificate_file) })} /> : null}
    {section === 'users' ? <AdminUsers items={users} loading={loadingUsers} error={failures.users}
      onRetry={() => retry(loadUsers)(userFilters, usersPage)} onPage={(page) => retry(loadUsers)(userFilters, page)}
      page={usersPage} pagination={usersPagination} filters={userFilters} onChange={handleUserFilterChange}
      onSubmit={handleUserFilterSubmit} savingId={savingUserId} actions={{
        profile: confirmPublicProfileAction, plan: confirmSubscriptionAction, feature: confirmFeaturedInstallerAction,
        certify: confirmCertificationAction, reject: rejectCertificationAction, role: confirmAdminRoleAction, restore: restoreUser, archive: deleteUser,
      }} /> : null}
    {section === 'payments' ? <AdminPayments items={payments} loading={loadingPayments} error={failures.payments}
      onRetry={() => retry(loadPayments)(paymentFilters, paymentsPage)} onPage={(page) => retry(loadPayments)(paymentFilters, page)}
      page={paymentsPage} pagination={paymentsPagination} filters={paymentFilters} onChange={handlePaymentFilterChange}
      onSubmit={handlePaymentFilterSubmit} onStatus={confirmPaymentStatus} savingId={savingPaymentId} metrics={overview.metrics || {}} /> : null}
    {section === 'advertising' ? <AdminAdvertising key={adTab} tab={adTab} changeTab={changeAdTab} store={store} ad={ad} /> : null}
    {section === 'announcements' ? <AdminAnnouncements values={announcement} onChange={handleAnnouncementChange}
      onSubmit={handleAnnouncementSubmit} sending={sendingAnnouncement} /> : null}
    {section === 'monitoring' ? <AdminMonitoring items={applicationErrors} loading={loadingErrors} error={failures.monitoring}
      refresh={retry(loadApplicationErrors)} updated={errorsUpdatedAt} resolve={resolveApplicationError} resolvingId={resolvingErrorId} /> : null}
    {rejecting ? <RejectionDialog target={rejecting} finish={finishRejection} /> : null}
  </section>;
}

function RejectionDialog({ target, finish }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal?.();
    return () => dialog?.close?.();
  }, []);
  return <dialog className="ip-admin-dialog" ref={dialogRef} aria-labelledby="admin-rejection-title"
    onCancel={(event) => { event.preventDefault(); finish(''); }}>
    <form className="ip-admin-form" onSubmit={(event) => {
      event.preventDefault();
      const reason = new FormData(event.currentTarget).get('reason')?.trim();
      if (reason) finish(reason);
    }}>
      <h2 id="admin-rejection-title">Recusar certificado</h2>
      <p>Explique o motivo da recusa para {target.name}.</p>
      <label className="ip-admin-field">Motivo da recusa<textarea name="reason" rows={4} required minLength={8} maxLength={1000} /></label>
      <div className="ip-admin-actions">
        <button className="ip-admin-btn" type="button" onClick={() => finish('')}>Cancelar</button>
        <button className="ip-admin-btn is-danger" type="submit">Confirmar recusa</button>
      </div>
    </form>
  </dialog>;
}
