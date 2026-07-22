const test = require('node:test');
const assert = require('node:assert/strict');

const enabled = Boolean(process.env.TEST_DATABASE_URL);

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

test('cadastro, pagamento, pedido, interesse e escolha do instalador', { skip: !enabled }, async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DATABASE_SSL = 'false';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret-with-at-least-32-characters';
  process.env.ALLOW_MANUAL_SUBSCRIPTION_CONFIRMATION = 'true';
  process.env.FRONTEND_URL = 'http://127.0.0.1:3000';

  const pool = require('../config/database');
  const { app, ensureRuntimeSchema } = require('../server');
  await ensureRuntimeSchema();

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `fluxo-${suffix}@example.test`;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  let installerId = null;
  let clientId = null;
  try {
    const registration = await requestJson(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Instalador Teste',
        email,
        password: 'TesteSeguro123!',
        phone: '48999999999',
        business_name: 'Teste Papel',
      }),
    });
    assert.equal(registration.response.status, 201, JSON.stringify(registration.body));
    installerId = registration.body.user.id;
    const token = registration.body.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    const clientRegistration = await requestJson(baseUrl, '/api/auth/register/client', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Cliente Conta Teste',
        email: `cliente-${email}`,
        password: 'ClienteSeguro123!',
        phone: '48988888888',
      }),
    });
    assert.equal(clientRegistration.response.status, 201, JSON.stringify(clientRegistration.body));
    clientId = clientRegistration.body.user.id;
    assert.equal(clientRegistration.body.user.account_type, 'client');
    const clientHeaders = { Authorization: `Bearer ${clientRegistration.body.token}` };

    const payment = await requestJson(baseUrl, '/api/subscriptions/pay', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({}),
    });
    assert.equal(payment.response.status, 200, JSON.stringify(payment.body));
    assert.ok(payment.body.payment?.external_id);

    const confirmation = await requestJson(
      baseUrl,
      `/api/subscriptions/payment/${encodeURIComponent(payment.body.payment.external_id)}/confirm`,
      { method: 'POST', headers: authHeaders, body: JSON.stringify({}) }
    );
    assert.equal(confirmation.response.status, 200, JSON.stringify(confirmation.body));
    assert.equal(confirmation.body.status, 'paid');

    await pool.query(
      `UPDATE users SET city = 'Palhoça', state = 'SC', latitude = -27.6453, longitude = -48.6679,
        service_radius_km = 80, certificate_file = $1,
        certification_verified = TRUE, public_profile = TRUE WHERE id = $2`,
      ['https://example.test/certificado.pdf', installerId]
    );

    const search = await requestJson(baseUrl, '/api/public/installers?city=Palhoca&state=SC');
    assert.equal(search.response.status, 200, JSON.stringify(search.body));
    assert.ok(search.body.installers.some((item) => item.id === installerId));

    const order = await requestJson(baseUrl, '/api/public/service-requests', {
      method: 'POST',
      body: JSON.stringify({
        client_name: 'Cliente Teste',
        client_phone: '48988888888',
        service: 'wallpaper',
        service_label: 'Instalação de papel de parede',
        city: 'Palhoça',
        state: 'SC',
        latitude: -27.6450,
        longitude: -48.6682,
        address_reference: 'Rua protegida, 123',
        details: 'Detalhes privados do ambiente',
        photo_urls: ['https://example.test/foto-privada.jpg'],
        privacy_consent: true,
      }),
    });
    assert.equal(order.response.status, 201, JSON.stringify(order.body));
    const serviceRequest = order.body.service_request;
    assert.ok(serviceRequest.client_access_token);

    const claim = await requestJson(baseUrl, `/api/public/service-requests/${serviceRequest.id}/claim`, {
      method: 'POST',
      headers: {
        ...clientHeaders,
        'X-Client-Request-Token': serviceRequest.client_access_token,
      },
      body: JSON.stringify({}),
    });
    assert.equal(claim.response.status, 200, JSON.stringify(claim.body));

    const myRequests = await requestJson(baseUrl, '/api/public/service-requests/mine', {
      headers: clientHeaders,
    });
    assert.equal(myRequests.response.status, 200, JSON.stringify(myRequests.body));
    assert.ok(myRequests.body.requests.some((item) => item.id === serviceRequest.id));

    const available = await requestJson(baseUrl, '/api/opportunities?status=open', {
      headers: authHeaders,
    });
    assert.equal(available.response.status, 200, JSON.stringify(available.body));
    const privateOpportunity = available.body.opportunities.find((item) => item.id === serviceRequest.id);
    assert.ok(privateOpportunity);
    assert.equal(privateOpportunity.client_name, null);
    assert.equal(privateOpportunity.address_reference, null);
    assert.equal(privateOpportunity.details, null);
    assert.deepEqual(privateOpportunity.photo_urls, []);
    assert.ok(privateOpportunity.distance_km < 1);

    const interest = await requestJson(baseUrl, `/api/opportunities/${serviceRequest.id}/interest`, {
      method: 'POST', headers: authHeaders, body: JSON.stringify({}),
    });
    assert.equal(interest.response.status, 200, JSON.stringify(interest.body));

    const interested = await requestJson(
      baseUrl,
      `/api/public/service-requests/${serviceRequest.id}/interests`,
      { headers: { 'X-Client-Request-Token': serviceRequest.client_access_token } }
    );
    assert.equal(interested.response.status, 200, JSON.stringify(interested.body));
    assert.equal(interested.body.interests.length, 1);

    const selection = await requestJson(
      baseUrl,
      `/api/public/service-requests/${serviceRequest.id}/interests/${interested.body.interests[0].id}/select`,
      {
        method: 'POST',
        headers: { 'X-Client-Request-Token': serviceRequest.client_access_token },
        body: JSON.stringify({}),
      }
    );
    assert.equal(selection.response.status, 200, JSON.stringify(selection.body));
    assert.equal(selection.body.selected_interest.selected, true);
    assert.ok(selection.body.selected_interest.whatsapp_url);

    const selectedOpportunities = await requestJson(baseUrl, '/api/opportunities?status=selected', {
      headers: authHeaders,
    });
    const selectedOpportunity = selectedOpportunities.body.opportunities.find((item) => item.id === serviceRequest.id);
    assert.equal(selectedOpportunity.client_name, 'Cliente Teste');
    assert.equal(selectedOpportunity.address_reference, 'Rua protegida, 123');
    assert.equal(selectedOpportunity.photo_urls.length, 1);

    const completion = await requestJson(baseUrl, `/api/public/service-requests/${serviceRequest.id}/status`, {
      method: 'PATCH',
      headers: clientHeaders,
      body: JSON.stringify({ status: 'closed' }),
    });
    assert.equal(completion.response.status, 200, JSON.stringify(completion.body));
    assert.equal(completion.body.request.status, 'closed');

    const review = await requestJson(baseUrl, `/api/public/installers/${installerId}/reviews`, {
      method: 'POST',
      headers: clientHeaders,
      body: JSON.stringify({
        service_request_id: serviceRequest.id,
        rating: 5,
        comment: 'Servico concluido com sucesso.',
      }),
    });
    assert.equal(review.response.status, 201, JSON.stringify(review.body));
  } finally {
    if (installerId) await pool.query('DELETE FROM users WHERE id = $1', [installerId]);
    if (clientId) await pool.query('DELETE FROM users WHERE id = $1', [clientId]);
    await pool.query('DELETE FROM service_requests WHERE client_name = $1', ['Cliente Teste']);
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
