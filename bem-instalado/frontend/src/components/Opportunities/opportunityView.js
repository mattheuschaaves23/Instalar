export function getOpportunityTitle(item) {
  return [item.service_label || 'Instalação de papel de parede', item.rooms?.join(', ')].filter(Boolean).join(' · ');
}

export function getOpportunityArea(item) {
  if (item.measurement_detail) return item.measurement_detail;
  if (item.wall_size) return item.wall_size;
  if (item.roll_count) return `${item.roll_count} ${Number(item.roll_count) === 1 ? 'rolo' : 'rolos'}`;
  return 'Medidas a combinar';
}

export function formatOpportunityDate(value, now = Date.now()) {
  const date = value ? new Date(value) : null;
  if (date && Number.isFinite(date.getTime())) {
    const seconds = (now - date.getTime()) / 1000;
    if (seconds >= 0 && seconds < 60) return 'Agora';
    if (seconds >= 60 && seconds < 86400) {
      const hours = seconds >= 3600;
      return new Intl.RelativeTimeFormat('pt-BR').format(-Math.floor(seconds / (hours ? 3600 : 60)), hours ? 'hour' : 'minute');
    }
  }
  return date && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
    : 'Data não informada';
}

export function getOpportunityState(item) {
  if (item.not_selected) return { key: 'not-selected', label: 'Outro profissional escolhido', hint: 'O cliente seguiu com outro instalador. Seu interesse permanece no histórico.' };
  const closed = {
    expired: ['Pedido expirado', 'O prazo deste pedido terminou. Não é possível enviar um novo interesse.'],
    canceled: ['Cancelado', 'Este pedido foi cancelado.'],
    completed: ['Concluído', 'Este serviço já foi concluído.'],
  };
  if (closed[item.status]) return { key: item.status, label: closed[item.status][0], hint: closed[item.status][1] };
  if (item.selected_by_me) {
    const label = { accepted: 'Agendado', in_progress: 'Em andamento' }[item.status] || 'Cliente escolheu você';
    return { key: 'selected', label, hint: 'Combine os detalhes com o cliente e acompanhe a proposta e o serviço.' };
  }
  if (item.interested_by_me) return { key: 'waiting', label: 'Aguardando cliente', hint: 'Seu interesse foi registrado. A contratação depende da escolha do cliente.' };
  return { key: 'new', label: 'Nova solicitação', hint: 'Demonstre interesse para o cliente conhecer seu perfil.' };
}

export function mergeOpportunityPage(current, incoming) {
  const records = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => records.set(item.id, item));
  return [...records.values()];
}
