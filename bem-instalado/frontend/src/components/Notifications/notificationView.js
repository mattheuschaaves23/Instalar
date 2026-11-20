const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const fullDateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export const notificationTypes = [
  ['all', 'Todos os tipos'], ['orders', 'Pedidos'], ['budgets', 'Orçamentos'],
  ['agenda', 'Agenda'], ['account', 'Conta e suporte'], ['other', 'Outros'],
];

export function describeNotification(item) {
  const title = String(item.title || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const path = item.action_path || '';
  const orderId = /^\/opportunities\?pedido=([1-9]\d{0,9})$/.exec(path)?.[1];
  const budgetId = /\borçamento #([1-9]\d{0,9})\b/i.exec(item.message || '')?.[1];
  if (/^\/budgets\/[1-9]\d{0,9}\/complete$/.test(path)) {
    return { type: 'budgets', icon: 'document', path, label: 'Abrir rascunho' };
  }
  if (orderId || path === '/opportunities' || title === 'pedido direto recebido') {
    const id = orderId || (title === 'pedido direto recebido' ? /\bpedido #([1-9]\d{0,9})\b/i.exec(item.message || '')?.[1] : null);
    return { type: 'orders', icon: 'briefcase', path: id ? `/opportunities?pedido=${id}` : '/opportunities', label: id ? 'Ver pedido' : 'Ver oportunidades' };
  }
  if (path === '/agenda' || /^(instalacao agendada|proposta aceita|novo agendamento|agendamento |servico agendado)/.test(title)) {
    return { type: 'agenda', icon: 'calendar', path: '/agenda', label: 'Ver agenda' };
  }
  if (path === '/budgets' || /^orcamento\b/.test(title)) {
    return { type: 'budgets', icon: 'document', path: budgetId ? `/budgets?orcamento=${budgetId}` : '/budgets', label: budgetId ? 'Ver orçamento' : 'Ver orçamentos' };
  }
  if (/^(pedido |novo interesse|voce foi escolhido|nova proposta|cliente respondeu)/.test(title)) {
    return { type: 'orders', icon: 'briefcase' };
  }
  if (/^(assinatura |pagamento |plano |certificado |suporte |resposta do suporte)/.test(title)) {
    return { type: 'account', icon: 'bell' };
  }
  return { type: 'other', icon: 'bell' };
}

export function notificationDate(value, now = new Date()) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return { today: false, label: 'Sem data' };
  const today = date.toDateString() === now.toDateString();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  let label = 'Ontem';
  if (today) {
    const minutes = Math.max(0, Math.floor((now - date) / 60000));
    label = minutes < 1 ? 'Agora' : minutes < 60 ? `Há ${minutes} min` : `Há ${Math.floor(minutes / 60)} h`;
  } else if (date.toDateString() !== yesterday.toDateString()) {
    label = dateFormatter.format(date);
  }
  return { today, label, iso: date.toISOString(), full: fullDateFormatter.format(date) };
}
