import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';

const rollArea = 4.5;
const INSTALLMENT_OPTIONS = Array.from({ length: 11 }, (_, index) => index + 2);

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

function createEnvironment(defaultRemovalPrice = 0) {
  return {
    name: '',
    height: '',
    width: '',
    rolls_manual: '',
    removal_included: false,
    removal_price: defaultRemovalPrice > 0 ? String(defaultRemovalPrice) : '',
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
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [pricingMode, setPricingMode] = useState('roll');
  const [pricePerRoll, setPricePerRoll] = useState(0);
  const [pricePerSquareMeter, setPricePerSquareMeter] = useState(10);
  const [defaultRemovalPrice, setDefaultRemovalPrice] = useState(0);
  const [profileDefaults, setProfileDefaults] = useState({ rollPrice: 0, removalPrice: 0 });
  const [installmentEnabled, setInstallmentEnabled] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState(3);
  const [environments, setEnvironments] = useState([createEnvironment()]);

  useEffect(() => {
    api.get('/clients').then((response) => setClients(response.data)).catch(() => null);

    api.get('/users/profile')
      .then((response) => {
        const profileDefaultRollPrice = Number(response.data.default_price_per_roll || 0);
        const profileDefaultRemovalPrice = Number(response.data.default_removal_price || 0);

        setProfileDefaults({
          rollPrice: profileDefaultRollPrice,
          removalPrice: profileDefaultRemovalPrice,
        });
        setPricePerRoll(profileDefaultRollPrice);
        setDefaultRemovalPrice(profileDefaultRemovalPrice);
        setEnvironments((current) => {
          if (
            current.length === 1 &&
            !current[0].name &&
            !current[0].height &&
            !current[0].width &&
            !current[0].rolls_manual
          ) {
            return [createEnvironment(profileDefaultRemovalPrice)];
          }

          return current;
        });
      })
      .catch(() => null);
  }, []);

  const updateEnvironment = (index, field, value) => {
    setEnvironments((current) =>
      current.map((item, currentIndex) => (currentIndex === index ? { ...item, [field]: value } : item))
    );
  };

  const toggleEnvironmentRemoval = (index, checked) => {
    setEnvironments((current) =>
      current.map((item, currentIndex) => {
        if (currentIndex !== index) {
          return item;
        }

        const currentPrice = String(item.removal_price || '').trim();
        const fallbackPrice = defaultRemovalPrice > 0 ? String(defaultRemovalPrice) : '';

        return {
          ...item,
          removal_included: checked,
          removal_price: checked ? (currentPrice || fallbackPrice) : item.removal_price,
        };
      })
    );
  };

  const addEnvironment = () => {
    setEnvironments((current) => [...current, createEnvironment(defaultRemovalPrice)]);
  };

  const removeEnvironment = (index) => {
    setEnvironments((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const environmentBreakdown = useMemo(
    () =>
      environments.map((environment) => {
        const height = Number(environment.height || 0);
        const width = Number(environment.width || 0);
        const area = height * width;
        const rollsAuto = Math.ceil(area / rollArea || 0);
        const rollsManual = environment.rolls_manual ? Number(environment.rolls_manual) : null;
        const rollsForMode = pricingMode === 'roll' ? (rollsManual || rollsAuto) : rollsAuto;
        const baseSubtotal =
          pricingMode === 'square_meter'
            ? area * Number(pricePerSquareMeter || 0)
            : rollsForMode * Number(pricePerRoll || 0);
        const removalSelected = Boolean(environment.removal_included);
        const removalValue = removalSelected ? Number(environment.removal_price || 0) : 0;
        const safeRemovalValue = Number.isFinite(removalValue) ? removalValue : 0;

        return {
          area,
          baseSubtotal,
          removalValue: safeRemovalValue,
          rollsAuto,
          rollsForMode,
          total: baseSubtotal + safeRemovalValue,
        };
      }),
    [environments, pricePerRoll, pricePerSquareMeter, pricingMode]
  );

  const totals = useMemo(
    () =>
      environmentBreakdown.reduce(
        (accumulator, environment) => ({
          area: accumulator.area + environment.area,
          rolls: accumulator.rolls + environment.rollsForMode,
          subtotal: accumulator.subtotal + environment.baseSubtotal,
          removal: accumulator.removal + environment.removalValue,
          total: accumulator.total + environment.total,
        }),
        { area: 0, rolls: 0, subtotal: 0, removal: 0, total: 0 }
      ),
    [environmentBreakdown]
  );

  const grandTotal = totals.total;
  const normalizedInstallments = installmentEnabled ? Number(installmentsCount || 2) : 1;
  const installmentValue = normalizedInstallments > 0 ? grandTotal / normalizedInstallments : grandTotal;

  const selectedClient = clients.find((client) => Number(client.id) === Number(clientId));
  const canCalculate = totals.area > 0;
  const canSave = canCalculate && grandTotal > 0 && Number(clientId) > 0;

  const steps = [
    { number: 1, label: 'Calculo', state: createStepState(canCalculate, !canCalculate) },
    { number: 2, label: 'Resumo', state: createStepState(grandTotal > 0, canCalculate && grandTotal <= 0) },
    { number: 3, label: 'Cliente', state: createStepState(Boolean(clientId), grandTotal > 0 && !clientId) },
    { number: 4, label: 'Enviar', state: createStepState(canSave, Boolean(clientId) && !canSave) },
  ];

  const handleClear = () => {
    setClientId('');
    setPricingMode('roll');
    setPricePerRoll(profileDefaults.rollPrice);
    setPricePerSquareMeter(10);
    setDefaultRemovalPrice(profileDefaults.removalPrice);
    setInstallmentEnabled(false);
    setInstallmentsCount(3);
    setEnvironments([createEnvironment(profileDefaults.removalPrice)]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedClientId = Number(clientId);
    const normalizedPricePerRoll = Number(pricePerRoll);
    const normalizedPricePerSquareMeter = Number(pricePerSquareMeter);
    const normalizedInstallmentsCount = Number(installmentsCount);

    if (!Number.isInteger(normalizedClientId) || normalizedClientId <= 0) {
      toast.error('Selecione um cliente valido.');
      return;
    }

    if (pricingMode === 'roll' && (!Number.isFinite(normalizedPricePerRoll) || normalizedPricePerRoll <= 0)) {
      toast.error('Informe um preco por rolo maior que zero.');
      return;
    }

    if (
      pricingMode === 'square_meter' &&
      (!Number.isFinite(normalizedPricePerSquareMeter) || normalizedPricePerSquareMeter <= 0)
    ) {
      toast.error('Informe um preco por metro quadrado maior que zero.');
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

    const invalidEnvironment = environments.find((environment) => {
      const height = Number(environment.height);
      const width = Number(environment.width);
      const hasManualRolls = String(environment.rolls_manual || '').trim() !== '';
      const manualRolls = hasManualRolls ? Number(environment.rolls_manual) : null;
      const removalSelected = Boolean(environment.removal_included);
      const removalValue = removalSelected ? Number(environment.removal_price) : 0;

      return (
        !String(environment.name || '').trim() ||
        !Number.isFinite(height) ||
        height <= 0 ||
        !Number.isFinite(width) ||
        width <= 0 ||
        (pricingMode === 'roll' && hasManualRolls && (!Number.isInteger(manualRolls) || manualRolls <= 0)) ||
        (removalSelected && (!Number.isFinite(removalValue) || removalValue < 0))
      );
    });

    if (invalidEnvironment) {
      toast.error('Revise nome, medidas, rolos e remocao dos ambientes.');
      return;
    }

    try {
      await api.post('/budgets', {
        client_id: normalizedClientId,
        pricing_mode: pricingMode,
        price_per_roll: normalizedPricePerRoll,
        price_per_square_meter: normalizedPricePerSquareMeter,
        installment_enabled: installmentEnabled,
        installments_count: installmentEnabled ? normalizedInstallmentsCount : 1,
        removal_included: false,
        removal_price: 0,
        environments: environments.map((environment) => ({
          name: environment.name,
          height: Number(environment.height),
          width: Number(environment.width),
          rolls_manual: pricingMode === 'roll' && environment.rolls_manual ? Number(environment.rolls_manual) : null,
          removal_included: Boolean(environment.removal_included),
          removal_price: environment.removal_included ? Number(environment.removal_price || 0) : 0,
        })),
      });

      toast.success('Orcamento criado.');
      navigate('/budgets');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel criar o orcamento.');
    }
  };

  return (
    <section className="budget-modern-shell">
      <form className="budget-modern-form" id="budget-modern-form" onSubmit={handleSubmit}>
        <header className="budget-modern-topbar fade-up">
          <button className="budget-modern-back-button" onClick={() => navigate('/budgets')} type="button">
            <BudgetIcon type="back" />
          </button>

          <div className="budget-modern-topbar-copy">
            <h1>Novo orcamento</h1>
            <p>Faca orcamentos de instalacao com clareza e rapidez.</p>
          </div>

          <button className="budget-modern-save-button" type="submit">
            <BudgetIcon type="save" />
            <span>Salvar orcamento</span>
          </button>
        </header>

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

        <div className="budget-modern-layout">
          <main className="budget-modern-main">
            <section className="budget-modern-calculator-card fade-up" style={{ animationDelay: '0.06s' }}>
              <header className="budget-modern-card-head">
                <div className="budget-modern-head-icon">
                  <BudgetIcon type="measure" />
                </div>
                <div>
                  <h2>Calculadora de instalacao</h2>
                  <p>Informe as medidas, o modo de cobranca e os servicos para calcular.</p>
                </div>
              </header>

              <div className="budget-modern-section">
                <div className="budget-modern-section-title">
                  <div>
                    <BudgetIcon type="measure" />
                    <span>1. Medidas da parede</span>
                  </div>

                  <button className="budget-modern-inline-button" onClick={addEnvironment} type="button">
                    <BudgetIcon type="add" />
                    Adicionar ambiente
                  </button>
                </div>

                <div className="budget-modern-note">
                  <BudgetIcon type="info" />
                  Ajuste manual de rolos disponivel em cada ambiente quando necessario.
                </div>

                <div className="budget-modern-environments">
                  {environments.map((environment, index) => {
                    const details = environmentBreakdown[index];

                    return (
                      <article className="budget-modern-environment" key={`env-${index}`}>
                        <div className="budget-modern-environment-head">
                          <div>
                            <strong>Ambiente {index + 1}</strong>
                            <span>Defina nome, medidas e remocao deste espaco.</span>
                          </div>

                          {environments.length > 1 ? (
                            <button className="budget-modern-remove-button" onClick={() => removeEnvironment(index)} type="button">
                              <BudgetIcon type="trash" />
                            </button>
                          ) : null}
                        </div>

                        <div className="budget-modern-field-grid is-identity">
                          <label className="budget-modern-field budget-modern-field--full">
                            <span>Nome do ambiente</span>
                            <input
                              onChange={(event) => updateEnvironment(index, 'name', event.target.value)}
                              placeholder="Ex.: Sala principal"
                              required
                              value={environment.name}
                            />
                          </label>
                        </div>

                        <div className="budget-modern-field-grid">
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

                          <label className="budget-modern-field budget-modern-field--readonly">
                            <span>Area total</span>
                            <input disabled readOnly value={`${details.area.toFixed(2)} m²`} />
                          </label>
                        </div>

                        {pricingMode === 'roll' ? (
                          <div className="budget-modern-field-grid">
                            <label className="budget-modern-field budget-modern-field--full">
                              <span>Rolos manuais (opcional)</span>
                              <input
                                min="1"
                                onChange={(event) => updateEnvironment(index, 'rolls_manual', event.target.value)}
                                placeholder={`Automatico: ${details.rollsAuto}`}
                                step="1"
                                type="number"
                                value={environment.rolls_manual}
                              />
                            </label>
                          </div>
                        ) : null}

                        <label className="budget-modern-toggle">
                          <input
                            checked={Boolean(environment.removal_included)}
                            onChange={(event) => toggleEnvironmentRemoval(index, event.target.checked)}
                            type="checkbox"
                          />
                          <span>Incluir remocao neste ambiente</span>
                        </label>

                        {environment.removal_included ? (
                          <div className="budget-modern-field-grid">
                            <label className="budget-modern-field budget-modern-field--full">
                              <span>Valor da remocao</span>
                              <div className="budget-modern-currency-input">
                                <i>R$</i>
                                <input
                                  min="0"
                                  onChange={(event) => updateEnvironment(index, 'removal_price', event.target.value)}
                                  step="0.01"
                                  type="number"
                                  value={environment.removal_price}
                                />
                              </div>
                            </label>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="budget-modern-section">
                <div className="budget-modern-section-title">
                  <div>
                    <BudgetIcon type="wallpaper" />
                    <span>2. Papel de parede</span>
                  </div>
                </div>

                <div className="budget-modern-mode-switch">
                  <button
                    className={pricingMode === 'roll' ? 'is-active' : ''}
                    onClick={() => setPricingMode('roll')}
                    type="button"
                  >
                    Cobrar por rolo
                  </button>
                  <button
                    className={pricingMode === 'square_meter' ? 'is-active' : ''}
                    onClick={() => setPricingMode('square_meter')}
                    type="button"
                  >
                    Cobrar por m²
                  </button>
                </div>

                <div className="budget-modern-field-grid">
                  {pricingMode === 'roll' ? (
                    <label className="budget-modern-field">
                      <span>Preco do rolo (R$)</span>
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
                    <span>Rendimento do rolo (m²)</span>
                    <input disabled readOnly value={rollArea.toFixed(1).replace('.', ',')} />
                  </label>

                  <label className="budget-modern-field">
                    <span>Remocao padrao por ambiente</span>
                    <div className="budget-modern-currency-input">
                      <i>R$</i>
                      <input
                        min="0"
                        onChange={(event) => setDefaultRemovalPrice(Number(event.target.value || 0))}
                        placeholder="0,00"
                        step="0.01"
                        type="number"
                        value={defaultRemovalPrice}
                      />
                    </div>
                  </label>
                </div>

                <div className="budget-modern-calculated-grid">
                  <article>
                    <span>Area total</span>
                    <strong>{totals.area.toFixed(2)} m²</strong>
                    <small>Base somada de todos os ambientes.</small>
                  </article>
                  <article>
                    <span>Rolos necessarios</span>
                    <strong>{totals.rolls} rolos</strong>
                    <small>{(totals.rolls * rollArea).toFixed(2)} m² previstos</small>
                  </article>
                  <article>
                    <span>Subtotal de materiais</span>
                    <strong>{formatCurrency(totals.subtotal)}</strong>
                    <small>{pricingMode === 'roll' ? 'Calculo por rolo.' : 'Calculo por metro quadrado.'}</small>
                  </article>
                </div>
              </div>

              <div className="budget-modern-section">
                <div className="budget-modern-section-title">
                  <div>
                    <BudgetIcon type="services" />
                    <span>3. Servicos e valores</span>
                  </div>
                </div>

                <div className="budget-modern-service-list">
                  <div className="budget-modern-service-row">
                    <span>Modo de cobranca</span>
                    <strong>{pricingMode === 'roll' ? 'Por rolo' : 'Por m²'}</strong>
                  </div>
                  <div className="budget-modern-service-row">
                    <span>Base de materiais</span>
                    <strong>{formatCurrency(totals.subtotal)}</strong>
                  </div>
                  <div className="budget-modern-service-row">
                    <span>Remocao total</span>
                    <strong>{formatCurrency(totals.removal)}</strong>
                  </div>
                </div>

                <div className="budget-modern-payment-box">
                  <label className="budget-modern-toggle">
                    <input
                      checked={installmentEnabled}
                      onChange={(event) => setInstallmentEnabled(event.target.checked)}
                      type="checkbox"
                    />
                    <span>Permitir pagamento parcelado</span>
                  </label>

                  {installmentEnabled ? (
                    <label className="budget-modern-field budget-modern-field--full">
                      <span>Parcelamento</span>
                      <select
                        onChange={(event) => setInstallmentsCount(Number(event.target.value))}
                        value={installmentsCount}
                      >
                        {INSTALLMENT_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}x de {formatCurrency(grandTotal / option)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
              </div>

              <div className="budget-modern-section">
                <div className="budget-modern-section-title">
                  <div>
                    <BudgetIcon type="summary" />
                    <span>4. Cliente e envio</span>
                  </div>
                </div>

                <div className="budget-modern-field-grid">
                  <label className="budget-modern-field budget-modern-field--full">
                    <span>Cliente</span>
                    <select onChange={(event) => setClientId(event.target.value)} required value={clientId}>
                      <option value="">Selecione um cliente</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="budget-modern-actions-bar">
                  <button className="budget-modern-primary-cta" type="submit">
                    Salvar orcamento
                  </button>
                  <button className="budget-modern-secondary-cta" onClick={handleClear} type="button">
                    Limpar calculo
                  </button>
                </div>
              </div>
            </section>
          </main>

          <aside className="budget-modern-summary-panel fade-up" style={{ animationDelay: '0.1s' }}>
            <div className="budget-modern-summary-head">
              <p className="budget-modern-section-label">Resumo do orcamento</p>
              <h3>Valores finais</h3>
            </div>

            <div className="budget-modern-summary-list">
              <div className="budget-modern-summary-row">
                <span>Materiais ({totals.rolls} rolos)</span>
                <strong>{formatCurrency(totals.subtotal)}</strong>
              </div>
              <div className="budget-modern-summary-row">
                <span>Remocao</span>
                <strong>{formatCurrency(totals.removal)}</strong>
              </div>
              <div className="budget-modern-summary-row">
                <span>Forma de pagamento</span>
                <strong>{installmentEnabled ? `${normalizedInstallments}x` : 'A vista'}</strong>
              </div>
            </div>

            <div className="budget-modern-total-box">
              <span>Total do orcamento</span>
              <strong>{formatCurrency(grandTotal)}</strong>
              <small>
                Valor por m²: {totals.area > 0 ? formatCurrency(grandTotal / totals.area) : formatCurrency(0)}
              </small>
            </div>

            <div className="budget-modern-client-box">
              <span>Cliente selecionado</span>
              <strong>{selectedClient?.name || 'Escolha quem vai receber o orcamento'}</strong>
              <small>
                {selectedClient?.phone || selectedClient?.email || 'Os dados do cliente aparecem aqui.'}
              </small>
            </div>

            <div className="budget-modern-environment-summary">
              <p>Ambientes</p>
              {environments.map((environment, index) => {
                const details = environmentBreakdown[index];

                return (
                  <div className="budget-modern-mini-row" key={`summary-${index}`}>
                    <span>{environment.name || `Ambiente ${index + 1}`}</span>
                    <strong>{formatCurrency(details.total)}</strong>
                  </div>
                );
              })}
            </div>

            <div className="budget-modern-summary-actions">
              <button className="budget-modern-primary-cta" disabled={!canSave} type="submit">
                Continuar
              </button>
              <button className="budget-modern-secondary-cta" onClick={handleClear} type="button">
                Limpar calculo
              </button>
            </div>
          </aside>
        </div>
      </form>
    </section>
  );
}
