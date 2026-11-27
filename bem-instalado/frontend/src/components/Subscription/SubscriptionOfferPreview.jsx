import { useState } from 'react';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import './SubscriptionOfferPreview.css';

const DESTINATION_STATUS = {
  approved: 'Cadastro aprovado no Asaas. A carteira de destino ainda não foi conferida.',
  verified_destination: 'Carteira de destino conferida e cadastro aprovado.',
  wrong_destination: 'A chave não pertence à carteira de destino configurada.',
  not_approved: 'Asaas encontrou a conta, mas o cadastro ainda não consta como aprovado.',
  not_configured: 'A chave da conta de destino não está configurada neste ambiente.',
  verification_failed: 'Não foi possível verificar a conta no Asaas.',
};
const TRIAL_STATUS = {
  pending: 'Aguardando a confirmação da assinatura no Asaas.',
  trial: 'Seu período de teste está ativo.',
  paid: 'Cobrança de teste confirmada pelo Asaas.',
  unpaid: 'Nenhuma cobrança confirmada para o período atual.',
  cancelled: 'Recorrência cancelada no Asaas.',
  abandoned: 'Checkout encerrado sem adesão. Fale com o suporte para uma nova tentativa.',
  review: 'Os dados da assinatura precisam ser conferidos. Fale com o suporte.',
};

function trustedCheckoutUrl(raw, isProduction) {
  let url;
  try { url = new URL(raw); } catch { return null; }
  const origin = isProduction ? 'https://asaas.com' : 'https://sandbox.asaas.com';
  const id = url.searchParams.get('id');
  if (url.origin !== origin || url.pathname !== '/checkoutSession/show' ||
      url.username || url.password || !/^[a-zA-Z0-9_-]{1,120}$/.test(id || '')) return null;
  return `${origin}/checkoutSession/show?id=${id}`;
}

function validatedCheckout(data, isProduction) {
  const url = trustedCheckoutUrl(data?.url, isProduction);
  const date = data?.first_charge_on;
  if (!url ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(data?.amount)) {
    throw new Error('Checkout do Asaas inválido.');
  }
  return { url, firstCharge: date.split('-').reverse().join('/'), amount: data.amount };
}

