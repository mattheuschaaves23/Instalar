import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { notifyPanelBadgeCountsChanged } from '../Layout/panelBadgeCounts';
import PlanUsage from '../Subscription/PlanUsage';
import MarketplaceProposal from './MarketplaceProposal';
import { formatOpportunityDate, getOpportunityArea, getOpportunityState, getOpportunityTitle, mergeOpportunityPage } from './opportunityView';
import { planLinkLabel } from '../../utils/storePlanCopy';
import './Opportunities.css';

const NativeWhatsApp = registerPlugin('NativeWhatsApp');
const TABS = [
  { value: 'open', label: 'Novas', heading: 'Pedidos na sua região', empty: 'Nenhuma nova oportunidade por enquanto.', hint: 'Quando clientes da sua região publicarem pedidos, eles aparecem aqui.' },
  { value: 'interested', label: 'Meus interesses', heading: 'Pedidos com seu interesse', empty: 'Você ainda não demonstrou interesse em um pedido.', hint: 'Explore as novas oportunidades e toque em “Tenho interesse” no pedido que quiser atender.' },
  { value: 'selected', label: 'Escolheram você', heading: 'Clientes que escolheram você', empty: 'Nenhum cliente escolheu você por enquanto.', hint: 'Quando um cliente escolher seu perfil, o contato, a proposta e o acompanhamento ficam disponíveis aqui.' },
];
const initialFilters = { status: 'open', q: '', region: '', place: '', photos: false, sort: 'newest', offset: 0 };
const initialResult = { items: [], stats: {}, regions: [], total: 0, hasMore: false, loading: true, error: null, eligibility: {} };

export function OpportunityIcon({ name, size = 18 }) {
  const paths = {
    map: <><path d="M12 21s6-4.4 6-10a6 6 0 1 0-12 0c0 5.6 6 10 6 10Z" /><circle cx="12" cy="11" r="2" /></>,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
    area: <><path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4M9 9h6v6H9z" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4m8-4v4M4 10h16" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    filter: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="10" cy="18" r="2" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" /></>,
    photo: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8" cy="9" r="1.5" /><path d="m4 17 5-5 4 4 3-3 4 4" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    back: <path d="m10 5-7 7 7 7M3 12h18" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    check: <path d="m5 12 4 4L19 6" />,
    briefcase: <><rect x="4" y="6" width="16" height="14" rx="2" /><path d="M9 6V3h6v3M4 12h16" /></>,
    whatsapp: <><path d="M20.5 11.7a8.6 8.6 0 0 1-12.9 7.5L3 20.5l1.3-4.4A8.6 8.6 0 1 1 20.5 11.7Z" /><path d="m8 7 1.5 3-1 1a8 8 0 0 0 4.5 4.5l1-1 3 1.5" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.briefcase}</svg>;
}

async function openWhatsApp(url, tab) {
  if (tab && !tab.closed) { tab.location.replace(url); return; }
  if (Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('NativeWhatsApp')) { await NativeWhatsApp.open({ url }); return; }
  if (Capacitor.isNativePlatform()) { await Browser.open({ url }); return; }
  const opened = window.open(url, '_blank');
  if (opened) opened.opener = null;
  else toast('Interesse registrado. Toque em “Reabrir WhatsApp” para continuar.');
}

function OpportunityPhoto({ src, className = '', alt = '' }) {
  const [failedSource, setFailedSource] = useState(null);
  return src && failedSource !== src
    ? <img className={className} src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailedSource(src)} />
    : <span className={'opp-no-photo ' + className}><OpportunityIcon name="photo" size={28} /><span>Sem foto</span></span>;
}

