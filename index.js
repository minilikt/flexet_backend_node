require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const { sendResponse } = require('./src/utils/response.utils');

const helmet = require('helmet');
const path = require('path');
const cookieParser = require('cookie-parser');
const authRoutes = require('./src/routes/auth.routes');
const workoutRoutes = require('./src/routes/workout.routes');
const logRoutes = require('./src/routes/log.routes');
const userRoutes = require('./src/routes/user.routes');
const exerciseRoutes = require('./src/routes/exercise.routes');
const analyticsRoutes = require('./src/routes/analytics.routes');

const app = express();

// Rate Limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
    standardHeaders: 'draft-7', // brough to you by IETF
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
    message: (req, res) => {
        sendResponse(res, 429, 'Too many requests from this IP, please try again after 15 minutes');
    }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 20, // Limit each IP to 20 requests per `window` (stricter for auth).
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: (req, res) => {
        sendResponse(res, 429, 'Too many login/registration attempts, please try again after 15 minutes');
    }
});

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(cors({
    origin: [
        process.env.CLIENT_URL || 'http://localhost:3000',
        'http://localhost:5000',
        'http://127.0.0.1:5000',
        'http://localhost:8081',
        'http://10.0.2.2:8081',
        'http://10.0.2.2:5000'
    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.get('/api/yo', (req, res) => {
    res.json({ message: 'yo, routing is working!' });
});

// Apply general limiter to all api routes
app.use('/api', generalLimiter);

// Stricter limiter for auth
app.use('/api/auth', authLimiter, authRoutes);

app.use('/api/workout', workoutRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/analytics', analyticsRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    sendResponse(
        res,
        err.status || 500,
        err.message || 'Internal Server Error',
        null,
        process.env.NODE_ENV === 'development' ? err : {}
    );
});


app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
