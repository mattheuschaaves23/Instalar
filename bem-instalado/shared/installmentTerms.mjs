export function installmentInfo(budget) {
  const requestedCount = Number(budget?.installments_count || 1);
  const count = budget?.installment_enabled && Number.isInteger(requestedCount) && requestedCount >= 2
    ? Math.min(requestedCount, 12) : 1;
  const requestedFree = Number(budget?.interest_free_installments || count);
  const requestedRate = Number(budget?.installment_interest_rate || 0);
  const total = Number(budget?.total_amount || 0);
  return {
    enabled: count > 1,
    count,
    interestFreeCount: Number.isFinite(requestedFree) ? Math.min(count, Math.max(1, Math.trunc(requestedFree))) : count,
    interestRate: Number.isFinite(requestedRate) ? Math.max(0, requestedRate) : 0,
    // The operator determines the actual charge. Never add interest to stored totals.
    installmentValue: (Number.isFinite(total) ? total : 0) / count,
  };
}

export function installmentAmountLabel(terms) {
  if (!terms.enabled) return 'Pagamento à vista';
  const amount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(terms.installmentValue);
  return `${terms.count}x de ${amount} (valor base)`;
}

export function paymentOptionsLabel(terms, hasUpfront) {
  if (terms.enabled) return `${terms.count}x${hasUpfront ? ' + à vista' : ' no cartão'}`;
  return hasUpfront ? 'À vista' : 'Não informado';
}

export function installmentConditionsLabel(terms) {
  if (!terms.enabled) return '';
  const free = `Sem juros até ${terms.interestFreeCount}x.`;
  if (terms.interestFreeCount === terms.count) return free;
  const rate = terms.interestRate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${free} Após: taxa informada de ${rate}% a.m. Juros calculados pela operadora, não incluídos no valor base.`;
}
