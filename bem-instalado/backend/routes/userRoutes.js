const express = require('express');
const controller = require('../controllers/userController');
const auth = require('../middleware/authMiddleware');
const requireAccountType = require('../middleware/accountTypeMiddleware');
const profileUpload = require('../middleware/profileUpload');

const router = express.Router();
const requireInstaller = requireAccountType('installer');
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
router.get('/dashboard', auth, requireInstaller, controller.getDashboard);
router.get('/reviews/summary', auth, requireInstaller, controller.getReviewsSummary);
router.get('/reviews-dashboard', auth, requireInstaller, controller.getReviewsDashboard);
router.put('/profile', auth, requireInstaller, controller.updateProfile);
router.get('/uploads/capabilities', auth, requireInstaller, controller.getUploadCapabilities);
router.get('/uploads/file/:assetKey', auth, requireInstaller, controller.getStoredProfileAsset);
router.post('/uploads', auth, requireInstaller, uploadSingleProfileAsset, controller.uploadProfileAsset);
router.get('/availability', auth, requireInstaller, controller.getAvailabilitySlots);
router.post('/availability', auth, requireInstaller, controller.createAvailabilitySlot);
router.delete('/availability/:id', auth, requireInstaller, controller.deleteAvailabilitySlot);

module.exports = router;
