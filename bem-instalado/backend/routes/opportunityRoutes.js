const express = require('express');
const controller = require('../controllers/serviceRequestController');
const auth = require('../middleware/authMiddleware');
const requireAccountType = require('../middleware/accountTypeMiddleware');
const hasSubscription = require('../middleware/subscriptionMiddleware');

const router = express.Router();

router.use(auth);
router.use(requireAccountType('installer'));
router.use(hasSubscription);

router.get('/', controller.getOpportunities);
router.post('/:id/interest', controller.expressInterest);
router.post('/:id/accept', controller.expressInterest);

module.exports = router;
