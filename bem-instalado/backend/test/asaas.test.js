const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPixPayment,
  createRecurringCheckout,
  findPaymentByCheckoutId,
  findPaymentByExternalId,
  findOrCreateCustomer,
  isAsaasConfigured,
  normalizePaymentStatus,
  parsePixPayment,
  parseRecurringCheckout,
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
  assert.equal(normalizePaymentStatus('CONFIRMED', 'CREDIT_CARD'), 'paid');
  assert.equal(normalizePaymentStatus('PENDING'), 'pending');
  assert.equal(normalizePaymentStatus('OVERDUE'), 'pending');
  assert.equal(normalizePaymentStatus('REFUNDED'), 'refunded');
  assert.equal(normalizePaymentStatus('PARTIALLY_REFUNDED'), 'refunded');
  assert.equal(normalizePaymentStatus('AWAITING_CHARGEBACK_REVERSAL'), 'refunded');
  assert.equal(normalizePaymentStatus('DELETED'), 'canceled');
});

test('converte checkout recorrente da Asaas', () => {
  const checkout = parseRecurringCheckout({
    id: 'checkout_123',
    link: 'https://sandbox.asaas.com/checkoutSession/show/checkout_123',
    status: 'ACTIVE',
    externalReference: 'instalapro_11_checkout',
    customer: 'cus_123',
    billingTypes: ['PIX', 'CREDIT_CARD'],
    chargeTypes: ['RECURRENT'],
    items: [{ quantity: 1, value: 49.9 }],
    subscription: { cycle: 'MONTHLY' },
  });

  assert.equal(checkout.provider, 'asaas_checkout');
  assert.equal(checkout.providerPaymentId, 'checkout_123');
  assert.equal(checkout.externalId, 'instalapro_11_checkout');
  assert.equal(checkout.amount, 49.9);
  assert.equal(checkout.status, 'pending');
  assert.equal(checkout.billingType, 'PIX,CREDIT_CARD');
});

test('cria checkout com Pix e cartão para assinatura mensal', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return new Response(
      JSON.stringify({
        id: 'checkout_monthly',
        link: 'https://sandbox.asaas.com/checkoutSession/show/checkout_monthly',
        status: 'ACTIVE',
        externalReference: 'instalapro_12_checkout',
        customer: 'cus_123',
        billingTypes: ['PIX', 'CREDIT_CARD'],
        chargeTypes: ['RECURRENT'],
        items: [{ quantity: 1, value: 49.9 }],
        subscription: { cycle: 'MONTHLY', nextDueDate: '2026-07-23' },
      }),
      { status: 200 }
    );
  };

  const checkout = await createRecurringCheckout({
    customerId: 'cus_123',
    amount: 49.9,
    externalId: 'instalapro_12_checkout',
    callbackBaseUrl: 'https://instalar.example',
    accessToken: 'test-key',
    fetchImpl,
    now: new Date('2026-07-23T12:00:00Z'),
  });
  const body = JSON.parse(request.options.body);

  assert.match(request.url, /\/checkouts$/);
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(body.billingTypes, ['PIX', 'CREDIT_CARD']);
  assert.deepEqual(body.chargeTypes, ['RECURRENT']);
  assert.equal(body.customer, 'cus_123');
  assert.equal(body.subscription.cycle, 'MONTHLY');
  assert.equal(body.subscription.nextDueDate, '2026-07-23');
  assert.equal(body.items[0].value, 49.9);
  assert.equal(body.callback.successUrl, 'https://instalar.example/subscription?checkout=success');
  assert.equal(checkout.ticketUrl, 'https://sandbox.asaas.com/checkoutSession/show/checkout_monthly');
});

