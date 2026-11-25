import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import api from '../../services/api';
import { formatCurrency, formatDateTime, formatStatusLabel } from '../../utils/formatters';
import PaginationControls from '../Layout/PaginationControls';
import {
  AdminBadge, AdminButton, AdminDetail, AdminEmpty, AdminFacts, AdminIcon, AdminSearch,
  AdminTable, AdminTabs, adminHref, scrollAdminDetail,
} from './AdminWorkspace';

const place = ({ city, state }) => [city, state].filter(Boolean).join(', ') || '—';
const nullableDate = (value) => value ? formatDateTime(value) : '—';
const requestLabel = (item) => item.service_label || item.service || 'Instalação';
const paymentStatuses = [['all', 'Todos os status'], ['pending', 'Pendentes'], ['paid', 'Confirmados'], ['failed', 'Falhos'], ['canceled', 'Cancelados'], ['refunded', 'Estornados']];
const requestStatuses = [['all','Todos os status'],['open','Abertos'],['expired','Vencidos'],['selected','Instalador escolhido'],['closed','Fechados'],['canceled','Cancelados']];
const userTypes = [['all', 'Tipo de conta'], ['installer','Instaladores'], ['client','Clientes']];
const userStatuses = [['all', 'Todos os planos'], ['active','Pro ativo'], ['inactive','Grátis'], ['canceled','Pro cancelado']];

export function AdminSelect({ options, label, ...props }) {
  return <select aria-label={label} {...props}>{options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select>;
}
export function AdminField({ label, children }) {
  return <label className="ip-admin-field">{label}{children}</label>;
}
function useSelected(items, elementId) {
  const [id, setId] = useState(undefined);
  const selected = id === null ? null : items.find((item) => item.id === id) || items[0] || null;
  return [selected, (next) => {
    setId(next);
    if (next != null) scrollAdminDetail(elementId);
  }];
}
function PageFooter({ page, pagination, onPage, currentCount }) {
  if (pagination.total_pages <= 1) return <p className="ip-admin-muted">{currentCount} {currentCount === 1 ? 'registro' : 'registros'}</p>;
  return <PaginationControls currentPage={page} totalPages={pagination.total_pages} onPageChange={onPage} />;
}
function Listing({ detailId, items, loading, error, onRetry, page, pagination, onPage, columns, label, renderCells, renderDetail, empty }) {
  const [item, select] = useSelected(items, detailId);
  return <div className="ip-admin-layout">
    <AdminTable label={label} columns={columns} rows={items.map((entry) => ({ id: entry.id, cells: renderCells(entry) }))}
      selected={item?.id} onSelect={select} loading={loading} error={error} onRetry={onRetry} empty={empty}
      footer={!loading && !error && pagination ? <PageFooter page={page} pagination={pagination} onPage={onPage} currentCount={items.length} /> : null} />
    {!loading && !error && item ? renderDetail(item, () => select(null)) : null}
  </div>;
}

export function AdminOverview({ overview, pending, errors, failures, loading, onRetry }) {
  const metrics = overview.metrics || {};
  const tasks = [
    ['verifications', 'Certificados para revisar', pending.length, 'Revisar', failures.verifications],
    ['payments', 'Pagamentos pendentes', metrics.pending_payments, 'Conferir', failures.overview],
    ['monitoring', 'Erros recentes', errors.length, 'Ver erros', failures.monitoring],
  ];
  const recent = [
    ...(overview.recent_service_requests || []).map((item) => ({ id: 'request-' + item.id, event: 'Pedido publicado', detail: '#' + item.id + ' · ' + place(item), status: item.status, date: item.created_at })),
    ...(overview.recent_payments || []).map((item) => ({ id: 'payment-' + item.id, event: 'Pagamento', detail: (item.user_name || 'Cobrança') + ' · ' + formatCurrency(item.amount), status: item.status, date: item.created_at })),
    ...(overview.recent_users || []).map((item) => ({ id: 'user-' + item.id, event: 'Nova conta', detail: item.name, date: item.created_at })),
    ...(overview.recent_budgets || []).map((item) => ({ id: 'budget-' + item.id, event: 'Orçamento criado', detail: '#' + item.id + ' · ' + (item.installer_name || 'Instalador'), status: item.status, date: item.created_at })),
  ].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)).slice(0, 8);
  return <>
    <div className="ip-admin-layout">
      <section className="ip-admin-card ip-admin-pane"><h2>Fila de trabalho</h2>
        <ul className="ip-admin-task-list">{tasks.map(([key, label, count, action, failed]) => (
          <li key={key}><span className="ip-admin-task-icon"><AdminIcon name={key} /></span><strong>{label}</strong>
            <b>{loading || failed || count == null ? '—' : count}</b>
            <Link to={key === 'payments' ? adminHref(key) + '&status=pending' : adminHref(key)}>{action}<AdminIcon name="right" size={16} /></Link>
          </li>
        ))}</ul>
      </section>
      <section className="ip-admin-card ip-admin-pane"><h2>Resumo da operação</h2>
        <AdminFacts facts={[
          ['Novos usuários · 30 dias', metrics.new_users_last_30_days],
          ['Pedidos publicados · 7 dias', metrics.recent_service_requests],
          ['Planos Pro ativos', metrics.active_subscriptions],
          ['Instaladores na busca', metrics.public_installers],
        ]} />
      </section>
    </div>
    <section className="ip-admin-stack"><h2 className="ip-admin-section-title">Atividade recente</h2>
      <AdminTable label="Atividade recente" columns={['Evento', 'Detalhe', 'Quando']} loading={loading}
        error={failures.overview} onRetry={onRetry}
        rows={recent.map((item) => ({ id: item.id, cells: [item.event, <span>{item.detail} {item.status ? <AdminBadge status={item.status} /> : null}</span>, nullableDate(item.date)] }))} />
    </section>
  </>;
}

