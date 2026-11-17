// Open the local frontend in Playwright CLI first. All API data is simulated.
async (page) => {
  const origin = new URL(page.url()).origin;
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.unrouteAll({ behavior: 'wait' });
  let scenario = 'delayed-ideas';
  let admin = false;
  let ideasFinished = false;
  let readFinished = false;
  const user = { id: 999999, name: 'Teste desempenho', email: 'visual@example.test', account_type: 'installer', email_verified: true };
  const conversation = { id: 99, status: 'open' };
  const message = { id: 1, body: 'Mensagem já recebida', sender_name: 'Administrador', is_from_admin: true, created_at: '2026-11-17T12:00:00Z' };
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const requestScenario = scenario;
    const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' };
    if (path === '/api/support/me' || path === '/api/support/admin/conversations/99/messages') {
      await pause(requestScenario === 'delayed-conversation' ? 2200 : 200);
      return route.fulfill({ status: requestScenario === 'failed-conversation' ? 503 : 200, json: requestScenario === 'failed-conversation'
        ? { error: 'Falha simulada na conversa' }
        : { conversation, messages: [message] }, headers });
    }
    if (path === '/api/support/admin/conversations') return route.fulfill({ status: 200, json: { conversations: [{ ...conversation, installer_name: 'Conta de teste' }] }, headers });
    if (path === '/api/support/ideas/me' || path === '/api/support/admin/ideas') {
      await pause(requestScenario === 'delayed-ideas' ? 2200 : 100);
      ideasFinished = true;
      return route.fulfill({ status: requestScenario === 'failed-ideas' ? 503 : 200, json: requestScenario === 'failed-ideas' ? { error: 'Falha simulada nas sugestões' } : { ideas: [] }, headers });
    }
    if (path === '/api/support/me/read' || path === '/api/support/admin/conversations/99/read') {
      await pause(2300);
      readFinished = true;
      return route.fulfill({ status: 200, json: {}, headers });
    }
    const fixtures = {
      '/api/auth/csrf': { csrf_token: 'qa-only' }, '/api/users/profile': { ...user, is_admin: admin },
      '/api/subscriptions': { plan: 'pro', plan_access: { is_pro: true, limits: {}, usage: {}, features: {} } },
      '/api/notifications': [], '/api/schedules': [], '/api/opportunities': { opportunities: [], stats: {} },
      '/api/users/reviews/summary': { review_count: 0 },
    };
    return route.fulfill({ status: 200, json: fixtures[path] || {}, headers });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/settings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Configurações', exact: true }).waitFor();
  const start = Date.now();
  await page.locator('.ref-panel-sidebar a[href="/support"]').click();
  await page.getByRole('heading', { name: 'Suporte direto com o administrador', exact: true }).waitFor();
  const headingMs = Date.now() - start;
  await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('.support-compose button[type="submit"]')?.disabled);
  const chatMs = Date.now() - start;
  const result = { headingMs, chatMs, ideasFinished, readFinished, roller: await page.locator('.wall-loader').count(), errors };
  if (headingMs >= 1500 || chatMs >= 1800 || ideasFinished || readFinished || result.roller) throw new Error('The chat is still blocked by secondary loading: ' + JSON.stringify(result));
  await page.getByText('Mensagem já recebida', { exact: true }).waitFor();
  await page.getByPlaceholder('Digite sua dúvida para o administrador...').fill('Rascunho deve continuar aqui');
  await page.locator('.support-ideas-panel').getByRole('button', { name: 'Atualizar', exact: true }).waitFor();
  if (await page.getByPlaceholder('Digite sua dúvida para o administrador...').inputValue() !== 'Rascunho deve continuar aqui') throw new Error('Ideas update lost the draft');

  scenario = 'delayed-conversation';
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Suporte direto com o administrador', exact: true }).waitFor();
  if (!(await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).isDisabled())) throw new Error('Send enabled before the conversation loads');
  await page.getByRole('status', { name: 'Carregando mensagens', exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('.support-compose button[type="submit"]')?.disabled);

  scenario = 'failed-ideas';
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('alert').filter({ hasText: 'Falha simulada nas sugestões' }).waitFor();
  await page.waitForFunction(() => !document.querySelector('.support-compose button[type="submit"]')?.disabled);
  await page.getByText('Mensagem já recebida', { exact: true }).waitFor();
  scenario = 'normal';
  await page.locator('.support-ideas-panel').getByRole('button', { name: 'Atualizar', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Falha simulada nas sugestões' }).waitFor({ state: 'hidden' });

  scenario = 'failed-conversation';
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('alert').filter({ hasText: 'Falha simulada na conversa' }).waitFor();
  if (!(await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).isDisabled())) throw new Error('Send enabled for a failed conversation');
  scenario = 'normal';
  await page.getByRole('button', { name: 'Tentar carregar conversa novamente', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.support-compose button[type="submit"]')?.disabled);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => localStorage.setItem('instalar-site-preferences', JSON.stringify({ theme: 'dark', themeVersion: 2 })));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Suporte direto com o administrador', exact: true }).waitFor();
  await page.getByText('Mensagem já recebida', { exact: true }).waitFor();
  await page.screenshot({ path: 'output/qa/support-without-loader-mobile.png', fullPage: true });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Support overflows the mobile viewport');

  admin = true; scenario = 'delayed-ideas'; readFinished = false; ideasFinished = false;
  await page.setViewportSize({ width: 1440, height: 1000 });
  const adminStart = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Central de atendimento e melhorias', exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('.support-compose button[type="submit"]')?.disabled);
  result.adminChatMs = Date.now() - adminStart;
  if (readFinished || ideasFinished) throw new Error('Admin composer blocked by receipt or ideas');
  await page.screenshot({ path: 'output/qa/support-without-loader-admin.png', fullPage: true });
  if (errors.length) throw new Error('Browser runtime errors: ' + errors.join('; '));
  result.result = 'PASS';
  result.tested = ['independent chat and ideas', 'read receipts non-blocking', 'errors and retry', 'draft', 'mobile dark', 'admin'];
  await page.evaluate((result) => { document.documentElement.dataset.navigationQa = JSON.stringify(result); }, result);
  return result;
}
