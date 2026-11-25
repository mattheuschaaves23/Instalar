import { useState } from 'react';
import { formatDateTime, formatStatusLabel } from '../../utils/formatters';
import {
  AdminBadge, AdminButton, AdminDetail, AdminEmpty, AdminHeading, AdminSearch, AdminTable,
  AdminTabs, scrollAdminDetail,
} from '../Admin/AdminWorkspace';
import { AdminField, AdminSelect } from '../Admin/AdminViews';

function ConversationWorkspace({
  conversations, conversation, selectedId, changeConversation, loading, error, onRetry,
  loadingMessages, messageError, onRetryMessages, messages, messagesEndRef, draft, setDraft,
  send, sending, canSend, savingStatus, toggleStatus,
}) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase('pt-BR');
  const filtered = conversations.filter((item) => !query ||
    [item.installer_name, item.installer_email, item.last_message].join(' ').toLocaleLowerCase('pt-BR').includes(query));
  return <>
    {error ? <AdminEmpty error={error} onRetry={onRetry} /> : null}
    <div className="ip-admin-layout is-queue">
      <section className="ip-admin-card ip-admin-pane" aria-label="Conversas">
        <AdminSearch label="Buscar conversa" value={search} onChange={(event) => setSearch(event.target.value)} />
        {loading || (!error && !filtered.length)
          ? <AdminEmpty busy={loading}>{query ? 'Nenhuma conversa encontrada.' : 'Sem conversas no momento.'}</AdminEmpty>
          : <ul className="ip-admin-queue">{filtered.map((item) => <li key={item.id}>
            <button type="button" aria-pressed={selectedId === item.id} disabled={sending || savingStatus} onClick={() => {
              changeConversation(item.id);
              scrollAdminDetail('admin-support-thread');
            }}>
              <strong>{item.installer_name || 'Instalador'}</strong>
              {item.last_message ? <span className="ip-admin-conversation-excerpt">{item.last_message}</span> : null}
              <div className="ip-admin-actions">
                <AdminBadge status={item.status}>{Number(item.unread_count) ? item.unread_count + ' não lidas' : item.status === 'closed' ? 'Encerrada' : 'Aberta'}</AdminBadge>
                {item.last_message_at ? <small>{formatDateTime(item.last_message_at)}</small> : null}
              </div>
            </button>
          </li>)}</ul>}
      </section>
      <AdminDetail id="admin-support-thread" title={conversation?.installer_name || 'Selecione uma conversa'}>
        {conversation ? <div className="ip-admin-actions">
          <AdminBadge status={conversation.status}>{conversation.status === 'closed' ? 'Encerrada' : 'Em atendimento'}</AdminBadge>
          {conversation.installer_email ? <span className="ip-admin-muted">{conversation.installer_email}</span> : null}
          <AdminButton disabled={savingStatus || sending || loadingMessages} onClick={toggleStatus}>
            {savingStatus ? 'Salvando…' : conversation.status === 'closed' ? 'Reabrir conversa' : 'Encerrar conversa'}
          </AdminButton>
        </div> : null}
        <section className="ip-admin-thread" aria-label="Mensagens da conversa" aria-busy={loadingMessages || undefined}>
          {messageError ? <AdminEmpty error={messageError} onRetry={onRetryMessages} /> : null}
          {!messageError && (loadingMessages || loading) ? <AdminEmpty busy /> : null}
          {!messageError && !loading && !loadingMessages && selectedId && !messages.length ? <AdminEmpty>Ainda não há mensagens.</AdminEmpty> : null}
          {!messageError && !loadingMessages ? messages.map((message) => <article className={'ip-admin-message' + (message.is_from_admin ? ' is-out' : '')} key={message.id}>
            <p>{message.body}</p>
            <small>{message.sender_name || (message.is_from_admin ? 'Administrador' : 'Instalador')} · {formatDateTime(message.created_at)}</small>
          </article>) : null}
          <div ref={messagesEndRef} />
        </section>
        <form className="ip-admin-chat-compose" onSubmit={send}>
          <label><span className="ip-admin-sr">Resposta</span>
            <textarea rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escreva uma resposta"
              disabled={!canSend || sending} />
          </label>
          <AdminButton tone="primary" type="submit" disabled={sending || !canSend || !draft.trim()}>{sending ? 'Enviando…' : 'Enviar'}</AdminButton>
        </form>
      </AdminDetail>
    </div>
  </>;
}