export function OpportunityCard({ item, selected, onSelect }) {
  const state = getOpportunityState(item);
  return (
    <button className={'opp-card' + (selected ? ' is-selected' : '')} onClick={onSelect} type="button" aria-pressed={selected} aria-controls="opp-order-detail">
      <OpportunityPhoto src={item.photo_urls?.[0]} className="opp-card-photo" />
      <span className="opp-card-copy">
        <strong className="opp-card-title">{getOpportunityTitle(item)}</strong>
        <span className="opp-card-location"><OpportunityIcon name="map" />{[item.neighborhood, item.city, item.state].filter(Boolean).join(', ') || 'Região a confirmar'}</span>
        <span className="opp-card-facts"><span><OpportunityIcon name="area" />{getOpportunityArea(item)}</span><span><OpportunityIcon name="calendar" />{item.urgency_label || 'Prazo a combinar'}</span></span>
        <span className="opp-card-bottom"><span className={'opp-state opp-state--' + state.key}>{state.key === 'new' ? (item.is_direct ? 'Pedido direto' : 'Novo') : state.label}</span><time dateTime={Number.isFinite(Date.parse(item.created_at)) ? item.created_at : undefined}>{formatOpportunityDate(item.created_at)}</time><span>{item.is_direct ? 'Link do seu perfil' : item.distance_label || 'Distância a confirmar'}</span></span>
      </span>
      <OpportunityIcon name="chevron" />
    </button>
  );
}

function WhatsAppAction({ href, children, primary = false }) {
  return <a className={primary ? 'opp-primary' : 'opp-secondary'} href={href} target="_blank" rel="noreferrer" onClick={(event) => {
    if (!Capacitor.isNativePlatform()) return;
    event.preventDefault();
    void openWhatsApp(href).catch(() => toast.error('Não foi possível abrir o WhatsApp.'));
  }}><OpportunityIcon name="whatsapp" size={21} />{children}</a>;
}

