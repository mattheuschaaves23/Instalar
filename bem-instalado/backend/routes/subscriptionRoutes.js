const express = require('express');
const controller = require('../controllers/subscriptionController');
const auth = require('../middleware/authMiddleware');
const requireAccountType = require('../middleware/accountTypeMiddleware');
const { createRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const paymentCreationLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: 'Muitas tentativas de gerar pagamento. Aguarde alguns minutos.',
});

router.use(auth);
router.use(requireAccountType('installer'));
router.get('/', controller.getSubscription);
router.post('/pay', paymentCreationLimiter, controller.createPayment);
router.get('/payment/:externalId', controller.checkPayment);
router.post('/payment/:externalId/confirm', controller.confirmPayment);

module.exports = router;
