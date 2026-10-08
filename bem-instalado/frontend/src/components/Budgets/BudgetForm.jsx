import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { useSubscription } from '../../contexts/SubscriptionContext';
import PlanUsage from '../Subscription/PlanUsage';
import ClientForm from '../Clients/ClientForm';
import { installmentInfo, installmentAmountLabel, installmentConditionsLabel, paymentOptionsLabel } from '../../../../shared/installmentTerms.mjs';

const INSTALLMENT_OPTIONS = Array.from({ length: 11 }, (_, index) => index + 2);
const INTEREST_FREE_INSTALLMENT_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const INSTALLMENT_INTEREST_OPTIONS = [0, 1, 1.5, 2, 2.5, 3, 4, 5];
const UPFRONT_PAYMENT_METHODS = [
  { id: 'pix', label: 'Pix' },
  { id: 'boleto', label: 'Boleto' },
  { id: 'debit_card', label: 'Cartão de débito' },
  { id: 'credit_card', label: 'Cartão à vista' },
  { id: 'cash', label: 'Dinheiro' },
  { id: 'bank_transfer', label: 'Transferência' },
];

function createUpfrontPaymentTerms() {
  return Object.fromEntries(
    UPFRONT_PAYMENT_METHODS.map((method) => [method.id, { enabled: false, discount: 0 }])
  );
}

function BudgetIcon({ type }) {
  const props = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  switch (type) {
    case 'back':
      return (
        <svg {...props}>
          <path d="m14.5 5.5-6 6 6 6" />
        </svg>
      );
    case 'save':
      return (
        <svg {...props}>
          <path d="M5 4.5h10l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V4.5Z" />
          <path d="M8 4.5V9h6V4.5M8 20.5v-6h8v6" />
        </svg>
      );
    case 'measure':
      return (
        <svg {...props}>
          <path d="m4.5 15.5 11-11 4 4-11 11h-4Z" />
          <path d="m13 7 4 4M6 17.5l.01.01" />
        </svg>
      );
    case 'wallpaper':
      return (
        <svg {...props}>
          <path d="M6 6.5a1.5 1.5 0 0 1 1.5-1.5H16a2 2 0 0 1 2 2v2.2H9a2 2 0 0 0-2 2V18" />
          <path d="M9 18h4M13 18v2.5" />
          <path d="M8 8h2M12 8h2M10 11h2M8 14h2M12 14h2" />
        </svg>
      );
    case 'card':
      return (
        <svg {...props}>
          <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
          <path d="M3.5 10h17M7 15h3.5" />
        </svg>
      );
    case 'view':
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M2.8 12s3.2-5.3 9.2-5.3S21.2 12 21.2 12 18 17.3 12 17.3 2.8 12 2.8 12Z" />
          <circle cx="12" cy="12" r="2.3" />
        </svg>
      );
    case 'services':
      return (
        <svg {...props}>
          <path d="m4.5 19.5 5.2-5.2M14 6l4 4" />
          <path d="m8.5 5.5 10 10-2.3 2.3-10-10zM4.5 11.5l3 3" />
        </svg>
      );
    case 'summary':
      return (
        <svg {...props}>
          <path d="M6.5 5.5h11M6.5 10.5h11M6.5 15.5h7" />
          <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
        </svg>
      );
    case 'add':
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...props}>
          <path d="M4.5 7.5h15" />
          <path d="M9.5 3.5h5l1 2.2h-7l1-2.2Z" />
          <path d="M7 7.5v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-10" />
        </svg>
      );
    case 'info':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 10v5M12 7.5h.01" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

function createEnvironment() {
  return {
    name: '',
    height: '',
    width: '',
    rolls_manual: '',
    removal_included: false,
  };
}

function createStepState(isDone, isActive) {
  if (isActive) {
    return 'active';
  }

  if (isDone) {
    return 'done';
  }

  return 'idle';
}

