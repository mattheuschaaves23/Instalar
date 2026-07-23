const crypto = require('crypto');

const PRODUCTION_API_URL = 'https://api.asaas.com/v3';
const SANDBOX_API_URL = 'https://api-sandbox.asaas.com/v3';
const DEFAULT_TIMEOUT_MS = 12000;

function firstEnvValue(...names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
  }
  return '';
}

function getAsaasConfig() {
  const configuredEnvironment = firstEnvValue('ASAAS_ENVIRONMENT').toLowerCase();
  const environment = configuredEnvironment || (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox');

  return {
    accessToken: firstEnvValue('ASAAS_API_KEY', 'ASAAS_ACCESS_TOKEN'),
    webhookToken: firstEnvValue('ASAAS_WEBHOOK_TOKEN'),
    environment,
    apiBaseUrl: environment === 'production' ? PRODUCTION_API_URL : SANDBOX_API_URL,
    userAgent: firstEnvValue('ASAAS_USER_AGENT') || `InstalaPro/1.0 (Node.js; ${environment})`,
  };
}

function isAsaasConfigured() {
  return Boolean(getAsaasConfig().accessToken) && isAsaasWebhookConfigured();
}

function isAsaasWebhookConfigured() {
  const tokenLength = getAsaasConfig().webhookToken.length;
  return tokenLength >= 32 && tokenLength <= 255;
}

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizePaymentStatus(status, billingType = '') {
  const value = String(status || '').trim().toUpperCase();
  const normalizedBillingType = String(billingType || '').trim().toUpperCase();

  if (['RECEIVED', 'RECEIVED_IN_CASH'].includes(value)) return 'paid';
  if (value === 'CONFIRMED' && normalizedBillingType === 'CREDIT_CARD') return 'paid';
  if (
    [
      'PENDING',
      'CONFIRMED',
      'OVERDUE',
      'AWAITING_RISK_ANALYSIS',
      'AUTHORIZED',
    ].includes(value)
  ) {
    return 'pending';
  }
  if (
    [
      'REFUNDED',
      'PARTIALLY_REFUNDED',
      'REFUND_REQUESTED',
      'REFUND_IN_PROGRESS',
      'CHARGEBACK_REQUESTED',
      'CHARGEBACK_DISPUTE',
      'AWAITING_CHARGEBACK_REVERSAL',
    ].includes(value)
  ) {
    return 'refunded';
  }
  if (['DELETED', 'CANCELED', 'CANCELLED'].includes(value)) return 'canceled';
  if (['CREDIT_CARD_CAPTURE_REFUSED', 'REPROVED_BY_RISK_ANALYSIS'].includes(value)) return 'failed';
  return 'pending';
}

function normalizeQrImage(value) {
  const image = String(value || '').trim();
  if (!image) return '';
  return image.startsWith('data:image/') ? image : `data:image/png;base64,${image}`;
}

function parsePixPayment(payment, pixQrCode = {}) {
  return {
    provider: 'asaas',
    providerPaymentId: String(payment?.id || ''),
    externalId: String(payment?.externalReference || ''),
    customerId: String(payment?.customer || ''),
    subscriptionId: String(payment?.subscription || ''),
    checkoutId: String(payment?.checkoutSession || ''),
    billingType: String(payment?.billingType || ''),
    status: normalizePaymentStatus(payment?.status, payment?.billingType),
    providerStatus: String(payment?.status || ''),
    statusDetail: String(payment?.billingType || ''),
    amount: Number(payment?.value || 0),
    currency: 'BRL',
    qrCodeImage: normalizeQrImage(pixQrCode?.encodedImage),
    copyPaste: String(pixQrCode?.payload || ''),
    ticketUrl: String(payment?.invoiceUrl || ''),
    expirationDate: pixQrCode?.expirationDate || payment?.dueDate || null,
    raw: payment || {},
  };
}

function normalizeCheckoutStatus(status) {
  const value = String(status || '').trim().toUpperCase();
  if (value === 'PAID') return 'paid';
  if (value === 'EXPIRED') return 'failed';
  if (['CANCELED', 'CANCELLED'].includes(value)) return 'canceled';
  return 'pending';
}

function parseRecurringCheckout(checkout, fallback = {}) {
  const items = Array.isArray(checkout?.items) ? checkout.items : [];
  const itemTotal = items.reduce(
    (total, item) => total + (Number(item?.value || 0) * Number(item?.quantity || 0)),
    0
  );
  const billingTypes = Array.isArray(checkout?.billingTypes) ? checkout.billingTypes : [];

  return {
    provider: 'asaas_checkout',
    providerPaymentId: String(checkout?.id || ''),
    externalId: String(checkout?.externalReference || fallback.externalId || ''),
    customerId: String(checkout?.customer || fallback.customerId || ''),
    subscriptionId: String(checkout?.subscription?.id || ''),
    checkoutId: String(checkout?.id || ''),
    billingType: billingTypes.join(','),
    status: normalizeCheckoutStatus(checkout?.status),
    providerStatus: String(checkout?.status || ''),
    statusDetail: billingTypes.join(','),
    amount: Number(itemTotal || fallback.amount || 0),
    currency: 'BRL',
    qrCodeImage: '',
    copyPaste: '',
    ticketUrl: String(checkout?.link || fallback.ticketUrl || ''),
    expirationDate: null,
    raw: checkout || {},
  };
}

function buildProviderError(payload, status) {
  const providerMessage = Array.isArray(payload?.errors)
    ? payload.errors.map((item) => item?.description).filter(Boolean).join(' ')
    : '';
  const error = new Error(providerMessage || 'A Asaas recusou a operação.');
  error.code = 'ASAAS_API_ERROR';
  error.status = status;
  error.providerResponse = payload;
  return error;
}

async function asaasRequest(
  path,
  {
    method = 'GET',
    body,
    fetchImpl = globalThis.fetch,
    accessToken = getAsaasConfig().accessToken,
    apiBaseUrl = getAsaasConfig().apiBaseUrl,
  } = {}
) {
  if (!accessToken) {
    const error = new Error('Credencial da Asaas não configurada.');
    error.code = 'ASAAS_NOT_CONFIGURED';
    throw error;
  }

  if (typeof fetchImpl !== 'function') {
    const error = new Error('Cliente HTTP indisponível.');
    error.code = 'PAYMENT_HTTP_UNAVAILABLE';
    throw error;
  }

  const options = {
    method,
    headers: {
      Accept: 'application/json',
      'User-Agent': getAsaasConfig().userAgent,
      access_token: accessToken,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetchImpl(`${String(apiBaseUrl).replace(/\/+$/, '')}${path}`, options);
  } catch (cause) {
    const isTimeout = cause?.name === 'AbortError' || cause?.name === 'TimeoutError';
    const error = new Error(
      isTimeout
        ? 'A Asaas demorou para responder.'
        : 'Não foi possível conectar à Asaas.'
    );
    error.code = isTimeout ? 'ASAAS_TIMEOUT' : 'ASAAS_NETWORK_ERROR';
    error.cause = cause;
    throw error;
  }
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw buildProviderError(payload, response.status);
  }

  return payload;
}

async function getPixQrCode(providerPaymentId, options = {}) {
  const id = encodeURIComponent(String(providerPaymentId || '').trim());
  if (!id) return {};

  try {
    return await asaasRequest(`/payments/${id}/pixQrCode`, options);
  } catch (_error) {
    // A cobrança continua válida pela fatura hospedada mesmo se o QR Code
    // estiver temporariamente indisponível.
    return {};
  }
}

function validateCustomerData({ userId, name, cpfCnpj }) {
  const normalizedDocument = normalizeDigits(cpfCnpj);
  const normalizedName = String(name || '').trim();

  if (!userId) {
    const error = new Error('Usuário não informado para a cobrança.');
    error.code = 'PAYMENT_CUSTOMER_REQUIRED';
    throw error;
  }

  if (!normalizedName) {
    const error = new Error('Preencha seu nome no perfil antes de assinar.');
    error.code = 'PAYMENT_CUSTOMER_NAME_REQUIRED';
    throw error;
  }

  if (![11, 14].includes(normalizedDocument.length)) {
    const error = new Error('Preencha um CPF ou CNPJ válido no seu perfil antes de assinar.');
    error.code = 'PAYMENT_CUSTOMER_DOCUMENT_REQUIRED';
    throw error;
  }

  return {
    name: normalizedName,
    cpfCnpj: normalizedDocument,
    externalReference: `instalapro-user-${userId}`,
  };
}

async function findOrCreateCustomer({
  userId,
  name,
  email,
  phone,
  cpfCnpj,
  fetchImpl,
  accessToken,
  apiBaseUrl,
}) {
  const customerData = validateCustomerData({ userId, name, cpfCnpj });
  const requestOptions = { fetchImpl, accessToken, apiBaseUrl };
  const query = new URLSearchParams({
    externalReference: customerData.externalReference,
    limit: '1',
  });
  let result = await asaasRequest(`/customers?${query.toString()}`, requestOptions);
  let customer = Array.isArray(result?.data) ? result.data.find((item) => !item?.deleted) : null;

  if (!customer) {
    const documentQuery = new URLSearchParams({
      cpfCnpj: customerData.cpfCnpj,
      limit: '1',
    });
    result = await asaasRequest(`/customers?${documentQuery.toString()}`, requestOptions);
    customer = Array.isArray(result?.data) ? result.data.find((item) => !item?.deleted) : null;
  }

  if (customer?.id) {
    return { id: String(customer.id), created: false, raw: customer };
  }

  const normalizedPhone = normalizeDigits(phone);
  const body = {
    ...customerData,
    email: String(email || '').trim().toLowerCase() || undefined,
    mobilePhone: normalizedPhone || undefined,
    notificationDisabled: false,
  };
  const createdCustomer = await asaasRequest('/customers', {
    ...requestOptions,
    method: 'POST',
    body,
  });

  return { id: String(createdCustomer.id || ''), created: true, raw: createdCustomer };
}

function formatDueDate(date = new Date()) {
  const dueDate = new Date(date);
  dueDate.setUTCDate(dueDate.getUTCDate() + 2);
  return dueDate.toISOString().slice(0, 10);
}

function formatCurrentDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(date));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeCallbackBaseUrl(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    const error = new Error('URL de retorno do checkout não configurada.');
    error.code = 'PAYMENT_CALLBACK_URL_REQUIRED';
    throw error;
  }

  try {
    const url = new URL(rawValue);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid-protocol');
    return url.toString().replace(/\/+$/, '');
  } catch (_error) {
    const error = new Error('URL de retorno do checkout inválida.');
    error.code = 'PAYMENT_CALLBACK_URL_INVALID';
    throw error;
  }
}

