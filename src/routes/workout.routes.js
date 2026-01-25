const express = require('express');
const router = express.Router();
const workoutController = require('../controllers/workout.controller');

router.post('/generate', workoutController.generateWorkout);

module.exports = router;