export function OpportunityDetail({ item, eligibility, sending, onInterest, onClose, onUpdated, titleRef }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = Array.isArray(item.photo_urls) ? item.photo_urls : [];
  const photo = photos[photoIndex] || photos[0];
  const state = getOpportunityState(item);
  const closed = ['completed', 'canceled', 'expired'].includes(state.key);
  const readinessLink = eligibility.requirement_code === 'FREE_INTEREST_LIMIT' ? '/subscription' : '/profile';
  return (
    <aside className="opp-detail" id="opp-order-detail" aria-label="Detalhes do pedido">
      <button className="opp-back-to-list" type="button" onClick={onClose}><OpportunityIcon name="back" />Voltar aos pedidos</button>
      <header className="opp-detail-head">
        <div><h2 ref={titleRef} tabIndex={-1}>{getOpportunityTitle(item)}</h2><p>{item.is_direct ? 'Pedido direto' : 'Pedido'} #{item.id}</p></div>
        <button className="opp-icon-button opp-detail-close" type="button" aria-label="Fechar detalhes do pedido" onClick={onClose}><OpportunityIcon name="close" /></button>
      </header>
      <div className="opp-gallery">
      {photo ? <a className="opp-cover" href={photo} target="_blank" rel="noreferrer" aria-label="Abrir foto do pedido em tamanho original"><OpportunityPhoto src={photo} alt="Foto enviada pelo cliente para este pedido" /><span className="opp-photo-count"><OpportunityIcon name="photo" />{photos.length} {photos.length === 1 ? 'foto' : 'fotos'}</span></a>
        : <div className="opp-cover opp-cover-empty"><OpportunityIcon name="photo" size={32} /><p>O cliente não enviou fotos.</p></div>}
      {photos.length > 1 ? <div className="opp-photo-options" aria-label="Fotos do pedido">{photos.map((src, index) => <button key={src + index} type="button" onClick={() => setPhotoIndex(index)} aria-label={'Ver foto ' + (index + 1)} aria-pressed={photoIndex === index}><OpportunityPhoto src={src} /></button>)}</div> : null}
      </div>
      <div className="opp-client"><span className="opp-client-avatar" aria-hidden="true">{item.client_name?.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || <OpportunityIcon name="briefcase" />}</span><div><strong>{item.client_name || (item.is_direct ? 'Cliente do seu perfil' : 'Cliente da região')}</strong><p>{[item.neighborhood, item.city, item.state].filter(Boolean).join(', ') || 'Região a confirmar'}</p></div></div>
      <dl className="opp-fact-grid">
        <div><dt>Medidas</dt><dd>{getOpportunityArea(item)}</dd></div>
        <div><dt>Serviço</dt><dd>{item.service_label || 'A combinar'}</dd></div>
        <div><dt>Prazo</dt><dd>{item.urgency_label || 'A combinar'}</dd></div>
        <div><dt>Local</dt><dd>{item.place_label || 'Não informado'}</dd></div>
      </dl>
      <section className="opp-description"><h3>Sobre o serviço</h3><p>{item.details || 'O cliente não acrescentou uma descrição. Combine os detalhes antes de enviar a proposta.'}</p>{item.material_label ? <p className="opp-material">{item.material_label}</p> : null}</section>
      {item.selected_by_me && (item.client_phone || item.address_reference) ? <section className="opp-contact"><h3>Contato liberado pelo cliente</h3>{item.client_phone ? <p>{item.client_phone}</p> : null}{item.address_reference ? <p>{item.address_reference}</p> : null}</section> : null}
      <footer className="opp-detail-actions">
        {state.key !== 'new' ? <div className={'opp-outcome opp-outcome--' + state.key}><strong>{state.label}</strong><p>{state.hint}</p></div> : null}
        {item.selected_by_me ? <>
          {item.whatsapp_url ? <WhatsAppAction href={item.whatsapp_url}>Chamar no WhatsApp</WhatsAppAction> : null}
          <MarketplaceProposal requestId={item.id} requestStatus={item.status} onUpdated={onUpdated} triggerClassName="opp-primary" />
        </> : closed || item.not_selected ? null : item.is_direct ? (
          <><button className="opp-primary" type="button" disabled={sending} onClick={() => onInterest(item)}><OpportunityIcon name="check" size={21} />{sending ? 'Preparando orçamento…' : 'Aceitar e montar orçamento'}</button><p className="opp-action-note">Este cliente enviou o pedido só para você. Aceitar abre um rascunho, sem enviar mensagens nem confirmar o serviço.</p></>
        ) : item.interest_whatsapp_url ? <WhatsAppAction href={item.interest_whatsapp_url} primary>Reabrir WhatsApp</WhatsAppAction>
          : item.interested_by_me ? null : eligibility.can_express_interest !== false
            ? <><button className="opp-primary" type="button" disabled={sending} onClick={() => onInterest(item)}><OpportunityIcon name={item.can_contact_on_interest ? 'whatsapp' : 'check'} size={21} />{sending ? 'Registrando interesse...' : 'Tenho interesse'}</button><p className="opp-action-note">{item.can_contact_on_interest ? 'Abre o WhatsApp. Você envia a mensagem.' : 'Seu interesse será apresentado ao cliente.'}<br />O cliente escolhe o profissional.</p></>
            : <><Link className="opp-primary" to={readinessLink}>{readinessLink === '/subscription' ? planLinkLabel('Conhecer o Pro') : 'Revisar meu perfil'}</Link><p className="opp-action-note">{eligibility.message || 'Complete os dados essenciais para demonstrar interesse.'}</p></>}
      </footer>
    </aside>
  );
}

