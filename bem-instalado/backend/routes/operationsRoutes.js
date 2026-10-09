const express = require('express');
const controller = require('../controllers/operationsController');
const { requireOperationsAccess } = require('../middleware/operationsMiddleware');

const router = express.Router();

router.get('/status', requireOperationsAccess, controller.status);
router.post('/run', requireOperationsAccess, controller.run);
// Schedulers such as Vercel Cron invoke GET. The bearer secret is still required.
router.get('/run', requireOperationsAccess, controller.run);

module.exports = router;
