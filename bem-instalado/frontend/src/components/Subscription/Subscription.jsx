import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
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
  amount: Number(process.env.REACT_APP_SUBSCRIPTION_PRICE || 40),
  currency: 'BRL',
  period: 'mensal',
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
    }, 8000);

    return () => window.clearInterval(interval);
  }, [payment?.automaticConfirmation, payment?.payment?.external_id, payment?.payment?.status, syncPaymentStatus]);

  const handlePay = async () => {
    if (subscription?.payment_mode === 'disabled') {
      toast.error(subscription?.payment_notice || 'Pagamento temporariamente indisponível.');
      return;
    }

    try {
      const response = await api.post('/subscriptions/pay');
      setPayment(response.data);
      toast.success('Pagamento gerado. O acesso será liberado assim que for confirmado.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível gerar o pagamento.');
    }
  };

  const handleCheck = async () => {
    await syncPaymentStatus(payment?.payment?.external_id);
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
  const isLaunchAccess = subscription?.payment_mode === 'launch' || subscription?.access_mode === 'launch';
  const showRecipient = Boolean(payment?.recipientName || payment?.city);
  const pricing = subscription?.pricing || defaultPricing;
  const apiBenefits = Array.isArray(subscription?.plan_benefits) ? subscription.plan_benefits : [];
  const planBenefits = apiBenefits.length
    ? apiBenefits.map((benefit, index) => (/[\u00C3\u00C2\u00E2]/.test(String(benefit)) ? defaultBenefits[index] || benefit : benefit))
    : defaultBenefits;

  return (
    <section className="page-shell space-y-7">
      <PageIntro
        description={isLaunchAccess
          ? 'Durante o lançamento, todas as ferramentas estão liberadas sem cobrança.'
          : 'Consulte aqui o status do seu plano e dos pagamentos.'}
        eyebrow="Assinatura"
        stats={[
          {
            label: 'Plano',
            value: subscription?.plan ? subscription.plan.toUpperCase() : 'MENSAL',
            detail: isLaunchAccess ? 'Acesso gratuito nesta fase.' : `${formatCurrency(pricing.amount)} por ${pricing.period}.`,
          },
          {
            label: 'Status',
            value: isLaunchAccess ? 'LANÇAMENTO' : formatStatusLabel(subscription?.status),
            detail: subscription?.expires_at
              ? `Expira em ${formatShortDate(subscription.expires_at)}`
              : 'Ainda sem data de expiração registrada.',
          },
          {
            label: 'Acesso',
            value: canUseApp ? 'LIBERADO' : 'BLOQUEADO',
            detail: canUseApp
              ? isLaunchAccess ? 'Ferramentas liberadas durante o lançamento.' : 'Ferramentas premium liberadas.'
              : 'Os módulos do painel ficam bloqueados até a assinatura ser ativada.',
          },
        ]}
        title={isLaunchAccess ? 'Seu acesso de lançamento está liberado.' : 'Gerencie seu plano de instalador.'}
      />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="lux-panel fade-up min-w-0 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow">Estado da assinatura</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">
                {isLaunchAccess ? 'Acesso liberado' : 'Controle de acesso premium'}
              </h2>
            </div>
            <span className="status-pill" data-tone={subscription?.status}>
              {formatStatusLabel(subscription?.status)}
            </span>
          </div>

          <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
            {isLaunchAccess
              ? 'Você já pode usar oportunidades, agenda, clientes e orçamentos. Nenhum pagamento é necessário agora.'
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

          {!isLaunchAccess ? <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="gold-button w-full sm:w-auto"
              disabled={isPaymentDisabled}
              onClick={handlePay}
              type="button"
            >
              {isPaymentDisabled ? 'Pagamento indisponível' : payment ? 'Abrir pagamento atual' : 'Gerar pagamento mensal'}
            </button>
            {payment ? (
              <button className="ghost-button w-full sm:w-auto" onClick={handleCheck} type="button">
                Verificar pagamento
              </button>
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
                  <p className="eyebrow">Pagamento manual</p>
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

                  <div className="subscription-info-row !items-start !justify-between gap-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--gold-strong)]">Código copia e cola</p>
                    <p className="break-all text-right text-[var(--text)]">{payment.copyPaste}</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="gold-button w-full sm:w-auto"
                  onClick={() => handleCopy(payment.copyPaste, 'Código PIX copiado.')}
                  type="button"
                >
                  Copiar código
                </button>
                {payment.ticketUrl ? (
                  <a className="ghost-button w-full sm:w-auto" href={payment.ticketUrl} rel="noreferrer" target="_blank">
                    Abrir comprovante
                  </a>
                ) : null}
                <button className="ghost-button w-full sm:w-auto" onClick={handleCheck} type="button">
                  Atualizar status
                </button>
              </div>

              <div className="subscription-inline-note mt-5">
                <p className="text-sm leading-7 text-[var(--muted)]">
                  Enquanto o novo método de pagamento não estiver configurado, o acesso premium permanece bloqueado
                  para assinaturas inativas.
                </p>
              </div>
            </section>
          ) : null}

          <section className="lux-panel-soft fade-up rounded-[28px] p-6" style={{ animationDelay: '0.14s' }}>
            <p className="eyebrow">Regra de acesso</p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              {isLaunchAccess
                ? 'O acesso é gratuito nesta fase. A plataforma avisará com antecedência antes de qualquer mudança no modelo de cobrança.'
                : 'O usuário pode entrar na conta, ajustar perfil e acompanhar o status da assinatura nesta tela.'}
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}
