const express = require('express');
const controller = require('../controllers/publicController');
const serviceRequestController = require('../controllers/serviceRequestController');
const { createRateLimiter } = require('../middleware/rateLimit');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

const publicSearchLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 90,
  message: 'Muitas buscas em sequencia. Aguarde alguns segundos para continuar.',
});

const reviewLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.ip || 'unknown'}:installer:${req.params.id || ''}`,
  message: 'Muitas avaliacoes em sequencia. Aguarde alguns minutos para enviar outra.',
});

const serviceRequestLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: 'Muitas solicitacoes em sequencia. Aguarde alguns minutos para publicar outra.',
});

router.get('/installers', publicSearchLimiter, controller.getInstallers);
router.get('/recommended-stores', publicSearchLimiter, controller.getRecommendedStores);
router.get('/location/reverse', publicSearchLimiter, controller.reverseLocation);
router.get('/installers/:id', publicSearchLimiter, controller.getInstallerProfile);
router.post('/service-requests', serviceRequestLimiter, serviceRequestController.createPublicServiceRequest);
router.post('/installers/:id/reviews', authMiddleware, reviewLimiter, controller.createReview);

module.exports = router;
