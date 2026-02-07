const express = require('express');
const router = express.Router();
const workoutController = require('../controllers/workout.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/generate', protect, workoutController.generateWorkout);
router.get('/my-plans', protect, workoutController.getUserPlans);
router.get('/plans', protect, workoutController.getUserPlans);

router.get('/trends', protect, workoutController.getPerformanceTrends);
router.get('/test', (req, res) => res.json({ message: 'workout api is up' }));
router.get('/active-session', protect, workoutController.getActiveSession);
router.get('/session', protect, workoutController.getActiveSession);

module.exports = router;
