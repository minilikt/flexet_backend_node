const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { protect } = require('../middlewares/auth.middleware');

router.get('/summary', protect, analyticsController.getDashboardSummary);
router.get('/muscles', protect, analyticsController.getMuscleDistribution);
router.get('/metrics', protect, analyticsController.getBodyMetrics);
router.post('/metrics', protect, analyticsController.logBodyMetric);

module.exports = router;
