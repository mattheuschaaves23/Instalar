const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPixPayment,
  findOrCreateCustomer,
  isAsaasConfigured,
  normalizePaymentStatus,
  parsePixPayment,
  validateWebhookToken,
} = require('../services/asaas');

test('só habilita cobrança quando chave e token seguro do webhook estão configurados', () => {
  const previousApiKey = process.env.ASAAS_API_KEY;
  const previousAccessToken = process.env.ASAAS_ACCESS_TOKEN;
  const previousWebhookToken = process.env.ASAAS_WEBHOOK_TOKEN;

  delete process.env.ASAAS_ACCESS_TOKEN;
  process.env.ASAAS_API_KEY = 'test-key';
  delete process.env.ASAAS_WEBHOOK_TOKEN;
  assert.equal(isAsaasConfigured(), false);

  process.env.ASAAS_WEBHOOK_TOKEN = 'curto';
  assert.equal(isAsaasConfigured(), false);

  process.env.ASAAS_WEBHOOK_TOKEN = 'token-seguro-com-pelo-menos-32-caracteres';
  assert.equal(isAsaasConfigured(), true);

  if (previousApiKey === undefined) delete process.env.ASAAS_API_KEY;
  else process.env.ASAAS_API_KEY = previousApiKey;
  if (previousAccessToken === undefined) delete process.env.ASAAS_ACCESS_TOKEN;
  else process.env.ASAAS_ACCESS_TOKEN = previousAccessToken;
  if (previousWebhookToken === undefined) delete process.env.ASAAS_WEBHOOK_TOKEN;
  else process.env.ASAAS_WEBHOOK_TOKEN = previousWebhookToken;
});

test('normaliza os estados relevantes da Asaas sem liberar Pix apenas confirmado', () => {
  assert.equal(normalizePaymentStatus('RECEIVED'), 'paid');
  assert.equal(normalizePaymentStatus('CONFIRMED'), 'pending');
  assert.equal(normalizePaymentStatus('PENDING'), 'pending');
  assert.equal(normalizePaymentStatus('OVERDUE'), 'pending');
  assert.equal(normalizePaymentStatus('REFUNDED'), 'refunded');
  assert.equal(normalizePaymentStatus('DELETED'), 'canceled');
});

test('converte cobrança e QR Code Pix da Asaas', () => {
  const payment = parsePixPayment(
    {
      id: 'pay_123',
      customer: 'cus_123',
      status: 'PENDING',
      billingType: 'PIX',
      externalReference: 'instalapro_1_abc',
      value: 49.9,
      invoiceUrl: 'https://sandbox.asaas.com/i/123',
      dueDate: '2026-07-25',
    },
    {
      encodedImage: 'iVBORw0KGgo=',
      payload: '000201...',
      expirationDate: '2026-07-25T23:59:59Z',
    }
  );

  assert.equal(payment.provider, 'asaas');
  assert.equal(payment.providerPaymentId, 'pay_123');
  assert.equal(payment.customerId, 'cus_123');
  assert.equal(payment.externalId, 'instalapro_1_abc');
  assert.equal(payment.status, 'pending');
  assert.equal(payment.copyPaste, '000201...');
  assert.equal(payment.qrCodeImage, 'data:image/png;base64,iVBORw0KGgo=');
});

test('reutiliza cliente encontrado pela referência externa', async () => {
  let calls = 0;
  const fetchImpl = async (url, options) => {
    calls += 1;
    assert.match(url, /\/customers\?externalReference=instalapro-user-4&limit=1$/);
    assert.equal(options.method, 'GET');
    assert.equal(options.body, undefined);
    return new Response(
      JSON.stringify({ data: [{ id: 'cus_existing', deleted: false }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const customer = await findOrCreateCustomer({
    userId: 4,
    name: 'Maria da Silva',
    cpfCnpj: '249.715.637-92',
    accessToken: 'test-key',
    fetchImpl,
  });

  assert.equal(customer.id, 'cus_existing');
  assert.equal(customer.created, false);
  assert.equal(calls, 1);
});

test('exige CPF ou CNPJ antes de consultar a Asaas', async () => {
  let called = false;

  await assert.rejects(
    findOrCreateCustomer({
      userId: 7,
      name: 'Instalador sem documento',
      cpfCnpj: '',
      accessToken: 'test-key',
      fetchImpl: async () => {
        called = true;
        return new Response('{}', { status: 200 });
      },
    }),
    { code: 'PAYMENT_CUSTOMER_DOCUMENT_REQUIRED' }
  );

  assert.equal(called, false);
});

test('cria cliente sem duplicar busca por documento e depois gera cobrança Pix', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });

    if (url.includes('/customers?externalReference=')) {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }
    if (url.includes('/customers?cpfCnpj=')) {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }
    if (url.endsWith('/customers')) {
      return new Response(JSON.stringify({ id: 'cus_new' }), { status: 200 });
    }
    if (url.endsWith('/payments')) {
      return new Response(
        JSON.stringify({
          id: 'pay_new',
          customer: 'cus_new',
          status: 'PENDING',
          billingType: 'PIX',
          externalReference: 'instalapro_4_uuid',
          value: 40,
          invoiceUrl: 'https://sandbox.asaas.com/i/new',
          dueDate: '2026-07-25',
        }),
        { status: 200 }
      );
    }
    if (url.endsWith('/payments/pay_new/pixQrCode')) {
      return new Response(
        JSON.stringify({ encodedImage: 'base64-code', payload: 'pix-code', expirationDate: '2026-07-25T12:00:00Z' }),
        { status: 200 }
      );
    }
    return new Response('{}', { status: 404 });
  };

  const customer = await findOrCreateCustomer({
    userId: 4,
    name: 'Maria da Silva',
    email: 'MARIA@EXAMPLE.COM',
    phone: '(48) 99999-9999',
    cpfCnpj: '249.715.637-92',
    accessToken: 'test-key',
    fetchImpl,
  });
  const payment = await createPixPayment({
    customerId: customer.id,
    amount: 40,
    externalId: 'instalapro_4_uuid',
    accessToken: 'test-key',
    fetchImpl,
    now: new Date('2026-07-23T12:00:00Z'),
  });

  const customerBody = JSON.parse(requests[2].options.body);
  const paymentBody = JSON.parse(requests[3].options.body);
  assert.equal(customer.id, 'cus_new');
  assert.equal(customerBody.cpfCnpj, '24971563792');
  assert.equal(customerBody.email, 'maria@example.com');
  assert.equal(customerBody.externalReference, 'instalapro-user-4');
  assert.equal(paymentBody.customer, 'cus_new');
  assert.equal(paymentBody.billingType, 'PIX');
  assert.equal(paymentBody.dueDate, '2026-07-25');
  assert.match(requests[3].options.headers['User-Agent'], /^InstalaPro\/1\.0/);
  assert.equal(requests[4].options.body, undefined);
  assert.equal(payment.providerPaymentId, 'pay_new');
  assert.equal(payment.copyPaste, 'pix-code');
});

test('valida token do webhook com comparação segura', () => {
  const token = 'token-seguro-com-pelo-menos-32-caracteres';
  assert.equal(validateWebhookToken(token, token), true);
  assert.equal(validateWebhookToken(`${token}x`, token), false);
  assert.equal(validateWebhookToken('token-incorreto', token), false);
});
