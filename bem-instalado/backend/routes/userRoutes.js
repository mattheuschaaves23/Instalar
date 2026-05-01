const express = require('express');
const controller = require('../controllers/userController');
const auth = require('../middleware/authMiddleware');
const requireAccountType = require('../middleware/accountTypeMiddleware');

const router = express.Router();
const requireInstaller = requireAccountType('installer');

router.get('/profile', auth, controller.getProfile);
router.get('/dashboard', auth, requireInstaller, controller.getDashboard);
router.put('/profile', auth, requireInstaller, controller.updateProfile);
router.get('/availability', auth, requireInstaller, controller.getAvailabilitySlots);
router.post('/availability', auth, requireInstaller, controller.createAvailabilitySlot);
router.delete('/availability/:id', auth, requireInstaller, controller.deleteAvailabilitySlot);

module.exports = router;