async function createRecurringCheckout({
  customerId,
  amount,
  externalId,
  callbackBaseUrl,
  fetchImpl,
  accessToken,
  apiBaseUrl,
  now,
}) {
  const normalizedCustomerId = String(customerId || '').trim();
  if (!normalizedCustomerId) {
    const error = new Error('Cliente Asaas não informado para a assinatura.');
    error.code = 'PAYMENT_CUSTOMER_REQUIRED';
    throw error;
  }

  const normalizedAmount = Number(Number(amount || 0).toFixed(2));
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    const error = new Error('Valor da assinatura inválido.');
    error.code = 'PAYMENT_AMOUNT_INVALID';
    throw error;
  }

  const reference = String(externalId || '').trim().slice(0, 200);
  const callbackUrl = normalizeCallbackBaseUrl(callbackBaseUrl);
  const checkout = await asaasRequest('/checkouts', {
    fetchImpl,
    accessToken,
    apiBaseUrl,
    method: 'POST',
    body: {
      billingTypes: ['PIX', 'CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      minutesToExpire: 1440,
      externalReference: reference,
      callback: {
        successUrl: `${callbackUrl}/subscription?checkout=success`,
        cancelUrl: `${callbackUrl}/subscription?checkout=canceled`,
        expiredUrl: `${callbackUrl}/subscription?checkout=expired`,
      },
      items: [
        {
          externalReference: 'instalapro-monthly',
          name: 'Plano mensal InstalaPro',
          description: 'Acesso mensal às ferramentas profissionais para instaladores.',
          quantity: 1,
          value: normalizedAmount,
        },
      ],
      customer: normalizedCustomerId,
      subscription: {
        cycle: 'MONTHLY',
        nextDueDate: formatCurrentDate(now),
      },
    },
  });

  if (!checkout?.id || !checkout?.link) {
    const error = new Error('A Asaas não retornou o link do checkout.');
    error.code = 'PAYMENT_PROVIDER_ID_MISSING';
    throw error;
  }

  return parseRecurringCheckout(checkout, {
    amount: normalizedAmount,
    customerId: normalizedCustomerId,
    externalId: reference,
  });
}