export default function SubscriptionOfferPreview({
  offer, isPro, features, canCancel, isCanceling, onCancel, onRefresh,
}) {
  const { monthly, yearly } = offer.options;
  const [plan, setPlan] = useState('monthly');
  const [accepted, setAccepted] = useState(false);
  const [checkout, setCheckout] = useState(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [error, setError] = useState('');
  const [destination, setDestination] = useState('');
  const [checkingDestination, setCheckingDestination] = useState(false);
  const [checkingTrial, setCheckingTrial] = useState(false);
  const managedTrial = offer.managed_trial;
  const isProduction = offer.checkout_environment === 'production';
  const amount = plan === 'yearly' ? yearly.amount : monthly.amount;
  const checkoutUrl = managedTrial?.state === 'pending'
    ? trustedCheckoutUrl(managedTrial.checkout_url, isProduction)
    : null;

  function choosePlan(next) {
    setPlan(next);
    setAccepted(false);
  }

  async function prepareCheckout(event) {
    event.preventDefault();
    if (!offer.checkout_available || !accepted || checkoutBusy || checkout) return;
    setError('');
    setCheckoutBusy(true);
    try {
      const terms = isProduction ? { consent_version: offer.consent_version, amount_cents: Math.round(amount * 100) } : {};
      const { data } = await api.post('/subscriptions/trial-checkout', { plan, accepted, ...terms });
      setCheckout(validatedCheckout(data, isProduction));
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Não foi possível preparar o checkout no Asaas.');
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function verifyDestination() {
    setDestination('');
    setCheckingDestination(true);
    try {
      const { data } = await api.get('/subscriptions/launch-status');
      setDestination(DESTINATION_STATUS[data?.destination] || DESTINATION_STATUS.verification_failed);
    } catch {
      setDestination(DESTINATION_STATUS.verification_failed);
    } finally {
      setCheckingDestination(false);
    }
  }

  async function refreshTrial() {
    setError('');
    setCheckingTrial(true);
    try {
      await api.post('/subscriptions/managed-trial/refresh');
      await onRefresh();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Não foi possível conferir o status no Asaas.');
    } finally {
      setCheckingTrial(false);
    }
  }

  return (
    <>
      <header className="subscription-offer-header">
        <div>
          <h1>Assinatura</h1>
          <p>Os mesmos recursos Pro, com pagamento mensal ou anual.</p>
        </div>
        <div className="subscription-offer-current">
          <span>Seu acesso agora</span>
          <strong>{isPro ? 'Pro ativo' : 'Grátis · plano atual'}</strong>
          {canCancel && (isPro || managedTrial?.can_cancel) ? (
            <button className="subscription-v3-secondary" type="button" disabled={isCanceling} onClick={onCancel}>
              {isCanceling ? 'Cancelando...' : 'Cancelar assinatura'}
            </button>
          ) : null}
        </div>
      </header>

      <div className="subscription-offer-trial">
        <div>
          <h2>{offer.trial_days} dias grátis</h2>
          <p>
            O teste começa depois de cadastrar e validar um cartão de crédito no Asaas.
            A primeira cobrança só acontece depois dos {offer.trial_days} dias se você não cancelar.
          </p>
        </div>
        <p className="subscription-offer-notice">
          {isProduction
            ? <><strong>Piloto de produção.</strong> {offer.checkout_available ? 'Use um cartão real. A assinatura poderá ser cobrada após o teste.' : 'Novas adesões estão pausadas para sua conta.'}</>
            : offer.checkout_available || managedTrial
            ? <><strong>Modo de teste.</strong> Use somente o cartão fictício do Asaas. Não é feita cobrança real.</>
            : <><strong>Novos planos em preparação.</strong> A contratação ainda não está disponível.</>}
        </p>
      </div>

      <section className="subscription-offer-options" aria-label="Opções de assinatura Pro">
        <article className="subscription-offer-card">
          <h2>Pro mensal</h2>
          <p className="subscription-offer-price">
            <strong>{formatCurrency(monthly.amount)}</strong> <span>por mês</span>
          </p>
          <p>Uma cobrança por mês, depois do teste.</p>
        </article>
        <article className="subscription-offer-card subscription-offer-card--yearly">
          <div className="subscription-offer-card-title">
            <h2>Pro anual</h2>
            <span>{offer.annual_discount_percent}% de desconto</span>
          </div>
          <p className="subscription-offer-price">
            <strong>{formatCurrency(yearly.amount)}</strong> <span>por ano</span>
          </p>
          <p>Uma cobrança anual. Você economiza {formatCurrency(yearly.savings)} em relação a 12 mensalidades.</p>
        </article>
      </section>

      {offer.checkout_available ? (
        <form className="subscription-offer-card subscription-offer-checkout" onSubmit={prepareCheckout}>
          <fieldset disabled={checkoutBusy || Boolean(checkout)}>
            <legend>{isProduction ? 'Escolha o plano do piloto' : 'Escolha um plano para testar'}</legend>
            <label>
              <input checked={plan === 'monthly'} name="trial-plan" onChange={() => choosePlan('monthly')} type="radio" />
              Mensal — {formatCurrency(monthly.amount)}
            </label>
            <label>
              <input checked={plan === 'yearly'} name="trial-plan" onChange={() => choosePlan('yearly')} type="radio" />
              Anual — {formatCurrency(yearly.amount)}
            </label>
            <label>
              <input checked={accepted} onChange={(event) => setAccepted(event.target.checked)} type="checkbox" />
              {isProduction
                ? `Autorizo a cobrança recorrente de ${formatCurrency(amount)} ${plan === 'yearly' ? 'por ano' : 'por mês'} após os 7 dias grátis, se eu não cancelar antes.`
                : 'Entendi que este checkout é só para teste e não devo usar um cartão real.'}
            </label>
          </fieldset>
          {checkout ? (
            <>
              <p role="status">{isProduction ? 'Primeira cobrança prevista:' : 'Primeira cobrança de teste:'} {formatCurrency(checkout.amount)} em {checkout.firstCharge}.</p>
              <a className="subscription-v3-primary" href={checkout.url}>{isProduction ? 'Continuar para o checkout do Asaas' : 'Abrir checkout de teste no Asaas'}</a>
            </>
          ) : (
            <button className="subscription-v3-primary" disabled={!accepted || checkoutBusy} type="submit">
              {checkoutBusy ? 'Preparando...' : isProduction ? 'Preparar checkout no Asaas' : 'Preparar checkout de teste'}
            </button>
          )}
          {error ? <p role="alert">{error}</p> : null}
        </form>
      ) : null}

      {managedTrial && (managedTrial.state !== 'eligible' || checkout) ? (
        <section className="subscription-offer-card subscription-offer-checkout" aria-label="Status da assinatura de teste">
          <h2>Status da assinatura de teste</h2>
          <p role="status">{isProduction && managedTrial.state === 'paid'
            ? 'Cobrança confirmada pelo Asaas.'
            : TRIAL_STATUS[managedTrial.state] || TRIAL_STATUS.pending}</p>
          {managedTrial.first_due_on ? <p>Primeiro vencimento: {managedTrial.first_due_on.split('-').reverse().join('/')}.</p> : null}
          {checkoutUrl ? <a href={checkoutUrl} className="subscription-v3-primary">Continuar no Asaas</a> : null}
          <button type="button" className="subscription-v3-secondary" disabled={checkingTrial} onClick={refreshTrial}>
            {checkingTrial ? 'Conferindo...' : 'Conferir status no Asaas'}
          </button>
          {error && !offer.checkout_available ? <p role="alert">{error}</p> : null}
        </section>
      ) : null}

      <section className="subscription-offer-included">
        <div>
          <h2>O que está incluído no Pro</h2>
          <ul>{features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
        </div>
        <div>
          <h2>Quem já usa o InstalarPro</h2>
          <p>
            {isPro
              ? 'Sua assinatura continua como está. Ela não muda para outro plano automaticamente.'
              : 'Quem já está no Grátis também pode iniciar os 7 dias quando a oferta estiver disponível. Sem aceitar as condições e cadastrar um cartão, não haverá cobrança.'}
          </p>
        </div>
      </section>
      {offer.destination_check_available ? (
        <section className="subscription-offer-card subscription-offer-checkout">
          <h2>Conta de recebimento</h2>
          <p>Verifique o cadastro no Asaas sem habilitar cobranças.</p>
          <button className="subscription-v3-secondary" disabled={checkingDestination} onClick={verifyDestination} type="button">
            {checkingDestination ? 'Verificando...' : 'Verificar conta Asaas'}
          </button>
          {destination ? <p role="status">{destination}</p> : null}
        </section>
      ) : null}
    </>
  );
}
