import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { formatDateTime, formatStatusLabel } from '../../utils/formatters';
import PageIntro from '../Layout/PageIntro';

const IDEA_CATEGORY_LABEL = {
  feature: 'Nova funcionalidade',
  ux: 'Design e usabilidade',
  performance: 'Desempenho',
  payments: 'Pagamentos',
  security: 'Segurança',
  automation: 'Automação',
  other: 'Outros',
};

const IDEA_STATUS_LABEL = {
  new: 'Nova',
  reviewing: 'Em análise',
  planned: 'Planejada',
  done: 'Concluída',
  rejected: 'Não aprovada',
};

function sortConversations(list) {
  return [...list].sort((a, b) => {
    const aDate = new Date(a.last_message_at || a.updated_at || a.created_at || 0).getTime();
    const bDate = new Date(b.last_message_at || b.updated_at || b.created_at || 0).getTime();
    return bDate - aDate;
  });
}

function upsertConversation(list, conversation) {
  if (!conversation?.id) {
    return list;
  }
  const next = list.some((item) => item.id === conversation.id)
    ? list.map((item) => (item.id === conversation.id ? { ...item, ...conversation } : item))
    : [conversation, ...list];
  return sortConversations(next);
}

function upsertMessage(list, message) {
  if (!message?.id || list.some((item) => item.id === message.id)) {
    return list;
  }
  return [...list, message].sort((a, b) => {
    const aDate = new Date(a.created_at || 0).getTime();
    const bDate = new Date(b.created_at || 0).getTime();
    if (aDate === bDate) {
      return Number(a.id || 0) - Number(b.id || 0);
    }
    return aDate - bDate;
  });
}

function sortIdeas(list) {
  return [...list].sort((a, b) => {
    const aDate = new Date(a.created_at || a.updated_at || 0).getTime();
    const bDate = new Date(b.created_at || b.updated_at || 0).getTime();
    return bDate - aDate;
  });
}

function upsertIdea(list, idea) {
  if (!idea?.id) {
    return list;
  }
  const next = list.some((item) => item.id === idea.id)
    ? list.map((item) => (item.id === idea.id ? { ...item, ...idea } : item))
    : [idea, ...list];
  return sortIdeas(next);
}

function ideaTone(status) {
  if (status === 'done') return 'success';
  if (status === 'rejected') return 'rejected';
  if (status === 'planned') return 'info';
  return 'pending';
}

