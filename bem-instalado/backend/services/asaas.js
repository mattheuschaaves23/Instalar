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

function normalizePaymentStatus(status) {
  const value = String(status || '').trim().toUpperCase();

  if (['RECEIVED', 'RECEIVED_IN_CASH'].includes(value)) return 'paid';
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
  if (['REFUNDED', 'REFUND_REQUESTED', 'REFUND_IN_PROGRESS', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE'].includes(value)) {
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
    status: normalizePaymentStatus(payment?.status),
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

  const response = await fetchImpl(`${String(apiBaseUrl).replace(/\/+$/, '')}${path}`, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw buildProviderError(payload, response.status);
  }

  return payload;
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
    const error = new Error('Preencha seu nome no perfil antes de gerar o Pix.');
    error.code = 'PAYMENT_CUSTOMER_NAME_REQUIRED';
    throw error;
  }

  if (![11, 14].includes(normalizedDocument.length)) {
    const error = new Error('Preencha um CPF ou CNPJ válido no seu perfil antes de gerar o Pix.');
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

  const pixQrCode = await asaasRequest(`/payments/${paymentId}/pixQrCode`, requestOptions);
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
  return parsePixPayment(payment);
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
  findOrCreateCustomer,
  getAsaasConfig,
  getPixPayment,
  isAsaasConfigured,
  isAsaasWebhookConfigured,
  normalizePaymentStatus,
  parsePixPayment,
  validateCustomerData,
  validateWebhookToken,
};
