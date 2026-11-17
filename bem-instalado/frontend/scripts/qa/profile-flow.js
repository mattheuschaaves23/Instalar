// Frontend running on 127.0.0.1:3000. Run from the repository root via Playwright CLI.
// All APIs are intercepted; no real customer/account data or production writes.
async (page) => {
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(12000);
  await page.unrouteAll({ behavior: 'wait' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => { void dialog.accept().catch(() => {}); });
  let failSave = false;
  let failLoad = false;
  let allowSessionLoad = 0;
  let clientViewer = false;
  let withPhoto = false;
  const writes = [];
  const profile = {
    id: 420042, name: 'João Instalador', business_name: 'João Papel de Parede', account_type: 'installer',
    email: 'visual@example.test', email_verified: true, email_verified_at: '2026-01-01T00:00:00Z',
    phone: '48999999999', city: 'Palhoça', state: 'SC', public_profile: false,
    bio: 'Instalação cuidadosa de papel de parede, do preparo ao acabamento.', installation_gallery: [],
    installation_days: ['monday', 'tuesday'], document_id: '12345678900', emergency_contact: 'CONTATO PRIVADO',
    emergency_phone: '48988888888', monthly_goal: 5000, provides_warranty: true, warranty_days: 90,
    service_radius_km: 80, accepts_service_contract: true,
  };
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:3000', 'Access-Control-Allow-Credentials': 'true' };
    if (path === '/api/users/profile' && route.request().method() === 'PUT') {
      const body = route.request().postDataJSON();
      writes.push(body);
      if (failSave) return route.fulfill({ status: 500, json: { error: 'Falha simulada ao salvar' }, headers });
      Object.assign(profile, body);
      return route.fulfill({ status: 200, json: profile, headers });
    }
    if (path === '/api/users/profile' && failLoad) {
      if (allowSessionLoad > 0) allowSessionLoad -= 1;
      else return route.fulfill({ status: 503, json: { error: 'Falha simulada ao carregar' }, headers });
    }
    const fixtures = {
      '/api/auth/csrf': { csrf_token: 'visual-only' }, '/api/auth/resend-verification': { success: true },
      '/api/users/profile': clientViewer ? { id: 11, name: 'Cliente QA', account_type: 'client', email_verified: true } : profile,
      '/api/subscriptions': { plan: 'free', plan_access: { is_pro: false, limits: { portfolio_photos: 3, availability_slots: 3 }, usage: {}, features: {} } },
      '/api/users/availability': { slots: [] }, '/api/users/reviews-dashboard': { summary: { review_count: 0, average_rating: 0 }, reviews: [] },
      '/api/users/reviews/summary': { review_count: 0, average_rating: 0 },
      '/api/notifications': [], '/api/schedules': [], '/api/opportunities': { opportunities: [], stats: {} },
    };
    if (path === '/api/public/installers/420042') return route.fulfill({ status: 200, json: {
      installer: { id: profile.id, name: profile.name, display_name: profile.business_name, city: profile.city, state: profile.state, bio: profile.bio,
        service_hours: profile.service_hours, installer_photo: withPhoto ? '/api/public/assets/profile-test.svg' : '', installation_gallery: [], unique_clients_served: 8, safety: { provides_warranty: true, warranty_days: 90 } }, reviews: [],
    }, headers });
    if (path === '/api/public/assets/profile-test.svg') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>', headers });
    return route.fulfill({ status: 200, json: fixtures[path] || {}, headers });
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:3000/profile');
  await page.evaluate(() => localStorage.removeItem('instalapro:profile-edit-tutorial:v1:420042'));
  await page.evaluate(async () => {
    const { saveSitePreferences, readSitePreferences } = await import('/src/utils/sitePreferences.jsx');
    saveSitePreferences({ ...readSitePreferences(), theme: 'light' });
  });
  await page.getByRole('heading', { name: 'João Papel de Parede', exact: true }).waitFor({ timeout: 10000 });
  if (await page.locator('input[name=name]').isVisible()) throw new Error('Profile opened as a form instead of the public-style presentation');
  await page.getByRole('link', { name: 'Editar perfil', exact: true }).first().waitFor();
  const content = await page.locator('.profile-owner-page').innerText();
  for (const privateValue of ['visual@example.test', '12345678900', 'CONTATO PRIVADO', '48988888888', '48999999999']) {
    if (content.includes(privateValue)) throw new Error(`Private value exposed in presentation: ${privateValue}`);
  }
  await page.getByText('Pronto para aceitar pedidos', { exact: true }).waitFor();
  await page.locator('.ig-profile-stats').getByText('8', { exact: true }).waitFor();
  await page.screenshot({ path: 'output/qa/profile-owner-desktop-light.png', fullPage: true });
  await page.getByRole('link', { name: 'Editar perfil', exact: true }).first().click();
  const tutorial = page.getByRole('dialog', { name: 'Comece pelo essencial', exact: true });
  await tutorial.waitFor();
  await page.waitForFunction(() => document.activeElement?.id === 'profile-tutorial-title');
  await page.keyboard.press('Shift+Tab');
  if (!(await page.getByRole('button', { name: 'Próximo', exact: true }).evaluate((element) => element === document.activeElement))) throw new Error('Tutorial does not trap keyboard focus');
  await page.screenshot({ path: 'output/qa/profile-tutorial.png' });
  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  await page.getByRole('heading', { name: 'Mostre seu trabalho', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  await page.getByRole('heading', { name: 'Organize seu atendimento', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Começar a editar', exact: true }).click();
  await page.locator('input[name=name]').fill('João Atualizado');
  await page.getByRole('button', { name: 'Salvar e continuar', exact: true }).click();
  await page.locator('textarea[name=bio]').waitFor({ state: 'visible' });
  if (Object.keys(writes[0]).sort().join(',') !== 'city,name,phone,state') throw new Error('Essential save changed unrelated fields');
  await page.locator('textarea[name=bio]').fill('Nova apresentação salva pelo instalador.');
  await page.getByRole('button', { name: 'Salvar e ver perfil', exact: true }).click();
  await page.getByText('Nova apresentação salva pelo instalador.', { exact: true }).waitFor();

  await page.getByRole('link', { name: 'Editar perfil', exact: true }).first().click();
  if (await page.getByRole('dialog').count()) throw new Error('Tutorial repeated after completion');
  if (await page.locator('input[name=name]').inputValue() !== 'João Atualizado') throw new Error('Saved name lost');
  await page.locator('input[name=city]').fill('São José');
  await page.getByRole('button', { name: 'Salvar e continuar', exact: true }).click();
  await page.locator('textarea[name=bio]').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByText('São José · SC', { exact: true }).first().waitFor({ timeout: 4000 });
  await page.getByRole('link', { name: 'Editar perfil', exact: true }).first().click();
  await page.locator('input[name=name]').fill('Rascunho do botão Voltar');
  await page.getByText('Alterações não salvas', { exact: true }).waitFor();
  await page.evaluate(() => history.back());
  await page.getByRole('button', { name: 'Continuar editando', exact: true }).click({ timeout: 4000 }).catch(() => { throw new Error('No discard dialog for first Browser Back'); });
  await page.waitForURL('**/profile?editar=1');
  await page.locator('input[name=name]').waitFor({ state: 'visible' });
  if (await page.locator('input[name=name]').inputValue() !== 'Rascunho do botão Voltar') throw new Error('Browser Back lost the unsaved draft');
  await page.evaluate(() => history.back());
  await page.getByRole('button', { name: 'Continuar editando', exact: true }).click({ timeout: 4000 }).catch(() => { throw new Error('No discard dialog for second Browser Back'); });
  await page.waitForURL('**/profile?editar=1');
  await page.locator('input[name=name]').waitFor({ state: 'visible' });
  if (await page.locator('input[name=name]').inputValue() !== 'Rascunho do botão Voltar') throw new Error('Second Browser Back lost the unsaved draft');
  await page.locator('input[name=name]').fill('NÃO SALVAR');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar editando', exact: true }).click();
  if (await page.locator('input[name=name]').inputValue() !== 'NÃO SALVAR') throw new Error('Cancel dialog lost unsaved draft');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  await page.getByRole('link', { name: 'Editar perfil', exact: true }).first().click();
  if (await page.locator('input[name=name]').inputValue() !== 'João Atualizado') throw new Error('Discard saved unwanted changes');

  failSave = true;
  await page.locator('input[name=name]').fill('Rascunho preservado');
  await page.getByRole('button', { name: 'Salvar e ver perfil', exact: true }).click();
  await page.getByText('Falha simulada ao salvar', { exact: true }).waitFor();
  if (await page.locator('input[name=name]').inputValue() !== 'Rascunho preservado') throw new Error('Failed save lost draft');
  failSave = false;
  await page.getByRole('button', { name: 'Salvar e ver perfil', exact: true }).click();
  await page.getByRole('link', { name: 'Editar perfil', exact: true }).first().click();
  await page.getByRole('button', { name: 'Ver tutorial', exact: true }).click();
  await page.getByRole('button', { name: 'Pular tutorial', exact: true }).click();
  await page.getByRole('navigation', { name: 'Etapas de edição' }).getByRole('button', { name: '3 Atendimento', exact: false }).click();
  await page.locator('input[name=service_hours]').fill('Segunda a sexta, 8h às 18h');
  await page.locator('input[name=travel_fee]').fill('12.50');
  await page.getByRole('button', { name: 'Salvar e ver perfil', exact: true }).click();
  await page.getByRole('link', { name: 'Editar perfil', exact: true }).first().waitFor();
  if (Number(writes.at(-1).travel_fee) !== 12.5) throw new Error('Attendance editor did not save decimal prices');
  await page.getByRole('tab', { name: 'Informações', exact: true }).click();
  await page.getByRole('tabpanel', { name: 'Informações', exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Agenda', exact: true }).click();
  await page.getByRole('tabpanel', { name: 'Agenda', exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Avaliações', exact: true }).click();
  await page.getByRole('tabpanel', { name: 'Avaliações', exact: true }).waitFor();

  await page.evaluate(async () => {
    const { saveSitePreferences, readSitePreferences } = await import('/src/utils/sitePreferences.jsx');
    saveSitePreferences({ ...readSitePreferences(), theme: 'dark' });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: 'Projetos', exact: true }).click();
  await page.getByText('Falha simulada ao salvar', { exact: true }).waitFor({ state: 'hidden' });
  await page.screenshot({ path: 'output/qa/profile-owner-mobile-dark.png', fullPage: true });
  await page.getByRole('link', { name: 'Editar perfil', exact: true }).first().click();
  await page.locator('input[name=name]').waitFor({ state: 'visible' });
  await page.screenshot({ path: 'output/qa/profile-editor-mobile-dark.png', fullPage: true });
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error('Mobile editor overflows');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();

  await page.waitForURL('**/profile');
  profile.email_verified = false; profile.email_verified_at = null; profile.phone = '';
  await page.reload();
  await page.getByText('Falta pouco para aceitar pedidos', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Completar dados', exact: true }).click();
  if (!(await page.getByRole('button', { name: 'Salvar e ver perfil', exact: true }).isDisabled())) throw new Error('Unverified email save not explained/disabled');
  await page.locator('input[name=phone]').fill('48999991234');
  const resend = page.waitForResponse((response) => response.url().endsWith('/api/auth/resend-verification'));
  await page.getByRole('button', { name: 'Reenviar link', exact: true }).click();
  await resend;
  await page.getByText('Enviamos um novo link para seu e-mail.', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('input[name=phone]')?.value === '48999991234');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  await page.waitForURL('**/profile');
  profile.email_verified = true; profile.email_verified_at = '2026-01-01T00:00:00Z'; profile.phone = '48999999999';
  failLoad = true; allowSessionLoad = 1;
  await page.reload();
  await page.getByRole('heading', { name: 'Seu perfil não carregou' }).waitFor();
  if (await page.locator('input[name=name]').count()) throw new Error('Failed load displayed an empty form');
  failLoad = false;
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await page.getByRole('heading', { name: 'João Papel de Parede', exact: true }).waitFor();
  await page.goto('http://127.0.0.1:3000/installers/420042');
  await page.getByRole('link', { name: 'Editar perfil', exact: true }).last().click();
  await page.locator('input[name=name]').fill('Rascunho ao sair da rota');
  await page.getByText('Alterações não salvas', { exact: true }).waitFor();
  await page.evaluate(() => history.back());
  await page.waitForURL('**/installers/420042');
  await page.getByRole('link', { name: 'Editar perfil', exact: true }).last().click();
  if (await page.locator('input[name=name]').inputValue() !== 'Rascunho ao sair da rota') throw new Error('SPA unmount lost the unsaved draft');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  await page.waitForURL('**/profile');
  withPhoto = true;
  await page.reload();
  await page.waitForFunction(() => {
    const image = document.querySelector('.ig-profile-avatar img');
    return image?.src === 'http://127.0.0.1:5000/api/public/assets/profile-test.svg' && image.naturalWidth > 0;
  });
  clientViewer = true;
  await page.goto('http://127.0.0.1:3000/installers/420042');
  await page.getByRole('heading', { name: 'João Papel de Parede', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Solicitar orçamento', exact: true }).first().waitFor({ state: 'attached' });
  if (await page.getByRole('link', { name: 'Editar perfil', exact: true }).count()) throw new Error('Public viewers can see the edit action');
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  const result = { result: 'PASS', tested: ['owner presentation/privacy', 'first-time tutorial/focus/replay', '3 edit steps', 'save/cancel/failure', 'draft across routes and email resend', 'saved-data requirements', 'mobile dark theme', 'cross-origin photo', 'public client profile'], writes: writes.length };
  await page.evaluate((result) => { document.documentElement.dataset.profileQaResult = JSON.stringify(result); }, result);
  return result;
}
