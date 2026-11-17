// Run against a local build. All API/account data and WhatsApp are simulated.
async (page) => {
  const origin = 'http://127.0.0.1:3018';
  const errors = [];
  const requests = [];
  let failNext = false;
  let delayNextOpen = false;
  let interestPosts = 0;
  let proposalPosts = 0;
  let progressPosts = 0;
  let eligibility = { can_express_interest: true };
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('instalar-site-preferences', JSON.stringify({ theme: 'light', themeVersion: 2, motion: 'reduced' }));
    window.__qaWhatsApp = [];
    window.open = (url) => {
      window.__qaWhatsApp.push(url);
      return { closed: false, opener: null, location: { replace(value) { window.__qaWhatsApp.push(value); } }, close() { this.closed = true; } };
    };
  });
  await page.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const photos = ['/landing/carousel-room-modern.jpg', '/landing/carousel-room-tropical.jpg'];
  const basic = { service_label: 'Instalação de papel de parede', rooms: ['Sala'], city: 'Palhoça', state: 'SC', neighborhood: 'Pagani', place_type: 'residential', place_label: 'Casa ou apartamento', urgency: 'week', urgency_label: 'Esta semana', measurement_detail: '18 m²', material_label: 'Já comprei o papel', details: 'Aplicação em uma parede da sala. Dados fictícios de teste.', photo_urls: photos, photo_count: 2, status: 'open', distance_km: 3, distance_label: '3 km de distância', created_at: '2026-11-17T12:20:00Z', client_name: null, client_phone: null, can_contact_on_interest: true };
  const records = Array.from({ length: 13 }, (_, i) => ({ ...basic, id: 101 + i, neighborhood: i === 1 ? 'Pedra Branca' : i === 2 ? 'Centro' : 'Pagani', city: i === 2 ? 'São José' : 'Palhoça', place_type: i === 2 ? 'commercial' : 'residential', photo_urls: i < 3 ? photos : [], photo_count: i < 3 ? 2 : 0, rooms: [i === 1 ? 'Quarto de casal' : i === 2 ? 'Escritório' : 'Sala'], created_at: new Date(Date.parse(basic.created_at) - i * 60000).toISOString() }));
  records.push({ ...basic, id: 201, rooms: ['Quarto'], interested_by_me: true, my_interest_status: 'interested', interest_whatsapp_url: 'https://wa.me/5548999990000?text=Mensagem%20ficticia' });
  records.push({ ...basic, id: 202, rooms: ['Histórico expirado'], photo_urls: [], city: 'Rio de Janeiro', state: 'RJ', status: 'expired', interested_by_me: true, my_interest_status: 'interested', can_contact_on_interest: false });
  records.push({ ...basic, id: 203, rooms: ['Outro profissional'], status: 'selected', interested_by_me: true, my_interest_status: 'interested', not_selected: true, can_contact_on_interest: false });
  records.push({ ...basic, id: 301, status: 'selected', rooms: ['Cliente escolheu você'], selected_by_me: true, interested_by_me: true, my_interest_status: 'selected', client_name: 'Cliente QA fictício', client_phone: '48999990000', address_reference: 'Endereço fictício autorizado', whatsapp_url: 'https://wa.me/5548999990000?text=Teste', can_contact_on_interest: false });
  records.push({ ...basic, id: 302, status: 'completed', rooms: ['Serviço concluído'], selected_by_me: true, interested_by_me: true, my_interest_status: 'selected', can_contact_on_interest: false });
  records.push({ ...basic, id: 303, status: 'scheduled', rooms: ['Serviço agendado'], selected_by_me: true, interested_by_me: true, my_interest_status: 'selected', can_contact_on_interest: false });
  const tabFor = (item) => item.selected_by_me ? 'selected' : item.interested_by_me ? 'interested' : 'open';
  const fold = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const installer = { id: 42, name: 'Instalador QA', business_name: 'Perfil de teste', account_type: 'installer', email: 'qa@example.test', email_verified: true, email_verified_at: '2026-11-01', city: 'Palhoça', state: 'SC', phone: '48999990000', installation_gallery: [] };
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/opportunities') {
      const status = url.searchParams.get('status') || 'open';
      if (url.searchParams.get('limit') === '12') requests.push(url.search);
      if (failNext && status === 'open') { failNext = false; return route.fulfill({ status: 500, json: { error: 'Falha simulada. Tente novamente.' } }); }
      if (delayNextOpen && status === 'open') { delayNextOpen = false; await new Promise((resolve) => setTimeout(resolve, 750)); }
      const stats = Object.fromEntries(['open', 'interested', 'selected'].map((key) => [key, records.filter((item) => tabFor(item) === key).length]));
      const regional = records.filter((item) => status === 'all' || tabFor(item) === status);
      let items = regional.filter((item) => (!url.searchParams.get('q') || fold([item.service_label, item.city, item.neighborhood, ...item.rooms].join(' ')).includes(fold(url.searchParams.get('q')))) && (!url.searchParams.get('city') || item.city === url.searchParams.get('city')) && (!url.searchParams.get('place') || item.place_type === url.searchParams.get('place')) && (url.searchParams.get('photos') !== 'true' || item.photo_urls.length));
      if (url.searchParams.get('sort') === 'oldest') items = [...items].reverse();
      const total = items.length;
      const offset = Number(url.searchParams.get('offset') || 0);
      const limit = Number(url.searchParams.get('limit') || 20);
      const regions = [...new Map(regional.map((item) => [item.city + item.state, { city: item.city, state: item.state }])).values()];
      return route.fulfill({ json: { opportunities: items.slice(offset, offset + limit), stats, regions, eligibility, pagination: { total, limit, offset, has_more: offset + limit < total } } });
    }
    if (/\/opportunities\/\d+\/interest$/.test(path)) {
      interestPosts++;
      const item = records.find((row) => row.id === Number(path.split('/')[3]));
      item.interested_by_me = true; item.my_interest_status = 'interested'; item.interest_whatsapp_url = 'https://wa.me/5548999990000?text=Mensagem%20ficticia';
      return route.fulfill({ json: { opportunity: item } });
    }
    if (/\/opportunities\/\d+\/proposal$/.test(path)) {
      if (route.request().method() === 'POST') { proposalPosts++; return route.fulfill({ json: { proposal: { status: 'sent', ...route.request().postDataJSON() } } }); }
      const complete = path.includes('/302/') || path.includes('/303/');
      return route.fulfill({ json: { proposal: complete ? { amount: 400, scope: 'Serviço fictício concluído', status: 'accepted', scheduled_start: '2026-11-18T12:00:00Z', scheduled_end: '2026-11-18T14:00:00Z' } : null } });
    }
    if (/\/opportunities\/\d+\/service-status$/.test(path)) {
      progressPosts++;
      records.find((row) => row.id === Number(path.split('/')[3])).status = route.request().postDataJSON().status;
      return route.fulfill({ json: { ok: true } });
    }
    const fixture = { '/api/users/profile': installer, '/api/auth/csrf': { csrf_token: 'qa-only' }, '/api/subscriptions': { plan: 'pro', plan_access: { is_pro: true, features: {}, limits: {}, usage: {} } }, '/api/notifications': [], '/api/schedules': [], '/api/users/reviews/summary': { review_count: 0 } };
    return route.fulfill({ json: fixture[path] || {} });
  });
  const waitLoaded = () => page.waitForFunction(() => document.querySelector('#opp-results')?.getAttribute('aria-busy') === 'false');
  const tab = (name) => page.getByRole('tab', { name: new RegExp(name) });
  const cards = () => page.locator('.opp-list').getByRole('button');
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  const contrast = (locator) => locator.evaluate((element) => {
    const css = getComputedStyle(element);
    const luminance = (color) => color.match(/[\d.]+/g).slice(0, 3).map((value) => { const c = Number(value) / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((total, c, index) => total + c * [.2126, .7152, .0722][index], 0);
    const colors = [luminance(css.color), luminance(css.backgroundColor)].sort((a, b) => b - a);
    return (colors[0] + .05) / (colors[1] + .05);
  });

  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto(origin + '/opportunities', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Oportunidades', exact: true }).waitFor();
  await waitLoaded();
  assert(await cards().count() === 12, 'Initial pagination');
  const blue = await page.getByRole('button', { name: 'Tenho interesse', exact: true }).evaluate((button) => getComputedStyle(button).backgroundColor);
  assert(blue === 'rgb(33, 124, 141)', 'Wrong light accent: ' + blue);
  assert(await page.getByRole('button', { name: 'Tenho interesse', exact: true }).evaluate((button) => getComputedStyle(button).color) === 'rgb(255, 255, 255)', 'Primary action text has low contrast');
  const primary = page.getByRole('button', { name: 'Tenho interesse', exact: true });
  assert(await contrast(primary) >= 4.5, 'Light primary contrast');
  await primary.hover();
  assert(await contrast(primary) >= 4.5, 'Light hover contrast');
  await page.mouse.move(0, 0);
  assert((await tab('Meus interesses').textContent()).includes('3'), 'Missing independent interest count');
  await page.screenshot({ path: 'output/qa/opportunities-new-desktop.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Carregar mais', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.opp-card').length === 13);
  assert(await cards().count() === 13, 'Append page without duplicate cards');

  await page.getByRole('searchbox', { name: 'Buscar por bairro ou serviço' }).fill('sao jose');
  await page.waitForFunction(() => document.querySelectorAll('.opp-card').length === 1 && document.querySelector('.opp-card').textContent.includes('São José'));
  await page.getByRole('searchbox').fill('zzzz-sem-pedido');
  await page.getByRole('heading', { name: 'Nenhum pedido com esses filtros.' }).waitFor();
  await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
  await waitLoaded();
  await page.getByRole('button', { name: /^Filtros/ }).click();
  await page.getByLabel('Somente pedidos com fotos').check();
  await page.waitForFunction(() => document.querySelectorAll('.opp-card').length === 3);
  await page.getByLabel('Local da instalação').selectOption('commercial');
  await page.waitForFunction(() => document.querySelectorAll('.opp-card').length === 1);
  await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
  await waitLoaded();
  await page.getByRole('button', { name: /^Filtros/ }).click();

  await tab('Meus interesses').click();
  await page.getByRole('heading', { name: 'Pedidos com seu interesse' }).waitFor();
  await waitLoaded();
  assert(await cards().count() === 3, 'Interest history');
  await page.screenshot({ path: 'output/qa/opportunities-interests.png', animations: 'disabled' });
  await cards().filter({ hasText: 'Histórico expirado' }).click();
  assert(await page.getByRole('button', { name: 'Tenho interesse', exact: true }).count() === 0, 'Expired request still actionable');
  await cards().filter({ hasText: 'Outro profissional' }).click();
  assert(await page.getByRole('link', { name: 'Chamar no WhatsApp' }).count() === 0, 'Contact exposed for another installer');

  await tab('Escolheram você').click();
  await waitLoaded();
  await cards().filter({ hasText: 'Cliente escolheu você' }).click();
  await page.getByRole('link', { name: 'Chamar no WhatsApp' }).waitFor();
  await page.getByRole('button', { name: 'Enviar proposta', exact: true }).click();
  await page.getByLabel('Valor total (R$)').fill('400');
  await page.getByLabel('O que está incluso').fill('Instalação fictícia para validar o formulário.');
  await page.screenshot({ path: 'output/qa/opportunities-proposal-form.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Enviar proposta', exact: true }).click();
  await page.getByText('Proposta enviada ao cliente.', { exact: true }).waitFor();
  assert(proposalPosts === 1, 'Proposal submit failed');
  await cards().filter({ hasText: 'Serviço concluído' }).click();
  await page.getByRole('button', { name: 'Ver proposta e serviço' }).click();
  await page.getByText('Este pedido está concluído.').waitFor();
  assert(await page.getByRole('button', { name: /^(Iniciar serviço|Concluir|Cancelar)$/ }).count() === 0, 'Completed service allowed mutation');
  await page.screenshot({ path: 'output/qa/opportunities-selected.png', animations: 'disabled' });
  await cards().filter({ hasText: 'Serviço agendado' }).click();
  await page.getByRole('button', { name: 'Ver proposta e serviço' }).click();
  await page.getByRole('button', { name: 'Iniciar serviço', exact: true }).click();
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await page.getByText('Este pedido está concluído.').waitFor();
  assert(progressPosts === 2, 'Scheduled -> in progress -> completed workflow failed');

  await tab('Novas').click();
  await waitLoaded();
  await page.getByRole('button', { name: 'Tenho interesse', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#opp-tab-interested')?.getAttribute('aria-selected') === 'true' && document.querySelector('#opp-results')?.getAttribute('aria-busy') === 'false');
  assert(interestPosts === 1, 'Interest duplicated or not sent');
  assert(await page.getByRole('link', { name: 'Reabrir WhatsApp' }).isVisible(), 'Interest missing WhatsApp recovery');
  const whatsApp = await page.evaluate(() => window.__qaWhatsApp);
  assert(whatsApp[0] === 'about:blank' && whatsApp.some((url) => url.startsWith('https://wa.me/')), 'Manual WhatsApp opening failed');
  assert((await tab('Novas').textContent()).includes('12') && (await tab('Meus interesses').textContent()).includes('4'), 'Counts were not updated');

  failNext = true;
  await tab('Novas').click();
  await page.getByRole('heading', { name: 'Não foi possível abrir os pedidos' }).waitFor();
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await waitLoaded();
  assert(await cards().count() === 12, 'Retry did not recover');
  delayNextOpen = true;
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await tab('Meus interesses').click();
  await waitLoaded();
  await page.waitForFunction(() => document.querySelectorAll('.opp-card').length === 4);
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 850)));
  assert(await cards().count() === 4 && await tab('Meus interesses').getAttribute('aria-selected') === 'true', 'Stale request overwrote active tab');

  await page.evaluate(() => { document.documentElement.dataset.siteTheme = 'dark'; });
  const reopen = page.getByRole('link', { name: 'Reabrir WhatsApp' });
  assert(await contrast(reopen) >= 4.5, 'Dark primary contrast');
  await reopen.hover();
  assert(await contrast(reopen) >= 4.5, 'Dark hover contrast');
  await page.mouse.move(0, 0);
  await page.screenshot({ path: 'output/qa/opportunities-dark-desktop.png', animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await noOverflow(), 'Mobile overflow');
  await cards().first().click();
  await page.getByRole('button', { name: 'Voltar aos pedidos' }).waitFor({ state: 'visible' });
  assert(await page.locator('.opp-browser-list').isHidden(), 'Mobile detail did not replace list');
  await page.screenshot({ path: 'output/qa/opportunities-mobile-dark.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Voltar aos pedidos' }).click();
  assert(await cards().first().isVisible(), 'Back to list failed');
  await page.evaluate(() => { document.documentElement.dataset.siteTheme = 'light'; });
  await page.screenshot({ path: 'output/qa/opportunities-mobile-light.png', animations: 'disabled' });
  await page.setViewportSize({ width: 320, height: 720 });
  assert(await noOverflow(), '320px overflow');
  await cards().first().click();
  assert(await noOverflow(), '320px detail overflow');
  await page.getByRole('button', { name: 'Voltar aos pedidos' }).click();
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.evaluate(() => { document.body.style.zoom = '2'; });
  assert(await noOverflow(), '200% zoom overflow');
  await page.evaluate(() => { document.body.style.zoom = ''; });
  eligibility = { can_express_interest: false, requirement_code: 'PROFILE_ESSENTIALS_REQUIRED', message: 'Complete os dados essenciais para enviar novos interesses.' };
  await tab('Novas').click();
  await waitLoaded();
  assert(await page.getByRole('button', { name: 'Tenho interesse', exact: true }).count() === 0, 'Missing profile allowed new interest');
  assert(await page.getByRole('link', { name: 'Revisar meu perfil', exact: true }).getAttribute('href') === '/profile', 'Profile recovery action missing');
  await tab('Meus interesses').click();
  await waitLoaded();
  assert(await page.getByRole('link', { name: 'Reabrir WhatsApp' }).isVisible(), 'Readiness blocked existing contact');
  records.length = 0;
  await tab('Novas').click();
  await page.getByRole('heading', { name: 'Nenhuma nova oportunidade por enquanto.' }).waitFor();
  await tab('Novas').focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('heading', { name: 'Você ainda não demonstrou interesse em um pedido.' }).waitFor();
  await page.keyboard.press('End');
  await page.getByRole('heading', { name: 'Nenhum cliente escolheu você por enquanto.' }).waitFor();
  assert(!errors.length, 'Browser errors: ' + errors.join('; '));
  return { result: 'PASS', interestPosts, proposalPosts, progressPosts, listRequests: requests.length, scenarios: ['3 tabs and counts', 'pagination', 'search and filters', 'expired and non-selected privacy', 'proposal form', 'scheduled/progress/completed service', 'manual WhatsApp', 'retry', 'stale request cancellation', 'desktop/mobile light/dark', '320px'] };
}
