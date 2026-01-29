const express = require('express');
const router = express.Router();
const exerciseController = require('../controllers/exercise.controller');
const { protect } = require('../middlewares/auth.middleware');

// Public search for now, could be protected if needed
router.get('/', exerciseController.getExercises);
router.get('/metadata', exerciseController.getFilterMetadata);

module.exports = router;