function AdminRequestInterests({ requestId, count }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open || !count) return undefined;
    const request = new AbortController();
    api.get('/admin/service-requests/' + requestId + '/interests', { signal: request.signal }).then(({ data }) => {
      if (!request.signal.aborted) setResult({ items: data?.interests || [] });
    }).catch((error) => {
      if (!request.signal.aborted) setResult({ error: error.response?.data?.error || 'Não foi possível carregar os interessados.' });
    });
    return () => request.abort();
  }, [open, count, requestId, attempt]);
  if (!count) return null;
  return <div className="ip-admin-stack">
    <div><AdminButton aria-expanded={open} aria-controls="admin-request-interests"
      onClick={() => { setResult(null); setOpen(!open); }}>{open ? 'Ocultar interessados' : 'Ver interessados'}</AdminButton></div>
    <div id="admin-request-interests" hidden={!open}>
      {!result || result.error || !result.items.length ? <AdminEmpty busy={!result} error={result?.error}
        onRetry={() => { setResult(null); setAttempt((current) => current + 1); }}>Nenhum interessado encontrado.</AdminEmpty>
        : <AdminFacts facts={result.items.map((item) => [item.installer_name || 'Instalador', formatStatusLabel(item.status), item.id])} />}
      {result?.items?.length === 50 && count > 50 ? <small className="ip-admin-muted">Mostrando os 50 interesses mais recentes.</small> : null}
    </div>
  </div>;
}

