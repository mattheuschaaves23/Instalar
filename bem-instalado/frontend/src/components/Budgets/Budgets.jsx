import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import api from '../../services/api';
import PageIntro from '../Layout/PageIntro';
import PaginationControls from '../Layout/PaginationControls';
import { notifyPanelBadgeCountsChanged } from '../Layout/panelBadgeCounts';
import { formatCurrency, formatDateTime, formatStatusLabel } from '../../utils/formatters';
import PlanUsage from '../Subscription/PlanUsage';
import { installmentInfo, installmentAmountLabel, installmentConditionsLabel } from '../../../../shared/installmentTerms.mjs';

const BUDGETS_PER_PAGE = 6;

function formatToDatetimeLocal(date) {
  const safe = date instanceof Date ? date : new Date(date);
  const year = safe.getFullYear();
  const month = String(safe.getMonth() + 1).padStart(2, '0');
  const day = String(safe.getDate()).padStart(2, '0');
  const hours = String(safe.getHours()).padStart(2, '0');
  const minutes = String(safe.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatPaymentTerms(budget) {
  return installmentAmountLabel(installmentInfo(budget));
}

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [approvalDraft, setApprovalDraft] = useState({ budgetId: null, scheduleDate: '' });
  const [mutatingBudgetId, setMutatingBudgetId] = useState(null);

  const loadBudgets = async () => {
    try {
      const response = await api.get('/budgets');
      setBudgets(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível carregar orçamentos.');
    }
  };

  useEffect(() => {
    loadBudgets();
  }, []);

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

  const totalPages = Math.max(1, Math.ceil(budgets.length / BUDGETS_PER_PAGE));
  const normalizedPage = Math.min(currentPage, totalPages);
  const start = (normalizedPage - 1) * BUDGETS_PER_PAGE;
  const paginatedBudgets = budgets.slice(start, start + BUDGETS_PER_PAGE);

  return (
    <section className="page-shell space-y-7">
      <PageIntro
        actions={
          <>
            <Link className="gold-button" to="/budgets/new">
              Criar novo orçamento
            </Link>
            <Link className="ghost-button" to="/agenda">
              Ver agenda
            </Link>
          </>
        }
        description="Veja os valores, o status e a próxima ação de cada orçamento."
        eyebrow="Comercial"
        stats={[
          { label: 'Total de propostas', value: `${budgets.length}`, detail: 'Todas as propostas registradas.' },
          {
            label: 'Aprovados',
            value: `${budgets.filter((budget) => budget.status === 'approved').length}`,
            detail: 'Propostas convertidas em venda.',
          },
          {
            label: 'Pendentes',
            value: `${budgets.filter((budget) => budget.status === 'pending').length}`,
            detail: 'Oportunidades que merecem acompanhamento.',
          },
        ]}
        title="Acompanhe seus orçamentos."
      />

      <PlanUsage usageKey="monthly_budgets" />

      <div className="grid gap-4">
        <div className="list-surface lux-panel fade-up min-w-0 overflow-hidden">
          {paginatedBudgets.map((budget, index) => (
            <article
              className="list-row"
              key={budget.id}
              style={{ animationDelay: `${0.08 + index * 0.05}s` }}
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 grid gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="break-words text-2xl font-semibold text-[var(--text)]">
                      #{budget.id} - {budget.client_name}
                    </p>
                    <span className="status-pill" data-tone={budget.status}>
                      {formatStatusLabel(budget.status)}
                    </span>
                  </div>

                  <div className="grid gap-2 break-words text-sm text-[var(--muted)] md:grid-cols-3">
                    <p>Criado em {formatDateTime(budget.created_at)}</p>
                    <p>Total calculado {formatCurrency(budget.total_amount)}</p>
                    <p>{formatPaymentTerms(budget)}</p>
                  </div>
                  {budget.installment_enabled ? <p className="text-sm text-[var(--muted)]">{installmentConditionsLabel(installmentInfo(budget))}</p> : null}
                </div>

                <div className="action-cluster flex flex-wrap gap-3">
                  {budget.status === 'pending' ? (
                    <>
                      <button disabled={Boolean(mutatingBudgetId)} className="gold-button w-full sm:w-auto" onClick={() => openApprovalModal(budget.id)} type="button">
                        Aprovar e agendar
                      </button>
                      <button disabled={Boolean(mutatingBudgetId)} className="danger-button w-full sm:w-auto" onClick={() => rejectBudget(budget.id)} type="button">
                        Rejeitar
                      </button>
                    </>
                  ) : null}
                  <button className="ghost-button w-full sm:w-auto" onClick={() => downloadPdf(budget.id)} type="button">
                    Baixar PDF
                  </button>
                  <button className="ghost-button w-full sm:w-auto" onClick={() => openWhatsapp(budget.id)} type="button">
                    Enviar no WhatsApp
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {budgets.length > 0 ? (
          <PaginationControls
            currentPage={normalizedPage}
            onPageChange={setCurrentPage}
            totalPages={totalPages}
          />
        ) : null}

        {budgets.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum orçamento cadastrado. Crie um quando tiver os dados do cliente e do serviço.</p>
            <div className="mt-5">
              <Link className="gold-button" to="/budgets/new">
                Criar novo orçamento
              </Link>
            </div>
          </div>
        ) : null}
      </div>

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
