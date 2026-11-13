const express = require('express');
const controller = require('../controllers/publicController');
const serviceRequestController = require('../controllers/serviceRequestController');
const marketplaceFlowController = require('../controllers/marketplaceFlowController');
const { createRateLimiter } = require('../middleware/rateLimit');
const { requireTurnstile } = require('../middleware/turnstileMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const optionalAuthMiddleware = require('../middleware/optionalAuthMiddleware');
const monitoringController = require('../controllers/monitoringController');
const profileUpload = require('../middleware/profileUpload');
const assetController = require('../controllers/assetController');
const installerAppReleaseController = require('../controllers/installerAppReleaseController');

const router = express.Router();

const publicSearchLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 90,
  message: 'Muitas buscas em sequência. Aguarde alguns segundos para continuar.',
});

const reviewLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.ip || 'unknown'}:installer:${req.params.id || ''}`,
  message: 'Muitas avaliações em sequência. Aguarde alguns minutos para enviar outra.',
});

const serviceRequestLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: 'Muitas solicitações em sequência. Aguarde alguns minutos para publicar outra.',
});

const clientErrorLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 12,
  message: 'Muitos registros de erro em sequência.',
});
const publicUploadSingle = (req, res, next) => {
  profileUpload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'A foto excede 4MB.' });
    return res.status(400).json({ error: error.message || 'Foto inválida.' });
  });
};

router.get('/installers', publicSearchLimiter, controller.getInstallers);
router.get('/sitemap.xml', controller.getSitemap);
router.get('/installer-app-release', publicSearchLimiter, installerAppReleaseController.getInstallerAppRelease);
router.get('/assets/:assetKey', publicSearchLimiter, assetController.getPublicAsset);
router.post('/client-errors', optionalAuthMiddleware, clientErrorLimiter, monitoringController.reportClientError);
router.post('/service-request-uploads', serviceRequestLimiter, publicUploadSingle, serviceRequestController.uploadPublicRequestPhoto);
router.get('/recommended-stores', publicSearchLimiter, controller.getRecommendedStores);
router.get('/dashboard-ads', publicSearchLimiter, controller.getDashboardAds);
router.get('/location/reverse', publicSearchLimiter, controller.reverseLocation);
router.get('/location/search', publicSearchLimiter, controller.searchLocation);
router.get('/installers/:id', optionalAuthMiddleware, publicSearchLimiter, controller.getInstallerProfile);
router.post('/service-requests', optionalAuthMiddleware, serviceRequestLimiter, requireTurnstile, serviceRequestController.createPublicServiceRequest);
router.get('/service-requests/mine', authMiddleware, publicSearchLimiter, serviceRequestController.getMyServiceRequests);
router.post('/service-requests/:id/claim', authMiddleware, serviceRequestLimiter, serviceRequestController.claimServiceRequest);
router.get('/service-requests/:id/interests', optionalAuthMiddleware, publicSearchLimiter, serviceRequestController.getPublicServiceRequestInterests);
router.post('/service-requests/:id/interests/:interestId/select', optionalAuthMiddleware, serviceRequestLimiter, serviceRequestController.selectServiceRequestInterest);
router.get('/service-requests/:id/proposal', optionalAuthMiddleware, publicSearchLimiter, marketplaceFlowController.getClientProposal);
router.post('/service-requests/:id/proposal/respond', optionalAuthMiddleware, serviceRequestLimiter, marketplaceFlowController.respondToProposal);
router.patch('/service-requests/:id/status', optionalAuthMiddleware, serviceRequestLimiter, serviceRequestController.updateClientServiceRequestStatus);
router.post('/installers/:id/reviews', authMiddleware, reviewLimiter, requireTurnstile, controller.createReview);

module.exports = router;
