const { verifyAccessToken } = require('../utils/jwt.utils');

const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        console.log('[AUTH] No token provided');
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
        console.log('[AUTH] Verifying token...');
        const decoded = verifyAccessToken(token);
        console.log('[AUTH] Token verified for user:', decoded.id);
        // Map decoded.id to req.user.userId for internal consistency if needed
        req.user = { ...decoded, userId: decoded.id };
        next();
    } catch (error) {
        console.error('[AUTH] Token verification failed:', error.message);
        res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

module.exports = { protect };
