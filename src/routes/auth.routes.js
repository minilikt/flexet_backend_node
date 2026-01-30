const express = require('express');
const router = express.Router();
const { register, login, refresh, logout } = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);

const { sendResponse } = require('../utils/response.utils');

// Example protected route
router.get('/me', protect, (req, res) => {
    sendResponse(res, 200, 'User profile fetched', req.user);
});

module.exports = router;
