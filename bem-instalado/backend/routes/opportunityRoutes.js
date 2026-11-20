const express = require('express');
const controller = require('../controllers/serviceRequestController');
const directServiceRequestController = require('../controllers/directServiceRequestController');
const marketplaceFlowController = require('../controllers/marketplaceFlowController');
const auth = require('../middleware/authMiddleware');
const requireAccountType = require('../middleware/accountTypeMiddleware');
const hasSubscription = require('../middleware/subscriptionMiddleware');
const requireVerifiedEmail = require('../middleware/verifiedEmailMiddleware');

const router = express.Router();

router.use(auth);
router.use(requireAccountType('installer'));
router.use(requireVerifiedEmail);
router.use(hasSubscription);

router.get('/', controller.getOpportunities);
router.post('/:id/interest', controller.expressInterest);
router.post('/:id/accept', controller.expressInterest);
router.post('/:id/accept-direct', directServiceRequestController.accept);
router.get('/:id/proposal', marketplaceFlowController.getInstallerProposal);
router.post('/:id/proposal', marketplaceFlowController.sendProposal);
router.patch('/:id/service-status', marketplaceFlowController.updateServiceProgress);

module.exports = router;
