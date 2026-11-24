const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET ||= 'auth-capabilities-test-secret-with-32-characters';

const authController = require('../controllers/authController');

test('expõe somente Google como provedor de login social', () => {
  const previousClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const previousClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  let payload;

  process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-client-id';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'google-client-secret';

  try {
    authController.getCapabilities({}, {
      json(value) {
        payload = value;
        return value;
      },
    });

    assert.deepEqual(payload.oauth, { google: true });
    assert.equal(Object.hasOwn(payload.oauth, 'apple'), false);
  } finally {
    if (previousClientId === undefined) delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    else process.env.GOOGLE_OAUTH_CLIENT_ID = previousClientId;

    if (previousClientSecret === undefined) delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    else process.env.GOOGLE_OAUTH_CLIENT_SECRET = previousClientSecret;
  }
});

const legacyOrigin = 'https://instalar-sigma.vercel.app';
const officialOrigin = 'https://instalarpro.com.br';

const previewOrigin = 'https://preview.example.test';

async function assertGoogleCancellation(t, platform, frontendUrl, returnOrigin) {
  const googleOrigin = frontendUrl === previewOrigin ? previewOrigin : officialOrigin;
  const googleCallback = `${googleOrigin}/api/auth/oauth/google/callback`;
  const previous = {
    FRONTEND_URL: process.env.FRONTEND_URL,
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_CALLBACK_URL: process.env.GOOGLE_OAUTH_CALLBACK_URL,
  };
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const redirects = [];
  const requestBase = {
    protocol: 'https',
    get(name) {
      if (name === 'host') return new URL(frontendUrl).host;
      return '';
    },
  };
  const response = {
    redirect(value) {
      redirects.push(value);
      return value;
    },
  };

  process.env.FRONTEND_URL = frontendUrl;
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-client-id';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'google-client-secret';
  process.env.GOOGLE_OAUTH_CALLBACK_URL = googleCallback;

  await authController.startOAuth({
    ...requestBase,
    params: { provider: 'google' },
    query: { role: 'installer', next: '/dashboard', platform },
  }, response);

  const authorizationUrl = new URL(redirects.at(-1));
  const state = authorizationUrl.searchParams.get('state');
  assert.ok(state);
  assert.equal(authorizationUrl.searchParams.get('redirect_uri'), googleCallback);

  await authController.handleOAuthCallback({
    ...requestBase,
    body: {},
    params: { provider: 'google' },
    query: { state, error: 'access_denied' },
  }, response);

  const callbackUrl = new URL(redirects.at(-1));
  assert.equal(callbackUrl.origin, returnOrigin);
  if (platform === 'web') {
    assert.equal(callbackUrl.pathname, '/instalador/entrar');
    assert.equal(callbackUrl.searchParams.get('oauth_error'), 'access_denied');
    assert.equal(callbackUrl.hash, '');
  } else {
    assert.equal(callbackUrl.pathname, '/auth/mobile/callback');
    assert.equal(callbackUrl.search, '');
    const hash = new URLSearchParams(callbackUrl.hash.slice(1));
    assert.equal(hash.get('oauth_error'), 'access_denied');
    assert.equal(hash.get('platform'), platform);
  }
}

for (const [platform, frontendUrl, returnOrigin] of [
  ['android', legacyOrigin, legacyOrigin],
  ['android', officialOrigin, legacyOrigin],
  ['android', 'https://www.instalarpro.com.br', legacyOrigin],
  ['android', previewOrigin, previewOrigin],
  ['ios', officialOrigin, officialOrigin],
  ['web', officialOrigin, officialOrigin],
]) {
  test(`devolve o cancelamento do Google para ${platform} em ${frontendUrl}`, (t) =>
    assertGoogleCancellation(t, platform, frontendUrl, returnOrigin));
}
