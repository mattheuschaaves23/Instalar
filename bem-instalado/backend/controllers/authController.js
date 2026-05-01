const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { jwtSecret, jwtExpiresIn } = require('../config/auth');
const { generateSecret, verifyToken, generateQrCode } = require('../utils/totp');
const { logAudit } = require('../utils/auditLog');

const REGISTER_PLAN_PRICE = Number(process.env.SUBSCRIPTION_PRICE || 40);
const PASSWORD_RESET_EXPIRATION_MINUTES = Number(process.env.PASSWORD_RESET_EXPIRATION_MINUTES || 30);
const PASSWORD_RESET_EXPOSE_TOKEN = process.env.PASSWORD_RESET_EXPOSE_TOKEN === 'true';
const OWNER_ADMIN_EMAILS = new Set(
  [
    'matheuschavesminadasilva@gmail.com',
    ...String(process.env.OWNER_ADMIN_EMAILS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  ].map((value) => String(value || '').trim().toLowerCase())
);

const OAUTH_STATE_EXPIRES_IN = '10m';
const OAUTH_APPLE_AUDIENCE = 'https://appleid.apple.com';
const OAUTH_APPLE_ISSUER = 'https://appleid.apple.com';
const OAUTH_ALLOWED_ROLES = new Set(['installer', 'client']);

function signToken(id) {
  return jwt.sign({ id }, jwtSecret, { expiresIn: jwtExpiresIn });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isOwnerAdminEmail(email) {
  return OWNER_ADMIN_EMAILS.has(normalizeEmail(email));
}

function firstEnvValue(...names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) {
      return value;
    }
  }

  return '';
}

function normalizeBaseUrl(rawUrl) {
  const value = String(rawUrl || '').split(',')[0].trim();

  if (!value) {
    return '';
  }

  return value.replace(/\/+$/, '');
}

function getBackendBaseUrl(req) {
  const configured = normalizeBaseUrl(process.env.APP_URL || process.env.BACKEND_URL);

  if (configured) {
    return configured;
  }

  return `${req.protocol}://${req.get('host')}`;
}

function getFrontendBaseUrl(req) {
  return normalizeBaseUrl(process.env.FRONTEND_URL || process.env.APP_URL) || getBackendBaseUrl(req);
}

function getOAuthCallbackUrl(req, provider) {
  const providerKey = String(provider || '').toUpperCase();
  const configured = firstEnvValue(
    `${providerKey}_OAUTH_CALLBACK_URL`,
    `${providerKey}_CALLBACK_URL`,
    provider === 'apple' ? 'APPLE_REDIRECT_URI' : 'GOOGLE_REDIRECT_URI'
  );

  if (configured) {
    return configured;
  }

  return `${getBackendBaseUrl(req)}/api/auth/oauth/${provider}/callback`;
}

function normalizeOAuthRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return OAUTH_ALLOWED_ROLES.has(role) ? role : 'installer';
}

function getDefaultNextPath(role) {
  return role === 'client' ? '/cliente' : '/dashboard';
}

function sanitizeNextPath(value, role = 'installer') {
  const fallback = getDefaultNextPath(role);
  const nextPath = String(value || '').trim();

  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return fallback;
  }

  return nextPath;
}

function redirectOAuthResult(req, res, { token, next, role, error }) {
  const frontendUrl = getFrontendBaseUrl(req);

  if (token) {
    const hash = new URLSearchParams({
      token,
      next: sanitizeNextPath(next, role),
    });

    return res.redirect(`${frontendUrl}/auth/social/callback#${hash.toString()}`);
  }

  const loginPath = role === 'client' ? '/cliente/entrar' : '/instalador/entrar';
  const query = new URLSearchParams({
    oauth_error: error || 'oauth_failed',
  });

  return res.redirect(`${frontendUrl}${loginPath}?${query.toString()}`);
}

function normalizeProvider(provider) {
  const value = String(provider || '').trim().toLowerCase();
  return ['google', 'apple'].includes(value) ? value : '';
}

function signOAuthState(payload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: OAUTH_STATE_EXPIRES_IN });
}

function verifyOAuthState(state) {
  return jwt.verify(String(state || ''), jwtSecret);
}

function parseBoolean(value) {
  return value === true || value === 'true' || value === '1';
}

function getApplePrivateKey() {
  const rawPrivateKey = firstEnvValue('APPLE_PRIVATE_KEY');

  if (rawPrivateKey) {
    return rawPrivateKey.replace(/\\n/g, '\n');
  }

  const base64PrivateKey = firstEnvValue('APPLE_PRIVATE_KEY_BASE64');

  if (base64PrivateKey) {
    return Buffer.from(base64PrivateKey, 'base64').toString('utf8');
  }

  return '';
}

