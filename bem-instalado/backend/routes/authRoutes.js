const express = require('express');
const controller = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');
const { createRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const authBurstLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Muitas tentativas de autenticação. Aguarde alguns minutos.',
});

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 12,
  keyGenerator: (req) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    return `${req.ip || 'unknown'}:${email || 'anonymous'}`;
  },
  message: 'Muitas tentativas de login. Tente novamente em alguns minutos.',
});

const passwordRecoveryLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyGenerator: (req) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    return `${req.ip || 'unknown'}:password:${email || 'anonymous'}`;
  },
  message: 'Muitas tentativas de recuperação de senha. Aguarde alguns minutos.',
});

const twoFactorLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `${req.ip || 'unknown'}:2fa:${req.userId || 'anonymous'}`,
  message: 'Muitas tentativas de autenticação em dois fatores. Aguarde alguns minutos.',
});

router.get('/capabilities', controller.getCapabilities);
router.post('/register', authBurstLimiter, controller.register);
router.post('/register/client', authBurstLimiter, controller.registerClient);
router.post('/login', loginLimiter, controller.login);
router.get('/oauth/:provider', authBurstLimiter, controller.startOAuth);
router.get('/oauth/:provider/callback', authBurstLimiter, controller.handleOAuthCallback);
router.post('/oauth/:provider/callback', authBurstLimiter, controller.handleOAuthCallback);
router.post('/forgot-password', passwordRecoveryLimiter, controller.forgotPassword);
router.post('/reset-password', passwordRecoveryLimiter, controller.resetPassword);
router.get('/2fa/setup', auth, twoFactorLimiter, controller.setup2FA);
router.post('/2fa/enable', auth, twoFactorLimiter, controller.enable2FA);
router.post('/2fa/disable', auth, twoFactorLimiter, controller.disable2FA);

module.exports = router;