async function createPixPayment({
  customerId,
  amount,
  externalId,
  fetchImpl,
  accessToken,
  apiBaseUrl,
  now,
}) {
  const normalizedCustomerId = String(customerId || '').trim();
  if (!normalizedCustomerId) {
    const error = new Error('Cliente Asaas não informado para a cobrança.');
    error.code = 'PAYMENT_CUSTOMER_REQUIRED';
    throw error;
  }

  const requestOptions = { fetchImpl, accessToken, apiBaseUrl };
  const payment = await asaasRequest('/payments', {
    ...requestOptions,
    method: 'POST',
    body: {
      customer: normalizedCustomerId,
      billingType: 'PIX',
      value: Number(Number(amount || 0).toFixed(2)),
      dueDate: formatDueDate(now),
      description: 'Assinatura mensal InstalaPro',
      externalReference: String(externalId || '').slice(0, 64),
    },
  });
  const paymentId = encodeURIComponent(String(payment?.id || '').trim());

  if (!paymentId) {
    const error = new Error('A Asaas não retornou o identificador da cobrança.');
    error.code = 'PAYMENT_PROVIDER_ID_MISSING';
    throw error;
  }

  const pixQrCode = await getPixQrCode(paymentId, requestOptions);
  return parsePixPayment(payment, pixQrCode);
}

