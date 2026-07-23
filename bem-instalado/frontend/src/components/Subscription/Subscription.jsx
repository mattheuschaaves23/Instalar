import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import PageIntro from '../Layout/PageIntro';
import { useAuth } from '../../contexts/AuthContext';
import { setSubscriptionAccessCache } from '../Layout/subscriptionAccessCache';
import {
  formatCurrency,
  formatDateTime,
  formatShortDate,
  formatStatusLabel,
} from '../../utils/formatters';

const defaultPricing = {
  amount: Number(process.env.REACT_APP_SUBSCRIPTION_PRICE || 49.9),
  currency: 'BRL',
  period: 'mês',
  label: 'Plano instalador',
};

const defaultBenefits = [
  'Dashboard comercial completo com indicadores do mês.',
  'Agenda visual por dia para organizar instalações.',
  'Orçamentos em PDF prontos para enviar ao cliente.',
  'Perfil público para captar mais clientes.',
  'Suporte interno em tempo real com o administrador.',
];

export default function Subscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [payment, setPayment] = useState(null);
  const [isPaying, setIsPaying] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [paymentNeedsProfile, setPaymentNeedsProfile] = useState(false);

  const loadSubscription = useCallback(async () => {
    try {
      const response = await api.get('/subscriptions');
      setSubscription(response.data);
      setPayment(response.data.pending_payment || null);
      setSubscriptionAccessCache(user?.id || user?.email, Boolean(response.data?.can_use_app));
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível carregar a assinatura.');
    }
  }, [user?.email, user?.id]);

  const syncPaymentStatus = useCallback(async (externalId, silent = false) => {
    if (!externalId) {
      return;
    }

    try {
      const response = await api.get(`/subscriptions/payment/${externalId}`);

      if (response.data.payment) {
        setPayment(response.data);
      }

      if (response.data.status === 'paid') {
        toast.success('Pagamento confirmado. O acesso premium foi liberado.');
        setPayment(null);
        await loadSubscription();
        return;
      }

      if (!silent) {
        toast('Pagamento ainda pendente.');
      }
    } catch (error) {
      if (!silent) {
        toast.error(error.response?.data?.error || 'Não foi possível consultar o pagamento.');
      }
    }
  }, [loadSubscription]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  useEffect(() => {
    if (!payment?.automaticConfirmation || payment?.payment?.status !== 'pending' || !payment?.payment?.external_id) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      syncPaymentStatus(payment.payment.external_id, true);
    }, 20000);

    return () => window.clearInterval(interval);
  }, [payment?.automaticConfirmation, payment?.payment?.external_id, payment?.payment?.status, syncPaymentStatus]);

  const handlePay = async () => {
    if (subscription?.payment_mode === 'disabled') {
      toast.error(subscription?.payment_notice || 'Pagamento temporariamente indisponível.');
      return;
    }

    try {
      setIsPaying(true);
      const response = await api.post('/subscriptions/pay');
      setPayment(response.data);
      setPaymentNeedsProfile(false);
      toast.success('Pagamento gerado. O acesso será liberado assim que for confirmado.');
    } catch (error) {
      const code = error.response?.data?.code;
      setPaymentNeedsProfile([
        'PAYMENT_CUSTOMER_REQUIRED',
        'PAYMENT_CUSTOMER_NAME_REQUIRED',
        'PAYMENT_CUSTOMER_DOCUMENT_REQUIRED',
      ].includes(code));
      toast.error(error.response?.data?.error || 'Não foi possível gerar o pagamento.');
    } finally {
      setIsPaying(false);
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

  const handleCopy = async (value, message) => {
    if (!value) {
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        toast.success(message);
        return;
      }

      throw new Error('clipboard-unavailable');
    } catch (_error) {
      toast.error('Não foi possível copiar automaticamente. Copie manualmente o código.');
    }
  };

  const canUseApp = Boolean(subscription?.can_use_app);
  const isPaymentDisabled = subscription?.payment_mode === 'disabled';
  const isAdminAccess = subscription?.access_mode === 'admin';
  const isLaunchAccess = subscription?.access_mode === 'launch';
  const isTrialAccess = subscription?.access_mode === 'trial';
  const isTrialPlan = subscription?.plan === 'trial';
  const isExpiredTrial = isTrialPlan && subscription?.is_expired;
  const hasComplimentaryAccess = isAdminAccess || isLaunchAccess || isTrialAccess;
  const trialDaysRemaining = subscription?.trial?.days_remaining || 0;
  const trialDaysLabel = `${trialDaysRemaining} ${trialDaysRemaining === 1 ? 'dia' : 'dias'}`;
  const currentPaymentIsPending = payment?.payment?.status === 'pending';
  const showRecipient = Boolean(payment?.recipientName || payment?.city);
  const pricing = subscription?.pricing || defaultPricing;
  const apiBenefits = Array.isArray(subscription?.plan_benefits) ? subscription.plan_benefits : [];
  const planBenefits = apiBenefits.length
    ? apiBenefits.map((benefit, index) => (/[\u00C3\u00C2\u00E2]/.test(String(benefit)) ? defaultBenefits[index] || benefit : benefit))
    : defaultBenefits;

  return (
    <section className="page-shell space-y-7">
      <PageIntro
        description={hasComplimentaryAccess
          ? isAdminAccess
            ? 'Sua conta administrativa possui acesso completo às ferramentas da plataforma.'
            : isTrialAccess
              ? `Aproveite todas as ferramentas grátis até ${formatShortDate(subscription?.trial?.ends_at)}.`
              : 'Durante o lançamento, todas as ferramentas estão liberadas sem cobrança.'
          : isExpiredTrial
            ? 'Seu teste grátis terminou. Gere o Pix mensal para continuar usando todas as ferramentas.'
            : 'Consulte aqui o status do seu plano e dos pagamentos.'}
        eyebrow="Assinatura"
        stats={[
          {
            label: 'Plano',
            value: isTrialPlan ? 'TESTE GRÁTIS' : subscription?.plan ? subscription.plan.toUpperCase() : 'MENSAL',
            detail: isTrialPlan
              ? `${subscription?.trial?.days_total || 7} dias sem cobrança.`
              : hasComplimentaryAccess
                ? 'Acesso sem cobrança.'
                : `${formatCurrency(pricing.amount)} por ${pricing.period}.`,
          },
          {
            label: 'Status',
            value: isAdminAccess
              ? 'ADMINISTRATIVO'
              : isTrialAccess
                ? 'TESTE GRÁTIS'
                : isExpiredTrial
                  ? 'ENCERRADO'
                  : isLaunchAccess
                    ? 'LANÇAMENTO'
                    : formatStatusLabel(subscription?.status),
            detail: subscription?.expires_at
              ? `Expira em ${formatShortDate(subscription.expires_at)}`
              : 'Ainda sem data de expiração registrada.',
          },
          {
            label: 'Acesso',
            value: canUseApp ? 'LIBERADO' : 'BLOQUEADO',
            detail: canUseApp
              ? isTrialAccess
                ? 'Todas as ferramentas liberadas durante o teste.'
                : hasComplimentaryAccess
                  ? 'Ferramentas liberadas sem cobrança.'
                  : 'Ferramentas premium liberadas.'
              : 'Os módulos do painel ficam bloqueados até a assinatura ser ativada.',
          },
        ]}
        title={isAdminAccess
          ? 'Seu acesso administrativo está liberado.'
          : isTrialAccess
            ? 'Seu teste grátis está ativo.'
            : isExpiredTrial
              ? 'Seu teste grátis terminou.'
              : isLaunchAccess
                ? 'Seu acesso de lançamento está liberado.'
                : 'Gerencie seu plano de instalador.'}
      />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="lux-panel fade-up min-w-0 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow">Estado da assinatura</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">
                {isTrialAccess
                  ? 'Teste grátis em andamento'
                  : hasComplimentaryAccess
                    ? 'Acesso liberado'
                    : 'Controle de acesso premium'}
              </h2>
            </div>
            <span className="status-pill" data-tone={isExpiredTrial ? 'inactive' : subscription?.status}>
              {isExpiredTrial ? 'Encerrado' : isTrialAccess ? 'Teste grátis' : formatStatusLabel(subscription?.status)}
            </span>
          </div>

          <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
            {hasComplimentaryAccess
              ? isTrialAccess
                ? `Você tem ${trialDaysLabel} de teste. Nenhuma cobrança será feita durante esse período.`
                : 'Você já pode usar oportunidades, agenda, clientes e orçamentos. Nenhum pagamento é necessário para este acesso.'
              : 'Acompanhe aqui a ativação e a validade da sua assinatura.'}
          </p>

          <div className="subscription-inline-note mt-6">
            <p className="eyebrow">Plano e benefícios</p>
            <p className="mt-3 text-xl font-semibold text-[var(--gold-strong)]">
              {pricing.label || 'Plano instalador'} • {formatCurrency(pricing.amount)}/{pricing.period || 'mês'}
            </p>
            <div className="mt-3 grid gap-2">
              {planBenefits.map((benefit) => (
                <p className="text-sm text-[var(--muted)]" key={benefit}>
                  • {benefit}
                </p>
              ))}
            </div>
          </div>

          {!hasComplimentaryAccess ? <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="gold-button w-full sm:w-auto"
              disabled={isPaymentDisabled || isPaying}
              onClick={handlePay}
              type="button"
            >
              {isPaymentDisabled
                ? 'Pagamento indisponível'
                : isPaying
                  ? 'Gerando Pix...'
                  : currentPaymentIsPending
                    ? 'Reabrir pagamento atual'
                    : payment
                      ? 'Gerar novo pagamento'
                      : 'Gerar pagamento mensal'}
            </button>
            {payment ? (
              <button
                className="ghost-button w-full sm:w-auto"
                disabled={isChecking || !payment?.payment?.external_id}
                onClick={handleCheck}
                type="button"
              >
                {isChecking ? 'Verificando...' : 'Verificar pagamento'}
              </button>
            ) : null}
            {paymentNeedsProfile ? (
              <Link className="ghost-button w-full sm:w-auto" to="/profile">
                Completar perfil para pagar
              </Link>
            ) : null}
          </div> : null}

          <div className="subscription-inline-note mt-6">
            <p className="text-sm leading-7 text-[var(--muted)]">
              {subscription?.payment_notice
                || 'Pagamento temporariamente indisponível. Um novo método será configurado futuramente.'}
            </p>
          </div>

          {subscription?.provider_error ? (
            <div className="mt-4 break-words rounded-[22px] border border-[rgba(223,107,107,0.32)] bg-[rgba(159,47,47,0.1)] p-5 text-sm leading-7 text-[var(--text)]">
              {subscription.provider_error}
            </div>
          ) : null}
        </section>

        <aside className="grid gap-6">
          {payment ? (
            <section className="lux-panel fade-up min-w-0 p-6" style={{ animationDelay: '0.08s' }}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="eyebrow">
                    {payment?.automaticConfirmation ? 'Pagamento Pix' : 'Pagamento manual'}
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">Compra em aberto</h2>
                </div>
                <span className="status-pill" data-tone={payment?.payment?.status}>
                  {formatStatusLabel(payment?.payment?.status)}
                </span>
              </div>

              {payment.qrCodeImage ? (
                <img
                  alt="QR Code PIX"
                  className="mt-5 w-full rounded-[24px] border border-[var(--line)] bg-white p-4"
                  src={payment.qrCodeImage}
                />
              ) : null}

              <div className="subscription-info-stack mt-5 text-sm text-[var(--muted)]">
                <div className="subscription-info-row">
                  <span>Valor</span>
                  <strong className="text-[var(--text)]">{formatCurrency(payment?.payment?.amount)}</strong>
                </div>

                <div className="subscription-info-row">
                  <span>Validação</span>
                  <strong className="text-[var(--text)]">
                    {payment?.automaticConfirmation ? 'Automática' : 'Manual'}
                  </strong>
                </div>

                {payment.expirationDate ? (
                  <div className="subscription-info-row">
                    <span>Validade</span>
                    <strong className="text-[var(--text)]">{formatDateTime(payment.expirationDate)}</strong>
                  </div>
                ) : null}

                {showRecipient ? (
                  <div className="subscription-info-row !items-start !justify-between gap-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--gold-strong)]">Recebedor</p>
                    <p className="break-words text-right text-[var(--text)]">
                      {[payment.recipientName, payment.city].filter(Boolean).join(' - ')}
                    </p>
                  </div>
                ) : null}

                {payment.copyPaste ? (
                  <div className="subscription-info-row !items-start !justify-between gap-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--gold-strong)]">Código copia e cola</p>
                    <p className="break-all text-right text-[var(--text)]">{payment.copyPaste}</p>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {payment.copyPaste ? (
                  <button
                    className="gold-button w-full sm:w-auto"
                    onClick={() => handleCopy(payment.copyPaste, 'Código PIX copiado.')}
                    type="button"
                  >
                    Copiar código
                  </button>
                ) : null}
                {payment.ticketUrl ? (
                  <a className="ghost-button w-full sm:w-auto" href={payment.ticketUrl} rel="noreferrer" target="_blank">
                    Abrir cobrança
                  </a>
                ) : null}
                <button
                  className="ghost-button w-full sm:w-auto"
                  disabled={isChecking || !payment?.payment?.external_id}
                  onClick={handleCheck}
                  type="button"
                >
                  {isChecking ? 'Atualizando...' : 'Atualizar status'}
                </button>
              </div>

              <div className="subscription-inline-note mt-5">
                <p className="text-sm leading-7 text-[var(--muted)]">
                  {payment?.automaticConfirmation
                    ? payment.copyPaste || payment.qrCodeImage
                      ? 'A confirmação é automática. Depois de pagar, esta tela atualizará o acesso em poucos segundos.'
                      : 'O QR Code está sendo atualizado. Você pode abrir a cobrança segura da Asaas enquanto isso.'
                    : 'A confirmação manual está disponível somente no ambiente de desenvolvimento.'}
                </p>
              </div>
            </section>
          ) : null}

          <section className="lux-panel-soft fade-up rounded-[28px] p-6" style={{ animationDelay: '0.14s' }}>
            <p className="eyebrow">Regra de acesso</p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              {hasComplimentaryAccess
                ? isAdminAccess
                  ? 'O acesso é vinculado à função administrativa desta conta.'
                  : isTrialAccess
                    ? `O teste termina em ${formatShortDate(subscription?.trial?.ends_at)}. Depois, o Pix mensal só será gerado se você decidir assinar.`
                    : 'O acesso de lançamento é gratuito e não gera cobrança automática.'
                : 'O usuário pode entrar na conta, ajustar perfil e acompanhar o status da assinatura nesta tela.'}
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}
