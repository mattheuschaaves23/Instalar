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
