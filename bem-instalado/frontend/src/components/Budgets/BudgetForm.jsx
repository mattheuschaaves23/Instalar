import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { useSubscription } from '../../contexts/SubscriptionContext';
import PlanUsage from '../Subscription/PlanUsage';
import ClientForm from '../Clients/ClientForm';
import BudgetClientChoice from './BudgetClientChoice';
import QuoteProductCatalog from './QuoteProductCatalog';
import { notifyPanelBadgeCountsChanged } from '../Layout/panelBadgeCounts';
import { installmentInfo, installmentConditionsLabel } from '../../../../shared/installmentTerms.mjs';
import productLimits from '../../../../shared/quoteProducts.json';
import './BudgetWizard.css';

const INSTALLMENT_OPTIONS = Array.from({ length: 11 }, (_, index) => index + 2);
const INTEREST_FREE_INSTALLMENT_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const MAX_REMOVAL_ROLLS = 1000;
const REMOVAL_ROLLS_ERROR = 'Informe de 1 a 1000 rolos inteiros para a remoção.';
const MEASURE = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STEP_LABELS = ['Cliente', 'Cálculo', 'Resumo', 'Salvar'];

function searchable(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function matchesClient(client, query) {
  const text = searchable(query);
  if (!text) return true;
  if ([client.name, client.email, client.contact_name].some((value) => searchable(value).includes(text))) return true;
  if (!/^[\d+().\s-]+$/.test(text)) return false;
  const digits = text.replace(/\D/g, '');
  return !!digits && [client.phone, client.whatsapp].some((value) => String(value || '').replace(/\D/g, '').includes(digits));
}
const UPFRONT_PAYMENT_METHODS = [
  { id: 'pix', label: 'Pix' },
  { id: 'boleto', label: 'Boleto' },
  { id: 'debit_card', label: 'Cartão de débito' },
  { id: 'cash', label: 'Dinheiro' },
  { id: 'bank_transfer', label: 'Transferência' },
  { id: 'credit_card', label: 'Cartão de crédito à vista' },
];

function createUpfrontPaymentTerms(terms = []) {
  return Object.fromEntries(
    UPFRONT_PAYMENT_METHODS.map((method) => {
      const saved = terms.find((term) => term.method === method.id);
      return [method.id, { enabled: Boolean(saved), discount: Number(saved?.discount_percent || 0) }];
    })
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
    case 'check':
      return <svg {...props}><path d="m5 12 4 4L19 6" /></svg>;
    case 'search':
      return <svg {...props}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>;
    case 'user':
      return <svg {...props}><circle cx="12" cy="8" r="3" /><path d="M5 20v-1a7 7 0 0 1 14 0v1" /></svg>;
    case 'pin':
      return <svg {...props}><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.3" /></svg>;
    case 'phone':
      return <svg {...props}><path d="m7 4 3 4-2 2c1 3 3 5 6 6l2-2 4 3v2c-1 3-8 0-12-4S1 4 4 4Z" /></svg>;
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
    default: return null;
  }
}

function createEnvironment(name = '') {
  return {
    name,
    height: '',
    width: '',
    rolls_manual: '',
    removal_included: false,
  };
}

function requestEnvironments(draft) {
  const rooms = draft?.direct_quote_details?.environments;
  if (!Array.isArray(rooms) || !rooms.length) return [createEnvironment(draft?.rooms?.[0])];
  return rooms.map((room) => ({
    ...createEnvironment(room.name),
    height: room.height ?? '',
    width: room.width ?? '',
    rolls_manual: room.rolls ?? '',
    removal_included: room.removal === 'yes',
  }));
}

function requestAddressLabel(draft) {
  const { street, house_number: number } = draft.direct_quote_details || {};
  const line = [street, number && `Nº ${number}`].filter(Boolean).join(', ');
  return [line, draft.neighborhood, draft.city, draft.state, draft.zip_code && `CEP ${draft.zip_code}`, draft.address_reference]
    .filter(Boolean).join(' • ');
}

export default function BudgetForm() {
  const { draftId, budgetId } = useParams();
  if (budgetId) return <ExistingBudgetLoader key={budgetId} budgetId={budgetId} />;
  return draftId ? <BudgetDraftLoader key={draftId} draftId={draftId} /> : <BudgetEditor />;
}

function ExistingBudgetLoader({ budgetId }) {
  const [load, setLoad] = useState({ budget: null, error: '' });
  useEffect(() => {
    const request = new AbortController();
    api.get(`/budgets/${budgetId}`, { signal: request.signal }).then(({ data }) => {
      if (request.signal.aborted) return;
      if (!['pending', 'rejected'].includes(data?.status) || data.source_service_request_id) {
        setLoad({ budget: null, error: 'Só é possível editar orçamentos manuais ainda não aprovados.' });
      } else setLoad({ budget: data, error: '' });
    }).catch((error) => {
      if (!request.signal.aborted) setLoad({ budget: null, error: error.response?.data?.error || 'Não foi possível abrir o orçamento.' });
    });
    return () => request.abort();
  }, [budgetId]);
  if (load.budget) return <BudgetEditor original={load.budget} />;
  return <section className="lux-panel p-6">
    {load.error ? <p role="alert">{load.error}</p> : <p role="status">Carregando orçamento…</p>}
    <Link className="ghost-button mt-4" to="/budgets">Voltar aos orçamentos</Link>
  </section>;
}

function BudgetDraftLoader({ draftId }) {
  const [load, setLoad] = useState({ request: null, error: '' });

  useEffect(() => {
    const controller = new AbortController();
    api.get(`/budgets/${draftId}/draft`, { signal: controller.signal })
      .then(({ data }) => setLoad({ request: data.request, error: '' }))
      .catch((error) => {
        if (!controller.signal.aborted) {
          setLoad({ request: null, error: error.response?.data?.error || 'Não foi possível carregar o rascunho.' });
        }
      });
    return () => controller.abort();
  }, [draftId]);

  if (load.request) return <BudgetEditor draft={load.request} draftId={draftId} />;

  return (
    <section className="lux-panel p-6">
      {load.error ? <p role="alert">{load.error}</p> : <p role="status">Carregando rascunho…</p>}
      <Link className="ghost-button mt-4" to="/budgets">Voltar aos orçamentos</Link>
    </section>
  );
}

function DraftRequestDetails({ draft }) {
  const measurements = draft.direct_quote_details?.environments?.map((room) => {
    const values = [room.width && `${room.width} m de largura`, room.height && `${room.height} m de altura`,
      room.rolls && `${room.rolls} rolo(s)`, room.removal === 'yes' && 'remoção solicitada'].filter(Boolean);
    return values.length ? `${room.name}: ${values.join(', ')}` : null;
  }).filter(Boolean).join(' · ') || [draft.wall_size, draft.roll_count].filter(Boolean).join(' · ');
  return (
    <section aria-label="Dados do pedido original" className="quote-draft-details">
      <strong>Pedido #{draft.id} · {draft.service_label || 'Instalação de papel de parede'}</strong>
      <p>{draft.place_label || 'Local'}: {requestAddressLabel(draft) || 'A confirmar com o cliente'}</p>
      {draft.client_email ? <p>E-mail informado: {draft.client_email}</p> : null}
      <p>Ambientes: {draft.rooms?.join(', ') || 'Não informados'}</p>
      <p>Medidas e rolos: {draft.measurement_detail || measurements || 'Não informados'}</p>
      {draft.material_label ? <p>Material: {draft.material_label}</p> : null}
      {draft.details ? <p>Observação do cliente: {draft.details}</p> : null}
      <p>Confirme as medidas por ambiente e defina os preços e as condições antes de salvar.</p>
    </section>
  );
}

function BudgetEditor({ draft = null, draftId = null, original = null }) {
  const navigate = useNavigate();
  const { isPro, refreshSubscription } = useSubscription();
  const [clients, setClients] = useState([]);
  const [clientStatus, setClientStatus] = useState('loading');
  const [clientQuery, setClientQuery] = useState('');
  const [clientId, setClientId] = useState(() => String(original?.client_id || ''));
  const [clientFormMode, setClientFormMode] = useState(null);
  const newClientTrigger = useRef(null);
  const closeClientForm = () => {
    setClientFormMode(null);
    newClientTrigger.current?.focus({ preventScroll: true });
  };
  const [activeStep, setActiveStep] = useState(1);
  const [choosePricing, setChoosePricing] = useState(false);
  const formRef = useRef(null);
  const headingRef = useRef(null);
  const paymentHeading = useRef(null);
  const clientSearch = useRef(null);
  const nextFocus = useRef(null);
  const goToStep = (step, focus = 'heading') => {
    nextFocus.current = focus;
    setActiveStep(step);
  };
  useEffect(() => {
    if (!nextFocus.current) return;
    const target = nextFocus.current === 'payment' ? paymentHeading.current : headingRef.current;
    nextFocus.current = null;
    target?.focus();
    target?.scrollIntoView?.({ block: 'nearest' });
  }, [activeStep, choosePricing]);
  const [saving, setSaving] = useState(false);
  const [pricingMode, setPricingMode] = useState(() => original?.product_items?.length ? 'products' : original?.pricing_mode || 'roll');
  const [fixedPrice, setFixedPrice] = useState(() => original?.manual_price ?? (original?.pricing_mode === 'fixed' ? original.total_amount : ''));
  const fixed = pricingMode === 'fixed';
  const productMode = pricingMode === 'products';
  const [withoutMeasurements, setWithoutMeasurements] = useState(() => original?.pricing_mode === 'square_meter' && Number(original.manual_price) > 0);
  const [keepLegacyRollTotal, setKeepLegacyRollTotal] = useState(() => original?.pricing_mode === 'roll' && Number(original.manual_price) > 0);
  const legacyRollTotal = pricingMode === 'roll' && keepLegacyRollTotal;
  const manualTotal = legacyRollTotal || (pricingMode === 'square_meter' && withoutMeasurements);
  const noMeasures = fixed || productMode || manualTotal;
  const [rollArea, setRollArea] = useState(original?.roll_area || 4.5);
  const [pricePerRoll, setPricePerRoll] = useState(original?.price_per_roll || 0);
  const [pricePerSquareMeter, setPricePerSquareMeter] = useState(original?.price_per_square_meter || (draft ? '' : 10));
  const [removalPricePerRoll, setRemovalPricePerRoll] = useState(original?.removal_price_per_roll || 0);
  const [removalRollsInput, setRemovalRollsInput] = useState(Number(original?.removal_rolls) || '');
  const [installmentEnabled, setInstallmentEnabled] = useState(Boolean(original?.installment_enabled));
  const [installmentsCount, setInstallmentsCount] = useState(Math.max(2, Number(original?.installments_count || 3)));
  const [interestFreeInstallments, setInterestFreeInstallments] = useState(Number(original?.interest_free_installments || 3));
  const installmentInterestRate = original?.installment_enabled && Number(original.installments_count) === installmentsCount
    && Number(original.interest_free_installments) === interestFreeInstallments ? Number(original.installment_interest_rate || 0) : 0;
  const [upfrontPaymentTerms, setUpfrontPaymentTerms] = useState(() => createUpfrontPaymentTerms(original?.payment_terms ?? []));
  const [environments, setEnvironments] = useState(() => original?.environments?.length
    ? original.environments.map((item) => ({
      ...item,
      height: Number(item.height) === 0 ? '' : item.height,
      width: Number(item.width) === 0 ? '' : item.width,
      rolls_manual: item.rolls_manual ?? '',
    })) : requestEnvironments(draft));
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState('');
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [productItems, setProductItems] = useState(() => original?.product_items || []);

  useEffect(() => {
    if (!productMode) return;
    const controller = new AbortController();
    api.get(productLimits.catalogPath, { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) setCatalog(Array.isArray(data) ? data : []);
    }).catch((error) => {
      if (!controller.signal.aborted) setCatalogError(error.response?.data?.error || 'Não foi possível abrir o catálogo.');
    });
    return () => controller.abort();
  }, [catalogRetry, productMode]);

  function reloadCatalog() {
    setCatalogError('');
    setCatalogRetry((value) => value + 1);
  }

  function addProduct(item) {
    setProductItems((current) => current.length >= productLimits.maximumItems ||
      current.some((entry) => Number(entry.product_id) === Number(item.id)) ? current
      : [...current, { product_id: item.id, name: item.name, unit_price: Number(item.price), quantity: 1 }]);
  }

  useEffect(() => {
    if (draft) return;
    let cancelled = false;
    api.get('/clients')
      .then((response) => {
        if (cancelled) return;
        setClients((current) => {
          const fetched = Array.isArray(response.data) ? response.data : [];
          return [...current, ...fetched.filter((client) => !current.some((item) => Number(item.id) === Number(client.id)))];
        });
        setClientStatus('ready');
      })
      .catch(() => { if (!cancelled) setClientStatus('error'); });

    if (!original) api.get('/users/profile')
      .then((response) => {
        const profileDefaultRollPrice = Number(response.data.default_price_per_roll || 0);
        const profileDefaultRemovalPrice = Number(response.data.default_removal_price || 0);

        if (cancelled) return;
        setPricePerRoll((current) => current === 0 ? profileDefaultRollPrice : current);
        setRemovalPricePerRoll((current) => current === 0 ? profileDefaultRemovalPrice : current);
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [draft, original]);

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
    setEnvironments((current) => {
      const nextRoom = draft?.rooms?.find((room) => !current.some((item) => item.name === room));
      return [...current, createEnvironment(nextRoom)];
    });
  };

  useEffect(() => {
    if (!isPro) {
      setEnvironments((current) => current.slice(0, 1));
    }
  }, [isPro]);

  const removeEnvironment = (index) => {
    setEnvironments((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const removalIncluded = !noMeasures && environments.some((environment) => Boolean(environment.removal_included));
  const manualRemovalRolls = removalIncluded && removalRollsInput !== '' ? Number(removalRollsInput) : null;
  const invalidRemovalRolls = manualRemovalRolls !== null &&
    (!Number.isInteger(manualRemovalRolls) || manualRemovalRolls < 1 || manualRemovalRolls > MAX_REMOVAL_ROLLS);
  const rollYield = Number(rollArea);
  const effectiveRollArea = Number.isFinite(rollYield) && rollYield > 0 ? rollYield : 0;

  const environmentBreakdown = useMemo(
    () =>
      environments.map((environment) => {
        const height = Number(environment.height || 0);
        const width = Number(environment.width || 0);
        const hasDimensions = Number.isFinite(height) && height > 0 && Number.isFinite(width) && width > 0;
        const hasNoDimensions = pricingMode === 'roll'
          && String(environment.height ?? '').trim() === '' && String(environment.width ?? '').trim() === '';
        const area = hasDimensions ? height * width : 0;
        const rollsAuto = effectiveRollArea > 0 ? Math.ceil(area / effectiveRollArea) : 0;
        const rollsManual = environment.rolls_manual ? Number(environment.rolls_manual) : null;
        const validRolls = Number.isInteger(rollsManual) && rollsManual >= 1 && rollsManual <= 2147483647;
        const valid = hasNoDimensions
          ? validRolls
          : hasDimensions && Boolean(String(environment.name || '').trim()) && (pricingMode !== 'roll' || rollsManual === null || validRolls);
        const rollsForMode = pricingMode === 'roll' && validRolls ? rollsManual : rollsAuto;
        const baseSubtotal =
          pricingMode === 'square_meter'
            ? area * Number(pricePerSquareMeter || 0)
            : rollsForMode * Number(pricePerRoll || 0);
        return {
          area,
          baseSubtotal,
          hasDimensions,
          hasNoDimensions,
          removalIncluded: Boolean(environment.removal_included),
          rollsAuto,
          rollsForMode,
          total: baseSubtotal,
          valid,
        };
      }),
    [effectiveRollArea, environments, pricePerRoll, pricePerSquareMeter, pricingMode]
  );

  const totals = useMemo(
    () =>
      (() => {
        if (noMeasures) {
          const total = productMode ? productItems.reduce((sum, item) => sum + Math.round(item.unit_price * 100) * Number(item.quantity), 0) / 100
            : Number(fixedPrice) || 0;
          return { area: 0, rolls: 0, removalRolls: 0, automaticRemovalRolls: 0, subtotal: total, removal: 0, total };
        }
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
        const removalRolls = invalidRemovalRolls ? 0 : (manualRemovalRolls ?? baseTotals.removalRolls);
        const removalRate = manualRemovalRolls === null ? unitRemovalPrice : Math.round(unitRemovalPrice * 100) / 100;
        const removal = removalIncluded && Number.isFinite(unitRemovalPrice) && unitRemovalPrice >= 0
          ? removalRolls * removalRate
          : 0;

        return {
          ...baseTotals,
          automaticRemovalRolls: baseTotals.removalRolls,
          removalRolls,
          removal,
          total: baseTotals.subtotal + removal,
        };
      })(),
    [environmentBreakdown, noMeasures, fixedPrice, productMode, productItems, invalidRemovalRolls, manualRemovalRolls, removalIncluded, removalPricePerRoll]
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
  const selectedClient = draft
    ? { name: draft.client_name, phone: draft.client_phone, email: draft.client_email }
    : clients.find((client) => Number(client.id) === Number(clientId));
  const selectedClientAddress = (draft
    ? requestAddressLabel(draft)
    : [
    [
      selectedClient?.street,
      selectedClient?.house_number && `Nº ${selectedClient.house_number}`,
    ].filter(Boolean).join(', '),
    [selectedClient?.neighborhood, [selectedClient?.city, selectedClient?.state].filter(Boolean).join(' - ')].filter(Boolean).join(', '),
    selectedClient?.zip_code && `CEP ${selectedClient.zip_code}`,
    ].filter(Boolean).join(' • ')) || selectedClient?.address || 'Endereço não informado';
  const hasClient = Boolean(draft || Number(clientId) > 0);
  const fixedPriceIsValid = Number.isFinite(grandTotal) && grandTotal > 0 && grandTotal <= 99_999_999.99 &&
    Math.round(grandTotal * 100) / 100 === grandTotal;
  const validProducts = productItems.length > 0 && productItems.every((item) => Number.isInteger(Number(item.quantity))
    && Number(item.quantity) >= 1 && Number(item.quantity) <= productLimits.maximumQuantity);
  const needsRollYield = !noMeasures && (pricingMode !== 'roll' || environmentBreakdown.some((room) => !room.hasNoDimensions));
  const canCalculate = noMeasures ? fixedPriceIsValid && (!productMode || validProducts)
    : environmentBreakdown.length > 0 && environmentBreakdown.every((room) => room.valid);
  const canSave = canCalculate && grandTotal > 0 && hasClient;

  const visibleClients = clients.filter((client) => matchesClient(client, clientQuery));

  const continueFromClient = () => {
    if (!hasClient) {
      toast.error('Escolha o cliente antes de montar o orçamento.');
      return;
    }
    setChoosePricing(true);
    goToStep(2);
  };

  const continueFromCalculation = () => {
    if (invalidRemovalRolls) {
      toast.error(REMOVAL_ROLLS_ERROR);
      return;
    }
    if (formRef.current && !formRef.current.reportValidity()) return;
    if (!canCalculate || grandTotal <= 0) {
      toast.error(productMode ? 'Adicione produtos e confira as quantidades.'
        : noMeasures ? 'Informe um valor positivo com até duas casas decimais.'
          : pricingMode === 'roll' ? 'Preencha largura e altura ou informe a quantidade de rolos.' : 'Confira as medidas dos ambientes.');
      return;
    }
    goToStep(3);
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
    setClientQuery('');
    setChoosePricing(true);
    goToStep(2);
    refreshSubscription().catch(() => null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving || activeStep !== 4) return;

    const normalizedClientId = Number(clientId);
    const normalizedPricePerRoll = Number(pricePerRoll);
    const normalizedPricePerSquareMeter = Number(pricePerSquareMeter);
    const normalizedRollArea = !needsRollYield && rollArea === '' ? 4.5 : Number(rollArea);
    const normalizedRemovalPricePerRoll = Number(removalPricePerRoll);
    const normalizedInstallmentsCount = Number(installmentsCount);
    const normalizedInterestFreeCount = Number(interestFreeInstallments);
    const normalizedInterestRate = Number(installmentInterestRate);

    if (!draft && (!Number.isInteger(normalizedClientId) || normalizedClientId <= 0)) {
      toast.error('Selecione um cliente válido.');
      return;
    }

    if (noMeasures && !canCalculate) {
      toast.error('Informe um valor positivo com até duas casas decimais.');
      return;
    }

    if (!noMeasures && pricingMode === 'roll' && (!Number.isFinite(normalizedPricePerRoll) || normalizedPricePerRoll <= 0)) {
      toast.error('Informe um preço por rolo maior que zero.');
      return;
    }

    if (!noMeasures && (!Number.isFinite(normalizedRollArea) || normalizedRollArea <= 0 || normalizedRollArea > 1000)) {
      toast.error('Informe um rendimento de rolo válido.');
      return;
    }

    if (
      !noMeasures && pricingMode === 'square_meter' &&
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

    if (invalidRemovalRolls) {
      toast.error(REMOVAL_ROLLS_ERROR);
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

    if (!noMeasures && !canCalculate) {
      toast.error('Revise nome, medidas e rolos dos ambientes.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...(draft ? {} : { client_id: normalizedClientId }),
        pricing_mode: productMode ? 'fixed' : pricingMode,
        ...(productMode ? { product_items: productItems.map(({ product_id, quantity }) => ({ product_id, quantity: Number(quantity) })) }
          : fixed ? { fixed_price: grandTotal } : manualTotal ? { manual_price: grandTotal } : {
          roll_area: normalizedRollArea,
          price_per_roll: normalizedPricePerRoll,
          price_per_square_meter: normalizedPricePerSquareMeter,
        }),
        installment_enabled: installmentEnabled,
        installments_count: installmentEnabled ? normalizedInstallmentsCount : 1,
        interest_free_installments: installmentEnabled ? normalizedInterestFreeCount : 1,
        installment_interest_rate: installmentEnabled ? normalizedInterestRate : 0,
        upfront_payment_terms: selectedUpfrontPaymentTerms,
        removal_included: removalIncluded,
        removal_price_per_roll: removalIncluded ? normalizedRemovalPricePerRoll : 0,
        ...(manualRemovalRolls !== null ? { removal_rolls: manualRemovalRolls } : {}),
        environments: noMeasures ? [] : environments.map((environment, index) => ({
          name: environment.name,
          height: environmentBreakdown[index].hasNoDimensions ? null : Number(environment.height),
          width: environmentBreakdown[index].hasNoDimensions ? null : Number(environment.width),
          rolls_manual: pricingMode === 'roll' && environment.rolls_manual ? Number(environment.rolls_manual) : null,
          removal_included: Boolean(environment.removal_included),
        })),
      };
      if (draft) await api.put(`/budgets/${draftId}/draft`, payload);
      else if (original) await api.put(`/budgets/${original.id}`, { ...payload, version: original.updated_at });
      else await api.post('/budgets', payload);

      Promise.resolve(refreshSubscription()).catch(() => null);
      notifyPanelBadgeCountsChanged();
      toast.success(draft ? 'Orçamento concluído. Nenhuma mensagem foi enviada.' : original ? 'Orçamento atualizado.' : 'Orçamento criado.');
      navigate('/budgets');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível salvar o orçamento.');
    } finally {
      setSaving(false);
    }
  };

  const paymentText = [
    selectedUpfrontPaymentTerms.length ? upfrontPaymentSummary : null,
    installmentPreview.enabled
      ? `${installmentPreview.count}x de ${formatCurrency(installmentPreview.installmentValue)}${installmentPreview.interestFreeCount === installmentPreview.count ? ' sem juros' : ' (valor base)'}`
      : null,
  ].filter(Boolean).join(' ou ') || 'Não informado';
  const title = [
    draft ? 'Confira o cliente e o pedido' : 'Escolha o cliente',
    choosePricing ? 'Como você quer montar o orçamento?' : 'Calcule o orçamento',
    'Revise o orçamento',
    'Confirme e salve',
  ][activeStep - 1];
  const hasContactPhone = Boolean(selectedClient?.whatsapp || selectedClient?.phone);

  const payMethod = (method) => {
    const options = upfrontPaymentTerms[method.id];
    return (
      <div className="quote-pay-method" key={method.id}>
        <label className="quote-check">
          <input checked={options.enabled} onChange={(event) => updateUpfrontPaymentTerm(method.id, 'enabled', event.target.checked)} type="checkbox" />
          <span>{method.label}</span>
        </label>
        {options.enabled && (
          <label className="quote-field">
            <span>Desconto no {method.label} (%)</span>
            <input inputMode="decimal" max="100" min="0" onChange={(event) => updateUpfrontPaymentTerm(method.id, 'discount', event.target.value)} step="0.01" type="number" value={options.discount} />
          </label>
        )}
      </div>
    );
  };

  function renderFinancial() {
    const live = activeStep === 2;
    const name = live ? 'Resumo do cálculo' : 'Resumo financeiro';
    return (
      <section aria-labelledby="quote-financial-heading" className="quote-card quote-financial">
        <h2 id="quote-financial-heading">{name}</h2>
        <dl>
          <div><dt>{productMode ? 'Produtos' : live || noMeasures ? 'Instalação' : pricingMode === 'roll' ? `Instalação (${totals.rolls} ${totals.rolls === 1 ? 'rolo' : 'rolos'})` : `Instalação (${MEASURE.format(totals.area)} m²)`}</dt><dd>{formatCurrency(totals.subtotal)}</dd></div>
          {!noMeasures && <div><dt>{live ? 'Remoção' : `Remoção (${totals.removalRolls} ${totals.removalRolls === 1 ? 'rolo' : 'rolos'})`}</dt><dd>{formatCurrency(totals.removal)}</dd></div>}
        </dl>
        <div className="quote-total">
          <span>{live ? 'Total estimado' : 'Total do orçamento'}</span>
          <output>{formatCurrency(grandTotal)}</output>
        </div>
      </section>
    );
  }

  return (
    <section className="quote-wizard">
      <form className="quote-wizard-form" onSubmit={handleSubmit} ref={formRef}>
        <header className="quote-topbar">
          <Link aria-label="InstalarPro: voltar aos orçamentos" className="quote-wordmark" to="/budgets">Instalar<span>Pro</span></Link>
          <span className="quote-topbar-title">{draft ? 'Completar orçamento' : original ? `Editar orçamento #${original.id}` : 'Novo orçamento'}</span>
        </header>

        <main className="quote-workspace" data-step={activeStep}>
          <ol aria-label="Etapas do orçamento" className="quote-steps">
            {STEP_LABELS.map((label, index) => {
              const number = index + 1;
              return (
                <li aria-current={activeStep === number ? 'step' : undefined} className="quote-step" data-state={activeStep === number ? 'active' : activeStep > number ? 'done' : 'idle'} key={label}>
                  <span aria-hidden="true" className="quote-step-dot">{activeStep > number ? <BudgetIcon type="check" /> : number}</span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ol>
          <PlanUsage className="quote-plan-usage" compact usageKey="monthly_budgets" />

          {activeStep !== 4 && (
            <div className="quote-heading">
              <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
              {activeStep === 1 && <p>{draft ? 'Confira os dados antes de calcular o orçamento.' : 'Selecione quem vai receber o orçamento.'}</p>}
              {activeStep === 3 && <p>Confira os dados e os valores antes de salvar.</p>}
            </div>
          )}

          {activeStep === 1 && (draft ? (
            <section className="quote-card quote-draft">
              <h2>{selectedClient.name}</h2>
              {[selectedClient.phone, selectedClient.email].filter(Boolean).length > 0 && <p>{[selectedClient.phone, selectedClient.email].filter(Boolean).join(' · ')}</p>}
              <DraftRequestDetails draft={draft} />
            </section>
          ) : (
            <section className="quote-card quote-client-picker">
              <div aria-label="Seleção de cliente" className="quote-client-tabs" role="group">
                <button aria-pressed="true" onClick={() => clientSearch.current?.focus()} type="button">Cliente existente</button>
                <button aria-haspopup="dialog" onClick={() => setClientFormMode('choice')} ref={newClientTrigger} type="button">Novo cliente</button>
              </div>
              <label className="quote-field">
                <span>Buscar cliente</span>
                <span className="quote-search"><BudgetIcon type="search" /><input onChange={(event) => setClientQuery(event.target.value)} placeholder="Nome, telefone ou e-mail" ref={clientSearch} type="search" value={clientQuery} /></span>
              </label>
              {visibleClients.length ? (
                <div aria-label="Clientes cadastrados" className="quote-client-list" role="radiogroup">
                  {visibleClients.map((client) => {
                    const initials = String(client.name || '').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
                    const isCurrent = String(client.id) === clientId;
                    return (
                      <label className="quote-client-row" data-selected={isCurrent} key={client.id}>
                        <span aria-hidden="true" className="quote-client-avatar">{initials}</span>
                        <span className="quote-client-name">{client.name}</span>
                        <input checked={isCurrent} name="budget-client" onChange={() => setClientId(String(client.id))} type="radio" value={client.id} />
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="quote-empty" role="status">{clientStatus === 'loading' ? 'Carregando clientes…' : clientStatus === 'error' ? 'Não foi possível carregar os clientes. Atualize a página ou cadastre um novo cliente.' : clientQuery.trim() ? 'Nenhum cliente encontrado com essa busca.' : 'Nenhum cliente cadastrado. Use “Novo cliente” para começar.'}</p>
              )}
              <p className="quote-help">{selectedClient && !visibleClients.some((client) => String(client.id) === clientId) ? `Cliente selecionado: ${selectedClient.name}` : 'Só o nome é necessário para começar.'}</p>
            </section>
          ))}

          {activeStep === 2 && choosePricing && (
            <section className="quote-card quote-client-picker quote-pricing-picker" aria-label="Tipo de cobrança">
              {[
                ['products', 'Produtos', 'Use produtos e preços do seu catálogo.'],
                ['roll', 'Por rolo', 'Use as medidas ou informe quantos rolos são.'],
                ['square_meter', 'Por m²', 'Calcule por metragem ou informe só o total.'],
                ...(original?.pricing_mode === 'fixed' && !original.product_items?.length
                  ? [['fixed', 'Manter valor original', 'Continue editando o orçamento antigo sem medidas.']] : []),
              ].map(([mode, label, description]) => (
                <button key={mode} className="quote-pricing-choice" type="button" onClick={() => {
                  nextFocus.current = 'heading';
                  setPricingMode(mode);
                  setChoosePricing(false);
                }}>
                  <strong>{label}</strong><span>{description}</span>
                </button>
              ))}
            </section>
          )}

          {activeStep === 2 && !choosePricing && (
            <>
              {draft && <div className="quote-card quote-draft"><DraftRequestDetails draft={draft} /></div>}
              <div className="quote-columns">
                <div className="quote-card quote-sheet">
                  <section className="quote-group">
                    <div className="quote-group-head">
                      <h2>{productMode ? 'Produtos' : pricingMode === 'roll' ? 'Por rolo' : pricingMode === 'square_meter' ? 'Por m²' : 'Valor original'}</h2>
                      <button className="quote-action-link" type="button" onClick={() => {
                        nextFocus.current = 'heading';
                        setChoosePricing(true);
                      }}>Trocar tipo</button>
                    </div>
                    {pricingMode === 'square_meter' && <label className="quote-check"><input type="checkbox" checked={withoutMeasurements}
                      onChange={(event) => setWithoutMeasurements(event.target.checked)} />Informar total sem medidas</label>}
                    {legacyRollTotal && <button className="quote-action-link" type="button" onClick={() => setKeepLegacyRollTotal(false)}>Usar preço por rolo</button>}
                    {productMode ? <div className="quote-product-lines">
                      {catalogError ? <><p role="alert">{catalogError}</p><button className="quote-action-link" type="button" onClick={reloadCatalog}>Tentar novamente</button></> : catalog == null ? <p role="status">Carregando produtos…</p> : (
                        <QuoteProductCatalog products={catalog} selected={productItems} onAdd={addProduct} onReload={reloadCatalog} />
                      )}
                      {productItems.length > 0 && <section className="quote-catalog-selection" aria-label="Itens adicionados ao orçamento">
                        <h3>Itens do orçamento ({productItems.length})</h3>
                        {productItems.map((item) => (
                        <div key={item.product_id} className="quote-product-line">
                          <div><strong>{item.name}</strong><p>{formatCurrency(item.unit_price)} por unidade</p></div>
                          <label className="quote-field"><span>Quantidade de {item.name}</span><input type="number" inputMode="numeric" min="1" max={productLimits.maximumQuantity} step="1" required value={item.quantity}
                            onChange={(event) => {
                              const quantity = event.target.value;
                              setProductItems((items) => items.map((line) => line.product_id === item.product_id ? { ...line, quantity } : line));
                            }} /></label>
                          <button aria-label={`Remover ${item.name}`} className="quote-action-link" type="button"
                            onClick={() => setProductItems((items) => items.filter((line) => line.product_id !== item.product_id))}>Remover</button>
                        </div>
                        ))}
                      </section>}
                    </div> : <>
                    <div className="quote-material" data-mode={pricingMode}>
                      {noMeasures ? <label className="quote-field">
                        <span>Valor do serviço</span>
                        <span className="quote-affix" data-side="before"><span aria-hidden="true">R$</span><input aria-label="Valor do serviço" aria-describedby="quote-fixed-help" inputMode="decimal" max="99999999.99" min="0.01" onChange={(event) => setFixedPrice(event.target.value)} placeholder="0,00" required step="0.01" type="number" value={fixedPrice} /></span>
                      </label> : <>
                      <label className="quote-field">
                        <span>{pricingMode === 'roll' ? 'Preço por rolo' : 'Preço por m²'}</span>
                        <span className="quote-affix" data-side="before"><span aria-hidden="true">R$</span><input inputMode="decimal" min="0.01" onChange={(event) => (pricingMode === 'roll' ? setPricePerRoll : setPricePerSquareMeter)(event.target.value)} placeholder="0,00" required step="0.01" type="number" value={pricingMode === 'roll' ? pricePerRoll : pricePerSquareMeter} /></span>
                      </label>
                      <label className="quote-field">
                        <span>Rendimento do rolo</span>
                        <span className="quote-affix"><input inputMode="decimal" max="1000" min="0.01" onChange={(event) => setRollArea(event.target.value)} required={needsRollYield} step="0.01" type="number" value={rollArea} /><span aria-hidden="true">m²</span></span>
                      </label>
                      </>}
                    </div>
                    {noMeasures && <p className="quote-help" id="quote-fixed-help">Informe o total combinado com o cliente. As medidas não serão exigidas.</p>}
                    </>}
                  </section>

                  {!noMeasures && <section className="quote-group">
                    <div className="quote-group-head">
                      <h2>Ambientes</h2>
                      <button className="quote-action-link" onClick={addEnvironment} type="button"><BudgetIcon type="add" />{isPro ? 'Adicionar ambiente' : 'Adicionar ambiente (Pro)'}</button>
                    </div>
                    {pricingMode === 'roll' && <p className="quote-help" id="quote-rolls-help">Preencha largura e altura para calcular os rolos. Se deixar as duas medidas em branco, informe a quantidade de rolos.</p>}
                    {environments.map((environment, index) => {
                      const details = environmentBreakdown[index];
                      return (
                        <fieldset className="quote-room" key={index}>
                          <legend className={environments.length > 1 ? 'quote-room-title' : 'quote-sr-only'}>Ambiente {index + 1}</legend>
                          {environments.length > 1 && <button aria-label={`Remover ambiente ${index + 1}`} className="quote-room-delete" onClick={() => removeEnvironment(index)} type="button"><BudgetIcon type="trash" /></button>}
                          <div className="quote-room-fields" data-mode={pricingMode}>
                            <label className="quote-field quote-room-name"><span>Ambiente</span><input onChange={(event) => updateEnvironment(index, 'name', event.target.value)} placeholder="Ex.: Sala" required={!details.hasNoDimensions} value={environment.name} /></label>
                            <label className="quote-field"><span>Largura (m)</span><input inputMode="decimal" min="0.01" onChange={(event) => updateEnvironment(index, 'width', event.target.value)} placeholder="0,00" required={!details.hasNoDimensions} step="0.01" type="number" value={environment.width} /></label>
                            <label className="quote-field"><span>Altura (m)</span><input inputMode="decimal" min="0.01" onChange={(event) => updateEnvironment(index, 'height', event.target.value)} placeholder="0,00" required={!details.hasNoDimensions} step="0.01" type="number" value={environment.height} /></label>
                            <div className="quote-field quote-room-area"><span>Área</span><span>{details.hasDimensions ? `${MEASURE.format(details.area)} m²` : '—'}</span></div>
                            {pricingMode === 'roll' && <label className="quote-field">
                              <span>Rolos{!details.hasDimensions && <span aria-hidden="true"> *</span>}</span>
                              <input aria-describedby="quote-rolls-help" aria-label={details.hasDimensions ? 'Rolos (opcional)' : 'Rolos'}
                                inputMode="numeric" max="2147483647" min="1" onChange={(event) => updateEnvironment(index, 'rolls_manual', event.target.value)}
                                placeholder={details.rollsAuto ? String(details.rollsAuto) : 'Ex.: 3'} required={!details.hasDimensions} step="1" type="number" value={environment.rolls_manual} />
                            </label>}
                          </div>
                          <label className="quote-check"><input checked={Boolean(environment.removal_included)} onChange={(event) => updateEnvironment(index, 'removal_included', event.target.checked)} type="checkbox" />Remover papel</label>
                        </fieldset>
                      );
                    })}
                    <div className="quote-removal" hidden={!removalIncluded}>
                      <div className="quote-removal-fields">
                        <label className="quote-field">
                          <span>Rolos a remover</span>
                          <input aria-describedby="quote-removal-help" aria-invalid={invalidRemovalRolls || undefined} disabled={!removalIncluded} inputMode="numeric" max={MAX_REMOVAL_ROLLS} min="1" onChange={(event) => setRemovalRollsInput(event.target.value)} placeholder={String(totals.automaticRemovalRolls || '')} step="1" type="number" value={removalRollsInput} />
                        </label>
                        <label className="quote-field">
                          <span>Valor por rolo</span>
                          <span className="quote-affix" data-side="before"><span aria-hidden="true">R$</span><input disabled={!removalIncluded} inputMode="decimal" min="0" onChange={(event) => setRemovalPricePerRoll(event.target.value)} placeholder="0,00" step="0.01" type="number" value={removalPricePerRoll} /></span>
                        </label>
                      </div>
                      <p className="quote-help" id="quote-removal-help">{invalidRemovalRolls ? REMOVAL_ROLLS_ERROR : `${totals.removalRolls} ${totals.removalRolls === 1 ? 'rolo' : 'rolos'} • ${formatCurrency(totals.removal)}. Deixe a quantidade em branco para usar o cálculo automático.`}</p>
                    </div>
                  </section>}

                  <section className="quote-group quote-payment">
                    <h2 ref={paymentHeading} tabIndex={-1}>Pagamento</h2>
                    <div className="quote-payment-top">
                      <label className="quote-check"><input checked={upfrontPaymentTerms.pix.enabled} onChange={(event) => updateUpfrontPaymentTerm('pix', 'enabled', event.target.checked)} type="checkbox" />Pix</label>
                      <label className="quote-check"><input checked={installmentEnabled} onChange={(event) => setInstallmentEnabled(event.target.checked)} type="checkbox" />Aceitar parcelamento</label>
                      {installmentEnabled && <label className="quote-field"><span className="quote-sr-only">Máximo de parcelas</span><select onChange={(event) => {
                        const count = Number(event.target.value);
                        setInstallmentsCount(count);
                        setInterestFreeInstallments((current) => current === installmentsCount ? count : Math.min(current, count));
                      }} value={installmentsCount}>{INSTALLMENT_OPTIONS.map((option) => <option key={option} value={option}>{option}x{option === installmentsCount && normalizedInterestFreeInstallments === option ? ' sem juros' : ''}</option>)}</select></label>}
                    </div>
                    <details className="quote-payment-detail" onInvalidCapture={(event) => { event.currentTarget.open = true; }}>
                      <summary>Mais opções de pagamento</summary>
                      <div className="quote-pay-options">
                        {upfrontPaymentTerms.pix.enabled && <label className="quote-field"><span>Desconto no Pix (%)</span><input aria-label="Desconto no Pix" inputMode="decimal" max="100" min="0" onChange={(event) => updateUpfrontPaymentTerm('pix', 'discount', event.target.value)} step="0.01" type="number" value={upfrontPaymentTerms.pix.discount} /></label>}
                        {UPFRONT_PAYMENT_METHODS.filter((method) => method.id !== 'pix').map(payMethod)}
                      </div>
                      {installmentEnabled && (
                        <div className="quote-removal-fields">
                          <label className="quote-field"><span>Sem juros até</span><select onChange={(event) => setInterestFreeInstallments(Number(event.target.value))} value={normalizedInterestFreeInstallments}>{INTEREST_FREE_INSTALLMENT_OPTIONS.filter((option) => option <= installmentsCount).map((option) => <option key={option} value={option}>{option}x</option>)}</select></label>
                        </div>
                      )}
                      {installmentEnabled && <p className="quote-help">{installmentConditionsLabel(installmentPreview)}</p>}
                      {upfrontPaymentTerms.pix.enabled && pixDiscountPercent > 0 && <p className="quote-help">Pix: {formatCurrency(pixPreviewValue)} com {pixDiscountPercent}% de desconto.</p>}
                    </details>
                  </section>
                </div>
                {renderFinancial()}
              </div>
            </>
          )}

          {activeStep === 3 && (
            <div className="quote-columns quote-review">
              <div className="quote-card quote-sheet">
                <section className="quote-group">
                  <div className="quote-group-head"><h2>Cliente e local</h2><button className="quote-action-link" onClick={() => goToStep(1)} type="button">{draft ? 'Ver cliente' : 'Editar cliente'}</button></div>
                  <div className="quote-review-contact">
                    <p><BudgetIcon type="user" /><strong>{selectedClient?.name || 'Não informado'}</strong></p>
                    <p><BudgetIcon type="pin" />{selectedClientAddress}</p>
                    <p><BudgetIcon type="phone" />{selectedClient?.phone || selectedClient?.whatsapp || selectedClient?.email || 'Telefone não informado'}</p>
                  </div>
                </section>
                <section className="quote-group">
                  <div className="quote-group-head"><h2>{productMode ? 'Produtos' : noMeasures ? 'Valor do serviço' : 'Ambientes'}</h2><button className="quote-action-link" onClick={() => goToStep(2)} type="button">Editar cálculo</button></div>
                  {productMode ? <ul className="quote-product-review">{productItems.map((item) => <li key={item.product_id}>{item.quantity} × {item.name}: {formatCurrency(Number(item.quantity) * Number(item.unit_price))}</li>)}</ul>
                    : noMeasures ? <p>Medidas não informadas.</p> : (
                  <div className="quote-review-rooms">
                    {environments.map((environment, index) => {
                      const details = environmentBreakdown[index];
                      return (
                        <div key={index}>
                          <strong>{environment.name || `Ambiente ${index + 1}`}</strong>
                          <p>{details.hasDimensions
                            ? `${MEASURE.format(Number(environment.width))} m × ${MEASURE.format(Number(environment.height))} m · ${MEASURE.format(details.area)} m²`
                            : `Medidas não informadas · ${details.rollsForMode} ${details.rollsForMode === 1 ? 'rolo' : 'rolos'}`}</p>
                        </div>
                      );
                    })}
                  </div>
                  )}
                </section>
                <section className="quote-group">
                  <div className="quote-group-head"><h2>Pagamento</h2><button className="quote-action-link" onClick={() => goToStep(2, 'payment')} type="button">Editar pagamento</button></div>
                  <p>{paymentText}</p>
                  {installmentEnabled && installmentPreview.interestFreeCount < installmentPreview.count && <p className="quote-help">{installmentConditionsLabel(installmentPreview)}</p>}
                  {selectedUpfrontPaymentTerms.some((term) => term.discount_percent > 0) && <ul className="quote-discounts">{selectedUpfrontPaymentTerms.filter((term) => term.discount_percent > 0).map((term) => <li key={term.method}>{term.label}: {formatCurrency(grandTotal * (1 - term.discount_percent / 100))} ({term.discount_percent}% de desconto)</li>)}</ul>}
                </section>
              </div>
              {renderFinancial()}
            </div>
          )}

          {activeStep === 4 && (
            <section className="quote-card quote-confirmation">
              <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
              <dl className="quote-confirm-rows">
                <div><dt>Cliente</dt><dd>{selectedClient?.name}</dd></div>
                <div><dt>Total do orçamento</dt><dd>{formatCurrency(grandTotal)}</dd></div>
                <div><dt>Pagamento</dt><dd>{paymentText}</dd></div>
              </dl>
              <p className="quote-info"><BudgetIcon type="info" />O orçamento será salvo como pendente. O PDF ficará disponível em Orçamentos.</p>
              {!hasContactPhone && <p className="quote-confirm-help">Para enviar pelo WhatsApp, adicione o telefone do cliente.</p>}
              <div className="quote-footer quote-footer--inside">
                <button className="quote-button" onClick={() => goToStep(3)} type="button">Voltar ao resumo</button>
                <button className="quote-button quote-button--primary" disabled={!canSave || saving} type="submit">{saving ? 'Salvando…' : 'Salvar orçamento'}</button>
              </div>
            </section>
          )}
        </main>

        {activeStep !== 4 && (
          <footer className="quote-footer">
            {activeStep === 1 ? <Link aria-label="Voltar aos orçamentos" className="quote-button" to="/budgets">Voltar</Link> : (
              <button className="quote-action-link" onClick={() => goToStep(activeStep - 1)} type="button">{activeStep === 2 ? 'Voltar ao cliente' : 'Voltar ao cálculo'}</button>
            )}
            {activeStep === 1 && <button className="quote-button quote-button--primary" onClick={continueFromClient} type="button">Continuar para o cálculo</button>}
            {activeStep === 2 && !choosePricing && <button className="quote-button quote-button--primary" onClick={continueFromCalculation} type="button">Revisar orçamento</button>}
            {activeStep === 3 && <button className="quote-button quote-button--primary" disabled={!canSave} onClick={() => goToStep(4)} type="button">Continuar para salvar</button>}
          </footer>
        )}
      </form>
      {clientFormMode === 'choice' && <BudgetClientChoice onClose={closeClientForm} onSelect={setClientFormMode} />}
      {(clientFormMode === 'quick' || clientFormMode === 'full') && (
        <ClientForm allowIncomplete onClose={closeClientForm} onSaved={handleClientCreated} quickCreate={clientFormMode === 'quick'} />
      )}
    </section>
  );
}