function getAppleConfig() {
  return {
    serviceId: firstEnvValue('APPLE_SERVICE_ID', 'APPLE_CLIENT_ID'),
    teamId: firstEnvValue('APPLE_TEAM_ID'),
    keyId: firstEnvValue('APPLE_KEY_ID'),
    privateKey: getApplePrivateKey(),
  };
}

function hasAppleConfig() {
  const config = getAppleConfig();
  return Boolean(config.serviceId && config.teamId && config.keyId && config.privateKey);
}

function hasGoogleConfig() {
  return Boolean(firstEnvValue('GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_CLIENT_ID') && firstEnvValue('GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET'));
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    business_name: user.business_name,
    logo: user.logo,
    city: user.city,
    state: user.state,
    service_region: user.service_region,
    public_profile: user.public_profile,
    installation_days: user.installation_days || [],
    default_price_per_roll: user.default_price_per_roll,
    default_removal_price: user.default_removal_price,
    is_admin: Boolean(user.is_admin),
    two_factor_enabled: Boolean(user.two_factor_enabled),
  };
}

async function fetchSanitizedUserById(userId) {
  const { rows } = await pool.query(
    `
      SELECT
        id,
        name,
        email,
        phone,
        business_name,
        logo,
        city,
        state,
        service_region,
        public_profile,
        COALESCE(installation_days, ARRAY[]::TEXT[]) AS installation_days,
        default_price_per_roll,
        default_removal_price,
        is_admin,
        two_factor_enabled
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

async function ensureUserSubscription(userId) {
  await pool.query(
    `
      INSERT INTO subscriptions (user_id, plan, status)
      SELECT $1, 'monthly', 'inactive'
      WHERE NOT EXISTS (
        SELECT 1
        FROM subscriptions
        WHERE user_id = $1
      )
    `,
    [userId]
  );
}

async function findOrCreateOAuthUser(profile, provider, role, req) {
  const normalizedEmail = normalizeEmail(profile.email);

  if (!normalizedEmail) {
    throw new Error('oauth_email_missing');
  }

  if (profile.emailVerified === false) {
    throw new Error('oauth_email_unverified');
  }

  const providerSubject = String(profile.providerId || '').trim();

  if (!providerSubject) {
    throw new Error('oauth_subject_missing');
  }

  const existingUserResult = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [normalizedEmail]);
  let user = existingUserResult.rows[0];
  const shouldGrantOwnerAdmin = isOwnerAdminEmail(normalizedEmail);

  if (user) {
    const updatedUser = await pool.query(
      `
        UPDATE users
        SET
          auth_provider = $2,
          auth_provider_id = $3,
          email_verified_at = COALESCE(email_verified_at, NOW()),
          last_login_at = NOW(),
          is_admin = CASE WHEN $4 THEN TRUE ELSE is_admin END,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [user.id, provider, providerSubject, shouldGrantOwnerAdmin]
    );
    user = updatedUser.rows[0] || user;
  } else {
    const generatedPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const displayName = String(profile.name || normalizedEmail.split('@')[0] || 'Usuario').trim().slice(0, 100);

    const createdUser = await pool.query(
      `
        INSERT INTO users (
          name,
          email,
          password,
          auth_provider,
          auth_provider_id,
          email_verified_at,
          last_login_at,
          is_admin
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6)
        RETURNING *
      `,
      [displayName, normalizedEmail, generatedPassword, provider, providerSubject, shouldGrantOwnerAdmin]
    );
    user = createdUser.rows[0];
  }

  await ensureUserSubscription(user.id);

  await logAudit({
    actorUserId: user.id,
    action: 'auth.oauth_login_success',
    entityType: 'user',
    entityId: user.id,
    metadata: {
      email: user.email,
      provider,
      role,
    },
    req,
  });

  return fetchSanitizedUserById(user.id);
}

function buildPasswordResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, business_name } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);

    if (existingUser.rowCount > 0) {
      await logAudit({
        actorUserId: null,
        action: 'auth.register_denied_duplicate_email',
        entityType: 'user',
        entityId: normalizedEmail,
        metadata: { email: normalizedEmail },
        req,
      });

      return res.status(409).json({ error: 'E-mail já cadastrado.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const shouldGrantOwnerAdmin = isOwnerAdminEmail(normalizedEmail);

    const { rows } = await pool.query(
      `
        INSERT INTO users (name, email, password, phone, business_name, is_admin)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          id,
          name,
          email,
          phone,
          business_name,
          logo,
          city,
          state,
          service_region,
          public_profile,
          COALESCE(installation_days, ARRAY[]::TEXT[]) AS installation_days,
          default_price_per_roll,
          default_removal_price,
          is_admin,
          two_factor_enabled
      `,
      [name, normalizedEmail, passwordHash, phone || null, business_name || null, shouldGrantOwnerAdmin]
    );

    const user = rows[0];

    await pool.query(
      `
        INSERT INTO subscriptions (user_id, plan, status)
        VALUES ($1, 'monthly', 'inactive')
      `,
      [user.id]
    );

    await logAudit({
      actorUserId: user.id,
      action: 'auth.register_success',
      entityType: 'user',
      entityId: user.id,
      metadata: {
        email: user.email,
        isAdmin: Boolean(user.is_admin),
      },
      req,
    });

    return res.status(201).json({
      user: sanitizeUser(user),
      token: signToken(user.id),
      onboarding: {
        subscription_price: REGISTER_PLAN_PRICE,
        currency: 'BRL',
        period: 'mensal',
      },
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao registrar usuário.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, twoFactorToken } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const { rows } = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
    let user = rows[0];

    if (!user) {
      await logAudit({
        actorUserId: null,
        action: 'auth.login_failed_user_not_found',
        entityType: 'user',
        entityId: normalizedEmail,
        metadata: { email: normalizedEmail },
        req,
      });
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const validPassword = await bcrypt.compare(password || '', user.password);

    if (!validPassword) {
      await logAudit({
        actorUserId: user.id,
        action: 'auth.login_failed_invalid_password',
        entityType: 'user',
        entityId: user.id,
        metadata: { email: user.email },
        req,
      });
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    if (!user.is_admin && isOwnerAdminEmail(user.email)) {
      const elevatedUser = await pool.query(
        `
          UPDATE users
          SET is_admin = TRUE
          WHERE id = $1
          RETURNING *
        `,
        [user.id]
      );
      user = elevatedUser.rows[0] || { ...user, is_admin: true };
    }

    if (user.two_factor_enabled) {
      if (!twoFactorToken) {
        await logAudit({
          actorUserId: user.id,
          action: 'auth.login_requires_2fa',
          entityType: 'user',
          entityId: user.id,
          metadata: { email: user.email },
          req,
        });
        return res.status(401).json({ error: 'Código 2FA necessário.', twoFactorRequired: true });
      }

      if (!verifyToken(user.two_factor_secret, twoFactorToken)) {
        await logAudit({
          actorUserId: user.id,
          action: 'auth.login_failed_invalid_2fa',
          entityType: 'user',
          entityId: user.id,
          metadata: { email: user.email },
          req,
        });
        return res.status(401).json({ error: 'Código 2FA inválido.' });
      }
    }

    await logAudit({
      actorUserId: user.id,
      action: 'auth.login_success',
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email },
      req,
    });

    return res.json({
      user: sanitizeUser(user),
      token: signToken(user.id),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao fazer login.' });
  }
};

exports.startOAuth = async (req, res) => {
  const provider = normalizeProvider(req.params.provider);
  const role = normalizeOAuthRole(req.query.role);
  const next = sanitizeNextPath(req.query.next, role);

  try {
    if (!provider) {
      return redirectOAuthResult(req, res, { role, error: 'invalid_provider' });
    }

    const state = signOAuthState({ provider, role, next });
    const redirectUri = getOAuthCallbackUrl(req, provider);

    if (provider === 'google') {
      if (!hasGoogleConfig()) {
        return redirectOAuthResult(req, res, { role, error: 'google_not_configured' });
      }

      const authorizationParams = new URLSearchParams({
        client_id: firstEnvValue('GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_CLIENT_ID'),
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        prompt: 'select_account',
        access_type: 'offline',
        include_granted_scopes: 'true',
        state,
      });

      return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${authorizationParams.toString()}`);
    }

    if (!hasAppleConfig()) {
      return redirectOAuthResult(req, res, { role, error: 'apple_not_configured' });
    }

    const appleConfig = getAppleConfig();
    const authorizationParams = new URLSearchParams({
      client_id: appleConfig.serviceId,
      redirect_uri: redirectUri,
      response_type: 'code',
      response_mode: 'form_post',
      scope: 'name email',
      state,
    });

    return res.redirect(`https://appleid.apple.com/auth/authorize?${authorizationParams.toString()}`);
  } catch (_error) {
    return redirectOAuthResult(req, res, { role, next, error: 'oauth_start_failed' });
  }
};

async function exchangeGoogleCode(req, code) {
  const redirectUri = getOAuthCallbackUrl(req, 'google');
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: firstEnvValue('GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_CLIENT_ID'),
      client_secret: firstEnvValue('GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET'),
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('google_token_exchange_failed');
  }

  const tokenData = await tokenResponse.json();

  if (!tokenData.id_token) {
    throw new Error('google_id_token_missing');
  }

  const profileResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenData.id_token)}`);

  if (!profileResponse.ok) {
    throw new Error('google_token_verify_failed');
  }

  const profile = await profileResponse.json();
  const clientId = firstEnvValue('GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_CLIENT_ID');

  if (profile.aud !== clientId) {
    throw new Error('google_audience_invalid');
  }

  return {
    providerId: profile.sub,
    email: profile.email,
    emailVerified: parseBoolean(profile.email_verified),
    name: profile.name,
  };
}

function buildAppleClientSecret() {
  const appleConfig = getAppleConfig();

  return jwt.sign({}, appleConfig.privateKey, {
    algorithm: 'ES256',
    audience: OAUTH_APPLE_AUDIENCE,
    expiresIn: '180d',
    issuer: appleConfig.teamId,
    keyid: appleConfig.keyId,
    subject: appleConfig.serviceId,
  });
}

async function getApplePublicKey(kid) {
  const keysResponse = await fetch('https://appleid.apple.com/auth/keys');

  if (!keysResponse.ok) {
    throw new Error('apple_keys_fetch_failed');
  }

  const { keys = [] } = await keysResponse.json();
  const key = keys.find((item) => item.kid === kid);

  if (!key) {
    throw new Error('apple_key_not_found');
  }

  return crypto.createPublicKey({ key, format: 'jwk' });
}

function parseAppleUserName(rawUser) {
  if (!rawUser) {
    return '';
  }

  try {
    const parsedUser = JSON.parse(rawUser);
    const firstName = parsedUser?.name?.firstName || '';
    const lastName = parsedUser?.name?.lastName || '';
    return `${firstName} ${lastName}`.trim();
  } catch (_error) {
    return '';
  }
}

async function exchangeAppleCode(req, code) {
  const appleConfig = getAppleConfig();
  const redirectUri = getOAuthCallbackUrl(req, 'apple');
  const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: appleConfig.serviceId,
      client_secret: buildAppleClientSecret(),
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('apple_token_exchange_failed');
  }

  const tokenData = await tokenResponse.json();

  if (!tokenData.id_token) {
    throw new Error('apple_id_token_missing');
  }

  const decodedToken = jwt.decode(tokenData.id_token, { complete: true });
  const publicKey = await getApplePublicKey(decodedToken?.header?.kid);
  const profile = jwt.verify(tokenData.id_token, publicKey, {
    algorithms: ['RS256'],
    audience: appleConfig.serviceId,
    issuer: OAUTH_APPLE_ISSUER,
  });

  return {
    providerId: profile.sub,
    email: profile.email,
    emailVerified: parseBoolean(profile.email_verified),
    name: parseAppleUserName(req.body?.user),
  };
}

exports.handleOAuthCallback = async (req, res) => {
  let role = 'installer';
  let next = getDefaultNextPath(role);

  try {
    const provider = normalizeProvider(req.params.provider);
    const error = req.body?.error || req.query?.error;

    if (error) {
      return redirectOAuthResult(req, res, { role, next, error: String(error) });
    }

    if (!provider) {
      return redirectOAuthResult(req, res, { role, next, error: 'invalid_provider' });
    }

    const state = verifyOAuthState(req.body?.state || req.query?.state);
    role = normalizeOAuthRole(state.role);
    next = sanitizeNextPath(state.next, role);

    if (state.provider !== provider) {
      return redirectOAuthResult(req, res, { role, next, error: 'state_provider_mismatch' });
    }

    const code = String(req.body?.code || req.query?.code || '').trim();

    if (!code) {
      return redirectOAuthResult(req, res, { role, next, error: 'code_missing' });
    }

    const oauthProfile = provider === 'google'
      ? await exchangeGoogleCode(req, code)
      : await exchangeAppleCode(req, code);

    const user = await findOrCreateOAuthUser(oauthProfile, provider, role, req);

    return redirectOAuthResult(req, res, {
      token: signToken(user.id),
      role,
      next,
    });
  } catch (error) {
    await logAudit({
      actorUserId: null,
      action: 'auth.oauth_login_failed',
      entityType: 'auth',
      entityId: null,
      metadata: {
        error: error.message,
      },
      req,
    }).catch(() => null);

    return redirectOAuthResult(req, res, { role, next, error: 'oauth_failed' });
  }
};

exports.setup2FA = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId]);
    const user = rows[0];

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const secret = generateSecret();
    const qrCode = await generateQrCode(secret.base32, user.email);
    return res.json({ secret: secret.base32, qrCode });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao configurar 2FA.' });
  }
};

exports.enable2FA = async (req, res) => {
  try {
    const { secret, token } = req.body;

    if (!secret || !token || !verifyToken(secret, token)) {
      return res.status(400).json({ error: 'Dados de 2FA inválidos.' });
    }

    await pool.query(
      `
        UPDATE users
        SET two_factor_secret = $1, two_factor_enabled = true, updated_at = NOW()
        WHERE id = $2
      `,
      [secret, req.userId]
    );

    await logAudit({
      actorUserId: req.userId,
      action: 'auth.2fa_enabled',
      entityType: 'user',
      entityId: req.userId,
      req,
    });

    return res.json({ success: true });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao ativar 2FA.' });
  }
};

exports.disable2FA = async (req, res) => {
  try {
    await pool.query(
      `
        UPDATE users
        SET two_factor_secret = NULL, two_factor_enabled = false, updated_at = NOW()
        WHERE id = $1
      `,
      [req.userId]
    );

    await logAudit({
      actorUserId: req.userId,
      action: 'auth.2fa_disabled',
      entityType: 'user',
      entityId: req.userId,
      req,
    });

    return res.json({ success: true });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao desativar 2FA.' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);

    if (!normalizedEmail) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }

    const userResult = await pool.query(
      `
        SELECT id, email
        FROM users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      [normalizedEmail]
    );
    const user = userResult.rows[0];

    // Resposta genérica para não vazar existência de conta.
    const genericResponse = {
      success: true,
      message: 'Se o e-mail existir, você receberá instruções para redefinir a senha.',
    };

    if (!user) {
      await logAudit({
        actorUserId: null,
        action: 'auth.password_reset_requested_unknown_email',
        entityType: 'user',
        entityId: normalizedEmail,
        metadata: { email: normalizedEmail },
        req,
      });

      return res.json(genericResponse);
    }

    const { token, tokenHash } = buildPasswordResetToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRATION_MINUTES * 60 * 1000);

    await pool.query(
      `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE user_id = $1 AND used_at IS NULL
      `,
      [user.id]
    );

    await pool.query(
      `
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
      `,
      [user.id, tokenHash, expiresAt]
    );

    await logAudit({
      actorUserId: user.id,
      action: 'auth.password_reset_requested',
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email },
      req,
    });

    if (process.env.NODE_ENV !== 'production' || PASSWORD_RESET_EXPOSE_TOKEN) {
      return res.json({
        ...genericResponse,
        reset_token: token,
        reset_expires_at: expiresAt.toISOString(),
      });
    }

    return res.json(genericResponse);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao iniciar recuperação de senha.' });
  }
};