function IdeaEditor({ idea, options, busy, save }) {
  const [showReply, setShowReply] = useState(false);
  const [reply, setReply] = useState(idea.admin_note || '');
  return <>
    <div className="ip-admin-actions">
      <AdminSelect label="Alterar status" value={idea.status} options={options} disabled={busy}
        onChange={(event) => save(idea.id, { status: event.target.value })} />
      <AdminButton tone="primary" disabled={busy} onClick={() => setShowReply((current) => !current)}>
        {showReply ? 'Fechar resposta' : idea.admin_note ? 'Editar resposta' : 'Responder'}
      </AdminButton>
    </div>
    {showReply ? <form className="ip-admin-form" onSubmit={async (event) => {
      event.preventDefault();
      if (await save(idea.id, { admin_note: reply.trim() })) setShowReply(false);
    }}>
      <AdminField label="Resposta ao instalador"><textarea rows={3} value={reply} onChange={(event) => setReply(event.target.value)} maxLength={2500} /></AdminField>
      <div><AdminButton tone="primary" type="submit" disabled={busy || (!reply.trim() && !idea.admin_note)}>
        {busy ? 'Salvando…' : 'Salvar resposta'}
      </AdminButton></div>
    </form> : null}
  </>;
}

function IdeasWorkspace({ items, options, categoryLabels, tone, filters, onChange, onSubmit, busy, error, onRetry, savingId, save }) {
  const [selected, setSelected] = useState();
  const idea = items.find((item) => item.id === selected) || items[0];
  const statusLabel = (value) => options.find(([key]) => key === value)?.[1] || formatStatusLabel(value);
  return <>
    <form className="ip-admin-toolbar" onSubmit={onSubmit}>
      <AdminSearch label="Buscar sugestão" name="q" value={filters.q} onChange={onChange} />
      <AdminSelect label="Status da sugestão" name="status" value={filters.status} onChange={onChange} options={[['all','Todos os status'], ...options]} />
      <AdminButton tone="primary" type="submit" disabled={busy}>Filtrar</AdminButton>
    </form>
    <div className="ip-admin-layout">
      <AdminTable label="Lista de sugestões" columns={['Sugestão','Enviada por','Status']}
        rows={items.map((item) => ({ id: item.id, cells: [item.title, item.installer_name || '—',
          <AdminBadge tone={tone(item.status)}>{statusLabel(item.status)}</AdminBadge>] }))}
        selected={idea?.id} onSelect={(id) => { setSelected(id); scrollAdminDetail('admin-idea-detail'); }}
        loading={busy} error={error} onRetry={onRetry} empty="Sem sugestões para os filtros atuais." />
      {idea && !busy && !error ? <AdminDetail id="admin-idea-detail" title={idea.title}>
        <div className="ip-admin-actions">
          <AdminBadge tone="info">{categoryLabels[idea.category] || idea.category || 'Sugestão'}</AdminBadge>
          <span>{idea.installer_name}</span>
        </div>
        {idea.created_at ? <small className="ip-admin-muted">Enviada em {formatDateTime(idea.created_at)}</small> : null}
        <p className="ip-admin-preserve">{idea.description}</p>
        {idea.admin_note ? <div className="ip-admin-preview"><strong>Resposta do administrador</strong><p>{idea.admin_note}</p></div> : null}
        <IdeaEditor key={idea.id} idea={idea} options={options} busy={savingId === idea.id} save={save} />
      </AdminDetail> : null}
    </div>
  </>;
}

export default function AdminSupportView({ tab, changeTab, chat, ideas }) {
  return <section className="ip-admin-page">
    <AdminHeading section="support" />
    <AdminTabs label="Seções de suporte" value={tab} onChange={changeTab} options={[['chat', 'Atendimentos'], ['ideas', 'Sugestões']]} />
    {tab === 'ideas' ? <IdeasWorkspace {...ideas} /> : <ConversationWorkspace {...chat} />}
  </section>;
}