export function AdminRequests({ filters, onChange, onSubmit, onStatus, busyId, ...list }) {
  return <>
    <form className="ip-admin-toolbar" onSubmit={onSubmit}>
      <AdminSearch label="Buscar por número, cliente ou cidade" name="q" value={filters.q} onChange={onChange} />
      <AdminSelect label="Status do pedido" options={requestStatuses} name="status" value={filters.status} onChange={onChange} />
      <AdminSelect label="Origem do pedido" options={ [['all','Todas as origens'],['marketplace','Pedido comum'],['direct','Pedido direto']] } name="origin" value={filters.origin} onChange={onChange} />
      <AdminButton tone="primary" type="submit" disabled={list.loading}>Filtrar</AdminButton>
    </form>
    <Listing {...list} detailId="admin-request-detail" label="Lista de pedidos" columns={['Pedido', 'Local', 'Status', 'Interesses']}
      renderCells={(item) => ['#' + item.id, place(item), <AdminBadge status={item.status} />, item.interests_count ?? 0]}
      renderDetail={(item, close) => <AdminDetail id="admin-request-detail" title={'Pedido #' + item.id} onClose={close}>
        <div><AdminBadge tone="info">{item.is_direct ? 'Pedido direto' : 'Pedido comum'}</AdminBadge></div>
        <h3>{requestLabel(item)}</h3>
        <AdminFacts facts={[
          ['Local', [item.neighborhood, item.city, item.state].filter(Boolean).join(', ')],
          ['Interessados', item.interests_count ?? 0], ['Instalador escolhido', item.selected_installer_name || 'Ainda não escolhido'],
          ['Cliente', item.client_name], ['Contato', item.client_email || item.client_phone], ['Conta vinculada', item.account_email || 'Pedido anônimo'],
          ['Publicado em', nullableDate(item.created_at)],
        ]} />
        <AdminRequestInterests key={item.id} requestId={item.id} count={item.interests_count} />
        {(item.status === 'open' || (item.status !== 'selected' && !item.selected_installer_id)) ? <div className="ip-admin-actions">
          <AdminButton disabled={busyId === item.id} onClick={() => onStatus(item, item.status === 'open' ? 'closed' : 'open')}>
            {item.status === 'open' ? 'Fechar pedido' : 'Reabrir pedido'}
          </AdminButton>
        </div> : null}
      </AdminDetail>} />
  </>;
}

