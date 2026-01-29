# Security Risk Assessment

## Overview
This document outlines potential security risks in the Flex backend and the current strategies used to mitigate them. It serves as a guide for future security hardening.

## 🔴 High Priority Risks

### 1. Rate Limiting (Brute Force)
- **Risk**: Currently, there is no global rate limiter (e.g., `express-rate-limit`). Attackers could theoretically brute-force the `/api/auth/login` endpoint.
- **Mitigation Status**: ❌ **Missing**.
- **Recommendation**: Install `express-rate-limit` and apply a strict limit (e.g., 5 attempts per minute) to the auth routes.

### 2. JWT Token Theft (XSS)
- **Risk**: Access Tokens are returned in the JSON body. If the frontend (which is not in this repo, but presumably exists) stores them in `localStorage`, they are vulnerable to XSS attacks.
- **Mitigation Status**: ⚠️ **Partial**. The Refresh Token is stored in the DB, but the Access Token transport mechanism is vulnerable if the frontend is insecure.
- **Recommendation**: Move Access Tokens to **HttpOnly Cookies** to prevent JavaScript access.

### 3. Input Validation (DoS)
- **Risk**: The `submitSessionResult` endpoint accepts large JSON payloads (nested arrays of sets/reps). A malicious user could send a 10MB JSON to exhaust server memory or CPU.
- **Mitigation Status**: ⚠️ **Partial**. We use standard body parsers, but explicit size limits should be enforced.
- **Recommendation**: Set `express.json({ limit: '10kb' })` in `index.js`.

## 🟠 Medium Priority Risks

### 1. Database Enumeration (UUIDs)
- **Risk**: Using auto-incrementing IDs allows attackers to guess resource IDs (e.g., `user/5`, `user/6`).
- **Mitigation Status**: ✅ **Fixed**. We use **UUIDs** (v4) for all primary keys (`User`, `Exercise`, `Plan`), making resource guessing mathematically impossible.

### 2. User Enumeration (Registration)
- **Risk**: The registration endpoint returns "User already exists" if an email is taken. This allows attackers to check if a specific person uses the app.
- **Mitigation Status**: ⚠️ **Accepted Risk**. This is standard UX for many apps, but for high security, it should return a generic "If the email is valid, a link has been sent" message.

### 3. CORS Configuration
- **Risk**: Overly permissive CORS settings allow any domain to call the API.
- **Mitigation Status**: ✅ **Fixed**. Ensure `cors()` in `index.js` is configured with a specific `origin` whitelist in production.

## 🟢 Low Priority / Best Practices

### 1. Helmet (Headers)
- **Risk**: Missing security headers (Content-Security-Policy, X-Frame-Options).
- **Recommendation**: Install `helmet` middleware.

### 2. Dependency Vulnerabilities
- **Risk**: Old NPM packages.
- **Mitigation**: Run `npm audit` regularly.

## 🔒 Checklist for Production Deployment

1.  [ ] Set `NODE_ENV=production`.
2.  [ ] Change `JWT_SECRET` to a long, random string (64+ chars).
3.  [ ] Enable SSL/TLS (HTTPS) - Essential for JWT security.
4.  [ ] Implement `express-rate-limit`.
5.  [ ] Configure CORS whitelist.
