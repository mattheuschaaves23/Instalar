export const BUDGET_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'draft', label: 'Rascunhos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'approved', label: 'Aprovados' },
  { value: 'rejected', label: 'Rejeitados' },
];

export const BUDGET_DATE_PERIODS = [
  { value: 'all', label: 'Todas as datas' },
  { value: 'today', label: 'Hoje' },
  { value: 'last-week', label: 'Últimos 7 dias' },
  { value: 'this-month', label: 'Este mês' },
  { value: 'last-month', label: 'Mês passado' },
  { value: 'custom', label: 'Personalizado' },
];

const draftRequestStatuses = new Set(['selected', 'proposal_sent', 'scheduled', 'in_progress']);
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

export function canCompleteBudget(budget) {
  return budget.status === 'draft' && draftRequestStatuses.has(budget.source_request_status);
}

function parseBudgetDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

// Match the local calendar day displayed by formatBudgetDate, even for UTC timestamps.
function localDateKey(date) {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function getBudgetDateRange({ period, from, to }, now = new Date()) {
  if (period === 'custom') {
    if (from && to && from > to) return { from: '', to: '', invalid: true };
    return { from, to };
  }
  if (period === 'today') {
    const today = localDateKey(now);
    return { from: today, to: today };
  }
  const year = now.getFullYear();
  const month = now.getMonth();
  if (period === 'last-week') {
    return { from: localDateKey(new Date(year, month, now.getDate() - 6)), to: localDateKey(now) };
  }
  if (period === 'this-month' || period === 'last-month') {
    const monthOffset = period === 'last-month' ? month - 1 : month;
    return { from: localDateKey(new Date(year, monthOffset, 1)), to: localDateKey(new Date(year, monthOffset + 1, 0)) };
  }
  return { from: '', to: '' };
}

export function formatBudgetDate(value) {
  const date = parseBudgetDate(value);
  if (!date) return '—';
  return dateFormatter.formatToParts(date).filter((part) => part.type !== 'literal').map((part) => part.value).join(' ');
}

export function getBudgetCounts(budgets) {
  const counts = { all: budgets.length, draft: 0, pending: 0, approved: 0, rejected: 0 };
  for (const { status } of budgets) {
    if (status !== 'all' && Object.hasOwn(counts, status)) counts[status] += 1;
  }
  return counts;
}

function searchable(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function budgetValue(budget) {
  if (budget.status === 'draft' || budget.total_amount == null || budget.total_amount === '') return null;
  const value = Number(budget.total_amount);
  return Number.isFinite(value) ? value : null;
}

function newestFirst(a, b) {
  return (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0) || Number(b.id) - Number(a.id);
}

export function getVisibleBudgets(budgets, { status, query, sort, exactId = null, dateFrom, dateTo }) {
  const terms = searchable(query).trim().split(/\s+/).filter(Boolean);
  return budgets.filter((budget) => {
    if (status !== 'all' && budget.status !== status) return false;
    if (dateFrom || dateTo) {
      const date = parseBudgetDate(budget.created_at);
      if (!date) return false;
      const day = localDateKey(date);
      if ((dateFrom && day < dateFrom) || (dateTo && day > dateTo)) return false;
    }
    if (exactId !== null) return String(budget.id) === exactId;
    const text = searchable(`${budget.client_name ?? ''} #${budget.id}`);
    return terms.every((term) => text.includes(term));
  }).sort((a, b) => {
    if (sort === 'oldest') return newestFirst(b, a);
    if (sort === 'highest' || sort === 'lowest') {
      const left = budgetValue(a);
      const right = budgetValue(b);
      if (left === null && right !== null) return 1;
      if (right === null && left !== null) return -1;
      if (left !== null && right !== null && left !== right) return sort === 'highest' ? right - left : left - right;
    }
    return newestFirst(a, b);
  });
}
