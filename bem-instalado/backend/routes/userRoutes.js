const express = require('express');
const controller = require('../controllers/userController');
const { getOwnClientLink } = require('../controllers/directServiceRequestController');
const linkContract = require('../../shared/installerClientLink.json');
const auth = require('../middleware/authMiddleware');
const requireAccountType = require('../middleware/accountTypeMiddleware');
const requireVerifiedEmail = require('../middleware/verifiedEmailMiddleware');
const { createRateLimiter } = require('../middleware/rateLimit');
const profileUpload = require('../middleware/profileUpload');

const router = express.Router();
const requireInstaller = requireAccountType('installer');
const pdfPreviewLimiter = createRateLimiter({
  bucket: 'pdf-preview',
  windowMs: 60 * 1000,
  max: 12,
  keyGenerator: req => req.userId,
  message: 'Muitos PDFs de teste em sequência. Aguarde um minuto e tente novamente.',
});
const uploadSingleProfileAsset = (req, res, next) => {
  profileUpload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'O arquivo excede o limite de 4MB.' });
    }
    return res.status(400).json({ error: error.message || 'Arquivo inválido.' });
  });
};

router.get('/profile', auth, controller.getProfile);
router.get(linkContract.ownerPath.slice('/users'.length), auth, requireInstaller, getOwnClientLink);
router.get('/pdf-branding', auth, requireInstaller, requireVerifiedEmail, controller.getPdfBranding);
router.post('/pdf-branding/preview', auth, requireInstaller, requireVerifiedEmail, pdfPreviewLimiter, controller.previewPdfBranding);
router.get('/data-export', auth, controller.exportOwnData);
router.delete('/account', auth, controller.deleteOwnAccount);
router.get('/dashboard', auth, requireInstaller, requireVerifiedEmail, controller.getDashboard);
router.get('/reviews/summary', auth, requireInstaller, requireVerifiedEmail, controller.getReviewsSummary);
router.get('/reviews-dashboard', auth, requireInstaller, requireVerifiedEmail, controller.getReviewsDashboard);
router.put('/profile', auth, requireInstaller, requireVerifiedEmail, controller.updateProfile);
router.put('/pdf-branding', auth, requireInstaller, requireVerifiedEmail, controller.updatePdfBranding);
router.get('/uploads/capabilities', auth, requireInstaller, requireVerifiedEmail, controller.getUploadCapabilities);
router.get('/uploads/file/:assetKey', auth, requireInstaller, requireVerifiedEmail, controller.getStoredProfileAsset);
router.post('/uploads', auth, requireInstaller, requireVerifiedEmail, uploadSingleProfileAsset, controller.uploadProfileAsset);
router.get('/availability', auth, requireInstaller, requireVerifiedEmail, controller.getAvailabilitySlots);
router.post('/availability', auth, requireInstaller, requireVerifiedEmail, controller.createAvailabilitySlot);
router.delete('/availability/:id', auth, requireInstaller, requireVerifiedEmail, controller.deleteAvailabilitySlot);

module.exports = router;
