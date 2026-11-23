const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

// Origem fixa do WebView do Capacitor: Android usa https://localhost
// (androidScheme https) e iOS usa capacitor://localhost (o WKWebView não aceita
// https como esquema local). Sem a origem do iOS liberada, o app do iPhone não
// consegue nem fazer login na API de produção.
function preflight(origins, extraEnv = {}) {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    JWT_SECRET: 'qa-cors-mobile-with-more-than-thirty-two-characters',
    FRONTEND_URL: 'https://instalapro.example',
    APP_URL: '',
    MOBILE_APP_ORIGINS: '',
    ...extraEnv,
  };
  const output = execFileSync(process.execPath, [path.join(__dirname, 'fixtures/corsPreflight.cjs'), ...origins], {
    env, encoding: 'utf8', timeout: 15000,
  });
  const line = output.split('\n').find((item) => item.startsWith('CORS='));
  return JSON.parse(line.slice(5));
}

test('produção aceita a origem do app Android e do app iOS sem configuração extra', () => {
  const result = preflight(['https://localhost', 'capacitor://localhost', 'https://instalapro.example']);
  assert.equal(result['https://localhost'].allowOrigin, 'https://localhost');
  assert.equal(result['capacitor://localhost'].allowOrigin, 'capacitor://localhost');
  assert.equal(result['https://instalapro.example'].allowOrigin, 'https://instalapro.example');
});

// O app passa a rodar em https://app.instalarpro.com.br (server.hostname do
// Capacitor) para o widget Turnstile do site valer no app sem liberar
// localhost. A origem que o capacitor.config.json gera tem de passar no CORS,
// senão o app novo nem faz login. localhost segue aceito pelo APK 1.0.35.
test('produção aceita a origem do WebView configurada no capacitor.config.json', () => {
  const config = require('../../frontend/capacitor.config.json');
  const hostname = config.server?.hostname || 'localhost';
  assert.notEqual(hostname, 'localhost', 'o app deve rodar no subdomínio próprio, não em localhost');
  const androidOrigin = `${config.server?.androidScheme || 'http'}://${hostname}`;
  const iosOrigin = `${config.server?.iosScheme || 'capacitor'}://${hostname}`;
  const result = preflight([androidOrigin, iosOrigin]);
  assert.equal(result[androidOrigin].allowOrigin, androidOrigin);
  assert.equal(result[iosOrigin].allowOrigin, iosOrigin);
});

test('produção continua recusando origem desconhecida e localhost de desenvolvimento', () => {
  const result = preflight(['https://site-estranho.example', 'http://localhost:3000', 'capacitor://outro-host']);
  for (const origin of Object.keys(result)) {
    assert.equal(result[origin].allowOrigin, null, origin);
    assert.equal(result[origin].status, 403, origin);
  }
});