async function getPixPayment(providerPaymentId, options = {}) {
  const id = encodeURIComponent(String(providerPaymentId || '').trim());
  if (!id) {
    const error = new Error('Pagamento do provedor não informado.');
    error.code = 'PAYMENT_PROVIDER_ID_REQUIRED';
    throw error;
  }

  const payment = await asaasRequest(`/payments/${id}`, options);
  const pixQrCode = options.includePixQrCode
    ? await getPixQrCode(id, options)
    : {};
  return parsePixPayment(payment, pixQrCode);
}

async function findPaymentByCheckoutId(checkoutId, options = {}) {
  const id = String(checkoutId || '').trim();
  if (!id) return null;

  const query = new URLSearchParams({
    checkoutSession: id,
    limit: '10',
  });
  const result = await asaasRequest(`/payments?${query.toString()}`, options);
  const payments = Array.isArray(result?.data) ? result.data : [];
  const payment = payments.find((item) => String(item?.checkoutSession || '') === id)
    || payments[0];

  if (!payment?.id) return null;
  return getPixPayment(payment.id, { ...options, includePixQrCode: true });
}

async function findPaymentByExternalId(externalId, options = {}) {
  const reference = String(externalId || '').trim();
  if (!reference) return null;

  const query = new URLSearchParams({
    externalReference: reference,
    limit: '10',
  });
  const result = await asaasRequest(`/payments?${query.toString()}`, options);
  const payment = Array.isArray(result?.data)
    ? result.data.find((item) => String(item?.externalReference || '') === reference)
    : null;

  if (!payment?.id) return null;
  return getPixPayment(payment.id, { ...options, includePixQrCode: true });
}

function validateWebhookToken(providedToken, expectedToken = getAsaasConfig().webhookToken) {
  const provided = String(providedToken || '').trim();
  const expected = String(expectedToken || '').trim();
  if (!provided || !expected || provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'));
}

module.exports = {
  asaasRequest,
  createPixPayment,
  createRecurringCheckout,
  findOrCreateCustomer,
  findPaymentByCheckoutId,
  findPaymentByExternalId,
  getAsaasConfig,
  getPixPayment,
  isAsaasConfigured,
  isAsaasWebhookConfigured,
  normalizePaymentStatus,
  parsePixPayment,
  parseRecurringCheckout,
  validateCustomerData,
  validateWebhookToken,
};