function externalHttp(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}
const safeAssetType = /^(application\/pdf|image\/(?:png|jpeg|webp|gif))$/i;
export function AdminCertificate({ file, name, inline = false }) {
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState(null);
  const privateFile = typeof file === 'string' && file.startsWith('/api/users/uploads/file/');
  const entry = load?.file === file && load.attempt === attempt ? load : null;
  const external = !privateFile && externalHttp(file);
  useEffect(() => {
    if (!privateFile || (!inline && attempt === 0)) return undefined;
    let objectUrl;
    const request = new AbortController();
    api.get(file.slice(4), { responseType: 'blob', signal: request.signal }).then(({ data }) => {
      if (request.signal.aborted) return;
      if (!safeAssetType.test(data?.type || '')) {
        setLoad({ file, attempt, error: 'Formato de certificado não disponível para visualização.' });
        return;
      }
      objectUrl = URL.createObjectURL(data);
      setLoad({ file, attempt, url: objectUrl, type: data.type });
    }).catch(() => {
      if (!request.signal.aborted) setLoad({ file, attempt, error: 'Não foi possível abrir o certificado.' });
    });
    return () => {
      request.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, privateFile, inline, attempt]);
  if (!file) return <AdminEmpty>Nenhum certificado disponível.</AdminEmpty>;
  const href = entry?.url || external;
  const fetching = privateFile && (inline || attempt > 0) && !entry;
  return <div className="ip-admin-stack">
    {inline ? <div className="ip-admin-media">
      {entry?.url && entry.type !== 'application/pdf' ? <img alt={name || 'Certificado de instalação'} src={entry.url} />
        : <div><AdminIcon name="file" size={32} /> <strong>{name || 'Certificado de instalação'}</strong>
          {entry?.type === 'application/pdf' ? <p>Abra o certificado para conferir o PDF em uma nova aba.</p> : null}</div>}
    </div> : null}
    {fetching || entry?.error ? <AdminEmpty busy={fetching} error={entry?.error} onRetry={() => setAttempt((previous) => previous + 1)} /> : null}
    {href ? <div><a className="ip-admin-link" href={href} target="_blank" rel="noopener noreferrer"><AdminIcon name="external" size={17} />Abrir certificado</a></div>
      : privateFile && !inline && !attempt ? <div><AdminButton onClick={() => setAttempt(1)}>Carregar certificado</AdminButton></div>
      : !privateFile ? <AdminEmpty error="Endereço do certificado inválido." /> : null}
  </div>;
}

export function AdminVerifications({ items, status, onStatus, loading, error, onRetry, search, onSearch, onApprove, onReject, savingId, pendingCount }) {
  const filtered = items.filter((entry) => !search.trim() || [entry.name, entry.business_name, entry.email, entry.city].join(' ').toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')));
  const [item, select] = useSelected(filtered, 'admin-certificate-detail');
  const [publishFor, setPublishFor] = useState(null);
  const pending = status === 'pending';
  const waiting = item?.certification_status ? item.certification_status === 'pending' : pending;
  return <>
    <div className="ip-admin-toolbar">
      <AdminTabs label="Status da revisão" value={status} onChange={(next) => { select(undefined); onStatus(next); }} options={[
        ['pending', 'Pendentes' + (pendingCount ? ' (' + pendingCount + ')' : '')], ['approved', 'Aprovados'], ['rejected', 'Recusados'],
      ]} />
      <AdminSearch label="Buscar instalador" value={search} onChange={(event) => onSearch(event.target.value)} />
    </div>
    <div className="ip-admin-layout is-queue">
      <div className="ip-admin-card" aria-busy={loading || undefined}>
        {loading || error || !filtered.length ? <AdminEmpty busy={loading} error={error} onRetry={onRetry}>Nenhum certificado para esta seleção.</AdminEmpty>
          : <ul className="ip-admin-queue">{filtered.map((entry) => <li key={entry.id}><button type="button" aria-pressed={item?.id === entry.id} onClick={() => select(entry.id)}>
            <strong>{entry.business_name || entry.name}</strong>
            <AdminBadge status={entry.certification_status || status}>{pending ? 'Aguardando revisão' : status === 'approved' ? 'Aprovado' : 'Recusado'}</AdminBadge>
            {entry.certificate_submitted_at ? <span>Enviado em {nullableDate(entry.certificate_submitted_at)}</span> : null}
          </button></li>)}</ul>}
      </div>
      {item && !loading && !error ? <AdminDetail id="admin-certificate-detail" title={item.business_name || item.name}>
        <p className="ip-admin-muted">{place(item)} {item.email ? ' · ' + item.email : ''}</p>
        <AdminCertificate key={item.id} file={item.certificate_file} name={item.certificate_name} inline />
        {waiting ? <div className="ip-admin-actions">
          {!item.public_profile ? <label className="ip-admin-check"><input checked={publishFor === item.id} type="checkbox" onChange={(event) => setPublishFor(event.target.checked ? item.id : null)} />Publicar perfil na busca</label> : <AdminBadge tone="info">Perfil publicado</AdminBadge>}
          <AdminButton tone="primary" disabled={savingId === item.id || !item.certificate_file} onClick={() => onApprove(item, { publish: !item.public_profile && publishFor === item.id })}>Aprovar certificado</AdminButton>
          <AdminButton tone="danger" disabled={savingId === item.id || !item.certificate_file} onClick={() => onReject(item)}>Recusar</AdminButton>
        </div> : <AdminFacts facts={[
          ['Revisado por', item.reviewed_by_name], ['Data da revisão', nullableDate(item.certificate_reviewed_at)], ['Motivo', item.certificate_rejection_reason],
        ]} />}
      </AdminDetail> : null}
    </div>
  </>;
}

export function AdminUsers({ filters, onChange, onSubmit, actions, savingId, ...list }) {
  return <>
    <form className="ip-admin-toolbar" onSubmit={onSubmit}>
      <AdminSearch label="Buscar nome ou e-mail" name="q" value={filters.q} onChange={onChange} />
      <AdminSelect label="Tipo de conta" options={userTypes} name="account_type" value={filters.account_type} onChange={onChange} />
      <AdminSelect label="Status do plano" options={userStatuses} name="status" value={filters.status} onChange={onChange} />
      <AdminButton tone="primary" type="submit" disabled={list.loading}>Filtrar</AdminButton>
    </form>
    <Listing {...list} detailId="admin-user-detail" label="Lista de usuários" columns={['Nome','Tipo','Plano','Status']}
      renderCells={(item) => [item.name, item.account_type === 'client' ? 'Cliente' : 'Instalador', item.account_type === 'client' ? '—' : item.subscription_status === 'active' ? 'Pro' : 'Grátis',
        <AdminBadge tone={item.deleted_at ? 'danger' : 'success'}>{item.deleted_at ? 'Arquivada' : 'Ativa'}</AdminBadge>]}
      renderDetail={(item, close) => {
        const installer = item.account_type !== 'client';
        const locked = savingId === item.id || Boolean(item.deleted_at);
        return <AdminDetail key={item.id} id="admin-user-detail" title={'Ficha de ' + item.name} onClose={close}>
          <AdminFacts facts={[
            ['E-mail', item.email], ['Telefone', item.phone], ['Local', place(item)],
            ['Acesso', item.is_admin ? 'Administrador' : 'Usuário comum'],
            ...(installer ? [
              ['Plano', item.subscription_status === 'active' ? 'Pro' : 'Grátis'],
              ['Assinatura até', nullableDate(item.expires_at)],
              ['Vitrine', item.public_profile ? 'Perfil publicado' : 'Perfil oculto na busca'],
              ['Certificado', item.certification_verified ? 'Verificado' : item.has_certificate ? 'Não verificado' : 'Não enviado'],
              ['Orçamentos', (item.budgets_count ?? 0) + ' · ' + (item.approved_count ?? 0) + ' aprovados'],
            ] : []),
          ]} />
          {installer && item.public_profile ? <div><Link className="ip-admin-link" to={'/installers/' + item.id} target="_blank" rel="noopener noreferrer">Ver perfil <AdminIcon name="external" size={16} /></Link></div> : null}
          <details className="ip-admin-expand"><summary>Gerenciar acesso</summary>
            <div className="ip-admin-actions">
              {installer ? <>
                <AdminButton disabled={locked} onClick={() => actions.profile(item)}>{item.public_profile ? 'Ocultar vitrine' : 'Mostrar na vitrine'}</AdminButton>
                <AdminButton disabled={locked} onClick={() => actions.plan(item)}>{item.subscription_status === 'active' ? 'Voltar para o Grátis' : 'Ativar plano Pro'}</AdminButton>
                <AdminButton disabled={locked} onClick={() => actions.feature(item)}>{item.featured_installer ? 'Remover destaque' : 'Destacar instalador'}</AdminButton>
                <AdminButton disabled={locked || (!item.has_certificate && !item.certification_verified)} onClick={() => actions.certify(item)}>{item.certification_verified ? 'Remover selo certificado' : 'Validar certificado'}</AdminButton>
                {item.has_certificate && !item.certification_verified ? <AdminButton disabled={locked} onClick={() => actions.reject(item)}>Recusar certificado</AdminButton> : null}
              </> : null}
              <AdminButton disabled={locked} onClick={() => actions.role(item)}>{item.is_admin ? 'Remover admin' : 'Tornar admin'}</AdminButton>
              {item.deleted_at
                ? <AdminButton tone="primary" disabled={savingId === item.id} onClick={() => actions.restore(item)}>Restaurar usuário</AdminButton>
                : <AdminButton tone="danger" disabled={locked} onClick={() => actions.archive(item)}>Arquivar usuário</AdminButton>}
            </div>
            {installer && item.has_certificate ? <div><AdminCertificate file={item.certificate_file} name={item.certificate_name} /></div> : null}
          </details>
        </AdminDetail>;
      }} />
  </>;
}

export function AdminPayments({ filters, onChange, onSubmit, onStatus, savingId, metrics, ...list }) {
  return <>
    <div className="ip-admin-summary ip-admin-card">
      <span>Recebidos no mês <b>{metrics.paid_this_month_total == null ? '—' : formatCurrency(metrics.paid_this_month_total)}</b></span>
      <span>Pendentes <b>{metrics.pending_payments ?? '—'}</b></span>
    </div>
    <form className="ip-admin-toolbar" onSubmit={onSubmit}>
      <AdminSearch label="Buscar por conta ou cobrança" name="q" value={filters.q} onChange={onChange} />
      <AdminSelect label="Status da cobrança" options={paymentStatuses} name="status" value={filters.status} onChange={onChange} />
      <AdminSelect label="Período da cobrança" options={ [['all','Qualquer período'],['month','Este mês']] } name="period" value={filters.period} onChange={onChange} />
      <AdminButton tone="primary" type="submit" disabled={list.loading}>Filtrar</AdminButton>
    </form>
    <Listing {...list} detailId="admin-payment-detail" label="Lista de pagamentos" columns={['Cobrança','Conta','Valor','Status','Atualizado']}
      renderCells={(item) => ['#' + item.id, item.user_name, formatCurrency(item.amount), <AdminBadge status={item.status} />, nullableDate(item.updated_at || item.created_at)]}
      renderDetail={(item, close) => <AdminDetail key={item.id} id="admin-payment-detail" title={'Detalhes da cobrança #' + item.id} onClose={close}>
        <div><AdminBadge status={item.status} /></div>
        <AdminFacts facts={[
          ['Conta', item.user_name], ['Valor', formatCurrency(item.amount)], ['Método', item.method && formatStatusLabel(item.method)], ['Provedor', item.provider],
          ['ID externo', item.external_id], ['Cobrança criada', nullableDate(item.created_at)], ['Última atualização', nullableDate(item.updated_at)],
        ]} />
        <details className="ip-admin-expand"><summary>Alterar status</summary>
          <div className="ip-admin-actions">{[['paid','Marcar pago'],['pending','Voltar pendente'],['failed','Marcar falha'],['canceled','Cancelar']].filter(([key]) => key !== item.status).map(([key, label]) => (
            <AdminButton key={key} tone={key === 'canceled' ? 'danger' : undefined} disabled={savingId === item.id} onClick={() => onStatus(item.id, key)}>{label}</AdminButton>
          ))}</div>
        </details>
      </AdminDetail>} />
  </>;
}

function AdPreview({ isAd, values }) {
  const media = externalHttp(isAd ? values?.media_url : values?.image_url);
  return <div className="ip-admin-preview">
    {media && (!isAd || values?.media_type !== 'text') ? <div className={'ip-admin-media' + (isAd ? ' is-square' : '')}>
      {isAd && values?.media_type === 'video' ? <video aria-label="Prévia do vídeo" src={media} controls preload="metadata" /> : <img alt={isAd ? 'Prévia da imagem do anúncio' : 'Prévia da imagem da loja'} src={media} loading="lazy" />}
    </div> : null}
    {isAd ? <small className="ip-admin-muted">Patrocinado</small> : null}
    <h3>{(isAd ? values?.title : values?.name) || (isAd ? 'Título do anúncio' : 'Nome da loja')}</h3>
    <p className="ip-admin-muted">{values?.description || 'A descrição aparece aqui.'}</p>
    <div><span className="ip-admin-link">{values?.cta_label || (isAd ? 'Conhecer' : 'Ir ao site')}</span></div>
  </div>;
}

export function AdminAdvertising({ tab, changeTab, store, ad }) {
  const isAd = tab === 'ads';
  const model = isAd ? ad : store;
  const { items, loading, error, retry, saving, mode, startNew, startEdit, closeEditor, values, onChange, submit, toggle, remove } = model;
  const [item, choose] = useSelected(items, 'admin-ad-detail');
  const title = isAd ? 'Anúncio' : 'Loja';
  const titleKey = isAd ? 'title' : 'name';
  const selectRow = (id) => { if (!saving) { closeEditor(); choose(id); } };
  const startItem = (entry) => { startEdit(entry); choose(entry.id); scrollAdminDetail('admin-ad-editor'); };
  return <>
    <div className="ip-admin-heading">
      <AdminTabs label="Local da propaganda" options={ [['stores','Lojas recomendadas'],['ads','Anúncios do painel']] } value={tab} onChange={changeTab} />
      <AdminButton tone="primary" disabled={saving} onClick={() => { startNew(); scrollAdminDetail('admin-ad-editor'); }}><AdminIcon name="add" size={17} />{isAd ? 'Novo anúncio' : 'Nova loja'}</AdminButton>
    </div>
    <div className="ip-admin-layout">
      <AdminTable label={isAd ? 'Anúncios do painel' : 'Lojas recomendadas'} columns={[title, ...(isAd ? ['Formato'] : []), 'Posição', 'Status', 'Ações']}
        rows={items.map((entry) => ({ id: entry.id, cells: [
          entry[titleKey], ...(isAd ? [{ image: 'Imagem', video: 'Vídeo', text: 'Texto' }[entry.media_type] || '—'] : []),
          entry.sort_order ?? 0, <AdminBadge tone={entry.is_active ? 'success' : 'warning'}>{entry.is_active ? 'Ativo' : isAd ? 'Pausado' : 'Oculta'}</AdminBadge>,
          <AdminButton disabled={saving} onClick={() => startItem(entry)} aria-label={'Editar ' + entry[titleKey]}>Editar</AdminButton>,
        ] }))}
        selected={item?.id} onSelect={selectRow} loading={loading} error={error} onRetry={retry} />
      <div className="ip-admin-stack">
        {mode !== null ? <AdminDetail id="admin-ad-editor" title={(mode === 'new' ? (isAd ? 'Novo anúncio' : 'Nova loja') : 'Editar ' + title.toLowerCase())} onClose={saving ? undefined : closeEditor}>
          <form className="ip-admin-form" onSubmit={submit}>
            <AdminField label={isAd ? 'Título' : 'Nome da loja'}><input name={titleKey} value={values[titleKey]} onChange={onChange} required /></AdminField>
            <AdminField label="Descrição"><textarea name="description" rows={3} value={values.description} onChange={onChange} /></AdminField>
            {isAd ? <AdminField label="Formato"><AdminSelect name="media_type" label="Formato" options={ [['image','Imagem'],['video','Vídeo'],['text','Texto']] } value={values.media_type} onChange={onChange} /></AdminField> : null}
            {!isAd || values.media_type !== 'text' ? <AdminField label={isAd && values.media_type === 'video' ? 'URL do vídeo' : 'URL da imagem'}><input type="url" name={isAd ? 'media_url' : 'image_url'} value={isAd ? values.media_url : values.image_url} onChange={onChange} required={isAd} /></AdminField> : null}
            <AdminField label="Link de destino"><input type="url" name="link_url" value={values.link_url} onChange={onChange} /></AdminField>
            <AdminField label="Texto do botão"><input name="cta_label" value={values.cta_label} onChange={onChange} /></AdminField>
            <AdminField label="Posição"><input type="number" name="sort_order" value={values.sort_order} onChange={onChange} /></AdminField>
            <label className="ip-admin-check"><input type="checkbox" name="is_active" checked={values.is_active} onChange={onChange} />Exibir {title.toLowerCase()}</label>
            <div className="ip-admin-actions"><AdminButton tone="primary" disabled={saving} type="submit">{saving ? 'Salvando…' : 'Salvar'}</AdminButton><AdminButton disabled={saving} onClick={closeEditor}>Cancelar</AdminButton></div>
          </form>
        </AdminDetail> : null}
        <AdminDetail id="admin-ad-detail" title={isAd ? 'Prévia no painel' : 'Onde aparece'}>
          {!isAd ? <p className="ip-admin-muted">Página inicial do site</p> : null}
          {mode !== null || item ? <AdPreview isAd={isAd} values={mode !== null ? values : item} /> : <AdminEmpty>Selecione um item para ver a prévia.</AdminEmpty>}
          {item && mode === null && !loading && !error ? <div className="ip-admin-actions">
            <AdminButton disabled={saving} onClick={() => toggle(item)}>{item.is_active ? 'Desativar' : 'Ativar'}</AdminButton>
            <AdminButton disabled={saving} tone="danger" onClick={() => remove(item)}>Excluir</AdminButton>
          </div> : null}
        </AdminDetail>
      </div>
    </div>
  </>;
}

export function AdminAnnouncements({ values, onChange, onSubmit, sending }) {
  const labels = { info: 'Informação', success: 'Sucesso', warning: 'Aviso' };
  return <div className="ip-admin-layout is-balanced">
    <AdminDetail title="Novo comunicado">
      <form className="ip-admin-form" onSubmit={onSubmit}>
        <AdminField label="Título"><input name="title" value={values.title} onChange={onChange} required /></AdminField>
        <AdminField label="Tipo"><AdminSelect label="Tipo" name="type" options={Object.entries(labels)} value={values.type} onChange={onChange} /></AdminField>
        <AdminField label="Mensagem"><textarea name="message" rows={5} value={values.message} onChange={onChange} required /></AdminField>
        <div className="ip-admin-actions"><p><strong>Destinatários:</strong> todos os usuários</p><AdminButton tone="primary" disabled={sending} type="submit">{sending ? 'Enviando…' : 'Revisar envio'}</AdminButton></div>
      </form>
    </AdminDetail>
    <AdminDetail title="Prévia da notificação">
      <div className="ip-admin-preview"><div><AdminBadge tone={values.type}>{labels[values.type]}</AdminBadge></div><h3>{values.title.trim() || 'Título do comunicado'}</h3><p>{values.message.trim() || 'Sua mensagem aparece aqui.'}</p></div>
    </AdminDetail>
  </div>;
}

export function AdminMonitoring({ items, loading, error, refresh, updated, resolve, resolvingId }) {
  const [source, setSource] = useState('all');
  const sourceLabel = (value) => value === 'client' || value === 'frontend' ? 'Site' : value === 'api' || value === 'backend' || value === 'server' ? 'API' : value || '—';
  const filtered = items.filter((item) => source === 'all' || sourceLabel(item.source) === source);
  return <>
    <div className="ip-admin-summary ip-admin-card">
      <span><AdminIcon name="monitoring" size={18} /> <b>Erros recentes {error ? '—' : items.length}</b></span>
      <span className="ip-admin-muted">Última atualização: {nullableDate(updated)}</span>
      <AdminButton disabled={loading} onClick={refresh}><AdminIcon name="refresh" size={17} />Atualizar</AdminButton>
    </div>
    <div className="ip-admin-toolbar"><AdminSelect label="Origem do erro" options={ [['all','API e site'],['API','API'],['Site','Site']] } value={source} onChange={(event) => setSource(event.target.value)} /></div>
    <Listing detailId="admin-error-detail" label="Lista de erros" columns={['Evento','Hora','Origem','Status']} items={filtered}
      loading={loading} error={error} onRetry={refresh} empty="Nenhum erro pendente."
      renderCells={(item) => [item.message, nullableDate(item.created_at), sourceLabel(item.source), <AdminBadge tone="danger">{item.status_code || 'Erro'}</AdminBadge>]}
      renderDetail={(item, close) => <AdminDetail id="admin-error-detail" title="Detalhes do erro" onClose={close}>
        <h3>{item.message}</h3>
        <AdminFacts facts={[['Origem', sourceLabel(item.source)], ['Ocorrido em', nullableDate(item.created_at)], ['Status', item.status_code || 'Erro']]} />
        {item.route || item.method || item.severity ? <details className="ip-admin-expand"><summary>Ver contexto</summary><AdminFacts facts={[['Rota', item.route], ['Método', item.method], ['Severidade', item.severity]]} /></details> : null}
        <div><AdminButton disabled={resolvingId === item.id} onClick={() => resolve(item.id)}>Marcar como resolvido</AdminButton></div>
      </AdminDetail>} />
  </>;
}