test('localiza a cobrança vinculada ao checkout recorrente', async () => {
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    if (url.includes('/payments?checkoutSession=checkout_456')) {
      return new Response(
        JSON.stringify({
          data: [{
            id: 'pay_checkout_456',
            checkoutSession: 'checkout_456',
          }],
        }),
        { status: 200 }
      );
    }
    if (url.endsWith('/payments/pay_checkout_456')) {
      return new Response(
        JSON.stringify({
          id: 'pay_checkout_456',
          customer: 'cus_456',
          subscription: 'sub_456',
          checkoutSession: 'checkout_456',
          status: 'CONFIRMED',
          billingType: 'CREDIT_CARD',
          externalReference: 'instalapro_13_checkout',
          value: 49.9,
          invoiceUrl: 'https://sandbox.asaas.com/i/pay_checkout_456',
        }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ errors: [] }), { status: 404 });
  };

  const payment = await findPaymentByCheckoutId('checkout_456', {
    accessToken: 'test-key',
    fetchImpl,
  });

  assert.equal(payment.providerPaymentId, 'pay_checkout_456');
  assert.equal(payment.subscriptionId, 'sub_456');
  assert.equal(payment.checkoutId, 'checkout_456');
  assert.equal(payment.status, 'paid');
  assert.equal(requests.length, 3);
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

test('mantém a cobrança acessível quando o QR Code está temporariamente indisponível', async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith('/payments')) {
      return new Response(
        JSON.stringify({
          id: 'pay_without_qr',
          customer: 'cus_123',
          status: 'PENDING',
          billingType: 'PIX',
          externalReference: 'instalapro_8_retry',
          value: 40,
          invoiceUrl: 'https://sandbox.asaas.com/i/pay_without_qr',
        }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ errors: [{ description: 'QR indisponível' }] }), { status: 503 });
  };

  const payment = await createPixPayment({
    customerId: 'cus_123',
    amount: 40,
    externalId: 'instalapro_8_retry',
    accessToken: 'test-key',
    fetchImpl,
  });

  assert.equal(payment.providerPaymentId, 'pay_without_qr');
  assert.equal(payment.ticketUrl, 'https://sandbox.asaas.com/i/pay_without_qr');
  assert.equal(payment.copyPaste, '');
});

test('recupera cobrança existente pela referência externa sem duplicá-la', async () => {
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    if (url.includes('/payments?externalReference=')) {
      return new Response(
        JSON.stringify({
          data: [{
            id: 'pay_recovered',
            externalReference: 'instalapro_9_retry',
          }],
        }),
        { status: 200 }
      );
    }
    if (url.endsWith('/payments/pay_recovered')) {
      return new Response(
        JSON.stringify({
          id: 'pay_recovered',
          customer: 'cus_999',
          status: 'PENDING',
          billingType: 'PIX',
          externalReference: 'instalapro_9_retry',
          value: 40,
          invoiceUrl: 'https://sandbox.asaas.com/i/recovered',
        }),
        { status: 200 }
      );
    }
    if (url.endsWith('/payments/pay_recovered/pixQrCode')) {
      return new Response(
        JSON.stringify({ encodedImage: 'qr-recovered', payload: 'pix-recovered' }),
        { status: 200 }
      );
    }
    return new Response('{}', { status: 404 });
  };

  const payment = await findPaymentByExternalId('instalapro_9_retry', {
    accessToken: 'test-key',
    fetchImpl,
  });

  assert.equal(payment.providerPaymentId, 'pay_recovered');
  assert.equal(payment.copyPaste, 'pix-recovered');
  assert.equal(requests.length, 3);
});

test('classifica falhas de rede da Asaas para permitir recuperação segura', async () => {
  await assert.rejects(
    createPixPayment({
      customerId: 'cus_123',
      amount: 40,
      externalId: 'instalapro_10_network',
      accessToken: 'test-key',
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    }),
    { code: 'ASAAS_NETWORK_ERROR' }
  );
});

test('valida token do webhook com comparação segura', () => {
  const token = 'token-seguro-com-pelo-menos-32-caracteres';
  assert.equal(validateWebhookToken(token, token), true);
  assert.equal(validateWebhookToken(`${token}x`, token), false);
  assert.equal(validateWebhookToken('token-incorreto', token), false);
});
