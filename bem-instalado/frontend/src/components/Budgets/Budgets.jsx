import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import toast from 'react-hot-toast';
import api from '../../services/api';
import PaginationControls from '../Layout/PaginationControls';
import { notifyPanelBadgeCountsChanged } from '../Layout/panelBadgeCounts';
import { formatCurrency, formatDateTime, formatStatusLabel } from '../../utils/formatters';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { installmentInfo, installmentAmountLabel, installmentConditionsLabel } from '../../../../shared/installmentTerms.mjs';
import { BUDGET_DATE_PERIODS, BUDGET_FILTERS, canCompleteBudget, formatBudgetDate, getBudgetCounts, getBudgetDateRange, getVisibleBudgets } from './budgetListView';
import { planLinkLabel } from '../../utils/storePlanCopy';
import './Budgets.css';

const BUDGETS_PER_PAGE = 6;
const DEFAULT_DATE_FILTER = { period: 'all', from: '', to: '' };

function formatToDatetimeLocal(date) {
  const safe = date instanceof Date ? date : new Date(date);
  const year = safe.getFullYear();
  const month = String(safe.getMonth() + 1).padStart(2, '0');
  const day = String(safe.getDate()).padStart(2, '0');
  const hours = String(safe.getHours()).padStart(2, '0');
  const minutes = String(safe.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function ListIcon({ name }) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="6.25" /><path d="m15 15 5 5" /></>,
    plus: <path d="M12 4v16M4 12h16" />,
    agenda: <><rect x="4" y="6" width="16" height="14" rx="2" /><path d="M8 4v4m8-4v4M4 11h16" /></>,
    more: <><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function BudgetActions({ budget, busy, onApprove, onReject, onDownload, onWhatsApp }) {
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!expanded) return undefined;
    const root = rootRef.current;
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    const dock = root.closest('.ref-panel-main')?.querySelector('.ref-panel-bottom-nav');
    const fitMenu = () => {
      const anchor = trigger.getBoundingClientRect();
      const dockBox = dock?.getBoundingClientRect();
      const bottom = dockBox?.height ? Math.min(window.innerHeight, dockBox.top) : window.innerHeight;
      const below = Math.max(0, bottom - anchor.bottom - 8);
      const above = Math.max(0, anchor.top - 8);
      const openUp = panel.scrollHeight > below && above > below;
      panel.dataset.openUp = String(openUp);
      panel.style.setProperty('--budget-menu-max-height', `${openUp ? above : below}px`);
    };
    fitMenu();
    root.addEventListener('toggle', fitMenu, true);
    window.addEventListener('resize', fitMenu);
    return () => {
      root.removeEventListener('toggle', fitMenu, true);
      window.removeEventListener('resize', fitMenu);
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return undefined;
    const dismissOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setExpanded(false);
    };
    const dismissEscape = (event) => {
      if (event.key === 'Escape') {
        setExpanded(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('focusin', dismissOutside);
    document.addEventListener('keydown', dismissEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('focusin', dismissOutside);
      document.removeEventListener('keydown', dismissEscape);
    };
  }, [expanded]);

  if (budget.status === 'draft') return canCompleteBudget(budget)
    ? <Link className="budget-list-button is-primary" to={`/budgets/${budget.id}/complete`}>Completar orçamento</Link>
    : <span className="budget-list-closed">Pedido encerrado</span>;

  const runAction = (action) => {
    setExpanded(false);
    triggerRef.current?.focus();
    action(budget.id);
  };

  return <>
    {budget.status === 'pending' ? (
      <button className="budget-list-button" disabled={busy} onClick={() => onApprove(budget.id)} type="button">
        Aprovar e agendar
      </button>
    ) : null}
    {budget.status === 'approved' ? <button className="budget-list-button" onClick={() => onDownload(budget.id)} type="button">Baixar PDF</button> : null}
    <div className="budget-list-more" ref={rootRef}>
      <button className="budget-list-button is-icon" type="button" aria-label={`Mais ações do orçamento #${budget.id}`}
        aria-expanded={expanded} aria-controls={expanded ? menuId : undefined} ref={triggerRef} onClick={() => setExpanded(!expanded)}>
        <ListIcon name="more" />
      </button>
      {expanded ? (
        <div id={menuId} className="budget-list-action-panel" ref={panelRef}>
          <details className="budget-list-row-details">
            <summary>Ver detalhes</summary>
            <div>
              <p>Criado em {formatDateTime(budget.created_at)}</p>
              {budget.source_service_request_id ? <p>Pedido da InstalaPro #{budget.source_service_request_id}</p> : null}
              <p>{installmentAmountLabel(installmentInfo(budget))}</p>
              {budget.installment_enabled ? <p>{installmentConditionsLabel(installmentInfo(budget))}</p> : null}
            </div>
          </details>
          {budget.status !== 'approved' ? <button onClick={() => runAction(onDownload)} type="button">Baixar PDF</button> : null}
          <button onClick={() => runAction(onWhatsApp)} type="button">Enviar no WhatsApp</button>
          {budget.status === 'pending' ? <button disabled={busy} onClick={() => runAction(onReject)} type="button">Rejeitar</button> : null}
        </div>
      ) : null}
    </div>
  </>;
}

export default function Budgets() {
  const [params] = useSearchParams();
  const requestedBudget = params.get('orcamento');
  const initialQuery = /^[1-9]\d{0,9}$/.test(requestedBudget || '') ? '#' + requestedBudget : '';
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState('newest');
  const [dateFilter, setDateFilter] = useState(DEFAULT_DATE_FILTER);
  const dateErrorId = useId();
  const [currentPage, setCurrentPage] = useState(1);
  const [approvalDraft, setApprovalDraft] = useState({ budgetId: null, scheduleDate: '' });
  const [mutatingBudgetId, setMutatingBudgetId] = useState(null);
  const { isPro, planAccess } = useSubscription();

  const loadBudgets = async () => {
    try {
      const response = await api.get('/budgets', { params: { include_drafts: true } });
      setBudgets(response.data);
      setLoadError('');
    } catch (error) {
      setLoadError(error.response?.data?.error || 'Não foi possível carregar orçamentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudgets();
  }, []);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      setStatus('all');
      setDateFilter(DEFAULT_DATE_FILTER);
      setCurrentPage(1);
    }
  }, [initialQuery]);

  const openApprovalModal = (budgetId) => {
    const suggestedDate = new Date();
    suggestedDate.setDate(suggestedDate.getDate() + 1);
    suggestedDate.setHours(9, 0, 0, 0);

    setApprovalDraft({
      budgetId,
      scheduleDate: formatToDatetimeLocal(suggestedDate),
    });
  };

  const closeApprovalModal = () => {
    setApprovalDraft({ budgetId: null, scheduleDate: '' });
  };

  const approveBudget = async () => {
    if (mutatingBudgetId) return;
    if (!approvalDraft.budgetId || !approvalDraft.scheduleDate) {
      toast.error('Escolha a data e a hora da instalação.');
      return;
    }

    setMutatingBudgetId(approvalDraft.budgetId);
    try {
      await api.put(`/budgets/${approvalDraft.budgetId}/approve`, {
        schedule_date: `${approvalDraft.scheduleDate.replace('T', ' ')}:00`,
      });
      toast.success('Orçamento aprovado e enviado para agenda.');
      setCurrentPage(1);
      closeApprovalModal();
      await loadBudgets();
      notifyPanelBadgeCountsChanged();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível aprovar o orçamento.');
    } finally {
      setMutatingBudgetId(null);
    }
  };

  const rejectBudget = async (budgetId) => {
    if (mutatingBudgetId) return;
    setMutatingBudgetId(budgetId);
    try {
      await api.put(`/budgets/${budgetId}/reject`);
      toast.success('Orçamento rejeitado.');
      await loadBudgets();
      notifyPanelBadgeCountsChanged();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível rejeitar o orçamento.');
    } finally {
      setMutatingBudgetId(null);
    }
  };

  const openWhatsapp = async (budgetId) => {
    try {
      const response = await api.get(`/budgets/${budgetId}/whatsapp`);
      window.open(response.data.link, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível abrir o WhatsApp.');
    }
  };

  const downloadPdf = async (budgetId) => {
    try {
      const response = await api.get(`/budgets/${budgetId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `orcamento-${budgetId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível gerar o PDF.');
    }
  };

  const counts = useMemo(() => getBudgetCounts(budgets), [budgets]);
  const exactId = initialQuery && query.trim() === initialQuery ? requestedBudget : null;
  const { from: dateFrom, to: dateTo, invalid: invalidDateRange } = getBudgetDateRange(dateFilter);
  const visibleBudgets = useMemo(
    () => getVisibleBudgets(budgets, { status, query, sort, exactId, dateFrom, dateTo }),
    [budgets, status, query, sort, exactId, dateFrom, dateTo],
  );
  const totalPages = Math.max(1, Math.ceil(visibleBudgets.length / BUDGETS_PER_PAGE));
  const normalizedPage = Math.min(currentPage, totalPages);
  const start = (normalizedPage - 1) * BUDGETS_PER_PAGE;
  const paginatedBudgets = visibleBudgets.slice(start, start + BUDGETS_PER_PAGE);
  const budgetLimit = planAccess?.limits?.monthly_budgets;
  const budgetsUsed = Number(planAccess?.usage?.monthly_budgets || 0);

  const changeStatus = (value) => {
    setStatus(value);
    setCurrentPage(1);
  };

  const changeDateFilter = (change) => {
    setDateFilter((current) => ({ ...current, ...change }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setQuery('');
    setDateFilter(DEFAULT_DATE_FILTER);
    changeStatus('all');
  };

  return (
    <section className="budget-list" aria-labelledby="budget-list-title">
      <header className="budget-list-heading">
        <h1 id="budget-list-title">Orçamentos</h1>
        <div className="budget-list-header-actions">
          <Link className="budget-list-button is-agenda-desktop" to="/agenda">Ver agenda</Link>
          <Link className="budget-list-button is-primary" to="/budgets/new"><ListIcon name="plus" />Novo orçamento</Link>
        </div>
      </header>

      <div aria-label="Filtrar orçamentos por status" className="budget-list-tabs" role="group">
        {BUDGET_FILTERS.map((filter) => (
          <button aria-pressed={status === filter.value} key={filter.value} onClick={() => changeStatus(filter.value)} type="button">
            <span>{filter.label}</span><span className="budget-list-count">{counts[filter.value]}</span>
          </button>
        ))}
      </div>

      <div className="budget-list-tools">
        <label className="budget-list-search">
          <ListIcon name="search" />
          <span className="sr-only">Buscar por cliente ou número</span>
          <input placeholder="Buscar por cliente ou número" type="search" value={query}
            onChange={(event) => { setQuery(event.target.value); setCurrentPage(1); }} />
        </label>
        <label className="budget-list-filter-field budget-list-period">
          <span>Data de criação</span>
          <span className="budget-list-select">
            <select value={dateFilter.period} onChange={(event) => changeDateFilter({ period: event.target.value })}>
              {BUDGET_DATE_PERIODS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
            <ListIcon name="chevron" />
          </span>
        </label>
        <label className="budget-list-select budget-list-sort">
          <span className="sr-only">Ordenar orçamentos</span>
          <select value={sort} onChange={(event) => { setSort(event.target.value); setCurrentPage(1); }}>
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="highest">Maior valor</option>
            <option value="lowest">Menor valor</option>
          </select>
          <ListIcon name="chevron" />
        </label>
        {dateFilter.period === 'custom' ? (
          <fieldset className="budget-list-date-range">
            <legend className="sr-only">Período personalizado</legend>
            <label className="budget-list-filter-field">
              <span>De</span>
              <input type="date" value={dateFilter.from} onChange={(event) => changeDateFilter({ from: event.target.value })} />
            </label>
            <label className="budget-list-filter-field">
              <span>Até</span>
              <input aria-describedby={invalidDateRange ? dateErrorId : undefined} aria-invalid={invalidDateRange}
                type="date" value={dateFilter.to} onChange={(event) => changeDateFilter({ to: event.target.value })} />
            </label>
            {invalidDateRange ? <p id={dateErrorId} role="status">A data final não pode ser anterior à inicial.</p> : null}
          </fieldset>
        ) : null}
        <div className="budget-list-mobile-tools">
          <label className="budget-list-select">
            <span className="sr-only">Filtrar por status</span>
            <select value={status} onChange={(event) => changeStatus(event.target.value)}>
              {BUDGET_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>Status: {filter.label}</option>)}
            </select>
            <ListIcon name="chevron" />
          </label>
          <Link className="budget-list-mobile-agenda" to="/agenda"><ListIcon name="agenda" />Ver agenda</Link>
        </div>
      </div>

      {loading ? <p className="budget-list-feedback" role="status">Carregando orçamentos…</p> : null}
      {loadError ? (
        <div className="budget-list-feedback" role="alert">
          <p>{loadError}</p>
          <button className="budget-list-button" onClick={loadBudgets} type="button">Tentar novamente</button>
        </div>
      ) : null}

      {paginatedBudgets.length ? (
        <div className="budget-list-surface">
          <table aria-label="Lista de orçamentos" className="budget-list-table" role="table">
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col" role="columnheader">Orçamento</th>
                <th scope="col" role="columnheader">Cliente</th>
                <th scope="col" role="columnheader">Data</th>
                <th scope="col" role="columnheader">Status</th>
                <th className="budget-list-value" scope="col" role="columnheader">Valor</th>
                <th scope="col" role="columnheader">Ações</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {paginatedBudgets.map((budget) => (
                <tr data-status={budget.status} key={budget.id} role="row">
                  <td className="budget-list-id" role="cell">#{budget.id}</td>
                  <td className="budget-list-client" role="cell">{budget.client_name || 'Cliente não informado'}</td>
                  <td className="budget-list-date" role="cell"><span className="budget-list-mobile-id">#{budget.id} <span aria-hidden="true">·</span> </span>{formatBudgetDate(budget.created_at)}</td>
                  <td className="budget-list-state" role="cell"><span className="budget-list-status" data-status={budget.status}>{formatStatusLabel(budget.status)}</span></td>
                  <td className="budget-list-value" role="cell">{budget.status === 'draft' || budget.total_amount == null ? '—' : formatCurrency(budget.total_amount)}</td>
                  <td className="budget-list-actions" role="cell">
                    <div className="budget-list-row-actions">
                      <BudgetActions budget={budget} busy={Boolean(mutatingBudgetId)}
                        onApprove={openApprovalModal} onReject={rejectBudget} onDownload={downloadPdf} onWhatsApp={openWhatsapp} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (!loading && !loadError ? (
        <div className="budget-list-feedback">
          {budgets.length ? <>
            <p>Nenhum orçamento encontrado.</p>
            <button className="budget-list-button" onClick={clearFilters} type="button">Limpar filtros</button>
          </> : <p>Nenhum orçamento cadastrado ainda.</p>}
        </div>
      ) : null)}

      {!loading && !loadError ? (
        <footer className="budget-list-footer">
          <p aria-live="polite">{visibleBudgets.length} {visibleBudgets.length === 1 ? 'orçamento' : 'orçamentos'}</p>
          {!isPro && budgetLimit != null ? (
            <p>Plano Grátis: {budgetsUsed} de {budgetLimit} usados neste mês · <Link to="/subscription">{planLinkLabel('Conhecer o Pro')}</Link></p>
          ) : null}
        </footer>
      ) : null}

      <PaginationControls currentPage={normalizedPage} onPageChange={setCurrentPage} totalPages={totalPages} />

      {approvalDraft.budgetId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(4,4,4,0.72)] px-4 backdrop-blur-md">
          <div aria-labelledby="budget-approval-title" aria-modal="true" role="dialog" className="lux-panel w-full max-w-lg p-6 sm:p-7">
            <p className="eyebrow">Aprovação guiada</p>
            <h2 id="budget-approval-title" className="mt-3 text-2xl font-semibold text-[var(--text)]">Agendar instalação</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              Defina a data e a hora para a instalação antes de aprovar o orçamento.
            </p>

            <label className="mt-6 block">
              <span className="field-label">Data e hora</span>
              <input
                className="field-input"
                disabled={Boolean(mutatingBudgetId)}
                onChange={(event) =>
                  setApprovalDraft((current) => ({ ...current, scheduleDate: event.target.value }))
                }
                type="datetime-local"
                value={approvalDraft.scheduleDate}
              />
            </label>

            <div className="mt-6 flex flex-wrap gap-3">
              <button disabled={Boolean(mutatingBudgetId)} className="gold-button w-full sm:w-auto" onClick={approveBudget} type="button">
                {mutatingBudgetId ? 'Aprovando...' : 'Confirmar aprovação'}
              </button>
              <button disabled={Boolean(mutatingBudgetId)} className="ghost-button w-full sm:w-auto" onClick={closeApprovalModal} type="button">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
