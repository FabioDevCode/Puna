/**
 * @file tests/integration/routes/auth.test.js
 * Integration tests for authentication web routes
 *
 * Routes tested:
 *   GET  /dp-login          — login page
 *   POST /dp-connect        — login form submission
 *   GET  /dp-logout         — logout
 *   GET  /dp-first-connexion — first-login page
 *   GET  /                  — root redirect
 */

import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializePassport } from '../../../src/helpers/authHelper.js';
import flashMessages from '../../../src/middlewares/flashMessages.js';
import { injectUserRole } from '../../../src/middlewares/injectUserRole.js';
import models from '../../../src/models/index.js';
import defaultRouter from '../../../src/routes/default.routes.js';
import { findUserByLogin } from '../../../src/services/auth.service.js';
import { getUserStatus, incrementFailedAttempts, resetFailedAttempts } from '../../../src/services/user.service.js';

// ---------------------------------------------------------------------------
// Mocks — hoisted before all imports by Vitest
// ---------------------------------------------------------------------------

vi.mock('../../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    errorLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn().mockResolvedValue(undefined),
    formatBytes: vi.fn((b) => `${b} B`),
}));

vi.mock('../../../src/utils/crypto.js', () => ({
    encryptObject: vi.fn(() => 'mock-encrypted'),
    decryptObject: vi.fn(() => ({ id: 'test-site-id', control_code: 'test-control-code' })),
    encryptString: vi.fn(() => 'mock-encrypted-str'),
    decryptString: vi.fn(() => 'mock-decrypted-str'),
}));

vi.mock('../../../src/models/index.js', () => ({
    default: {
        User: {
            findOne: vi.fn(),
            findByPk: vi.fn(),
            update: vi.fn().mockResolvedValue([1]),
            count: vi.fn().mockResolvedValue(0),
            create: vi.fn(),
            findAll: vi.fn().mockResolvedValue([]),
        },
        Site: {
            findOne: vi.fn().mockResolvedValue(null),
            findByPk: vi.fn().mockResolvedValue(null),
            count: vi.fn().mockResolvedValue(0),
            findAll: vi.fn().mockResolvedValue([]),
        },
        Form: {
            findOne: vi.fn().mockResolvedValue(null),
            findByPk: vi.fn().mockResolvedValue(null),
            count: vi.fn().mockResolvedValue(0),
            findAll: vi.fn().mockResolvedValue([]),
        },
        Inbox: { count: vi.fn().mockResolvedValue(0) },
        SiteUser: { findAll: vi.fn().mockResolvedValue([]) },
        sequelize: {
            sync: vi.fn().mockResolvedValue(undefined),
            query: vi.fn().mockResolvedValue([]),
        },
        Sequelize: { QueryTypes: { SELECT: 'SELECT' } },
        Op: {},
    },
}));

// Replace loginRateLimiter with a simple passthrough to avoid rate-limit state
vi.mock('../../../src/middlewares/loginRateLimiter.js', () => ({
    loginRateLimiter: vi.fn((_req, _res, next) => next()),
    firstLoginRateLimiter: vi.fn((_req, _res, next) => next()),
    forgotPasswordRateLimiter: vi.fn((_req, _res, next) => next()),
    resetPasswordRateLimiter: vi.fn((_req, _res, next) => next()),
    twoFaRateLimiter: vi.fn((_req, _res, next) => next()),
    twoFaConfigRateLimiter: vi.fn((_req, _res, next) => next()),
}));

vi.mock('bcrypt', () => ({
    default: {
        compare: vi.fn(),
        hash: vi.fn().mockResolvedValue('$2b$10$new-hashed-password'),
    },
}));

vi.mock('../../../src/services/user.service.js', () => ({
    updateLastConnection: vi.fn().mockResolvedValue(undefined),
    getAllUsers: vi.fn().mockResolvedValue({ users: [], total: 0, totalPages: 1, currentPage: 1 }),
    getUserStatus: vi.fn().mockResolvedValue('active'),
    incrementFailedAttempts: vi.fn().mockResolvedValue({ failedAttempts: 1, suspended: false }),
    resetFailedAttempts: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../src/services/auth.service.js', () => ({
    findUserByLogin: vi.fn().mockResolvedValue(null),
    activateUserAccount: vi.fn().mockResolvedValue(true),
    authenticateUserByLogin: vi.fn().mockResolvedValue(null),
    hashPassword: vi.fn().mockResolvedValue('$2b$10$hashed'),
}));

