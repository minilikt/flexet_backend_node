# Authentication & Security Flows

## Overview

Flex uses **JWT (JSON Web Token)** for stateless authentication. We implement a dual-token strategy (Access Token + Refresh Token) to balance security and user experience.

## 🔐 Auth Logic

### 1. Registration (`POST /api/auth/register`)
- **Input**: Email, Password.
- **Process**:
    1. Check if user exists.
    2. Hash password using `bcrypt` (Salt Rounds: 10).
    3. Create `User` record in DB.
    4. Generate Access & Refresh tokens.
    5. Store Refresh Token hash in DB (Table: `RefreshToken`).
- **Output**: tokens + user info.

### 2. Login (`POST /api/auth/login`)
- **Input**: Email, Password.
- **Process**:
    1. Find user by email.
    2. `bcrypt.compare(inputPassword, storedHash)`.
    3. If valid, issue new tokens.
    4. **Security**: We revoke (delete) old refresh tokens to prevent replay attacks or "hanging" sessions.

### 3. Protected Routes (`authenticateToken` Middleware)
- Located in `src/middleware/auth.js`.
- Checks `Authorization: Bearer <token>` header.
- Verifies JWT signature using `process.env.JWT_SECRET`.
- Decodes payload (`userId`) and attaches it to `req.user`.
- **Failure**: Returns 401 Unauthorized or 403 Forbidden.

## 🛡️ Security Measures

### Password Storage
- We **never** store plain-text passwords.
- Bcrypt is used with a work factor of 10. While Argon2 is newer, Bcrypt remains industry standard and is "secure enough" for this application scale.

### Token Management
- **Access Token**: Short lifespan (e.g., 15-60 minutes). Used for API calls.
- **Refresh Token**: Long lifespan (e.g., 7-30 days). Used *only* to get new Access Tokens.
- **Revocation**: Signing out deletes the refresh token from the DB, instantly invalidating the session once the short-lived access token expires.

### Data Protection
- **Input Validation**: Controllers perform basic validation.
- **SQL Injection**: Prevented by Prisma's underlying parameterization. Prisma uses prepared statements by default.

## ⚠️ Known Limitations

- **Rate Limiting**: Currently, there is no global rate limiter (e.g., `express-rate-limit`). Brute-force attacks on `/login` are theoretically possible. (See [Security Risks](SECURITY_RISKS.md)).
- **Email Verification**: Registration does not verify email ownership. Dummy emails can be used.

## 🔄 Refresh Flow
When the frontend receives a `401 Unauthorized` on a request:
1. It should call `POST /api/auth/refresh` with the `refreshToken`.
2. Backend verifies the refresh token against the DB.
3. If valid and not expired, returns a new `accessToken`.
4. Frontend retries original request.
