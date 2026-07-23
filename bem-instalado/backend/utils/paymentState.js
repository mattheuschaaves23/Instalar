const REVERSAL_STATUSES = new Set(['refunded', 'canceled', 'failed']);

function isReversalStatus(status) {
  return REVERSAL_STATUSES.has(String(status || '').trim().toLowerCase());
}

function resolvePaymentStatusTransition(currentStatus, providerStatus) {
  const current = String(currentStatus || 'pending').trim().toLowerCase();
  const incoming = String(providerStatus || current).trim().toLowerCase();

  // Uma leitura atrasada da Asaas nunca deve remover um pagamento já recebido.
  // Apenas um estorno, cancelamento ou falha explícita pode reverter esse estado.
  if (current === 'paid' && incoming === 'pending') {
    return 'paid';
  }

  // Um estorno em andamento não deve voltar a pendente por uma leitura atrasada.
  if (current === 'refunded' && incoming === 'pending') {
    return 'refunded';
  }

  return incoming;
}

module.exports = {
  isReversalStatus,
  resolvePaymentStatusTransition,
};