vi.mock('../../../src/services/stats.service.js', () => ({
    getSitesWithCounts: vi.fn().mockResolvedValue([]),
    getGlobalStatsFromSites: vi.fn().mockReturnValue({}),
    getTopForms: vi.fn().mockResolvedValue([]),
    getTopSiteWithForms: vi.fn().mockResolvedValue({}),
    getInboxCountsByDay: vi.fn().mockResolvedValue({ labels: [], data: [] }),
    getInboxPercentagesDetailed: vi.fn().mockResolvedValue({}),
    getInboxCountsBySite: vi.fn().mockResolvedValue([]),
    getInboxHeatmap: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../src/services/site.service.js', () => ({
    createSite: vi.fn().mockResolvedValue({ id: 'mock-site-id', domain: 'test.com' }),
    deleteSiteWithForms: vi.fn().mockResolvedValue({ success: true }),
    getSiteWithForms: vi.fn().mockResolvedValue(null),
    generateSiteToken: vi.fn().mockResolvedValue({ success: true, token: 'mock-token' }),
    revokeSiteTokens: vi.fn().mockResolvedValue({ success: true, control_code: 'test' }),
    getSitesForUser: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.CSRF_SECRET = 'test-csrf-secret';
process.env.KEY_TK = 'test-jwt-secret-key-minimum-32-chars!!';
process.env.KEV = 'a'.repeat(64);
process.env.KIV = 'b'.repeat(32);
process.env.LOG_TO_CONSOLE = 'false';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockUser = {
    id: 'user-uuid-1',
    login: 'testuser',
    email: 'test@example.com',
    role: 'super_admin',
    status: 'active',
    password: '$2b$10$mock-hashed-password',
};

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

function buildTestApp() {
    const app = express();

    app.use(cookieParser());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // In-memory session store — no MySQL required
    app.use(
        session({
            secret: process.env.SESSION_SECRET,
            resave: false,
            saveUninitialized: false,
            cookie: { secure: false },
        })
    );

    // Inject test user from request header BEFORE injectUserRole so req.userRole is set
    app.use((req, res, next) => {
        const header = req.headers['x-test-user'];
        if (header) {
            try {
                req.session.user = JSON.parse(header);
            } catch {
                // ignore malformed header
            }
        }
        next();
    });

    initializePassport();
    app.use(passport.initialize());
    app.use(passport.session());

    app.use(flashMessages);
    app.use(injectUserRole);

    // Stub res.render so tests need no real Handlebars view engine
    app.use((_req, res, next) => {
        res.render = (view, data) => {
            const code = res.statusCode && res.statusCode !== 200 ? res.statusCode : 200;
            const flashes = (res.locals.flashMessages || []).map((f) => f.text).join('\n');
            const errorText = data?.error || '';
            res.status(code).send(`<html><body>${view}${errorText ? '\n' + errorText : ''}${flashes ? '\n' + flashes : ''}</body></html>`);
        };
        next();
    });

    app.use('/', defaultRouter);

    return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('auth routes', () => {
    let app;

    beforeAll(() => {
        app = buildTestApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    describe('GET /dp-login', () => {
        it('returns 200 with login page when no session is active', async () => {
            const res = await request(app).get('/dp-login');

            expect(res.status).toBe(200);
            expect(res.text).toContain('auth/login');
        });

        it('redirects to /dashboard when a session is already active', async () => {
            const res = await request(app).get('/dp-login').set('X-Test-User', JSON.stringify(mockUser));

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dashboard');
        });
    });

    // -----------------------------------------------------------------------
    describe('POST /dp-connect', () => {
        it('redirects to /dashboard and sets session cookie on valid credentials', async () => {
            vi.mocked(models.User.findOne).mockResolvedValueOnce({ ...mockUser });
            vi.mocked(bcrypt.compare).mockResolvedValueOnce(true);

            const res = await request(app).post('/dp-connect').send({ login: 'testuser', password: 'correctpassword' });

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dashboard');
        });

        it('redirects to /dp-login on invalid credentials', async () => {
            vi.mocked(models.User.findOne).mockResolvedValueOnce(null);

            const res = await request(app).post('/dp-connect').send({ login: 'wrong', password: 'wrong' });

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dp-login');
        });

        it('redirects to /dp-login with disabled-account message when user is inactive', async () => {
            // Passport fails: no active user found
            vi.mocked(models.User.findOne).mockResolvedValueOnce(null);
            // findUserByLogin (without status filter) finds the inactive user
            vi.mocked(findUserByLogin).mockResolvedValueOnce({ ...mockUser, status: 'inactive' });

            const agent = request.agent(app);
            const postRes = await agent.post('/dp-connect').send({ login: 'testuser', password: 'wrongpassword' });

            expect(postRes.status).toBe(302);
            expect(postRes.headers.location).toContain('/dp-login');

            // Follow redirect — flash message should appear on the login page
            const loginPage = await agent.get('/dp-login');
            expect(loginPage.text).toContain('Votre compte est désactivé. Contactez un administrateur.');
        });

        it('redirects to /dp-login with suspended-account message when user is suspended', async () => {
            // Passport fails: no active user found
            vi.mocked(models.User.findOne).mockResolvedValueOnce(null);
            // findUserByLogin finds the suspended user
            vi.mocked(findUserByLogin).mockResolvedValueOnce({ ...mockUser, status: 'suspended' });

            const agent = request.agent(app);
            const postRes = await agent.post('/dp-connect').send({ login: 'testuser', password: 'wrongpassword' });

            expect(postRes.status).toBe(302);
            expect(postRes.headers.location).toContain('/dp-login');

            const loginPage = await agent.get('/dp-login');
            expect(loginPage.text).toContain('Votre compte est suspendu suite à de trop nombreuses tentatives de connexion. Contactez un administrateur.');
        });

        it('increments failed_login_attempts counter on login failure for active user', async () => {
            vi.mocked(models.User.findOne).mockResolvedValueOnce(null);
            vi.mocked(findUserByLogin).mockResolvedValueOnce({ ...mockUser, status: 'active' });

            await request(app).post('/dp-connect').send({ login: 'testuser', password: 'wrongpassword' });

            expect(incrementFailedAttempts).toHaveBeenCalledWith(mockUser.id, mockUser.login, expect.any(String));
        });

        it('does NOT increment counter when login fails for suspended user', async () => {
            vi.mocked(models.User.findOne).mockResolvedValueOnce(null);
            vi.mocked(findUserByLogin).mockResolvedValueOnce({ ...mockUser, status: 'suspended' });

            await request(app).post('/dp-connect').send({ login: 'testuser', password: 'wrongpassword' });

            expect(incrementFailedAttempts).not.toHaveBeenCalled();
        });

        it('does NOT increment counter and shows ban message when user is banned', async () => {
            vi.mocked(models.User.findOne).mockResolvedValueOnce(null);
            vi.mocked(findUserByLogin).mockResolvedValueOnce({ ...mockUser, status: 'banned' });

            const agent = request.agent(app);
            const postRes = await agent.post('/dp-connect').send({ login: 'testuser', password: 'wrongpassword' });

            expect(postRes.status).toBe(302);
            expect(postRes.headers.location).toContain('/dp-login');
            expect(incrementFailedAttempts).not.toHaveBeenCalled();

            const loginPage = await agent.get('/dp-login');
            expect(loginPage.text).toContain('Votre compte a été banni.');
        });

        it('resets failed_login_attempts counter on successful login', async () => {
            vi.mocked(models.User.findOne).mockResolvedValueOnce({ ...mockUser });
            vi.mocked(bcrypt.compare).mockResolvedValueOnce(true);

            await request(app).post('/dp-connect').send({ login: 'testuser', password: 'correctpassword' });

            expect(resetFailedAttempts).toHaveBeenCalledWith(mockUser.id);
        });
    });

    // -----------------------------------------------------------------------
    describe('GET /dp-logout', () => {
        it('destroys the session and redirects to /dp-login', async () => {
            const res = await request(app).get('/dp-logout').set('X-Test-User', JSON.stringify(mockUser));

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dp-login');
        });
    });

    // -----------------------------------------------------------------------
    describe('GET /', () => {
        it('redirects to /dp-login when no session is active', async () => {
            const res = await request(app).get('/');

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dp-login');
        });

        it('redirects to /dashboard when a session is active', async () => {
            const res = await request(app).get('/').set('X-Test-User', JSON.stringify(mockUser));

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dashboard');
        });
    });

    // -----------------------------------------------------------------------
    describe('checkUserStatus — session invalidation', () => {
        it('redirects to /dp-login when the active session user is deactivated (status → inactive)', async () => {
            // getUserStatus returns 'inactive' — simulates a user whose account was deactivated
            // after their session was established (statusCheckedAt defaults to 0, so the TTL
            // is expired and the DB is checked on this request)
            vi.mocked(getUserStatus).mockResolvedValueOnce('inactive');

            const res = await request(app).get('/dashboard').set('X-Test-User', JSON.stringify(mockUser));

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dp-login');
        });
    });

    // -----------------------------------------------------------------------
    describe('POST /dp-first-co', () => {
        it('shows ban message and does not activate account when pending user is banned', async () => {
            // First call with 'pending' filter returns null (user has been banned, no longer pending)
            vi.mocked(findUserByLogin).mockResolvedValueOnce(null);
            // Second call without filter finds the banned user
            vi.mocked(findUserByLogin).mockResolvedValueOnce({ ...mockUser, status: 'banned' });

            const res = await request(app).post('/dp-first-co').send({ login: 'testuser', password: 'newpassword', confirm_password: 'newpassword' });

            expect(res.status).toBe(200);
            expect(res.text).toContain('Votre compte a été banni.');
        });

        it('shows login-unknown message when user does not exist', async () => {
            vi.mocked(findUserByLogin).mockResolvedValue(null);

            const res = await request(app).post('/dp-first-co').send({ login: 'unknown', password: 'newpassword', confirm_password: 'newpassword' });

            expect(res.status).toBe(200);
            expect(res.text).toContain('Login inconnu.');
        });
    });
});
