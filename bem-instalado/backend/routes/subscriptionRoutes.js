const express = require('express');
const controller = require('../controllers/subscriptionController');
const auth = require('../middleware/authMiddleware');
const requireAccountType = require('../middleware/accountTypeMiddleware');
const { createRateLimiter } = require('../middleware/rateLimit');
const requireVerifiedEmail = require('../middleware/verifiedEmailMiddleware');

const router = express.Router();

const paymentCreationLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: 'Muitas tentativas de gerar pagamento. Aguarde alguns minutos.',
});

router.post('/webhooks/asaas', controller.handleAsaasWebhook);
router.post('/webhooks/asaas-managed-trial', controller.receiveManagedTrialEvent);
router.use(auth);
router.use(requireAccountType('installer'));
router.use(requireVerifiedEmail);
router.get('/', controller.getSubscription);
router.get('/launch-status', paymentCreationLimiter, controller.getLaunchBillingStatus);
router.post('/trial-checkout', paymentCreationLimiter, controller.createTrialCheckout);
router.post('/managed-trial/refresh', paymentCreationLimiter, controller.refreshManagedTrial);
router.post('/pay', paymentCreationLimiter, controller.createPayment);
router.delete('/', controller.cancelSubscription);
router.get('/payment/:externalId', controller.checkPayment);
router.post('/payment/:externalId/confirm', controller.confirmPayment);

module.exports = router;