exports.resetPassword = async (req, res) => {
  const db = await pool.connect();
  try {
    const token = String(req.body?.token || '').trim();
    const nextPassword = String(req.body?.password || '');

    if (!token || !nextPassword) {
      return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
    }

    if (nextPassword.length < 8) {
      return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 8 caracteres.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetTokenResult = await pool.query(
      `
        SELECT id, user_id
        FROM password_reset_tokens
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > NOW()
        LIMIT 1
      `,
      [tokenHash]
    );
    const resetTokenRow = resetTokenResult.rows[0];

    if (!resetTokenRow) {
      return res.status(400).json({ error: 'Token de redefinição inválido ou expirado.' });
    }

    const passwordHash = await bcrypt.hash(nextPassword, 10);

    await db.query('BEGIN');
    await db.query(
      `
        UPDATE users
        SET password = $1, updated_at = NOW()
        WHERE id = $2
      `,
      [passwordHash, resetTokenRow.user_id]
    );
    await db.query(
      `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE id = $1
      `,
      [resetTokenRow.id]
    );
    await db.query(
      `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE user_id = $1
          AND used_at IS NULL
      `,
      [resetTokenRow.user_id]
    );
    await db.query('COMMIT');

    await logAudit({
      actorUserId: resetTokenRow.user_id,
      action: 'auth.password_reset_success',
      entityType: 'user',
      entityId: resetTokenRow.user_id,
      req,
    });

    return res.json({ success: true, message: 'Senha redefinida com sucesso.' });
  } catch (_error) {
    await db.query('ROLLBACK').catch(() => null);
    return res.status(500).json({ error: 'Erro ao redefinir senha.' });
  } finally {
    db.release();
  }
};
