import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router';
import api from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { formatCurrency, formatDateTime, formatStatusLabel } from '../../utils/formatters';
import { isNativeStoreApp } from '../../utils/nativePlatform';
import './Subscription.css';

const FREE_ITEMS = [
  '5 interesses por mês',
  '15 clientes ativos',
  '5 orçamentos por mês',
  'Parcelamento em até 12x',
  'Agenda e suporte essenciais',
];

const PRO_ITEMS = [
  'Interesses, clientes e orçamentos ilimitados',
  'Orçamentos com vários ambientes',
  'PDF profissional com a sua marca',
  'Dashboard comercial e análises avançadas',
  'Mais fotos, horários e personalização',
];

function safePaymentView(value) {
  if (!value) return null;

  return {
    payment: value.payment
      ? {
          external_id: value.payment.external_id,
          amount: value.payment.amount,
          status: value.payment.status,
          method: value.payment.method,
          created_at: value.payment.created_at,
        }
      : null,
    ticketUrl: value.ticketUrl || '',
    expirationDate: value.expirationDate || null,
    automaticConfirmation: Boolean(value.automaticConfirmation),
  };
}

function FeatureList({ items }) {
  return (
    <ul className="subscription-v3-features">
      {items.map((item) => (
        <li key={item}>
          <span aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function UsageMeter({ label, limit, used }) {
  const normalizedUsed = Number(used || 0);
  const normalizedLimit = limit === null ? null : Math.max(1, Number(limit || 1));
  const percent = normalizedLimit === null
    ? 18
    : Math.min(100, Math.round((normalizedUsed / normalizedLimit) * 100));

  return (
    <article className="subscription-v3-usage-item">
      <div>
        <span>{label}</span>
        <strong>
          {normalizedUsed}
          <small> / {normalizedLimit === null ? 'sem limite' : normalizedLimit}</small>
        </strong>
      </div>
      <div
        aria-label={`${label}: ${percent}% utilizado`}
        className="subscription-v3-usage-track"
        role="progressbar"
        aria-valuemax={normalizedLimit || 100}
        aria-valuemin="0"
        aria-valuenow={normalizedUsed}
      >
        <i style={{ '--subscription-progress': `${percent}%` }} />
      </div>
    </article>
  );
}

export default function Subscription() {
  const confirm = useConfirm();
  const isStoreApp = isNativeStoreApp();
  const {
    subscription: contextSubscription,
    planAccess,
    isPro,
    refreshSubscription,
  } = useSubscription();
  const [subscription, setSubscription] = useState(contextSubscription);
  const [payment, setPayment] = useState(safePaymentView(contextSubscription?.pending_payment));
  const [isPaying, setIsPaying] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [paymentNeedsProfile, setPaymentNeedsProfile] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);

  const loadSubscription = useCallback(async () => {
    const response = await api.get('/subscriptions');
    setSubscription(response.data);
    setPayment(safePaymentView(response.data.pending_payment));
    await refreshSubscription();
    return response.data;
  }, [refreshSubscription]);

  useEffect(() => {
    if (contextSubscription) {
      setSubscription(contextSubscription);
      setPayment((current) => current || safePaymentView(contextSubscription.pending_payment));
    }
  }, [contextSubscription]);

  useEffect(() => {
    loadSubscription().catch((error) => {
      toast.error(error.response?.data?.error || 'Não foi possível carregar os planos.');
    });
  }, [loadSubscription]);

  const syncPaymentStatus = useCallback(async (externalId, silent = false) => {
    if (!externalId) return;

    try {
      const response = await api.get(`/subscriptions/payment/${externalId}`);
      if (response.data.payment) setPayment(safePaymentView(response.data));

      if (response.data.status === 'paid') {
        toast.success('Pagamento confirmado. O plano Pro foi ativado.');
        setPayment(null);
        setShowPaymentDetails(false);
        await loadSubscription();
      } else if (!silent) {
        toast('Pagamento ainda está sendo processado.');
      }
    } catch (error) {
      if (!silent) {
        toast.error(error.response?.data?.error || 'Não foi possível consultar o pagamento.');
      }
    }
  }, [loadSubscription]);

  useEffect(() => {
    if (
      isStoreApp
      || !payment?.automaticConfirmation
      || payment?.payment?.status !== 'pending'
      || !payment?.payment?.external_id
    ) {
      return undefined;
    }

    const interval = window.setInterval(
      () => syncPaymentStatus(payment.payment.external_id, true),
      20000
    );
    return () => window.clearInterval(interval);
  }, [isStoreApp, payment, syncPaymentStatus]);

  const handlePay = async () => {
    if (isStoreApp || isPro) return;

    if (payment?.ticketUrl && payment?.payment?.status === 'pending') {
      window.location.assign(payment.ticketUrl);
      return;
    }

    if (subscription?.payment_mode === 'disabled') {
      toast.error(subscription?.payment_notice || 'Pagamento temporariamente indisponível.');
      return;
    }

    try {
      setIsPaying(true);
      const response = await api.post('/subscriptions/pay');
      const nextPayment = safePaymentView(response.data);
      setPayment(nextPayment);
      setPaymentNeedsProfile(false);
      toast.success('Ambiente seguro de pagamento aberto.');

      if (nextPayment?.ticketUrl) {
        window.location.assign(nextPayment.ticketUrl);
      } else {
        setShowPaymentDetails(true);
      }
    } catch (error) {
      const code = error.response?.data?.code;
      setPaymentNeedsProfile([
        'PAYMENT_CUSTOMER_REQUIRED',
        'PAYMENT_CUSTOMER_NAME_REQUIRED',
        'PAYMENT_CUSTOMER_DOCUMENT_REQUIRED',
      ].includes(code));
      toast.error(error.response?.data?.error || 'Não foi possível abrir o pagamento.');
    } finally {
      setIsPaying(false);
    }
  };

  const handleCancel = async () => {
    const accepted = await confirm({
      title: 'Voltar para o plano Grátis?',
      message: 'A recorrência será cancelada. Seus clientes, orçamentos e demais dados não serão apagados.',
      confirmText: 'Voltar para o Grátis',
      cancelText: 'Manter o Pro',
    });
    if (!accepted) return;

    try {
      setIsCanceling(true);
      const response = await api.delete('/subscriptions');
      toast.success(response.data?.message || 'Plano Grátis ativado.');
      setPayment(null);
      setShowPaymentDetails(false);
      await loadSubscription();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível cancelar agora.');
    } finally {
      setIsCanceling(false);
    }
  };

  const handleCheck = async () => {
    try {
      setIsChecking(true);
      await syncPaymentStatus(payment?.payment?.external_id);
    } finally {
      setIsChecking(false);
    }
  };

  const usageRows = [
    ['Interesses neste mês', planAccess.usage?.monthly_interests, planAccess.limits?.monthly_interests],
    ['Clientes ativos', planAccess.usage?.clients, planAccess.limits?.clients],
    ['Orçamentos neste mês', planAccess.usage?.monthly_budgets, planAccess.limits?.monthly_budgets],
    ['Fotos no portfólio', planAccess.usage?.portfolio_photos, planAccess.limits?.portfolio_photos],
    ['Horários futuros', planAccess.usage?.availability_slots, planAccess.limits?.availability_slots],
  ];
  const pricing = subscription?.pricing || { amount: 49.9, period: 'mês' };
  const currentPaymentIsPending = payment?.payment?.status === 'pending';

  return (
    <section className="page-shell subscription-v3">
      <section className="subscription-v3-hero">
        <div aria-hidden="true" className="subscription-v3-orbit subscription-v3-orbit-one" />
        <div aria-hidden="true" className="subscription-v3-orbit subscription-v3-orbit-two" />
        <div className="subscription-v3-hero-copy">
          <div className="subscription-v3-kicker">
            <i aria-hidden="true" />
            Planos InstalarPro
          </div>
          <h1>
            Comece grátis.
            <span>Cresça no seu ritmo.</span>
          </h1>
          {isStoreApp ? (
            <p>Veja o seu plano e quanto você já usou neste mês.</p>
          ) : (
            <>
              <p>
                Organize seu trabalho sem pagar nada e ative o Pro quando precisar de mais volume,
                apresentação e controle.
              </p>
              <div className="subscription-v3-hero-points">
                <span>Sem fidelidade</span>
                <span>Cancele quando quiser</span>
                <span>Seus dados continuam salvos</span>
              </div>
            </>
          )}
        </div>

        <div className="subscription-v3-current">
          <span>Seu plano agora</span>
          <strong>{isPro ? 'Pro' : 'Grátis'}</strong>
          <p>{isPro ? 'Todos os recursos liberados' : 'Acesso permanente, sem cobrança'}</p>
          <i aria-hidden="true" />
        </div>
      </section>

      <section className="subscription-v3-plans" aria-label="Comparação de planos">
        <article className={`subscription-v3-plan subscription-v3-plan-free ${!isPro ? 'is-current' : ''}`}>
          <div className="subscription-v3-plan-head">
            <div>
              <span className="subscription-v3-plan-label">Para começar</span>
              <h2>Grátis</h2>
            </div>
            {!isPro ? <span className="subscription-v3-current-badge">Plano atual</span> : null}
          </div>

          <div className="subscription-v3-price">
            <strong>R$ 0</strong>
            <span>para sempre</span>
          </div>
          <p className="subscription-v3-plan-description">
            O necessário para receber oportunidades e organizar os primeiros serviços.
          </p>
          <FeatureList items={FREE_ITEMS} />
        </article>

        <article className={`subscription-v3-plan subscription-v3-plan-pro ${isPro ? 'is-current' : ''}`}>
          <div aria-hidden="true" className="subscription-v3-plan-shine" />
          <div className="subscription-v3-plan-head">
            <div>
              <span className="subscription-v3-plan-label">{isStoreApp ? 'Sem limites' : 'Mais escolhido'}</span>
              <h2>Pro</h2>
            </div>
            {isPro || !isStoreApp ? (
              <span className="subscription-v3-pro-badge">{isPro ? 'Plano atual' : 'Recomendado'}</span>
            ) : null}
          </div>

          {isStoreApp ? null : (
            <div className="subscription-v3-price">
              <strong>{formatCurrency(pricing.amount)}</strong>
              <span>por {pricing.period || 'mês'}</span>
            </div>
          )}
          <p className="subscription-v3-plan-description">
            Para trabalhar sem limites e apresentar uma operação mais profissional.
          </p>
          <FeatureList items={PRO_ITEMS} />

          <div className="subscription-v3-plan-action">
            {!isPro ? (
              isStoreApp ? null : (
                <>
                  <button
                    className="subscription-v3-primary"
                    disabled={subscription?.payment_mode === 'disabled' || isPaying}
                    onClick={handlePay}
                    type="button"
                  >
                    <span>
                      {isPaying
                        ? 'Abrindo pagamento...'
                        : currentPaymentIsPending
                          ? 'Continuar pagamento'
                          : 'Ativar o Pro'}
                    </span>
                    <i aria-hidden="true">→</i>
                  </button>
                  <div className="subscription-v3-payment-methods">
                    <span>Pix mensal</span>
                    <span>Cartão mensal</span>
                    <span>Ambiente Asaas</span>
                  </div>
                  {paymentNeedsProfile ? (
                    <Link className="subscription-v3-profile-link" to="/profile">
                      Complete CPF/CNPJ no perfil para continuar
                    </Link>
                  ) : null}
                </>
              )
            ) : !isStoreApp && subscription?.access_mode === 'pro' ? (
              <button
                className="subscription-v3-secondary"
                disabled={isCanceling}
                onClick={handleCancel}
                type="button"
              >
                {isCanceling ? 'Cancelando...' : 'Cancelar assinatura'}
              </button>
            ) : null}
          </div>
        </article>
      </section>

      {!isPro ? (
        <section className="subscription-v3-usage">
          <div className="subscription-v3-section-copy">
            <span>Seu uso no plano Grátis</span>
            <h2>Você ainda tem espaço para trabalhar</h2>
            <p>Interesses e orçamentos são renovados automaticamente no primeiro dia de cada mês.</p>
          </div>
          <div className="subscription-v3-usage-list">
            {usageRows.map(([label, used, limit]) => (
              <UsageMeter key={label} label={label} limit={limit} used={used} />
            ))}
          </div>
        </section>
      ) : (
        <section className="subscription-v3-pro-active">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Seu Pro está ativo</strong>
            <p>Uso ilimitado e recursos avançados liberados em todos os seus dispositivos.</p>
          </div>
        </section>
      )}

      {!isStoreApp && currentPaymentIsPending ? (
        <section className="subscription-v3-pending">
          <button
            aria-expanded={showPaymentDetails}
            className="subscription-v3-pending-toggle"
            onClick={() => setShowPaymentDetails((current) => !current)}
            type="button"
          >
            <span>
              <i aria-hidden="true" />
              Existe um pagamento em andamento
            </span>
            <strong>{showPaymentDetails ? 'Ocultar' : 'Ver detalhes'}</strong>
          </button>

          {showPaymentDetails ? (
            <div className="subscription-v3-pending-body">
              <div>
                <span>Valor</span>
                <strong>{formatCurrency(payment?.payment?.amount)}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{formatStatusLabel(payment?.payment?.status)}</strong>
              </div>
              <div>
                <span>Validade</span>
                <strong>{payment.expirationDate ? formatDateTime(payment.expirationDate) : 'No ambiente de pagamento'}</strong>
              </div>
              <div className="subscription-v3-pending-actions">
                {payment.ticketUrl ? (
                  <a href={payment.ticketUrl} rel="noreferrer" target="_blank">
                    Continuar pagamento
                  </a>
                ) : null}
                <button disabled={isChecking} onClick={handleCheck} type="button">
                  {isChecking ? 'Verificando...' : 'Verificar status'}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {!isStoreApp && subscription?.provider_error ? (
        <div className="subscription-v3-provider-error">{subscription.provider_error}</div>
      ) : null}

      {isStoreApp ? null : (
        <footer className="subscription-v3-footer">
          <span>Pagamento protegido</span>
          <span>Ativação automática</span>
          <span>Sem taxa de cancelamento</span>
        </footer>
      )}
    </section>
  );
}
