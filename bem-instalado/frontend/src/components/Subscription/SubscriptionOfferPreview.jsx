import { useState } from 'react';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import './SubscriptionOfferPreview.css';

const DESTINATION_STATUS = {
  approved: 'Credencial aceita: cadastro da conta Asaas aprovado. Adesões reais seguem desativadas.',
  not_approved: 'Asaas encontrou a conta, mas o cadastro ainda não consta como aprovado.',
  not_configured: 'A chave da conta de destino não está configurada neste ambiente.',
  verification_failed: 'Não foi possível verificar a conta no Asaas.',
};

function validatedCheckout(data) {
  const url = new URL(data?.url);
  const date = data?.first_charge_on;
  if (url.origin !== 'https://sandbox.asaas.com' || url.pathname !== '/checkoutSession/show' ||
      url.username || url.password || !/^[a-zA-Z0-9_-]{1,120}$/.test(url.searchParams.get('id') || '') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(data?.amount)) {
    throw new Error('Checkout de teste inválido.');
  }
  return { url: url.href, firstCharge: date.split('-').reverse().join('/'), amount: data.amount };
}

export default function SubscriptionOfferPreview({
  offer, isPro, features, canCancel, isCanceling, onCancel,
}) {
  const { monthly, yearly } = offer.options;
  const [plan, setPlan] = useState('monthly');
  const [accepted, setAccepted] = useState(false);
  const [checkout, setCheckout] = useState(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [error, setError] = useState('');
  const [destination, setDestination] = useState('');
  const [checkingDestination, setCheckingDestination] = useState(false);

  async function prepareCheckout(event) {
    event.preventDefault();
    if (!offer.checkout_available || !accepted || checkoutBusy || checkout) return;
    setError('');
    setCheckoutBusy(true);
    try {
      const { data } = await api.post('/subscriptions/trial-checkout', { plan, accepted });
      setCheckout(validatedCheckout(data));
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Não foi possível preparar o checkout de teste.');
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
          {isPro && canCancel ? (
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
          {offer.checkout_available
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
            <legend>Escolha um plano para testar</legend>
            <label>
              <input checked={plan === 'monthly'} name="trial-plan" onChange={() => setPlan('monthly')} type="radio" />
              Mensal — {formatCurrency(monthly.amount)}
            </label>
            <label>
              <input checked={plan === 'yearly'} name="trial-plan" onChange={() => setPlan('yearly')} type="radio" />
              Anual — {formatCurrency(yearly.amount)}
            </label>
            <label>
              <input checked={accepted} onChange={(event) => setAccepted(event.target.checked)} type="checkbox" />
              Entendi que este checkout é só para teste e não devo usar um cartão real.
            </label>
          </fieldset>
          {checkout ? (
            <>
              <p role="status">Primeira cobrança de teste: {formatCurrency(checkout.amount)} em {checkout.firstCharge}.</p>
              <a className="subscription-v3-primary" href={checkout.url}>Abrir checkout de teste no Asaas</a>
            </>
          ) : (
            <button className="subscription-v3-primary" disabled={!accepted || checkoutBusy} type="submit">
              {checkoutBusy ? 'Preparando...' : 'Preparar checkout de teste'}
            </button>
          )}
          {error ? <p role="alert">{error}</p> : null}
        </form>
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