export default function Opportunities() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rawId = params.get('pedido');
  const linkedId = /^[1-9]\d{0,9}$/.test(rawId || '') && Number(rawId) <= 2147483647 ? rawId : null;
  const { refreshSubscription } = useSubscription();
  const [filters, setFilters] = useState(initialFilters);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [resultState, setResult] = useState(initialResult);
  const [refresh, setRefresh] = useState(0);
  const [selectedId, setSelectedId] = useState(undefined);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const pendingInterest = useRef(false);
  const alive = useRef(true);
  const detailTitle = useRef(null);
  const lastCard = useRef(null);
  const tabRefs = useRef([]);
  const filterKey = JSON.stringify({ ...filters, linkedId, offset: 0 });
  const loadKey = JSON.stringify([filters, linkedId, refresh]);
  const result = resultState.key === loadKey ? resultState : { ...resultState, loading: true, items: resultState.filterKey === filterKey ? resultState.items : [] };
  const tab = TABS.find((item) => item.value === filters.status);
  const selected = linkedId ? result.items.find((item) => String(item.id) === linkedId) || null
    : selectedId === null ? null : result.items.find((item) => item.id === selectedId) || result.items[0] || null;
  const showDetail = detailOpen || Boolean(linkedId);
  const filterCount = Number(Boolean(filters.place)) + Number(filters.photos);
  const hasSearch = Boolean(filters.q || filters.region || filterCount);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const timer = setTimeout(() => setFilters((current) => current.q === search.trim() ? current : { ...current, q: search.trim(), offset: 0 }), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    const [city, state] = filters.region.split('|');
    setResult((current) => ({ ...current, loading: true, error: null, items: current.filterKey === filterKey ? current.items : [] }));
    api.get('/opportunities', { signal: controller.signal, params: linkedId
      ? { status: 'all', request_id: linkedId, limit: 1 }
      : { status: filters.status, q: filters.q, city, state, place: filters.place, photos: filters.photos ? 'true' : '', sort: filters.sort, offset: filters.offset, limit: 12 } })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setResult((current) => ({ key: loadKey, filterKey, items: !linkedId && filters.offset ? mergeOpportunityPage(current.items, data.opportunities || []) : data.opportunities || [], stats: data.stats || {}, regions: data.regions || [], total: data.pagination?.total ?? data.opportunities?.length ?? 0, hasMore: Boolean(data.pagination?.has_more), eligibility: data.eligibility || {}, loading: false, error: null }));
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        const code = error.response?.data?.code;
        setResult((current) => ({ ...current, key: loadKey, loading: false, error: { code, message: error.response?.data?.error || 'Não foi possível carregar os pedidos. Tente novamente.' } }));
      });
    return () => controller.abort();
  }, [filters, linkedId, refresh, loadKey, filterKey]);
  useEffect(() => {
    if (showDetail) detailTitle.current?.focus();
    else lastCard.current?.focus();
  }, [showDetail, selected?.id]);

  const changeFilter = (change) => {
    setFilters((current) => ({ ...current, ...change, offset: 0 }));
    setSelectedId(undefined);
    setDetailOpen(false);
  };
  const changeTab = (status) => {
    setSearch('');
    setFilters({ ...initialFilters, status });
    setSelectedId(undefined);
    setDetailOpen(false);
  };
  const clearFilters = () => {
    setSearch('');
    setFilters({ ...initialFilters, status: filters.status, sort: filters.sort });
  };
  const reload = () => { setFilters((current) => ({ ...current, offset: 0 })); setRefresh((current) => current + 1); };
  const handleInterest = async (item) => {
    if (pendingInterest.current) return;
    pendingInterest.current = true;
    const whatsAppTab = !item.is_direct && item.can_contact_on_interest && !Capacitor.isNativePlatform() ? window.open('about:blank', '_blank') : null;
    if (whatsAppTab) whatsAppTab.opener = null;
    setSendingId(item.id);
    try {
      const { data } = await api.post('/opportunities/' + item.id + (item.is_direct ? '/accept-direct' : '/interest'));
      notifyPanelBadgeCountsChanged();
      void refreshSubscription();
      if (item.is_direct) {
        if (alive.current) navigate(`/budgets/${data.budget_id}/complete`);
        return;
      }
      if (alive.current) {
        setSearch('');
        setFilters({ ...initialFilters, status: 'interested' });
        setSelectedId(item.id);
        setRefresh((current) => current + 1);
      }
      if (data.opportunity?.interest_whatsapp_url) {
        try { await openWhatsApp(data.opportunity.interest_whatsapp_url, whatsAppTab); }
        catch { whatsAppTab?.close(); toast('Interesse registrado. Use “Reabrir WhatsApp” para continuar.'); }
      } else { whatsAppTab?.close(); toast.success('Interesse registrado. Acompanhe em “Meus interesses”.'); }
    } catch (error) {
      whatsAppTab?.close();
      toast.error(error.response?.data?.error || (item.is_direct ? 'Não foi possível aceitar o pedido direto.' : 'Não foi possível registrar o interesse.'));
    } finally { pendingInterest.current = false; if (alive.current) setSendingId(null); }
  };

  return (
    <div className="opp-workspace" data-detail-open={showDetail && Boolean(selected)}>
      <header className="opp-heading">
        <div><h1>Oportunidades</h1><p>{linkedId ? `Pedido #${linkedId} aberto pela notificação.` : 'Encontre seu próximo serviço na sua região.'}</p></div>
        <div className="opp-heading-actions">
          <Link className="opp-secondary" to={linkedId ? '/opportunities' : '/profile#link-para-clientes'}>{linkedId ? 'Ver todos os pedidos' : 'Link para clientes'}</Link>
          <button className="opp-secondary" disabled={result.loading} onClick={reload} type="button"><OpportunityIcon name="refresh" />Atualizar</button>
        </div>
      </header>
      {linkedId ? null : <><div className="opp-tabs" role="tablist" aria-label="Situação das oportunidades">{TABS.map((item, index) => <button key={item.value} ref={(node) => { tabRefs.current[index] = node; }} role="tab" id={'opp-tab-' + item.value} aria-selected={filters.status === item.value} aria-controls="opp-results" tabIndex={filters.status === item.value ? 0 : -1} type="button" onClick={() => changeTab(item.value)} onKeyDown={(event) => {
        const next = event.key === 'ArrowRight' ? (index + 1) % TABS.length : event.key === 'ArrowLeft' ? (index + TABS.length - 1) % TABS.length : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : null;
        if (next === null) return;
        event.preventDefault(); changeTab(TABS[next].value); tabRefs.current[next]?.focus();
      }}>{item.label}<span>{result.stats[item.value] ?? '—'}</span></button>)}</div>
      <div className="opp-toolbar">
        <label className="opp-search"><OpportunityIcon name="search" /><input aria-label="Buscar por bairro ou serviço" placeholder="Buscar por bairro ou serviço" value={search} onChange={(event) => setSearch(event.target.value)} type="search" /></label>
        <label className="opp-region"><OpportunityIcon name="map" /><select aria-label="Filtrar por cidade" value={filters.region} onChange={(event) => changeFilter({ region: event.target.value })}><option value="">{filters.status === 'open' ? 'Minha região' : 'Todas as cidades'}</option>{result.regions.map((region) => <option key={region.city + region.state} value={region.city + '|' + region.state}>{region.city}, {region.state}</option>)}</select></label>
        <button className={'opp-secondary' + (showFilters ? ' is-active' : '')} type="button" aria-expanded={showFilters} aria-controls="opp-more-filters" onClick={() => setShowFilters((current) => !current)}><OpportunityIcon name="filter" />Filtros{filterCount ? <span className="opp-filter-count">{filterCount}</span> : null}</button>
      </div>
      {showFilters ? <div className="opp-more-filters" id="opp-more-filters"><label>Local da instalação<select value={filters.place} onChange={(event) => changeFilter({ place: event.target.value })}><option value="">Todos os locais</option><option value="residential">Casa ou apartamento</option><option value="commercial">Empresa ou loja</option><option value="other">Outro local</option></select></label><label className="opp-checkbox"><input type="checkbox" checked={filters.photos} onChange={(event) => changeFilter({ photos: event.target.checked })} />Somente pedidos com fotos</label>{hasSearch ? <button type="button" className="opp-text-button" onClick={clearFilters}>Limpar filtros</button> : null}</div> : null}
      <PlanUsage compact className="opp-plan-usage" usageKey="monthly_interests" />
      {result.eligibility.message ? <div className="opp-readiness"><p>{result.eligibility.message}</p><Link to={result.eligibility.requirement_code === 'FREE_INTEREST_LIMIT' ? '/subscription' : '/profile'}>{result.eligibility.requirement_code === 'FREE_INTEREST_LIMIT' ? planLinkLabel('Conhecer o Pro') : 'Revisar perfil'}</Link></div> : null}
      </>}
      <section role={linkedId ? undefined : 'tabpanel'} id="opp-results" aria-label={linkedId ? 'Pedido da notificação' : undefined} aria-labelledby={linkedId ? undefined : 'opp-tab-' + filters.status} className="opp-results" aria-busy={result.loading}>
        <div className="opp-browser-list">
          <div className="opp-list-heading"><h2>{linkedId ? 'Pedido da notificação' : tab.heading}{!result.loading && !linkedId ? <span> ({result.total})</span> : null}</h2>{!linkedId ? <select aria-label="Ordenar pedidos" value={filters.sort} onChange={(event) => changeFilter({ sort: event.target.value })}><option value="newest">Mais recentes</option><option value="nearest">Mais próximos</option><option value="oldest">Mais antigos</option></select> : null}</div>
          {result.error ? <div className="opp-empty" role="alert"><OpportunityIcon name="briefcase" size={32} /><h3>{['PROFILE_LOCATION_REQUIRED', 'PROFILE_ESSENTIALS_REQUIRED', 'EMAIL_VERIFICATION_REQUIRED'].includes(result.error.code) ? 'Revise os dados essenciais do perfil' : 'Não foi possível abrir os pedidos'}</h3><p>{result.error.message}</p>{['PROFILE_LOCATION_REQUIRED', 'PROFILE_ESSENTIALS_REQUIRED', 'EMAIL_VERIFICATION_REQUIRED'].includes(result.error.code) ? <Link className="opp-primary" to="/profile">Revisar meu perfil</Link> : <button className="opp-secondary" onClick={reload} type="button">Tentar novamente</button>}</div>
            : result.loading && !result.items.length ? <div className="opp-list-loading" role="status"><OpportunityIcon name="refresh" /><span>Buscando pedidos...</span></div>
              : linkedId && !selected ? <div className="opp-empty" role="status"><h3>Este pedido não está mais disponível.</h3><p>Ele pode ter sido encerrado ou não estar disponível para a sua conta.</p><Link className="opp-secondary" to="/opportunities">Voltar para oportunidades</Link></div>
              : !result.items.length ? <div className="opp-empty"><OpportunityIcon name="briefcase" size={32} /><h3>{hasSearch ? 'Nenhum pedido com esses filtros.' : tab.empty}</h3><p>{hasSearch ? 'Tente outro bairro, cidade ou serviço, ou limpe os filtros.' : tab.hint}</p>{hasSearch ? <button type="button" className="opp-secondary" onClick={clearFilters}>Limpar filtros</button> : filters.status !== 'open' ? <button type="button" className="opp-secondary" onClick={() => changeTab('open')}>Ver novas oportunidades</button> : null}</div>
                : <><div className="opp-list">{result.items.map((item) => <OpportunityCard key={item.id} item={item} selected={selected?.id === item.id} onSelect={(event) => { lastCard.current = event.currentTarget; setSelectedId(item.id); setDetailOpen(true); }} />)}</div><div className="opp-pagination"><p aria-live="polite">Mostrando {result.items.length} de {result.total} {result.total === 1 ? 'pedido' : 'pedidos'}</p>{result.hasMore ? <button className="opp-secondary" type="button" disabled={result.loading} onClick={() => setFilters((current) => ({ ...current, offset: result.items.length }))}>{result.loading ? 'Carregando...' : 'Carregar mais'}</button> : null}</div></>}
        </div>
        {!result.error && selected ? <OpportunityDetail key={selected.id} item={selected} eligibility={result.eligibility} sending={sendingId === selected.id} onInterest={handleInterest} onClose={() => { if (linkedId) navigate('/opportunities'); else { setSelectedId(null); setDetailOpen(false); } }} onUpdated={reload} titleRef={detailTitle} /> : <div className="opp-detail-placeholder"><OpportunityIcon name="briefcase" size={32} /><p>Selecione um pedido para ver os detalhes.</p></div>}
      </section>
    </div>
  );
}
