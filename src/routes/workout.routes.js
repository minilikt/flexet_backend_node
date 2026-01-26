const express = require('express');
const router = express.Router();
const workoutController = require('../controllers/workout.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/generate', protect, workoutController.generateWorkout);
router.get('/my-plans', protect, workoutController.getUserPlans);

module.exports = router;
