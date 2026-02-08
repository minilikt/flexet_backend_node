const express = require('express');
const router = express.Router();
const logController = require('../controllers/log.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/session', protect, logController.logSession);
router.post('/performance', protect, logController.logPerformance);
router.post('/feedback', protect, logController.submitFeedback);
router.post('/recovery', protect, logController.logRecovery);
router.post('/submit', protect, logController.submitSessionResult);


module.exports = router;
