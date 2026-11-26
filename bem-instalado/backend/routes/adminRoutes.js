const express = require('express');
const controller = require('../controllers/adminController');
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');
const adminAudit = require('../middleware/adminAuditMiddleware');
const pool = require('../config/database');
const { dashboardAdMediaHandler } = require('../utils/dashboardAdMedia');
const { createRateLimiter } = require('../middleware/rateLimit');
const dashboardAdUpload = require('../middleware/dashboardAdUpload');
const { DashboardAdUploadError, appendDashboardAdPart, cancelDashboardAdUpload, startDashboardAdUpload } = require('../services/dashboardAdUploads');

const router = express.Router();

router.use(auth);
router.use(admin);
router.use(adminAudit);

const dashboardAdWriteLimit = createRateLimiter({
  windowMs: 60 * 1000, max: 15, bucket: 'dashboard-ad-write', keyGenerator: (req) => req.userId,
});
const dashboardAdPreviewLimit = createRateLimiter({
  windowMs: 60 * 1000, max: 90, bucket: 'dashboard-ad-preview', keyGenerator: (req) => req.userId,
});
const dashboardAdPartsLimit = createRateLimiter({
  windowMs: 60 * 1000, max: 80, bucket: 'dashboard-ad-parts', keyGenerator: (req) => req.userId,
});
const uploadAction = (action) => async (req, res) => {
  try {
    return await action(req, res);
  } catch (error) {
    if (error instanceof DashboardAdUploadError) return res.status(error.status).json({ error: error.message });
    return res.status(503).json({ error: 'Não foi possível transferir o arquivo agora.' });
  }
};

router.get('/overview', controller.getOverview);
router.get('/users', controller.listUsers);
router.get('/installer-verifications', controller.listInstallerVerifications);
router.get('/payments', controller.listPayments);
router.get('/service-requests', controller.listServiceRequests);
router.get('/service-requests/:id/interests', controller.listServiceRequestInterests);
router.get('/recommended-stores', controller.listRecommendedStores);
router.get('/dashboard-ads', controller.listDashboardAds);
router.get('/dashboard-ads/media/:key', dashboardAdPreviewLimit, dashboardAdMediaHandler(pool, { admin: true }));
router.post('/dashboard-ads/uploads', dashboardAdWriteLimit, uploadAction(async (req, res) => {
  const upload = await startDashboardAdUpload(pool, req.userId, req.body || {});
  return res.status(201).json(upload);
}));
router.put('/dashboard-ads/uploads/:id/:part', dashboardAdPartsLimit, dashboardAdUpload, uploadAction(async (req, res) => {
  await appendDashboardAdPart(pool, req.userId, req.params.id, req.params.part, req.file?.buffer);
  return res.status(204).end();
}));
router.delete('/dashboard-ads/uploads/:id', dashboardAdWriteLimit, uploadAction(async (req, res) => {
  await cancelDashboardAdUpload(pool, req.userId, req.params.id);
  return res.status(204).end();
}));
router.get('/system/errors', controller.listApplicationErrors);
router.patch('/system/errors/:id/resolve', controller.resolveApplicationError);
router.post('/announcements', controller.broadcastAnnouncement);
router.post('/recommended-stores', controller.createRecommendedStore);
router.post('/dashboard-ads', dashboardAdWriteLimit, dashboardAdUpload, controller.createDashboardAd);
router.patch('/users/:id/subscription', controller.updateUserSubscription);
router.patch('/users/:id/public-profile', controller.updateUserPublicProfile);
router.patch('/users/:id/trust', controller.updateUserTrust);
router.post('/installer-verifications/:id/decision', controller.decideInstallerVerification);
router.patch('/users/:id/admin', controller.updateUserAdmin);
router.patch('/users/:id/restore', controller.restoreUser);
router.patch('/recommended-stores/:id', controller.updateRecommendedStore);
router.patch('/dashboard-ads/:id', dashboardAdWriteLimit, dashboardAdUpload, controller.updateDashboardAd);
router.delete('/users/:id', controller.deleteUser);
router.delete('/recommended-stores/:id', controller.deleteRecommendedStore);
router.delete('/dashboard-ads/:id', controller.deleteDashboardAd);
router.patch('/payments/:id/status', controller.updatePaymentStatus);
router.patch('/service-requests/:id/status', controller.updateServiceRequestStatus);

module.exports = router;
