// Open the local frontend in Playwright CLI first. Account/API data is mocked.
async (page) => {
  const origin = new URL(page.url()).origin;
  const brandRoot = '/brand/instalarpro-2026/';
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let viewer = null;
  const installer = { id: 42, name: 'Perfil de teste', display_name: 'Perfil de teste', business_name: 'Perfil de teste', account_type: 'installer', email: 'brand@example.test', email_verified: true, city: 'Palhoça', state: 'SC', installation_gallery: [], phone: '48999999999' };
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/users/profile' && !viewer) return route.fulfill({ status: 401, json: { code: 'AUTH_REQUIRED' } });
    const fixtures = {
      '/api/auth/csrf': { csrf_token: 'brand-qa-only' },
      '/api/users/profile': viewer === 'client' ? { ...installer, account_type: 'client' } : installer,
      '/api/subscriptions': { plan: 'pro', plan_access: { is_pro: true, limits: {}, usage: {}, features: {} } },
      '/api/notifications': [], '/api/schedules': [], '/api/opportunities': { opportunities: [], stats: {} },
      '/api/users/reviews/summary': { review_count: 0 },
      '/api/public/installers/42': { installer, reviews: [] },
    };
    return route.fulfill({ status: 200, json: fixtures[path] || {} });
  });

  const checkImage = async (selector, file) => {
    await page.locator(selector).first().waitFor({ state: 'visible' });
    await page.waitForFunction(({ selector, file, brandRoot }) => {
      const img = document.querySelector(selector);
      return img?.complete && img.naturalWidth > 0 && new URL(img.currentSrc).pathname === brandRoot + file;
    }, { selector, file, brandRoot });
    const image = await page.locator(selector).first().evaluate((img) => ({
      alt: img.alt, width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height,
      naturalRatio: img.naturalWidth / img.naturalHeight, filter: getComputedStyle(img).filter, fit: getComputedStyle(img).objectFit,
    }));
    if (image.alt !== 'Logo InstalarPro' || image.width <= 0 || image.height <= 0 || (image.fit !== 'contain' && Math.abs(image.width / image.height - image.naturalRatio) > .03)) throw new Error('Distorted or unlabeled brand: ' + JSON.stringify(image));
    if (/brightness|invert|saturate|contrast/.test(image.filter)) throw new Error('Brand colors altered by CSS: ' + image.filter);
    return image;
  };
  const setTheme = (theme) => page.evaluate((theme) => {
    document.documentElement.dataset.siteTheme = theme;
    localStorage.setItem('instalar-site-preferences', JSON.stringify({ theme, themeVersion: 2 }));
  }, theme);
  const noOverflow = async () => { if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Horizontal overflow'); };

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
  await setTheme('light');
  await checkImage('.lp6-brand img', 'wordmark-dark.png');
  if (!(await page.title()).includes('InstalarPro')) throw new Error('Old page title');
  await page.screenshot({ path: 'output/qa/new-brand-home.png' });
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.locator('.lp6-header.is-scrolled').waitFor();
  await checkImage('.lp6-brand img', 'wordmark-light.png');
  await setTheme('dark');
  await checkImage('.lp6-brand img', 'wordmark-dark.png');

  for (const path of ['/cliente/entrar', '/instalador/entrar']) {
    await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
    await setTheme('light');
    await checkImage(path.startsWith('/cliente') ? '.client-login-brand-logo img' : '.installer-login-brand-logo img', 'logo-dark.png');
    if (path.startsWith('/instalador')) await page.waitForFunction(() => {
      const photo = document.querySelector('.installer-login-worker-photo');
      return photo?.complete && photo.naturalWidth > 0 && photo.getAttribute('src') === '/auth/installer-login-worker-instalarpro-2026.jpg';
    });
    await noOverflow();
    await page.screenshot({ path: `output/qa/new-brand-${path.startsWith('/cliente') ? 'client' : 'installer'}-login.png`, fullPage: true });
  }
  for (const path of ['/instalador/recuperar-senha', '/cliente/recuperar-senha', '/privacidade', '/termos', '/excluir-conta']) {
    await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
    await setTheme('light');
    const selector = '.brand-wordmark-image';
    await page.locator(selector).first().waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.brand-wordmark-image')].some(img => img.complete && img.naturalWidth > 0));
    const old = await page.locator(selector).evaluateAll(imgs => imgs.some(img => !img.getAttribute('src').includes('/instalarpro-2026/')));
    if (old) throw new Error('Legacy logo remains on ' + path);
  }
  await page.goto(origin + '/installers/42', { waitUntil: 'domcontentloaded' });
  await checkImage('.ig-profile-brand img', 'wordmark-light.png');

  viewer = 'installer';
  await page.goto(origin + '/settings', { waitUntil: 'domcontentloaded' });
  await checkImage('.ref-panel-sidebar .brand-wordmark-image', 'wordmark-light.png');
  await setTheme('dark');
  await checkImage('.ref-panel-sidebar .brand-wordmark-image', 'wordmark-dark.png');
  await page.getByRole('button', { name: 'Recolher menu', exact: true }).click();
  await checkImage('.ref-panel-collapsed-logo img', 'mark-dark.png');
  await page.getByRole('button', { name: 'Expandir menu', exact: true }).click();
  await page.screenshot({ path: 'output/qa/new-brand-panel-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await checkImage('.ref-panel-mobile-wordmark img', 'wordmark-dark.png');
  await noOverflow();
  await page.screenshot({ path: 'output/qa/new-brand-mobile-dark.png', fullPage: true });
  await setTheme('light');
  await checkImage('.ref-panel-mobile-wordmark img', 'wordmark-light.png');
  await page.screenshot({ path: 'output/qa/new-brand-mobile-light.png', fullPage: true });

  viewer = 'client';
  await page.goto(origin + '/cliente', { waitUntil: 'domcontentloaded' });
  await checkImage('.request-brand-wordmark img', 'wordmark-light.png');
  const manifestResponse = await page.request.get(origin + '/manifest.webmanifest');
  const manifest = await manifestResponse.json();
  if (manifest.short_name !== 'InstalarPro') throw new Error('Old installed site name');
  for (const icon of manifest.icons) {
    const response = await page.request.get(origin + icon.src);
    if (!response.ok()) throw new Error('Missing icon ' + icon.src);
  }
  if (errors.length) throw new Error('Browser runtime errors: ' + errors.join('; '));
  const result = { result: 'PASS', tested: ['landing and scroll', 'client/installer login', 'recovery and legal pages', 'public profile', 'panel and collapsed mark', 'mobile light/dark', 'request wizard', 'manifest and icons'] };
  await page.evaluate((result) => { document.documentElement.dataset.brandQa = JSON.stringify(result); }, result);
  return result;
}