export default function BudgetForm() {
  const navigate = useNavigate();
  const { isPro, refreshSubscription } = useSubscription();
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [showClientForm, setShowClientForm] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [pricingMode, setPricingMode] = useState('roll');
  const [rollArea, setRollArea] = useState(4.5);
  const [pricePerRoll, setPricePerRoll] = useState(0);
  const [pricePerSquareMeter, setPricePerSquareMeter] = useState(10);
  const [removalPricePerRoll, setRemovalPricePerRoll] = useState(0);
  const [profileDefaults, setProfileDefaults] = useState({ rollPrice: 0, removalPricePerRoll: 0 });
  const [installmentEnabled, setInstallmentEnabled] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState(3);
  const [interestFreeInstallments, setInterestFreeInstallments] = useState(3);
  const [installmentInterestRate, setInstallmentInterestRate] = useState(0);
  const [upfrontPaymentTerms, setUpfrontPaymentTerms] = useState(createUpfrontPaymentTerms);
  const [environments, setEnvironments] = useState([createEnvironment()]);

  useEffect(() => {
    api.get('/clients').then((response) => setClients(response.data)).catch(() => null);

    api.get('/users/profile')
      .then((response) => {
        const profileDefaultRollPrice = Number(response.data.default_price_per_roll || 0);
        const profileDefaultRemovalPrice = Number(response.data.default_removal_price || 0);

        setProfileDefaults({
          rollPrice: profileDefaultRollPrice,
          removalPricePerRoll: profileDefaultRemovalPrice,
        });
        setPricePerRoll(profileDefaultRollPrice);
        setRemovalPricePerRoll(profileDefaultRemovalPrice);
      })
      .catch(() => null);
  }, []);

  const updateEnvironment = (index, field, value) => {
    setEnvironments((current) =>
      current.map((item, currentIndex) => (currentIndex === index ? { ...item, [field]: value } : item))
    );
  };

  const addEnvironment = () => {
    if (!isPro) {
      toast('Vários ambientes no mesmo orçamento estão disponíveis no plano Pro.');
      return;
    }
    setEnvironments((current) => [...current, createEnvironment()]);
  };

  useEffect(() => {
    if (!isPro) {
      setEnvironments((current) => current.slice(0, 1));
    }
  }, [isPro]);

  const removeEnvironment = (index) => {
    setEnvironments((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const removalIncluded = environments.some((environment) => Boolean(environment.removal_included));
  const rollYield = Number(rollArea);
  const effectiveRollArea = Number.isFinite(rollYield) && rollYield > 0 ? rollYield : 0;

  const environmentBreakdown = useMemo(
    () =>
      environments.map((environment) => {
        const height = Number(environment.height || 0);
        const width = Number(environment.width || 0);
        const area = height * width;
        const rollsAuto = effectiveRollArea > 0 ? Math.ceil(area / effectiveRollArea) : 0;
        const rollsManual = environment.rolls_manual ? Number(environment.rolls_manual) : null;
        const rollsForMode = pricingMode === 'roll' ? (rollsManual || rollsAuto) : rollsAuto;
        const baseSubtotal =
          pricingMode === 'square_meter'
            ? area * Number(pricePerSquareMeter || 0)
            : rollsForMode * Number(pricePerRoll || 0);
        return {
          area,
          baseSubtotal,
          removalIncluded: Boolean(environment.removal_included),
          rollsAuto,
          rollsForMode,
          total: baseSubtotal,
        };
      }),
    [effectiveRollArea, environments, pricePerRoll, pricePerSquareMeter, pricingMode]
  );

  const totals = useMemo(
    () =>
      (() => {
        const baseTotals = environmentBreakdown.reduce(
          (accumulator, environment) => ({
            area: accumulator.area + environment.area,
            rolls: accumulator.rolls + environment.rollsForMode,
            removalRolls: accumulator.removalRolls + (environment.removalIncluded ? environment.rollsForMode : 0),
            subtotal: accumulator.subtotal + environment.baseSubtotal,
            total: accumulator.total + environment.total,
          }),
          { area: 0, rolls: 0, removalRolls: 0, subtotal: 0, total: 0 }
        );
        const unitRemovalPrice = Number(removalPricePerRoll || 0);
        const removal = removalIncluded && Number.isFinite(unitRemovalPrice)
          ? baseTotals.removalRolls * unitRemovalPrice
          : 0;

        return {
          ...baseTotals,
          removal,
          total: baseTotals.subtotal + removal,
        };
      })(),
    [environmentBreakdown, removalIncluded, removalPricePerRoll]
  );

  const grandTotal = totals.total;
  const normalizedInstallments = installmentEnabled ? Number(installmentsCount || 2) : 1;
  const normalizedInterestFreeInstallments = installmentEnabled
    ? Math.min(normalizedInstallments, Math.max(1, Number(interestFreeInstallments || 1)))
    : 1;
  const normalizedInstallmentInterestRate = installmentEnabled
    ? Math.max(0, Number(installmentInterestRate || 0))
    : 0;
  const pixDiscountPercent = Number(upfrontPaymentTerms.pix?.discount || 0);
  const installmentPreview = installmentInfo({
    total_amount: grandTotal,
    installment_enabled: installmentEnabled,
    installments_count: normalizedInstallments,
    interest_free_installments: normalizedInterestFreeInstallments,
    installment_interest_rate: normalizedInstallmentInterestRate,
  });
  const pixPreviewValue = grandTotal * (1 - (pixDiscountPercent / 100));
  const selectedUpfrontPaymentTerms = useMemo(
    () =>
      UPFRONT_PAYMENT_METHODS.reduce((selected, method) => {
        const configuration = upfrontPaymentTerms[method.id];
        if (!configuration?.enabled) {
          return selected;
        }

        const discountPercent = Number(configuration.discount);
        return [
          ...selected,
          {
            method: method.id,
            label: method.label,
            discount_percent: Number.isFinite(discountPercent) ? discountPercent : 0,
          },
        ];
      }, []),
    [upfrontPaymentTerms]
  );
  const upfrontPaymentSummary = selectedUpfrontPaymentTerms.length
    ? selectedUpfrontPaymentTerms
      .map((term) => `${term.label}${term.discount_percent > 0 ? ` ${term.discount_percent}%` : ''}`)
      .join(' • ')
    : 'Não definido';
  const selectedClient = clients.find((client) => Number(client.id) === Number(clientId));
  const selectedClientAddress = [
    [
      selectedClient?.street,
      selectedClient?.house_number && `Nº ${selectedClient.house_number}`,
    ].filter(Boolean).join(', '),
    [selectedClient?.neighborhood, [selectedClient?.city, selectedClient?.state].filter(Boolean).join(' - ')].filter(Boolean).join(', '),
    selectedClient?.zip_code && `CEP ${selectedClient.zip_code}`,
  ].filter(Boolean).join(' • ') || selectedClient?.address || 'Endereço não informado';
  const canCalculate = totals.area > 0;
  const canSave = canCalculate && grandTotal > 0 && Number(clientId) > 0;

  const steps = [
    { number: 1, label: 'Cliente', state: createStepState(Boolean(clientId), activeStep === 1) },
    { number: 2, label: 'Cálculo', state: createStepState(canCalculate && grandTotal > 0, activeStep === 2) },
    { number: 3, label: 'Resumo', state: createStepState(canCalculate && grandTotal > 0 && activeStep > 3, activeStep === 3) },
    { number: 4, label: 'Enviar', state: createStepState(false, activeStep === 4) },
  ];

  const continueFromClient = () => {
    if (!Number(clientId)) {
      toast.error('Escolha o cliente antes de montar o orçamento.');
      return;
    }
    setActiveStep(2);
  };

  const continueFromCalculation = () => {
    if (!canCalculate || grandTotal <= 0) {
      toast.error('Preencha as medidas e os valores para calcular o orçamento.');
      return;
    }
    setActiveStep(3);
  };

  const handleClear = () => {
    setClientId('');
    setPricingMode('roll');
    setRollArea(4.5);
    setPricePerRoll(profileDefaults.rollPrice);
    setPricePerSquareMeter(10);
    setRemovalPricePerRoll(profileDefaults.removalPricePerRoll);
    setInstallmentEnabled(false);
    setInstallmentsCount(3);
    setInterestFreeInstallments(3);
    setInstallmentInterestRate(0);
    setUpfrontPaymentTerms(createUpfrontPaymentTerms());
    setEnvironments([createEnvironment()]);
  };

  const updateUpfrontPaymentTerm = (methodId, field, value) => {
    setUpfrontPaymentTerms((current) => ({
      ...current,
      [methodId]: {
        ...current[methodId],
        [field]: value,
      },
    }));
  };

  const handleClientCreated = (client) => {
    if (!client?.id) {
      return;
    }

    setClients((current) => [
      client,
      ...current.filter((item) => Number(item.id) !== Number(client.id)),
    ]);
    setClientId(String(client.id));
    refreshSubscription().catch(() => null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedClientId = Number(clientId);
    const normalizedPricePerRoll = Number(pricePerRoll);
    const normalizedPricePerSquareMeter = Number(pricePerSquareMeter);
    const normalizedRollArea = Number(rollArea);
    const normalizedRemovalPricePerRoll = Number(removalPricePerRoll);
    const normalizedInstallmentsCount = Number(installmentsCount);
    const normalizedInterestFreeCount = Number(interestFreeInstallments);
    const normalizedInterestRate = Number(installmentInterestRate);

    if (!Number.isInteger(normalizedClientId) || normalizedClientId <= 0) {
      toast.error('Selecione um cliente válido.');
      return;
    }

    if (pricingMode === 'roll' && (!Number.isFinite(normalizedPricePerRoll) || normalizedPricePerRoll <= 0)) {
      toast.error('Informe um preço por rolo maior que zero.');
      return;
    }

    if (!Number.isFinite(normalizedRollArea) || normalizedRollArea <= 0 || normalizedRollArea > 1000) {
      toast.error('Informe um rendimento de rolo válido.');
      return;
    }

    if (
      pricingMode === 'square_meter' &&
      (!Number.isFinite(normalizedPricePerSquareMeter) || normalizedPricePerSquareMeter <= 0)
    ) {
      toast.error('Informe um preço por metro quadrado maior que zero.');
      return;
    }

    if (
      removalIncluded &&
      (!Number.isFinite(normalizedRemovalPricePerRoll) || normalizedRemovalPricePerRoll < 0)
    ) {
      toast.error('Informe um valor de remoção por rolo válido.');
      return;
    }

    if (
      installmentEnabled &&
      (!Number.isInteger(normalizedInstallmentsCount) ||
        normalizedInstallmentsCount < 2 ||
        normalizedInstallmentsCount > 12)
    ) {
      toast.error('Escolha um parcelamento entre 2x e 12x.');
      return;
    }

    if (
      installmentEnabled &&
      (!Number.isInteger(normalizedInterestFreeCount) ||
        normalizedInterestFreeCount < 1 ||
        normalizedInterestFreeCount > normalizedInstallmentsCount)
    ) {
      toast.error('Defina até quantas parcelas ficam sem juros.');
      return;
    }

    if (
      installmentEnabled &&
      (!Number.isFinite(normalizedInterestRate) || normalizedInterestRate < 0 || normalizedInterestRate > 100)
    ) {
      toast.error('Informe uma taxa de juros entre 0% e 100%.');
      return;
    }

    const invalidUpfrontPaymentTerm = selectedUpfrontPaymentTerms.find((term) => (
      !Number.isFinite(term.discount_percent) || term.discount_percent < 0 || term.discount_percent > 100
    ));

    if (invalidUpfrontPaymentTerm) {
      toast.error('O desconto à vista deve ficar entre 0% e 100%.');
      return;
    }

    const invalidEnvironment = environments.find((environment) => {
      const height = Number(environment.height);
      const width = Number(environment.width);
      const hasManualRolls = String(environment.rolls_manual || '').trim() !== '';
      const manualRolls = hasManualRolls ? Number(environment.rolls_manual) : null;
      return (
        !String(environment.name || '').trim() ||
        !Number.isFinite(height) ||
        height <= 0 ||
        !Number.isFinite(width) ||
        width <= 0 ||
        (pricingMode === 'roll' && hasManualRolls && (!Number.isInteger(manualRolls) || manualRolls <= 0))
      );
    });

    if (invalidEnvironment) {
      toast.error('Revise nome, medidas e rolos dos ambientes.');
      return;
    }

    try {
      await api.post('/budgets', {
        client_id: normalizedClientId,
        pricing_mode: pricingMode,
        roll_area: normalizedRollArea,
        price_per_roll: normalizedPricePerRoll,
        price_per_square_meter: normalizedPricePerSquareMeter,
        installment_enabled: installmentEnabled,
        installments_count: installmentEnabled ? normalizedInstallmentsCount : 1,
        interest_free_installments: installmentEnabled ? normalizedInterestFreeCount : 1,
        installment_interest_rate: installmentEnabled ? normalizedInterestRate : 0,
        upfront_payment_terms: selectedUpfrontPaymentTerms,
        removal_included: removalIncluded,
        removal_price_per_roll: removalIncluded ? normalizedRemovalPricePerRoll : 0,
        environments: environments.map((environment) => ({
          name: environment.name,
          height: Number(environment.height),
          width: Number(environment.width),
          rolls_manual: pricingMode === 'roll' && environment.rolls_manual ? Number(environment.rolls_manual) : null,
          removal_included: Boolean(environment.removal_included),
        })),
      });

      await refreshSubscription();
      toast.success('Orçamento criado.');
      navigate('/budgets');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível criar o orçamento.');
    }
  };

  return (
    <section className="budget-modern-shell">
      <form className="budget-modern-form" id="budget-modern-form" onSubmit={handleSubmit}>
        <header className="budget-modern-topbar fade-up">
          <button aria-label="Voltar aos orçamentos" className="budget-modern-back-button" onClick={() => navigate('/budgets')} type="button">
            <BudgetIcon type="back" />
          </button>

          <div className="budget-modern-topbar-copy">
            <h1>Novo orçamento</h1>
            <p>Cliente, cálculo, resumo e envio — uma etapa por vez.</p>
          </div>

          <span className="budget-modern-progress">Etapa {activeStep} de 4</span>
        </header>

        <PlanUsage className="fade-up" usageKey="monthly_budgets" />

        <section className="budget-modern-stepper fade-up" style={{ animationDelay: '0.04s' }}>
          {steps.map((step, index) => (
            <div className="budget-modern-step" key={step.number}>
              <div className="budget-modern-step-bubble" data-state={step.state}>
                {step.number}
              </div>
              {index < steps.length - 1 ? <span className="budget-modern-step-line" /> : null}
              <span className="budget-modern-step-label" data-state={step.state}>
                {step.label}
              </span>
            </div>
          ))}
        </section>

        <div className={`budget-modern-layout${activeStep === 3 ? '' : ' budget-modern-layout--wide'}`}>
          <main className="budget-modern-main">
            <section className="budget-modern-calculator-card fade-up" style={{ animationDelay: '0.06s' }}>
              <header className="budget-modern-card-head">
                <div className="budget-modern-head-icon">
                  <BudgetIcon type={activeStep === 1 ? 'summary' : activeStep === 4 ? 'save' : 'measure'} />
                </div>
                <div>
                  <h2>{activeStep === 1 ? 'Escolha o cliente' : activeStep === 2 ? 'Monte o orçamento' : activeStep === 4 ? 'Confirme o envio' : 'Revise o orçamento'}</h2>
                  <p>{activeStep === 1 ? 'Defina para quem este orçamento será criado.' : activeStep === 2 ? 'Preencha os detalhes para montar o orçamento em uma única etapa.' : activeStep === 4 ? 'Confira os dados finais antes de salvar o orçamento.' : 'Confira os valores antes de seguir para o envio.'}</p>
                </div>
              </header>

              {activeStep === 2 ? (
                <>
              <div className="budget-modern-section budget-modern-calculation-section">
                <div className="budget-modern-calculation-base budget-modern-calculation-block">
                  <div className="budget-modern-calculation-base-head">
                    <div>
                      <span>01 · Material e cobrança</span>
                      <strong>Defina o valor e o rendimento do material</strong>
                    </div>
                    <div className="budget-modern-mode-switch">
                      <button
                        className={pricingMode === 'roll' ? 'is-active' : ''}
                        onClick={() => setPricingMode('roll')}
                        type="button"
                      >
                        Por rolo
                      </button>
                      <button
                        className={pricingMode === 'square_meter' ? 'is-active' : ''}
                        onClick={() => setPricingMode('square_meter')}
                        type="button"
                      >
                        Por m²
                      </button>
                    </div>
                  </div>

                  <div className="budget-modern-field-grid budget-modern-material-grid budget-modern-material-grid--compact">
                  {pricingMode === 'roll' ? (
                    <label className="budget-modern-field">
                      <span>Preço do rolo (R$)</span>
                      <div className="budget-modern-currency-input">
                        <i>R$</i>
                        <input
                          min="0.01"
                          onChange={(event) => setPricePerRoll(event.target.value)}
                          placeholder="0,00"
                          required
                          step="0.01"
                          type="number"
                          value={pricePerRoll}
                        />
                      </div>
                    </label>
                  ) : (
                    <label className="budget-modern-field">
                      <span>Valor por m²</span>
                      <div className="budget-modern-currency-input">
                        <i>R$</i>
                        <input
                          min="0.01"
                          onChange={(event) => setPricePerSquareMeter(event.target.value)}
                          placeholder="0,00"
                          required
                          step="0.01"
                          type="number"
                          value={pricePerSquareMeter}
                        />
                      </div>
                    </label>
                  )}

                  <label className="budget-modern-field">
                    <span>Rendimento do rolo</span>
                    <div className="budget-modern-currency-input">
                      <i>m²</i>
                      <input
                        inputMode="decimal"
                        min="0.01"
                        onChange={(event) => setRollArea(event.target.value)}
                        placeholder="Ex.: 4,5"
                        required
                        step="0.01"
                        type="number"
                        value={rollArea}
                      />
                    </div>
                  </label>
                </div>
                </div>

                <div className="budget-modern-calculation-block budget-modern-environments-block">
                <div className="budget-modern-calculation-group-head">
                  <div>
                    <span>02 · Ambientes</span>
                    <strong>Informe as medidas de cada espaço</strong>
                  </div>
                  <div className="budget-modern-environment-actions">
                    <button className="budget-modern-inline-button budget-modern-environment-add" onClick={addEnvironment} type="button">
                      <BudgetIcon type="add" />
                      <span>{isPro ? 'Adicionar ambiente' : 'Adicionar ambiente • Pro'}</span>
                      <small>{environments.length} ambiente{environments.length === 1 ? '' : 's'}</small>
                    </button>
                  </div>
                </div>

                <div className="budget-modern-environments">
                  {environments.map((environment, index) => {
                    const details = environmentBreakdown[index];

                    return (
                      <article className="budget-modern-environment" key={`env-${index}`}>
                        <div className="budget-modern-environment-head">
                          <div>
                            <strong>Ambiente {index + 1}</strong>
                          </div>

                          {environments.length > 1 ? (
                            <button className="budget-modern-remove-button" onClick={() => removeEnvironment(index)} type="button">
                              <BudgetIcon type="trash" />
                            </button>
                          ) : null}
                        </div>

                        <div className="budget-modern-environment-compact-grid">
                          <label className="budget-modern-field budget-modern-environment-name">
                            <span>Ambiente</span>
                            <input
                              onChange={(event) => updateEnvironment(index, 'name', event.target.value)}
                              placeholder="Ex.: Sala"
                              required
                              value={environment.name}
                            />
                          </label>

                          <label className="budget-modern-field">
                            <span>Largura (m)</span>
                            <input
                              min="0.01"
                              onChange={(event) => updateEnvironment(index, 'width', event.target.value)}
                              placeholder="0,00"
                              required
                              step="0.01"
                              type="number"
                              value={environment.width}
                            />
                          </label>

                          <label className="budget-modern-field">
                            <span>Altura (m)</span>
                            <input
                              min="0.01"
                              onChange={(event) => updateEnvironment(index, 'height', event.target.value)}
                              placeholder="0,00"
                              required
                              step="0.01"
                              type="number"
                              value={environment.height}
                            />
                          </label>

                          <div className="budget-modern-field budget-modern-environment-area" aria-label={`Área calculada automaticamente do ambiente ${index + 1}`}>
                            <span>Área</span>
                            <output title="Valor calculado automaticamente">{details.area.toFixed(2)} m²</output>
                          </div>

                          {pricingMode === 'roll' ? (
                            <label className="budget-modern-field">
                              <span>Rolos (opcional)</span>
                              <input
                                min="1"
                                onChange={(event) => updateEnvironment(index, 'rolls_manual', event.target.value)}
                                placeholder={`Auto: ${details.rollsAuto}`}
                                step="1"
                                type="number"
                                value={environment.rolls_manual}
                              />
                            </label>
                          ) : null}

                          <label className="budget-modern-toggle budget-modern-environment-removal">
                            <input
                              checked={Boolean(environment.removal_included)}
                              onChange={(event) => updateEnvironment(index, 'removal_included', event.target.checked)}
                              type="checkbox"
                            />
                            <span>Remover papel</span>
                          </label>
                        </div>

                      </article>
                    );
                  })}
                </div>
                </div>

                <div className="budget-modern-payment-box budget-modern-removal-rate budget-modern-calculation-block">
                  <label className="budget-modern-field">
                    <span>03 · Remoção por rolo</span>
                    <div className="budget-modern-currency-input">
                      <i>R$</i>
                      <input
                        disabled={!removalIncluded}
                        min="0"
                        onChange={(event) => setRemovalPricePerRoll(event.target.value)}
                        placeholder="0,00"
                        step="0.01"
                        type="number"
                        value={removalPricePerRoll}
                      />
                    </div>
                  </label>

                  <div className="budget-modern-removal-summary">
                    <span>Remoção selecionada</span>
                    {removalIncluded
                      ? <strong>{totals.removalRolls} rolo{totals.removalRolls === 1 ? '' : 's'} • {formatCurrency(totals.removal)}</strong>
                      : <strong>Nenhum ambiente marcado</strong>}
                  </div>
                </div>

                <div className="budget-modern-payment-conditions budget-modern-calculation-block">
                  <div className="budget-modern-payment-conditions-head">
                    <div>
                      <span>04 · Pagamento</span>
                      <strong>Parcelamento e desconto à vista</strong>
                    </div>
                    <small>Marque apenas as opções que você aceita.</small>
                  </div>

                  <div className="budget-modern-payment-conditions-body">
                    <div className="budget-modern-payment-box budget-modern-installment-control">
                      <label className="budget-modern-toggle budget-modern-installment-switch">
                        <input
                          checked={installmentEnabled}
                          onChange={(event) => setInstallmentEnabled(event.target.checked)}
                          type="checkbox"
                        />
                        <span>Aceitar pagamento parcelado</span>
                      </label>

                      {installmentEnabled ? (
                        <>
                          <div className="budget-modern-credit-card-settings">
                            <div className="budget-modern-credit-card-head">
                              <BudgetIcon type="card" />
                              <strong>Cartão de crédito</strong>
                            </div>

                            <div className="budget-modern-installment-fields">
                              <label className="budget-modern-field">
                                <span>Máximo de parcelas</span>
                                <select
                                  onChange={(event) => {
                                    const nextCount = Number(event.target.value);
                                    setInstallmentsCount(nextCount);
                                    setInterestFreeInstallments((current) => Math.min(Number(current || nextCount), nextCount));
                                  }}
                                  value={installmentsCount}
                                >
                                  {INSTALLMENT_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option}x</option>
                                  ))}
                                </select>
                              </label>

                              <label className="budget-modern-field">
                                <span>Sem juros até</span>
                                <select
                                  onChange={(event) => setInterestFreeInstallments(Number(event.target.value))}
                                  value={Math.min(interestFreeInstallments, installmentsCount)}
                                >
                                  {INTEREST_FREE_INSTALLMENT_OPTIONS.filter((option) => option <= installmentsCount).map((option) => (
                                    <option key={option} value={option}>{option}x</option>
                                  ))}
                                </select>
                              </label>

                              <label className="budget-modern-field">
                                <span>Juros após (a.m.)</span>
                                <select
                                  onChange={(event) => setInstallmentInterestRate(Number(event.target.value))}
                                  value={installmentInterestRate}
                                >
                                  {INSTALLMENT_INTEREST_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          </div>

                          <div className="budget-modern-installment-preview">
                            <div>
                              <BudgetIcon type="view" />
                              <strong>Prévia para o cliente</strong>
                            </div>
                            <span>
                              {upfrontPaymentTerms.pix?.enabled
                                ? `Pix: ${formatCurrency(pixPreviewValue)}${pixDiscountPercent > 0 ? ` com ${pixDiscountPercent}% de desconto` : ''}`
                                : 'Pix: configure a opção à vista ao lado'}
                            </span>
                            <span>Cartão: até {installmentAmountLabel(installmentPreview)}</span>
                            <small>{installmentConditionsLabel(installmentPreview)}</small>
                          </div>
                        </>
                      ) : null}
                    </div>

                    <div className="budget-modern-payment-box budget-modern-upfront-payment-control">
                      <div className="budget-modern-upfront-payment-head">
                        <div>
                          <span>À vista</span>
                          <strong>Forma e desconto</strong>
                        </div>
                        <small>Desconto %</small>
                      </div>

                      <div className="budget-modern-upfront-payment-grid">
                        {UPFRONT_PAYMENT_METHODS.map((method) => {
                          const configuration = upfrontPaymentTerms[method.id];

                          return (
                            <label className="budget-modern-upfront-payment-method" key={method.id}>
                              <span className="budget-modern-upfront-payment-method-name">
                                <input
                                  checked={Boolean(configuration?.enabled)}
                                  onChange={(event) => updateUpfrontPaymentTerm(method.id, 'enabled', event.target.checked)}
                                  type="checkbox"
                                />
                                <strong>{method.label}</strong>
                              </span>
                              <span className="budget-modern-upfront-payment-discount">
                                <input
                                  aria-label={`Desconto no ${method.label}`}
                                  disabled={!configuration?.enabled}
                                  max="100"
                                  min="0"
                                  onChange={(event) => updateUpfrontPaymentTerm(method.id, 'discount', event.target.value)}
                                  step="0.01"
                                  type="number"
                                  value={configuration?.discount ?? 0}
                                />
                                <i>%</i>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="budget-modern-stage-actions">
                <button className="budget-modern-secondary-cta" onClick={() => setActiveStep(1)} type="button">
                  Voltar ao cliente
                </button>
                <button className="budget-modern-primary-cta" onClick={continueFromCalculation} type="button">
                  Revisar resumo
                </button>
              </div>
                </>
              ) : null}

              {activeStep === 1 ? (
              <div className="budget-modern-section">
                <div className="budget-modern-section-title">
                  <div>
                    <BudgetIcon type="summary" />
                    <span>1. Cliente</span>
                  </div>
                </div>

                <div className="budget-modern-client-choice" role="group" aria-label="Seleção de cliente">
                  <button
                    aria-pressed="true"
                    className="budget-modern-client-choice-button is-active"
                    onClick={() => document.getElementById('budget-client-select')?.focus()}
                    type="button"
                  >
                    Cliente existente
                  </button>
                  <button
                    className="budget-modern-client-choice-button"
                    onClick={() => setShowClientForm(true)}
                    type="button"
                  >
                    Novo cliente
                  </button>
                </div>

                <div className="budget-modern-field-grid">
                  <label className="budget-modern-field budget-modern-field--full">
                    <span>Cliente</span>
                    <select id="budget-client-select" onChange={(event) => setClientId(event.target.value)} required value={clientId}>
                      <option value="">
                        {clients.length ? 'Selecione um cliente' : 'Ainda não há clientes cadastrados'}
                      </option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="budget-modern-actions-bar">
                  <button className="budget-modern-primary-cta" onClick={continueFromClient} type="button">
                    Continuar para o cálculo
                  </button>
                  <button className="budget-modern-secondary-cta" onClick={handleClear} type="button">
                    Limpar dados
                  </button>
                </div>
              </div>

              ) : null}

              {activeStep === 4 ? (
                <div className="budget-modern-section budget-modern-send-stage">
                  <div className="budget-modern-section-title">
                    <div>
                      <BudgetIcon type="save" />
                      <span>4. Enviar orçamento</span>
                    </div>
                  </div>

                  <p className="budget-modern-send-copy">
                    O orçamento será salvo como pendente. Em seguida, você poderá baixar o PDF ou enviar no WhatsApp pela lista de orçamentos.
                  </p>

                  <div className="budget-modern-send-checks">
                    <div><span>Cliente</span><strong>{selectedClient?.name}</strong></div>
                    <div><span>Total</span><strong>{formatCurrency(grandTotal)}</strong></div>
                    <div><span>Pagamento</span><strong>{paymentOptionsLabel({ enabled: installmentEnabled, count: normalizedInstallments }, selectedUpfrontPaymentTerms.length > 0)}</strong></div>
                  </div>

                  <div className="budget-modern-stage-actions">
                    <button className="budget-modern-secondary-cta" onClick={() => setActiveStep(3)} type="button">
                      Voltar ao resumo
                    </button>
                    <button className="budget-modern-primary-cta" disabled={!canSave} type="submit">
                      Salvar orçamento
                    </button>
                  </div>
                </div>
              ) : null}

              {activeStep === 3 ? (
                <div className="budget-modern-section budget-modern-review-stage">
                  <div className="budget-modern-section-title">
                    <div>
                      <BudgetIcon type="summary" />
                      <span>3. Revisão do orçamento</span>
                    </div>
                  </div>
                  <p className="budget-modern-send-copy">
                    Confira os dados abaixo antes de salvar. Você ainda pode voltar e alterar qualquer informação.
                  </p>

                  <div className="budget-modern-review-overview">
                    <article>
                      <span>Cliente</span>
                      <strong>{selectedClient?.name || '—'}</strong>
                      <small>{selectedClient?.phone || selectedClient?.email || 'Contato não informado'}</small>
                    </article>
                    <article>
                      <span>Ambientes</span>
                      <strong>{environments.length}</strong>
                      <small>{totals.area.toFixed(2)} m² • {totals.rolls} rolos</small>
                    </article>
                    <article>
                      <span>Valor total</span>
                      <strong>{formatCurrency(grandTotal)}</strong>
                      <small>{installmentEnabled ? `${normalizedInstallments}x no cartão` : 'Pagamento à vista'}</small>
                    </article>
                  </div>

                  <div className="budget-modern-review-grid">
                    <article className="budget-modern-review-card">
                      <div className="budget-modern-review-card-head">
                        <div>
                          <BudgetIcon type="summary" />
                          <div>
                            <span>Cliente e local</span>
                            <h3>Quem vai receber</h3>
                          </div>
                        </div>
                        <button className="budget-modern-review-edit" onClick={() => setActiveStep(1)} type="button">
                          Alterar
                        </button>
                      </div>
                      <dl className="budget-modern-review-data">
                        <div><dt>Nome</dt><dd>{selectedClient?.name || 'Não informado'}</dd></div>
                        <div><dt>Contato</dt><dd>{selectedClient?.phone || selectedClient?.email || 'Não informado'}</dd></div>
                        <div className="budget-modern-review-data--full"><dt>Local do serviço</dt><dd>{selectedClientAddress}</dd></div>
                      </dl>
                    </article>

                    <article className="budget-modern-review-card">
                      <div className="budget-modern-review-card-head">
                        <div>
                          <BudgetIcon type="measure" />
                          <div>
                            <span>Cálculo</span>
                            <h3>Materiais e medidas</h3>
                          </div>
                        </div>
                        <button className="budget-modern-review-edit" onClick={() => setActiveStep(2)} type="button">
                          Alterar
                        </button>
                      </div>
                      <dl className="budget-modern-review-data">
                        <div><dt>Cobrança</dt><dd>{pricingMode === 'roll' ? 'Por rolo' : 'Por m²'}</dd></div>
                        <div><dt>Área total</dt><dd>{totals.area.toFixed(2)} m²</dd></div>
                        <div><dt>Rendimento do rolo</dt><dd>{effectiveRollArea.toFixed(2)} m²</dd></div>
                        <div><dt>{pricingMode === 'roll' ? 'Preço por rolo' : 'Preço por m²'}</dt><dd>{formatCurrency(pricingMode === 'roll' ? pricePerRoll : pricePerSquareMeter)}</dd></div>
                      </dl>
                    </article>

                    <article className="budget-modern-review-card budget-modern-review-card--full">
                      <div className="budget-modern-review-card-head">
                        <div>
                          <BudgetIcon type="wallpaper" />
                          <div>
                            <span>Ambientes</span>
                            <h3>Itens incluídos no serviço</h3>
                          </div>
                        </div>
                        <button className="budget-modern-review-edit" onClick={() => setActiveStep(2)} type="button">
                          Alterar
                        </button>
                      </div>
                      <div className="budget-modern-review-environment-list">
                        {environments.map((environment, index) => {
                          const details = environmentBreakdown[index];

                          return (
                            <div className="budget-modern-review-environment" key={`review-${index}`}>
                              <div>
                                <strong>{environment.name || `Ambiente ${index + 1}`}</strong>
                                <small>
                                  {Number(environment.height || 0).toFixed(2)} m × {Number(environment.width || 0).toFixed(2)} m • {details.area.toFixed(2)} m² • {details.rollsForMode} rolo{details.rollsForMode === 1 ? '' : 's'}
                                </small>
                              </div>
                              <div className="budget-modern-review-environment-value">
                                <span>{details.removalIncluded ? 'Com remoção' : 'Sem remoção'}</span>
                                <strong>{formatCurrency(details.total)}</strong>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </article>

                    <article className="budget-modern-review-card budget-modern-review-card--full">
                      <div className="budget-modern-review-card-head">
                        <div>
                          <BudgetIcon type="save" />
                          <div>
                            <span>Pagamento</span>
                            <h3>Condições apresentadas ao cliente</h3>
                          </div>
                        </div>
                        <button className="budget-modern-review-edit" onClick={() => setActiveStep(2)} type="button">
                          Alterar
                        </button>
                      </div>
                      <div className="budget-modern-review-payment-grid">
                        <div className="budget-modern-review-payment-card">
                          <span>Parcelado no cartão</span>
                          <strong>{installmentEnabled ? installmentAmountLabel(installmentPreview) : 'Não oferecido'}</strong>
                          <small>{installmentEnabled ? installmentConditionsLabel(installmentPreview) : 'Ative caso queira oferecer parcelamento.'}</small>
                        </div>
                        <div className="budget-modern-review-payment-card">
                          <span>À vista</span>
                          <strong>{selectedUpfrontPaymentTerms.length ? upfrontPaymentSummary : 'Não informado'}</strong>
                          <small>{selectedUpfrontPaymentTerms.length ? 'As formas abaixo aparecem como opção para o cliente.' : 'Nenhuma forma à vista foi selecionada.'}</small>
                        </div>
                      </div>
                      {selectedUpfrontPaymentTerms.length ? (
                        <div className="budget-modern-review-discount-list">
                          {selectedUpfrontPaymentTerms.map((term) => (
                            <div key={`payment-${term.method}`}>
                              <span>{term.label}</span>
                              <small>{term.discount_percent > 0 ? `${term.discount_percent}% de desconto` : 'Sem desconto'}</small>
                              <strong>{formatCurrency(grandTotal * (1 - term.discount_percent / 100))}</strong>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </article>

                    <article className="budget-modern-review-ready-card budget-modern-review-card--full">
                      <div>
                        <span>Próximo passo</span>
                        <strong>Pronto para salvar e enviar</strong>
                        <p>O orçamento será criado como pendente. Depois, você poderá baixar o PDF e compartilhar no WhatsApp.</p>
                      </div>
                      <ul>
                        <li>Cliente selecionado</li>
                        <li>Medidas e valores revisados</li>
                        <li>Condições de pagamento definidas</li>
                      </ul>
                    </article>
                  </div>

                  <div className="budget-modern-stage-actions">
                    <button className="budget-modern-secondary-cta" onClick={() => setActiveStep(2)} type="button">
                      Ajustar cálculo
                    </button>
                    <button className="budget-modern-primary-cta" disabled={!canSave} onClick={() => setActiveStep(4)} type="button">
                      Continuar para envio
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          </main>

          {activeStep === 3 ? (
          <aside className="budget-modern-summary-panel fade-up" style={{ animationDelay: '0.1s' }}>
            <div className="budget-modern-summary-head">
              <p className="budget-modern-section-label">Resumo financeiro</p>
              <h3>Total e condições</h3>
            </div>

            <div className="budget-modern-summary-list">
              <div className="budget-modern-summary-row">
                <span>Materiais ({totals.rolls} rolos)</span>
                <strong>{formatCurrency(totals.subtotal)}</strong>
              </div>
              <div className="budget-modern-summary-row">
                <span>Remoção por rolo ({totals.removalRolls} rolos marcados)</span>
                <strong>{formatCurrency(totals.removal)}</strong>
              </div>
              <div className="budget-modern-summary-row">
                <span>Subtotal do serviço</span>
                <strong>{formatCurrency(totals.subtotal)}</strong>
              </div>
              <div className="budget-modern-summary-row">
                <span>Pagamento parcelado</span>
                <strong>{installmentEnabled ? `${normalizedInstallments}x` : 'Não oferecido'}</strong>
              </div>
            </div>

            <div className="budget-modern-total-box">
              <span>Total do orçamento</span>
              <strong>{formatCurrency(grandTotal)}</strong>
              <small>
                Valor por m²: {totals.area > 0 ? formatCurrency(grandTotal / totals.area) : formatCurrency(0)}
              </small>
            </div>

            <div className="budget-modern-review-side-note">
              <span>Conferência</span>
              <strong>{environments.length} ambiente{environments.length === 1 ? '' : 's'} • {totals.area.toFixed(2)} m²</strong>
              <small>{selectedUpfrontPaymentTerms.length ? `À vista: ${upfrontPaymentSummary}` : 'Nenhuma condição à vista selecionada.'}</small>
            </div>
          </aside>
          ) : null}
        </div>
      </form>
      {showClientForm ? (
        <ClientForm
          onClose={() => setShowClientForm(false)}
          onSaved={handleClientCreated}
        />
      ) : null}
    </section>
  );
}
