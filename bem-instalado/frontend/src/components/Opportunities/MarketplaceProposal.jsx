import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

function localDateTime(value) {
  if (value) {
    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setHours(9, 0, 0, 0);
  return localDateTime(date.toISOString());
}

function addHours(value, hours) {
  return localDateTime(new Date(new Date(value).getTime() + hours * 60 * 60 * 1000).toISOString());
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

export default function MarketplaceProposal({ requestId, requestStatus, onUpdated, triggerClassName }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [form, setForm] = useState(() => {
    const start = localDateTime();
    return { amount: '', scope: '', materials: '', notes: '', scheduled_start: start, scheduled_end: addHours(start, 2) };
  });

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/opportunities/${requestId}/proposal`);
      const nextProposal = response.data?.proposal || null;
      setProposal(nextProposal);
      if (nextProposal) {
        setForm({
          amount: String(nextProposal.amount ?? ''),
          scope: nextProposal.scope || '',
          materials: nextProposal.materials || '',
          notes: nextProposal.notes || '',
          scheduled_start: localDateTime(nextProposal.scheduled_start),
          scheduled_end: localDateTime(nextProposal.scheduled_end),
        });
      }
      setExpanded(true);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível carregar a proposta.');
    } finally {
      setLoading(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await api.post(`/opportunities/${requestId}/proposal`, form);
      setProposal(response.data?.proposal || null);
      toast.success('Proposta enviada ao cliente.');
      onUpdated?.();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível enviar a proposta.');
    } finally {
      setLoading(false);
    }
  };

  const updateProgress = async (status) => {
    setLoading(true);
    try {
      await api.patch(`/opportunities/${requestId}/service-status`, { status });
      toast.success(status === 'in_progress' ? 'Serviço marcado como em andamento.' : status === 'completed' ? 'Serviço concluído.' : 'Serviço cancelado.');
      onUpdated?.();
      await load();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar o serviço.');
    } finally {
      setLoading(false);
    }
  };

  if (!expanded) {
    return (
      <button
        className={triggerClassName || (requestStatus === 'selected' ? 'gold-button' : 'ghost-button')}
        disabled={loading}
        onClick={load}
        type="button"
      >
        {loading ? 'Abrindo...' : requestStatus === 'selected' ? 'Enviar proposta' : 'Ver proposta e serviço'}
      </button>
    );
  }

  const terminal = ['completed', 'canceled', 'expired'].includes(requestStatus);
  const editable = !terminal && (!proposal || ['sent', 'change_requested', 'rejected', 'canceled'].includes(proposal.status));
  const accepted = proposal?.status === 'accepted';

  return (
    <section className="marketplace-proposal mt-3 w-full rounded-xl border border-[var(--line)] bg-[rgba(255,255,255,0.035)] p-4 text-left">
      <div className="mb-3 flex items-center justify-between gap-3">
        <strong>{proposal ? 'Proposta do pedido' : 'Nova proposta'}</strong>
        <button className="text-xs text-[var(--muted)]" onClick={() => setExpanded(false)} type="button">Fechar</button>
      </div>

      {proposal?.client_response_message ? <p className="mb-3 rounded-lg bg-[rgba(216,155,53,0.12)] p-3 text-sm">Resposta do cliente: {proposal.client_response_message}</p> : null}

      {terminal ? (
        <div className="space-y-2 text-sm">
          <p>Este pedido está {requestStatus === 'completed' ? 'concluído' : requestStatus === 'canceled' ? 'cancelado' : 'expirado'}.</p>
          {proposal ? <><p><strong>Valor da proposta:</strong> {formatCurrency(proposal.amount)}</p><p>{proposal.scope}</p></> : <p>Nenhuma proposta foi registrada.</p>}
        </div>
      ) : accepted ? (
        <div className="space-y-3 text-sm">
          <p><strong>Horário confirmado:</strong> {new Date(proposal.scheduled_start).toLocaleString('pt-BR')}</p>
          <p><strong>Valor:</strong> {formatCurrency(proposal.amount)}</p>
          <div className="flex flex-wrap gap-2">
            {['accepted', 'scheduled'].includes(requestStatus) ? <button className="gold-button" disabled={loading} onClick={() => updateProgress('in_progress')} type="button">Iniciar serviço</button> : null}
            {requestStatus === 'in_progress' ? <button className="gold-button" disabled={loading} onClick={() => updateProgress('completed')} type="button">Concluir</button> : null}
            {['accepted', 'scheduled', 'in_progress'].includes(requestStatus) ? <button className="ghost-button" disabled={loading} onClick={() => updateProgress('canceled')} type="button">Cancelar</button> : null}
          </div>
        </div>
      ) : editable ? (
        <form className="grid gap-3" onSubmit={save}>
          <label><span className="field-label">Valor total (R$)</span><input className="field-input" inputMode="decimal" min="0" name="amount" onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} required step="0.01" value={form.amount} /></label>
          <label><span className="field-label">O que está incluso</span><textarea className="field-input min-h-20" name="scope" onChange={(event) => setForm((current) => ({ ...current, scope: event.target.value }))} required value={form.scope} /></label>
          <label><span className="field-label">Materiais (opcional)</span><input className="field-input" name="materials" onChange={(event) => setForm((current) => ({ ...current, materials: event.target.value }))} value={form.materials} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="field-label">Início</span><input className="field-input" name="scheduled_start" onChange={(event) => setForm((current) => ({ ...current, scheduled_start: event.target.value }))} required type="datetime-local" value={form.scheduled_start} /></label>
            <label><span className="field-label">Fim</span><input className="field-input" name="scheduled_end" onChange={(event) => setForm((current) => ({ ...current, scheduled_end: event.target.value }))} required type="datetime-local" value={form.scheduled_end} /></label>
          </div>
          <label><span className="field-label">Observações (opcional)</span><textarea className="field-input min-h-16" name="notes" onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} value={form.notes} /></label>
          <button className="gold-button" disabled={loading} type="submit">{loading ? 'Enviando...' : proposal?.status === 'change_requested' ? 'Enviar proposta ajustada' : 'Enviar proposta'}</button>
        </form>
      ) : <p className="text-sm text-[var(--muted)]">Esta proposta está {proposal?.status === 'rejected' ? 'recusada' : 'aguardando a resposta do cliente'}.</p>}
    </section>
  );
}
