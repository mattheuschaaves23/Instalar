const express = require('express');
const controller = require('../controllers/notificationController');
const auth = require('../middleware/authMiddleware');
const requireAccountType = require('../middleware/accountTypeMiddleware');
const hasSubscription = require('../middleware/subscriptionMiddleware');

const router = express.Router();

router.use(auth);
router.use(requireAccountType('installer'));
router.use(hasSubscription);

router.get('/', controller.getNotifications);
router.put('/:id/read', controller.markAsRead);

module.exports = router;