export default function SupportChat() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const isAdmin = Boolean(user?.is_admin);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [sendingIdea, setSendingIdea] = useState(false);
  const [draft, setDraft] = useState('');
  const [conversation, setConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [ideaForm, setIdeaForm] = useState({ title: '', category: 'feature', description: '' });
  const [ideaFilter, setIdeaFilter] = useState('all');
  const [ideaSearch, setIdeaSearch] = useState('');
  const [savingIdeaId, setSavingIdeaId] = useState(null);
  const lastSeenMessageIdRef = useRef(0);
  const pollTickRef = useRef(0);
  const messagesEndRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);

  const unreadTotal = conversations.reduce((total, item) => total + Number(item.unread_count || 0), 0);
  const openConversations = conversations.filter((item) => item.status === 'open').length;
  const pendingIdeas = useMemo(
    () => ideas.filter((item) => ['new', 'reviewing'].includes(item.status)).length,
    [ideas]
  );
  const canSend = Boolean(selectedConversationId);

  async function fetchAdminIdeas(params = {}) {
    const response = await api.get('/support/admin/ideas', {
      params: {
        limit: 180,
        status: params.status ?? ideaFilter,
        q: params.q ?? ideaSearch.trim(),
      },
    });
    return sortIdeas(response.data?.ideas || []);
  }

  async function fetchInstallerIdeas() {
    const response = await api.get('/support/ideas/me', { params: { limit: 120 } });
    return sortIdeas(response.data?.ideas || []);
  }

  useEffect(() => {
    let isMounted = true;
    async function loadInitialData() {
      setLoading(true);
      try {
        if (isAdmin) {
          const [conversationResponse, ideasList] = await Promise.all([
            api.get('/support/admin/conversations', { params: { limit: 120 } }),
            api
              .get('/support/admin/ideas', { params: { limit: 180, status: 'all', q: '' } })
              .then((response) => sortIdeas(response.data?.ideas || [])),
          ]);
          const conversationList = sortConversations(conversationResponse.data?.conversations || []);
          if (!isMounted) return;
          setConversations(conversationList);
          setIdeas(ideasList);
          setSelectedConversationId((current) => {
            if (current && conversationList.some((item) => item.id === current)) return current;
            return conversationList[0]?.id || null;
          });
        } else {
          const [conversationResponse, ideasList] = await Promise.all([
            api.get('/support/me'),
            fetchInstallerIdeas(),
          ]);
          const currentConversation = conversationResponse.data?.conversation || null;
          if (!isMounted) return;
          setConversation(currentConversation);
          setMessages(conversationResponse.data?.messages || []);
          setSelectedConversationId(currentConversation?.id || null);
          setIdeas(ideasList);
          await api.post('/support/me/read').catch(() => null);
        }
      } catch (error) {
        toast.error(error.response?.data?.error || 'Não foi possível carregar o suporte.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadInitialData();
    return () => { isMounted = false; };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !selectedConversationId) {
      if (isAdmin && !selectedConversationId) {
        setConversation(null);
        setMessages([]);
      }
      return;
    }
    let isMounted = true;
    setLoadingMessages(true);
    api.get(`/support/admin/conversations/${selectedConversationId}/messages`, { params: { limit: 220 } })
      .then((response) => {
        if (!isMounted) return;
        const nextConversation = response.data?.conversation || null;
        setConversation(nextConversation);
        setMessages(response.data?.messages || []);
        setConversations((current) => upsertConversation(current, nextConversation));
      })
      .then(() => api.post(`/support/admin/conversations/${selectedConversationId}/read`))
      .then((response) => {
        const nextConversation = response?.data?.conversation || null;
        if (!isMounted || !nextConversation) return;
        setConversations((current) => upsertConversation(current, nextConversation));
        setConversation((current) => (current?.id === nextConversation.id ? nextConversation : current));
      })
      .catch((error) => {
        if (isMounted) toast.error(error.response?.data?.error || 'Não foi possível carregar as mensagens.');
      })
      .finally(() => {
        if (isMounted) setLoadingMessages(false);
      });
    return () => { isMounted = false; };
  }, [isAdmin, selectedConversationId]);

  useEffect(() => {
    if (!user?.id) return undefined;

    let isMounted = true;

    const notifyAboutNewMessages = (nextMessages) => {
      const latestId = nextMessages.reduce((highest, item) => Math.max(highest, Number(item.id || 0)), 0);
      const previousId = lastSeenMessageIdRef.current;

      if (previousId > 0 && latestId > previousId) {
        const incoming = nextMessages.find((item) => Number(item.id) === latestId);
        const isIncomingForCurrentUser = isAdmin ? !incoming?.is_from_admin : Boolean(incoming?.is_from_admin);
        if (isIncomingForCurrentUser) toast.success('Nova mensagem no suporte.');
      }

      lastSeenMessageIdRef.current = latestId;
    };

    const pollSupport = async () => {
      if (document.hidden) return;

      try {
        pollTickRef.current += 1;

        if (isAdmin) {
          const requests = [api.get('/support/admin/conversations', { params: { limit: 120 } })];

          if (selectedConversationId) {
            requests.push(api.get(`/support/admin/conversations/${selectedConversationId}/messages`, { params: { limit: 220 } }));
          }

          if (pollTickRef.current % 4 === 0) {
            requests.push(api.get('/support/admin/ideas', { params: { limit: 180, status: 'all', q: '' } }));
          }

          const responses = await Promise.all(requests);
          if (!isMounted) return;

          const nextConversations = sortConversations(responses[0].data?.conversations || []);
          setConversations(nextConversations);

          if (selectedConversationId && responses[1]) {
            const nextConversation = responses[1].data?.conversation || null;
            const nextMessages = responses[1].data?.messages || [];
            notifyAboutNewMessages(nextMessages);
            setConversation(nextConversation);
            setMessages(nextMessages);
            api.post(`/support/admin/conversations/${selectedConversationId}/read`).catch(() => null);
          }

          const ideasResponse = responses.find((response) => Array.isArray(response.data?.ideas));
          if (ideasResponse) setIdeas(sortIdeas(ideasResponse.data.ideas));
          return;
        }

        const requests = [api.get('/support/me')];
        if (pollTickRef.current % 4 === 0) requests.push(api.get('/support/ideas/me', { params: { limit: 120 } }));
        const responses = await Promise.all(requests);
        if (!isMounted) return;

        const nextConversation = responses[0].data?.conversation || null;
        const nextMessages = responses[0].data?.messages || [];
        notifyAboutNewMessages(nextMessages);
        setConversation(nextConversation);
        setSelectedConversationId(nextConversation?.id || null);
        setMessages(nextMessages);
        api.post('/support/me/read').catch(() => null);

        if (responses[1]) setIdeas(sortIdeas(responses[1].data?.ideas || []));
      } catch (_error) {
        // A proxima consulta tenta novamente sem interromper a conversa.
      }
    };

    const interval = window.setInterval(pollSupport, 8000);
    window.addEventListener('focus', pollSupport);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', pollSupport);
    };
  }, [isAdmin, selectedConversationId, user?.id]);

  const handleSendMessage = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    if (!canSend) {
      toast.error('Selecione uma conversa para enviar.');
      return;
    }
    setSending(true);
    try {
      const payload = { body, ...(isAdmin ? { conversation_id: selectedConversationId } : {}) };
      const response = await api.post('/support/messages', payload);
      const nextConversation = response.data?.conversation || null;
      const sentMessage = response.data?.message || null;
      if (sentMessage) setMessages((current) => upsertMessage(current, sentMessage));
      if (nextConversation) {
        if (isAdmin) setConversations((current) => upsertConversation(current, nextConversation));
        setConversation(nextConversation);
      }
      setDraft('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível enviar a mensagem.');
    } finally {
      setSending(false);
    }
  };

  const handleToggleConversationStatus = async () => {
    if (!isAdmin || !selectedConversationId || !conversation) return;
    const nextStatus = conversation.status === 'open' ? 'closed' : 'open';
    const confirmed = await confirm({
      title: nextStatus === 'closed' ? 'Encerrar conversa' : 'Reabrir conversa',
      message:
        nextStatus === 'closed'
          ? 'Deseja encerrar esta conversa?'
          : 'Deseja reabrir esta conversa?',
      confirmText: nextStatus === 'closed' ? 'Encerrar' : 'Reabrir',
      cancelText: 'Cancelar',
      tone: 'danger',
    });
    if (!confirmed) return;
    setSavingStatus(true);
    try {
      const response = await api.patch(`/support/admin/conversations/${selectedConversationId}/status`, { status: nextStatus });
      const nextConversation = response.data?.conversation || null;
      if (nextConversation) {
        setConversation(nextConversation);
        setConversations((current) => upsertConversation(current, nextConversation));
      }
      toast.success(nextStatus === 'closed' ? 'Conversa encerrada.' : 'Conversa reaberta.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar o status da conversa.');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleCreateIdea = async (event) => {
    event.preventDefault();
    const title = ideaForm.title.trim();
    const description = ideaForm.description.trim();
    if (title.length < 8) {
      toast.error('Use um título mais descritivo.');
      return;
    }
    if (description.length < 20) {
      toast.error('Explique melhor sua ideia para avaliação.');
      return;
    }
    setSendingIdea(true);
    try {
      const response = await api.post('/support/ideas', {
        title,
        category: ideaForm.category,
        description,
      });
      const createdIdea = response.data?.idea || null;
      if (createdIdea) setIdeas((current) => upsertIdea(current, createdIdea));
      setIdeaForm({ title: '', category: 'feature', description: '' });
      toast.success('Ideia enviada com sucesso.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível enviar sua ideia.');
    } finally {
      setSendingIdea(false);
    }
  };

  const handleRefreshIdeas = async () => {
    setLoadingIdeas(true);
    try {
      const nextIdeas = isAdmin ? await fetchAdminIdeas() : await fetchInstallerIdeas();
      setIdeas(nextIdeas);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar as ideias.');
    } finally {
      setLoadingIdeas(false);
    }
  };

  const handleAdminIdeaStatus = async (ideaId, status) => {
    setSavingIdeaId(ideaId);
    try {
      const response = await api.patch(`/support/admin/ideas/${ideaId}`, { status });
      const updatedIdea = response.data?.idea || null;
      if (updatedIdea) setIdeas((current) => upsertIdea(current, updatedIdea));
      toast.success('Status da ideia atualizado.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar a ideia.');
    } finally {
      setSavingIdeaId(null);
    }
  };

  if (loading) {
    return (
      <section className="page-shell space-y-7">
        <div className="empty-state">Carregando suporte...</div>
      </section>
    );
  }

  return (
    <section className="page-shell space-y-7">
      <PageIntro
        eyebrow={isAdmin ? 'Suporte administrativo' : 'Suporte para instaladores'}
        title={isAdmin ? 'Central de atendimento e melhorias' : 'Suporte direto com o administrador'}
        description={
          isAdmin
            ? 'Atenda instaladores em tempo real e acompanhe ideias de melhoria no mesmo fluxo.'
            : 'Abra chamados no chat e envie ideias para melhorar o site. Nós acompanhamos tudo por aqui.'
        }
        stats={
          isAdmin
            ? [
                { label: 'Conversas abertas', value: `${openConversations}`, detail: `${conversations.length} no total.` },
                { label: 'Ideias pendentes', value: `${pendingIdeas}`, detail: `${ideas.length} ideias enviadas.` },
              ]
            : [
                { label: 'Mensagens', value: `${messages.length}`, detail: 'Histórico do seu atendimento.' },
                { label: 'Ideias enviadas', value: `${ideas.length}`, detail: `${pendingIdeas} em análise.` },
              ]
        }
      />

      {isAdmin ? (
        <div className="support-shell">
          <aside className="lux-panel support-list-panel fade-up p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
              <p className="eyebrow">Conversas</p>
              <span className="status-pill" data-tone={unreadTotal > 0 ? 'pending' : 'success'}>
                {unreadTotal > 0 ? `${unreadTotal} não lidas` : 'Em dia'}
              </span>
            </div>

            <div className="support-conversation-list mt-4">
              {conversations.length === 0 ? <div className="empty-state !p-6">Sem conversas no momento.</div> : null}
              {conversations.map((item) => (
                <button
                  className={`support-conversation-item ${selectedConversationId === item.id ? 'support-conversation-item-active' : ''}`}
                  key={item.id}
                  onClick={() => setSelectedConversationId(item.id)}
                  type="button"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text)]">{item.installer_name}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{item.installer_email}</p>
                    </div>
                    <span className="status-pill shrink-0" data-tone={item.status}>
                      {formatStatusLabel(item.status)}
                    </span>
                  </div>
                  <p className="support-conversation-last mt-3 text-left text-xs text-[var(--muted)]">
                    {item.last_message || 'Sem mensagens ainda.'}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-[var(--muted)]">
                      {item.last_message_at ? formatDateTime(item.last_message_at) : 'Agora'}
                    </p>
                    {item.unread_count > 0 ? <span className="support-unread-pill">{item.unread_count}</span> : null}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <div className="support-admin-stack">
            <article className="lux-panel support-chat-panel fade-up p-4 sm:p-6" style={{ animationDelay: '0.04s' }}>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-4">
                <div>
                  <p className="eyebrow">Conversa selecionada</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[var(--text)]">
                    {conversation?.installer_name || 'Selecione uma conversa'}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {conversation?.installer_email || 'Sem conversa selecionada.'}
                  </p>
                </div>
                {conversation ? (
                  <button className="ghost-button" disabled={savingStatus} onClick={handleToggleConversationStatus} type="button">
                    {savingStatus ? 'Salvando...' : conversation.status === 'open' ? 'Encerrar conversa' : 'Reabrir conversa'}
                  </button>
                ) : null}
              </div>

              <div className="support-message-list mt-4">
                {loadingMessages ? <div className="empty-state !p-6">Carregando mensagens...</div> : null}
                {!loadingMessages && messages.length === 0 ? <div className="empty-state !p-6">Ainda não há mensagens.</div> : null}
                {!loadingMessages
                  ? messages.map((message) => (
                      <article className={`support-message ${message.is_from_admin ? 'support-message-admin' : 'support-message-installer'}`} key={message.id}>
                        <p className="support-message-name">{message.sender_name || (message.is_from_admin ? 'Administrador' : 'Instalador')}</p>
                        <p className="support-message-body">{message.body}</p>
                        <p className="support-message-time">{formatDateTime(message.created_at)}</p>
                      </article>
                    ))
                  : null}
                <div ref={messagesEndRef} />
              </div>

              <form className="support-compose mt-4" onSubmit={handleSendMessage}>
                <textarea
                  className="field-textarea"
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={canSend ? 'Digite a resposta para o instalador...' : 'Selecione uma conversa para responder.'}
                  rows={3}
                  value={draft}
                />
                <div className="support-compose-actions">
                  <button className="gold-button" disabled={sending || !canSend} type="submit">
                    {sending ? 'Enviando...' : 'Responder agora'}
                  </button>
                </div>
              </form>
            </article>

            <article className="lux-panel support-ideas-panel fade-up p-4 sm:p-6" style={{ animationDelay: '0.08s' }}>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-4">
                <div>
                  <p className="eyebrow">Ideias de melhoria</p>
                  <h3 className="mt-2 text-xl font-semibold text-[var(--text)]">Inbox de sugestões</h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Acompanhe as ideias dos instaladores e atualize o status com um clique.
                  </p>
                </div>
                <button className="ghost-button" disabled={loadingIdeas} onClick={handleRefreshIdeas} type="button">
                  {loadingIdeas ? 'Atualizando...' : 'Atualizar'}
                </button>
              </div>

              <div className="grid gap-3 pt-4 sm:grid-cols-2">
                <div>
                  <label className="field-label">Filtro por status</label>
                  <select className="field-select" onChange={(event) => setIdeaFilter(event.target.value)} value={ideaFilter}>
                    <option value="all">Todos</option>
                    <option value="new">Nova</option>
                    <option value="reviewing">Em análise</option>
                    <option value="planned">Planejada</option>
                    <option value="done">Concluída</option>
                    <option value="rejected">Não aprovada</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Busca</label>
                  <input
                    className="field-input"
                    onChange={(event) => setIdeaSearch(event.target.value)}
                    placeholder="Título, descrição, nome ou e-mail"
                    type="text"
                    value={ideaSearch}
                  />
                </div>
              </div>

              <div className="support-compose-actions !justify-start pt-3">
                <button className="gold-button" onClick={handleRefreshIdeas} type="button">
                  Aplicar filtros
                </button>
              </div>

              <div className="support-idea-list mt-4">
                {ideas.length === 0 ? <div className="empty-state !p-6">Sem ideias para os filtros atuais.</div> : null}
                {ideas.map((idea) => (
                  <article className="support-idea-card" key={idea.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text)]">{idea.title}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {idea.installer_name} • {idea.installer_email}
                        </p>
                      </div>
                      <span className="status-pill" data-tone={ideaTone(idea.status)}>
                        {IDEA_STATUS_LABEL[idea.status] || idea.status}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-7 text-[var(--text)]">{idea.description}</p>

                    <div className="support-idea-meta mt-3">
                      <span className="status-pill" data-tone="info">
                        {IDEA_CATEGORY_LABEL[idea.category] || idea.category}
                      </span>
                      <span className="text-xs text-[var(--muted)]">Enviada em {formatDateTime(idea.created_at)}</span>
                    </div>

                    <div className="support-idea-actions mt-4">
                      <button
                        className="ghost-button !min-h-0 !px-3 !py-2 text-xs"
                        disabled={savingIdeaId === idea.id}
                        onClick={() => handleAdminIdeaStatus(idea.id, 'reviewing')}
                        type="button"
                      >
                        Em análise
                      </button>
                      <button
                        className="ghost-button !min-h-0 !px-3 !py-2 text-xs"
                        disabled={savingIdeaId === idea.id}
                        onClick={() => handleAdminIdeaStatus(idea.id, 'planned')}
                        type="button"
                      >
                        Planejar
                      </button>
                      <button
                        className="gold-button !min-h-0 !px-3 !py-2 text-xs"
                        disabled={savingIdeaId === idea.id}
                        onClick={() => handleAdminIdeaStatus(idea.id, 'done')}
                        type="button"
                      >
                        Concluir
                      </button>
                      <button
                        className="danger-button !min-h-0 !px-3 !py-2 text-xs"
                        disabled={savingIdeaId === idea.id}
                        onClick={() => handleAdminIdeaStatus(idea.id, 'rejected')}
                        type="button"
                      >
                        Não aprovar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </div>
        </div>
      ) : (
        <div className="support-installer-shell">
          <article className="lux-panel support-chat-panel fade-up p-4 sm:p-6">
            <div className="border-b border-[var(--line)] pb-4">
              <p className="eyebrow">Canal exclusivo do instalador</p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--text)]">Dúvidas e suporte direto com o administrador</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Use este chat para pedir ajuda sobre operação, conta, pagamentos e funcionalidades.
              </p>
            </div>

            <div className="support-message-list mt-4">
              {messages.length === 0 ? (
                <div className="empty-state !p-6">Ainda não há mensagens. Escreva sua dúvida para começar.</div>
              ) : (
                messages.map((message) => (
                  <article className={`support-message ${message.is_from_admin ? 'support-message-admin' : 'support-message-installer'}`} key={message.id}>
                    <p className="support-message-name">{message.is_from_admin ? 'Administrador' : (message.sender_name || 'Você')}</p>
                    <p className="support-message-body">{message.body}</p>
                    <p className="support-message-time">{formatDateTime(message.created_at)}</p>
                  </article>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="support-compose mt-4" onSubmit={handleSendMessage}>
              <textarea
                className="field-textarea"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Digite sua dúvida para o administrador..."
                rows={3}
                value={draft}
              />
              <div className="support-compose-actions">
                <button className="gold-button" disabled={sending || !canSend} type="submit">
                  {sending ? 'Enviando...' : 'Enviar mensagem'}
                </button>
              </div>
            </form>
          </article>

          <aside className="lux-panel support-ideas-panel fade-up p-4 sm:p-6" style={{ animationDelay: '0.06s' }}>
            <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-4">
              <div>
                <p className="eyebrow">Ideias para melhorar o site</p>
                <h3 className="mt-2 text-xl font-semibold text-[var(--text)]">Seu espaço de sugestões</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Compartilhe melhorias que facilitem sua rotina. O administrador avalia e responde.
                </p>
              </div>
              <button className="ghost-button" disabled={loadingIdeas} onClick={handleRefreshIdeas} type="button">
                {loadingIdeas ? 'Atualizando...' : 'Atualizar'}
              </button>
            </div>

            <form className="mt-4 space-y-3" onSubmit={handleCreateIdea}>
              <div>
                <label className="field-label">Título da ideia</label>
                <input
                  className="field-input"
                  onChange={(event) => setIdeaForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Ex.: Agenda com confirmação automática"
                  type="text"
                  value={ideaForm.title}
                />
              </div>
              <div>
                <label className="field-label">Categoria</label>
                <select
                  className="field-select"
                  onChange={(event) => setIdeaForm((current) => ({ ...current, category: event.target.value }))}
                  value={ideaForm.category}
                >
                  <option value="feature">Nova funcionalidade</option>
                  <option value="ux">Design e usabilidade</option>
                  <option value="performance">Desempenho</option>
                  <option value="payments">Pagamentos</option>
                  <option value="security">Segurança</option>
                  <option value="automation">Automação</option>
                  <option value="other">Outros</option>
                </select>
              </div>
              <div>
                <label className="field-label">Descrição</label>
                <textarea
                  className="field-textarea"
                  onChange={(event) => setIdeaForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Explique a melhoria e como isso ajudaria no seu dia a dia."
                  rows={4}
                  value={ideaForm.description}
                />
              </div>
              <button className="gold-button w-full" disabled={sendingIdea} type="submit">
                {sendingIdea ? 'Enviando ideia...' : 'Enviar ideia'}
              </button>
            </form>

            <div className="support-idea-list mt-5">
              {ideas.length === 0 ? <div className="empty-state !p-6">Nenhuma ideia enviada ainda.</div> : null}
              {ideas.map((idea) => (
                <article className="support-idea-card" key={idea.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--text)]">{idea.title}</p>
                    <span className="status-pill" data-tone={ideaTone(idea.status)}>
                      {IDEA_STATUS_LABEL[idea.status] || idea.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[var(--text)]">{idea.description}</p>
                  <div className="support-idea-meta mt-3">
                    <span className="status-pill" data-tone="info">
                      {IDEA_CATEGORY_LABEL[idea.category] || idea.category}
                    </span>
                    <span className="text-xs text-[var(--muted)]">Enviada em {formatDateTime(idea.created_at)}</span>
                  </div>
                  {idea.admin_note ? (
                    <div className="support-idea-note mt-4">
                      <p className="support-message-name">Retorno do administrador</p>
                      <p className="support-message-body">{idea.admin_note}</p>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
