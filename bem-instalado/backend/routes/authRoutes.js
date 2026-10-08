const express = require('express');
const controller = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');
const { createRateLimiter } = require('../middleware/rateLimit');
const { issueCsrfToken } = require('../middleware/csrfMiddleware');
const { requireTurnstile } = require('../middleware/turnstileMiddleware');

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

router.get('/capabilities', controller.getCapabilities);
router.get('/csrf', issueCsrfToken);
router.post('/register', authBurstLimiter, requireTurnstile, controller.register);
router.post('/register/client', authBurstLimiter, requireTurnstile, controller.registerClient);
router.post('/login', loginLimiter, controller.login);
router.get('/oauth/:provider', authBurstLimiter, controller.startOAuth);
router.get('/oauth/:provider/callback', authBurstLimiter, controller.handleOAuthCallback);
router.post('/forgot-password', passwordRecoveryLimiter, requireTurnstile, controller.forgotPassword);
router.post('/reset-password', passwordRecoveryLimiter, controller.resetPassword);
router.post('/verify-email', authBurstLimiter, controller.verifyEmail);
router.get('/session', auth, controller.getSession);
router.post('/logout', controller.logout);
router.post('/resend-verification', auth, authBurstLimiter, controller.resendEmailVerification);

module.exports = router;
