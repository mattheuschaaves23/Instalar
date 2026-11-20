const test = require('node:test');
const assert = require('node:assert/strict');

test('link Pro funciona com perfil oculto, limita o pedido a um instalador e respeita o fim do plano', { skip: !process.env.TEST_DATABASE_URL }, async (t) => {
  const database = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname), 'Use PostgreSQL local para testes de escrita.');
  process.env.DATABASE_URL = database.toString();
  process.env.DATABASE_SSL = 'false';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET ||= 'integration-test-secret-with-at-least-32-characters';
  process.env.TURNSTILE_SECRET_KEY = 'qa-fake-turnstile-secret';
  const pool = require('../config/database');
  const { app, ensureRuntimeSchema } = require('../server');
  const { jwtSecret } = require('../config/auth');
  const jwt = require('jsonwebtoken');
  const realFetch = global.fetch;
  t.mock.method(global, 'fetch', (url, options) => {
    if (url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
      return Promise.resolve(Response.json({ success: options.body.get('response') === 'checked-by-qa', action: 'direct_service_request' }));
    }
    return realFetch(url, options);
  });
  const ids = [];
  let server;
  let requestId;
  try {
    await ensureRuntimeSchema();
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const api = async (path, options = {}) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
        method: options.method,
        headers: {
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.user ? { Authorization: `Bearer ${jwt.sign({ id: options.user, v: 0 }, jwtSecret)}` } : {}),
          ...(options.token ? { 'X-Client-Request-Token': options.token } : {}),
          ...(options.invite ? { 'X-Installer-Link-Token': options.invite } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      return { status: response.status, headers: response.headers, body: await response.json() };
    };
    const addInstaller = async (label, visible, verified = true) => {
      const { rows } = await pool.query(`
        INSERT INTO users (name,email,password,phone,city,state,latitude,longitude,account_type,email_verified_at,public_profile,certification_verified)
        VALUES ($1,$2,'fixture','48999990000','Palhoça','SC',-27.6,-48.6,'installer',NOW(),$3,$4) RETURNING id
      `, [label, `direct-${label}-${Date.now()}@example.test`, visible, verified]);
      ids.push(rows[0].id);
      return rows[0].id;
    };
    // Old installs defaulted public_profile to true before there was an approval.
    const installer = await addInstaller('Escolhido', true, false);
    const other = await addInstaller('Outro', true);
    const hidden = await addInstaller('Oculto', false);
    await pool.query('UPDATE users SET is_admin = TRUE WHERE id = $1', [hidden]);
    assert.equal((await api(`/public/installers/${installer}`)).status, 404);
    const legacyOwner = await api('/users/profile', { user: installer });
    assert.equal(legacyOwner.status, 200);
    assert.equal(legacyOwner.body.public_profile, false);
    const initialDirectory = await api('/public/installers');
    assert.equal(initialDirectory.status, 200);
    assert.equal(initialDirectory.body.installers.some((row) => row.id === installer), false);
    assert.equal(initialDirectory.body.installers.some((row) => row.id === other && row.certificate_verified), true);
    const visibilityPath = `/admin/users/${installer}/public-profile`;
    const publish = { method: 'PATCH', body: { public_profile: true } };
    assert.equal((await api(visibilityPath, { ...publish, user: installer })).status, 403);
    const approved = await api(visibilityPath, { ...publish, user: hidden });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.user.public_profile, true);
    const profile = await api(`/public/installers/${installer}`);
    assert.equal(profile.status, 200);
    assert.equal(profile.body.installer.certificate_verified, false);
    assert.equal(profile.body.installer.accepts_direct_requests, false);
    assert.equal((await api('/users/client-link')).status, 401);
    assert.deepEqual((await api('/users/client-link', { user: installer })).body, { status: 'plan_required', url: null });
    const adminLink = await api('/users/client-link', { user: hidden });
    assert.equal(adminLink.body.status, 'ready', 'O acesso Pro que o painel já reconhece deve liberar o link.');
    const adminInvite = new URLSearchParams(new URL(adminLink.body.url).hash.slice(1)).get('convite');
    const adminProfile = await api(`/public/installers/${hidden}`, { invite: adminInvite });
    assert.equal(adminProfile.status, 200);
    assert.equal(adminProfile.body.installer.accepts_direct_requests, true);
    assert.equal((await pool.query('SELECT 1 FROM subscriptions WHERE user_id = $1', [hidden])).rowCount, 0);
    const directory = await api('/public/installers');
    assert.equal(directory.status, 200);
    const visible = directory.body.installers.find((row) => row.id === installer);
    assert.equal(visible?.certificate_verified, false);
    assert.equal(directory.body.installers.some((row) => row.id === hidden), false);

    const hide = { method: 'PATCH', body: { public_profile: false }, user: hidden };
    assert.equal((await api(visibilityPath, hide)).status, 200);
    await pool.query("INSERT INTO subscriptions (user_id, plan, status) VALUES ($1, 'pro', 'active')", [installer]);
    const ownLink = await api('/users/client-link', { user: installer });
    assert.equal(ownLink.status, 200, JSON.stringify(ownLink.body));
    assert.equal(ownLink.body.status, 'ready');
    assert.match(ownLink.headers.get('cache-control'), /no-store/);
    const url = new URL(ownLink.body.url);
    assert.equal(url.pathname, `/installers/${installer}`);
    assert.equal(url.search, '?orcamento=1');
    const invite = new URLSearchParams(url.hash.slice(1)).get('convite');
    assert.match(invite, /^[A-Za-z0-9_-]{43}$/);
    await pool.query("UPDATE users SET phone = '' WHERE id = $1", [installer]);
    assert.deepEqual((await api('/users/client-link', { user: installer })).body, { status: 'incomplete', url: null });
    assert.equal((await api(`/public/installers/${installer}`, { invite })).status, 404);
    await pool.query("UPDATE users SET phone = '48999990000' WHERE id = $1", [installer]);
    assert.equal((await api(`/public/installers/${installer}`)).status, 404);
    assert.equal((await api(`/public/installers/${hidden}`, { invite })).status, 404);
    const invited = await api(`/public/installers/${installer}`, { invite });
    assert.equal(invited.status, 200, JSON.stringify(invited.body));
    assert.equal(invited.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(invited.body.installer.accepts_direct_requests, true);
    assert.equal(invited.body.installer.email, undefined);
    assert.equal(invited.body.installer.phone, undefined);
    assert.equal((await api('/public/installers')).body.installers.some((row) => row.id === installer), false);
    const payload = {
      client_name: 'Cliente visitante QA', client_phone: '48999990001', city: 'Palhoça', state: 'SC',
      details: 'Instalação na sala', privacy_consent: true, turnstile_token: 'checked-by-qa',
    };
    const send = (id, body = payload) => api(`/public/installers/${id}/direct-requests`, { method: 'POST', body, invite: id === installer ? invite : undefined });
    const created = await send(installer, { ...payload, city: 'Curitiba', state: 'PR' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    requestId = created.body.service_request.id;
    const token = created.body.service_request.client_access_token;
    assert.ok(token);
    assert.equal(created.body.service_request.is_direct, true);
    assert.equal(created.body.service_request.status, 'open');
    assert.equal((await send(hidden)).status, 404);
    assert.equal((await send(installer, { ...payload, privacy_consent: false })).status, 400);
    assert.equal((await send(installer, { ...payload, turnstile_token: '' })).status, 403);
    assert.equal((await send(installer, { ...payload, turnstile_token: 'refused-by-qa' })).status, 403);

    const ownList = await api('/opportunities', { user: installer });
    assert.equal(ownList.status, 200, JSON.stringify(ownList.body));
    const item = ownList.body.opportunities.find((row) => row.id === requestId);
    assert.equal(item?.is_direct, true);
    assert.equal(item.status, 'open');
    assert.equal(item.client_phone, null);
    assert.equal(item.can_contact_on_interest, false);
    const otherList = await api('/opportunities', { user: other });
    assert.equal(otherList.status, 200);
    assert.ok(!otherList.body.opportunities.some((row) => row.id === requestId));
    const ownFromNotice = await api(`/opportunities?status=all&request_id=${requestId}`, { user: installer });
    assert.deepEqual(ownFromNotice.body.opportunities.map((row) => row.id), [requestId]);
    const otherFromNotice = await api(`/opportunities?status=all&request_id=${requestId}`, { user: other });
    assert.deepEqual(otherFromNotice.body.opportunities, []);
    const missingFromNotice = await api('/opportunities?status=all&request_id=2147483647', { user: installer });
    assert.deepEqual(missingFromNotice.body.opportunities, []);
    // Same-city direct orders are also private, not just orders outside the search radius.
    const sameCity = await send(installer);
    assert.equal(sameCity.status, 201);
    const sameCityList = await api('/opportunities', { user: other });
    assert.ok(!sameCityList.body.opportunities.some((row) => row.id === sameCity.body.service_request.id));
    const alternate = sameCity.body.service_request;
    await assert.rejects(
      pool.query("UPDATE service_requests SET status = 'open' WHERE id = $1", [alternate.id]),
      { code: '23514' },
    );
    assert.equal((await api(`/public/service-requests/${alternate.id}/status`, { token: alternate.client_access_token, method: 'PATCH', body: { status: 'canceled' } })).status, 200);
    const reopened = await api(`/admin/service-requests/${alternate.id}/status`, { user: hidden, method: 'PATCH', body: { status: 'open' } });
    assert.equal(reopened.status, 200, JSON.stringify(reopened.body));
    assert.equal(reopened.body.request.status, 'open');
    const storedStatus = await pool.query('SELECT status FROM service_requests WHERE id = $1', [alternate.id]);
    assert.equal(storedStatus.rows[0].status, 'direct_pending');
    assert.ok(!(await api('/opportunities', { user: other })).body.opportunities.some((row) => row.id === alternate.id));
    const acceptPath = `/opportunities/${requestId}/accept-direct`;
    assert.equal((await api(acceptPath, { method: 'POST' })).status, 401);
    assert.equal((await api(acceptPath, { method: 'POST', user: other })).status, 404);
    assert.equal((await api(`/opportunities/${requestId}/interest`, { method: 'POST', user: installer })).status, 404);
    assert.equal((await api(`/opportunities/${sameCity.body.service_request.id}/interest`, { method: 'POST', user: other })).status, 404);

    const tracking = `/public/service-requests/${requestId}/interests`;
    assert.equal((await api(tracking, { token: 'wrong-code' })).status, 404);
    const before = await api(tracking, { token });
    assert.equal(before.body.request.is_direct, true);
    assert.equal(before.body.request.status, 'open');
    assert.deepEqual(before.body.interests, []);
    const proposalPath = `/public/service-requests/${requestId}/proposal`;
    const proposalBeforeAccept = await api(proposalPath, { token });
    assert.equal(proposalBeforeAccept.status, 200);
    assert.equal(proposalBeforeAccept.body.request_status, 'open');
    assert.equal(proposalBeforeAccept.body.proposal, null);
    const notifications = await pool.query('SELECT user_id, action_path FROM notifications WHERE title = $1 AND user_id = ANY($2::int[]) ORDER BY id', ['Pedido direto recebido', ids]);
    assert.deepEqual(notifications.rows, [{ user_id: installer, action_path: '/opportunities' }, { user_id: installer, action_path: '/opportunities' }]);
    assert.equal((await pool.query('SELECT id FROM budgets WHERE source_service_request_id = $1', [requestId])).rowCount, 0);
    assert.equal((await pool.query('SELECT id FROM clients WHERE user_id = $1', [installer])).rowCount, 0);

    const accepted = await Promise.all([1, 2].map(() => api(acceptPath, { method: 'POST', user: installer })));
    assert.deepEqual(accepted.map((result) => result.status), [200, 200], JSON.stringify(accepted));
    const draftId = accepted[0].body.budget_id;
    assert.ok(draftId);
    assert.equal(accepted[1].body.budget_id, draftId);
    const draft = await pool.query('SELECT id, user_id, client_id, status FROM budgets WHERE source_service_request_id = $1', [requestId]);
    assert.deepEqual(draft.rows, [{ id: draftId, user_id: installer, client_id: null, status: 'draft' }]);
    const after = await api(tracking, { token });
    assert.equal(after.body.request.status, 'selected');
    assert.equal(after.body.interests[0].installer_id, installer);
    assert.equal(after.body.interests[0].selected, true);
    const draftAsOwner = await api(`/budgets/${draftId}/draft`, { user: installer });
    assert.equal(draftAsOwner.status, 200);
    assert.equal(draftAsOwner.body.request.client_phone, '5548999990001');
    assert.equal((await api(`/budgets/${draftId}/draft`, { user: other })).status, 404);

    assert.equal((await api(visibilityPath, { ...publish, user: hidden })).status, 200);
    await pool.query("UPDATE users SET certificate_file = 'qa-certificate.pdf', certification_verified = TRUE WHERE id = $1", [installer]);
    const clearCertificate = await api('/users/profile', { method: 'PUT', body: { certificate_file: '' }, user: installer });
    assert.equal(clearCertificate.status, 200);
    assert.equal(clearCertificate.body.public_profile, true);
    assert.equal(clearCertificate.body.certification_verified, false);
    assert.equal(clearCertificate.body.certification_status, 'not_submitted');
    assert.equal((await api(`/public/installers/${installer}`)).body.installer.accepts_direct_requests, true);

    assert.equal((await api(visibilityPath, hide)).status, 200);
    await pool.query("UPDATE subscriptions SET expires_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1", [installer]);
    assert.deepEqual((await api('/users/client-link', { user: installer })).body, { status: 'plan_required', url: null });
    assert.equal((await api(`/public/installers/${installer}`, { invite })).status, 404);
    assert.equal((await send(installer)).status, 404);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (ids.length) await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [ids]);
    await pool.end();
  }
});
