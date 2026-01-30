const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt.utils');
const { sendResponse } = require('../utils/response.utils');


const register = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return sendResponse(res, 400, 'Email and password are required');
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return sendResponse(res, 400, 'User already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
            },
        });

        // Generate tokens upon registration
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Save refresh token to DB
        await prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });

        // Set refresh token in HttpOnly cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        sendResponse(res, 201, 'User created successfully', {
            accessToken,
            refreshToken, // Return for storage fallback
            user: { id: user.id, email: user.email }
        });

    } catch (error) {
        sendResponse(res, 500, 'Internal server error', null, error.message);
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return sendResponse(res, 401, 'Invalid credentials');
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Save refresh token to DB
        await prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });

        // Set refresh token in HttpOnly cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        sendResponse(res, 200, 'Login successful', {
            accessToken,
            refreshToken, // Always return for storage fallback
            user: { id: user.id, email: user.email }
        });

    } catch (error) {
        sendResponse(res, 500, 'Internal server error', null, error.message);
    }
};

const refresh = async (req, res) => {
    // Check cookie first, fallback to body
    const refreshToken = req.cookies.refreshToken || req.body.token;
    if (!refreshToken) return sendResponse(res, 401, 'No refresh token provided');

    try {
        const savedToken = await prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true }
        });

        if (!savedToken || savedToken.expiresAt < new Date()) {
            if (savedToken) await prisma.refreshToken.delete({ where: { id: savedToken.id } });
            return sendResponse(res, 403, 'Invalid or expired refresh token');
        }

        const accessToken = generateAccessToken(savedToken.user);
        sendResponse(res, 200, 'Token refreshed', { accessToken });

    } catch (error) {
        sendResponse(res, 403, 'Invalid refresh token', null, error.message);
    }
};

const logout = async (req, res) => {
    const refreshToken = req.cookies.refreshToken || req.body.token;
    if (refreshToken) {
        await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.clearCookie('refreshToken');
    sendResponse(res, 200, 'Logged out successfully');

};

module.exports = { register, login, refresh, logout };
