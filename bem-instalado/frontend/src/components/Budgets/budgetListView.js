export const BUDGET_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'draft', label: 'Rascunhos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'approved', label: 'Aprovados' },
  { value: 'rejected', label: 'Rejeitados' },
];

const draftRequestStatuses = new Set(['selected', 'proposal_sent', 'scheduled', 'in_progress']);
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

export function canCompleteBudget(budget) {
  return budget.status === 'draft' && draftRequestStatuses.has(budget.source_request_status);
}

export function formatBudgetDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
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

export function getVisibleBudgets(budgets, { status, query, sort }) {
  const terms = searchable(query).trim().split(/\s+/).filter(Boolean);
  return budgets.filter((budget) => {
    if (status !== 'all' && budget.status !== status) return false;
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
