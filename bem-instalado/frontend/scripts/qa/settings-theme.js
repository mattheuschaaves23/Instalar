// Open the local frontend in Playwright CLI (defaults to 127.0.0.1:3000), then run from the repository root:
// playwright-cli run-code --filename=bem-instalado/frontend/scripts/qa/settings-theme.js
// API responses are local fixtures: no real login, account changes or backend needed.
async (page) => {
  const target = new URL(page.url());
  const origin = target.protocol === 'http:' && target.hostname === '127.0.0.1'
    ? target.origin
    : 'http://127.0.0.1:3000';
  const user = {
    id: 999999,
    name: 'Teste visual',
    email: 'visual@example.test',
    account_type: 'installer',
    email_verified: true,
    email_verified_at: '2026-01-01T00:00:00Z',
    is_admin: false,
  };
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const fixtures = {
      '/api/auth/csrf': { csrf_token: 'visual-test-only' },
      '/api/users/profile': user,
      '/api/subscriptions': { plan: 'pro', plan_access: { is_pro: true, limits: {}, usage: {}, remaining: {}, features: {} } },
      '/api/notifications': [],
      '/api/schedules': [],
      '/api/users/reviews/summary': { review_count: 0 },
      '/api/opportunities': { opportunities: [], stats: { open: 0 } },
    };
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' },
      body: JSON.stringify(fixtures[path] || {}),
    });
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(`${origin}/settings`);
  const settings = page.locator('.settings-page');
  await settings.getByRole('heading', { name: 'Organização visual' }).waitFor();
  if (await settings.getByRole('heading', { name: 'Atalhos úteis' }).count()) throw new Error('Removed shortcuts card is still visible');
  const fillsSettingsWidth = await settings.locator('.settings-layout').evaluate((layout) => (
    [...layout.children].every((panel) => Math.abs(panel.getBoundingClientRect().width - layout.clientWidth) <= 1)
  ));
  if (!fillsSettingsWidth) throw new Error('The removed shortcuts card left an unused column');
  for (const to of ['/profile', '/subscription', '/notifications', '/support']) {
    await page.locator(`.ref-panel-sidebar a[href="${to}"]`).waitFor({ state: 'visible' });
  }
  const theme = page.getByRole('group', { name: 'Fundo', exact: true });
  await theme.getByRole('button', { name: 'Preto', exact: false }).click();
  await page.waitForFunction(() => document.documentElement.dataset.siteTheme === 'dark');
  await page.getByRole('button', { name: 'Compacta', exact: false }).waitFor();

  const readColors = () => page.locator('.settings-segment').evaluateAll((rows) => rows.map((row) => {
    const style = getComputedStyle(row);
    return { group: row.getAttribute('aria-label'), background: style.backgroundColor, border: style.borderTopColor };
  }));
  const assertDarkRows = async () => {
    const rows = await readColors();
    if (rows.length !== 3) throw new Error(`Expected 3 preference groups, got ${rows.length}`);
    for (const row of rows) {
      for (const property of ['background', 'border']) {
        const channels = row[property].match(/[\d.]+/g)?.map(Number);
        if (!channels || channels.length < 3 || channels.slice(0, 3).some((channel) => channel > 100)
          || (channels.length === 4 && channels[3] !== 1)) {
          throw new Error(`Dark theme: ${row.group} has a light or transparent ${property}: ${row[property]}`);
        }
      }
    }
    return rows;
  };

  await page.locator('.settings-panel').first().screenshot({ path: 'output/qa/settings-theme-desktop.png' });
  const darkDesktop = await assertDarkRows();
  for (const [group, label] of [['Espaçamento', 'Compacta'], ['Animações', 'Reduzidas']]) {
    const button = page.getByRole('group', { name: group, exact: true }).getByRole('button', { name: label, exact: false });
    await button.click();
    if (!(await button.getAttribute('class')).includes('is-selected')) throw new Error(`${label} did not become selected`);
  }
  await theme.getByRole('button', { name: 'Branco', exact: false }).focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.documentElement.dataset.siteTheme === 'light');
  // The page theme attribute changes before the CSS color transition finishes.
  await page.waitForFunction(() => {
    const rows = [...document.querySelectorAll('.settings-segment')];
    return rows.length === 3 && rows.every((row) => getComputedStyle(row).backgroundColor === 'rgb(255, 255, 255)');
  }, undefined, { timeout: 2500 });
  const lightRows = await readColors();
  if (lightRows.some((row) => row.background !== 'rgb(255, 255, 255)')) throw new Error('Light theme preference rows changed');
  await page.locator('.settings-panel').first().screenshot({ path: 'output/qa/settings-theme-light.png' });

  await theme.getByRole('button', { name: 'Preto', exact: false }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await assertDarkRows();
  await page.locator('.settings-panel').first().screenshot({ path: 'output/qa/settings-theme-mobile.png' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) throw new Error('Settings overflow the mobile viewport');
  await page.reload();
  await page.getByRole('group', { name: 'Fundo', exact: true }).waitFor();
  if (await page.locator('html').getAttribute('data-site-theme') !== 'dark') throw new Error('Dark theme not preserved after reload');
  await assertDarkRows();
  return { result: 'PASS', darkDesktop, lightRows, mobile: '390px, no horizontal overflow', themeSwitchingAndReload: 'PASS' };
}
