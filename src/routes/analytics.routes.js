const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { protect } = require('../middlewares/auth.middleware');

router.get('/summary', protect, analyticsController.getDashboardSummary);
router.get('/muscles', protect, analyticsController.getMuscleDistribution);
router.get('/metrics', protect, analyticsController.getBodyMetrics);
router.get('/trends', protect, analyticsController.getTrends);
router.get('/heatmap', protect, analyticsController.getActivityHeatmap);
router.get('/profile-summary', protect, analyticsController.getProfileSummary);
router.get('/recovery-summary', protect, analyticsController.getRecoverySummary);
router.get('/history', protect, analyticsController.getHistory);
router.post('/metrics', protect, analyticsController.logBodyMetric);

module.exports = router;
