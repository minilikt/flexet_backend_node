const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect: authenticateToken } = require('../middlewares/auth.middleware');

router.get('/profile', authenticateToken, userController.getProfile);
router.put('/profile', authenticateToken, userController.updateProfile);

module.exports = router;
