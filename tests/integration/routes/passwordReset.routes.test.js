/**
 * @file tests/integration/routes/passwordReset.routes.test.js
 * Integration tests for the password-reset HTTP routes.
 *
 * Routes tested:
 *   GET  /dp-forgot-password          — forgot-password form
 *   POST /dp-forgot-password          — submit email
 *   GET  /dp-reset-password/:token    — reset-password form
 *   POST /dp-reset-password/:token    — submit new password
 */

import cookieParser from 'cookie-parser';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializePassport } from '../../../src/helpers/auth.helpers.js';
import flashMessages from '../../../src/middlewares/flashMessages.js';
import { injectUserRole } from '../../../src/middlewares/injectUserRole.js';
import defaultRouter from '../../../src/routes/default.routes.js';
import { createPasswordResetRequest, validateResetToken, resetPassword } from '../../../src/services/passwordReset.service.js';

// ---------------------------------------------------------------------------
// Mocks — hoisted above imports by Vitest
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

// Replace all rate limiters with a simple passthrough to avoid shared state
vi.mock('../../../src/middlewares/loginRateLimiter.js', () => ({
    loginRateLimiter: vi.fn((_req, _res, next) => next()),
    firstLoginRateLimiter: vi.fn((_req, _res, next) => next()),
    forgotPasswordRateLimiter: vi.fn((_req, _res, next) => next()),
    resetPasswordRateLimiter: vi.fn((_req, _res, next) => next()),
    twoFaRateLimiter: vi.fn((_req, _res, next) => next()),
    twoFaConfigRateLimiter: vi.fn((_req, _res, next) => next()),
}));

vi.mock('../../../src/config/mailer.js', () => ({
    mailEnabled: true,
    sendMail: vi.fn(),
}));

vi.mock('../../../src/services/passwordReset.service.js', () => ({
    generateResetToken: vi.fn(),
    createPasswordResetRequest: vi.fn().mockResolvedValue(undefined),
    validateResetToken: vi.fn().mockResolvedValue(null),
    resetPassword: vi.fn().mockResolvedValue(false),
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
    getInboxCountsByDay: vi.fn().mockResolvedValue({ labels: [], data: [] }),
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

vi.mock('../../../src/services/user.service.js', () => ({
    updateLastConnection: vi.fn().mockResolvedValue(undefined),
    getAllUsers: vi.fn().mockResolvedValue({ users: [], total: 0, totalPages: 1, currentPage: 1 }),
    getUserStatus: vi.fn().mockResolvedValue('active'),
    incrementFailedAttempts: vi.fn().mockResolvedValue({ failedAttempts: 1, suspended: false }),
    resetFailedAttempts: vi.fn().mockResolvedValue(true),
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

    app.use(
        session({
            secret: process.env.SESSION_SECRET,
            resave: false,
            saveUninitialized: false,
            cookie: { secure: false },
        })
    );

    // Inject test user from request header BEFORE injectUserRole
    app.use((req, _res, next) => {
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

    // Stub i18n: add req.__ to every request (i18n.init is not wired in the test app)
    app.use((req, _res, next) => {
        req.__ = (key) => key;
        next();
    });

    app.use('/', defaultRouter);

    return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('passwordReset routes', () => {
    let app;

    beforeAll(() => {
        app = buildTestApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    describe('GET /dp-forgot-password', () => {
        it('returns 200 with the forgot-password form', async () => {
            const res = await request(app).get('/dp-forgot-password');
            expect(res.status).toBe(200);
            expect(res.text).toContain('auth/forgot-password');
        });

        it('redirects to /dashboard if already authenticated', async () => {
            const res = await request(app).get('/dp-forgot-password').set('X-Test-User', JSON.stringify(mockUser));
            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dashboard');
        });
    });

    // -----------------------------------------------------------------------
    describe('POST /dp-forgot-password', () => {
        it('with valid email of existing active user: redirects with success flash', async () => {
            vi.mocked(createPasswordResetRequest).mockResolvedValue(undefined);

            const agent = request.agent(app);
            const postRes = await agent.post('/dp-forgot-password').send({ email: 'test@example.com' });
            expect(postRes.status).toBe(302);
            expect(postRes.headers.location).toContain('/dp-forgot-password');

            const getRes = await agent.get('/dp-forgot-password');
            expect(getRes.text).toContain('flash.reset_link_sent');
        });

        it('with non-existent email: redirects with the SAME success flash (anti-enumeration)', async () => {
            vi.mocked(createPasswordResetRequest).mockResolvedValue(undefined);

            const agent = request.agent(app);
            const postRes = await agent.post('/dp-forgot-password').send({ email: 'nobody@example.com' });
            expect(postRes.status).toBe(302);
            expect(postRes.headers.location).toContain('/dp-forgot-password');

            const getRes = await agent.get('/dp-forgot-password');
            expect(getRes.text).toContain('flash.reset_link_sent');
        });

        it('with empty email: redirects with error flash', async () => {
            const agent = request.agent(app);
            const postRes = await agent.post('/dp-forgot-password').send({ email: '' });
            expect(postRes.status).toBe(302);
            expect(postRes.headers.location).toContain('/dp-forgot-password');

            const getRes = await agent.get('/dp-forgot-password');
            expect(getRes.text).toContain('flash.enter_email');
        });
    });

    // -----------------------------------------------------------------------
    describe('GET /dp-reset-password/:token', () => {
        it('with valid token: returns 200 with the reset form', async () => {
            vi.mocked(validateResetToken).mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
            const res = await request(app).get('/dp-reset-password/validtoken123');
            expect(res.status).toBe(200);
            expect(res.text).toContain('auth/reset-password');
        });

        it('with invalid/expired token: redirects to forgot-password with error flash', async () => {
            vi.mocked(validateResetToken).mockResolvedValue(null);

            const agent = request.agent(app);
            const getRes = await agent.get('/dp-reset-password/badtoken');
            expect(getRes.status).toBe(302);
            expect(getRes.headers.location).toContain('/dp-forgot-password');

            const forgotPage = await agent.get('/dp-forgot-password');
            expect(forgotPage.text).toContain('flash.reset_link_invalid');
        });
    });

    // -----------------------------------------------------------------------
    describe('POST /dp-reset-password/:token', () => {
        it('with valid token + matching passwords: resets password, redirects to login with success flash', async () => {
            vi.mocked(resetPassword).mockResolvedValue(true);

            const agent = request.agent(app);
            const postRes = await agent.post('/dp-reset-password/validtoken').send({
                password: 'NewPassword1234!',
                confirm_password: 'NewPassword1234!',
            });
            expect(postRes.status).toBe(302);
            expect(postRes.headers.location).toContain('/dp-login');

            const loginPage = await agent.get('/dp-login');
            expect(loginPage.text).toContain('flash.password_reset_success');
        });

        it('with valid token + mismatching passwords: redirects back with error flash', async () => {
            // Needed for the GET /dp-reset-password/validtoken following the POST redirect
            vi.mocked(validateResetToken).mockResolvedValue({ id: 'user-1', email: 'test@example.com' });

            const agent = request.agent(app);
            const postRes = await agent.post('/dp-reset-password/validtoken').send({
                password: 'NewPassword123!',
                confirm_password: 'DifferentPassword!',
            });
            expect(postRes.status).toBe(302);
            expect(postRes.headers.location).toContain('/dp-reset-password/validtoken');

            const resetPage = await agent.get('/dp-reset-password/validtoken');
            expect(resetPage.text).toContain('flash.passwords_mismatch');
        });

        it('with invalid/expired token: redirects to forgot-password with error flash', async () => {
            vi.mocked(resetPassword).mockResolvedValue(false);

            const agent = request.agent(app);
            const postRes = await agent.post('/dp-reset-password/badtoken').send({
                password: 'NewPassword1234!',
                confirm_password: 'NewPassword1234!',
            });
            expect(postRes.status).toBe(302);
            expect(postRes.headers.location).toContain('/dp-forgot-password');

            const forgotPage = await agent.get('/dp-forgot-password');
            expect(forgotPage.text).toContain('flash.reset_link_invalid');
        });

        it('with weak password: renders reset-password view with error', async () => {
            const res = await request(app).post('/dp-reset-password/validtoken').send({
                password: 'weak',
                confirm_password: 'weak',
            });

            expect(res.status).toBe(200);
            expect(res.text).toContain('auth/reset-password');
            expect(res.text).toContain('password.too_weak');
        });
    });
});

// ---------------------------------------------------------------------------
// Rate limiting tests (use the real forgotPasswordRateLimiter)
// ---------------------------------------------------------------------------

describe('rate limiting: POST /dp-forgot-password', () => {
    let rateLimitApp;

    beforeAll(async () => {
        // vi.importActual bypasses the mock and loads the real module; logger.js
        // remains mocked so auditLogger.warn() inside the handler is a no-op.
        const { forgotPasswordRateLimiter } = await vi.importActual('../../../src/middlewares/loginRateLimiter.js');

        rateLimitApp = express();
        rateLimitApp.use(cookieParser());
        rateLimitApp.use(express.urlencoded({ extended: true }));
        rateLimitApp.use(session({ secret: 'test-rl-secret', resave: false, saveUninitialized: true, cookie: { secure: false } }));
        rateLimitApp.use(flashMessages);
        // Stub i18n: req.__ is needed by rate limiter handlers
        rateLimitApp.use((req, _res, next) => {
            req.__ = (key) => key;
            next();
        });
        // Simple route that always succeeds — rate limiter counts every request
        rateLimitApp.post('/dp-forgot-password', forgotPasswordRateLimiter, (_req, res) => res.status(200).end());
    });

    it('after 3 requests from the same IP, the 4th is blocked with a redirect', async () => {
        const RATE_LIMIT_THRESHOLD = 3; // forgotPasswordRateLimiter max: 3
        for (let i = 0; i < RATE_LIMIT_THRESHOLD; i++) {
            await request(rateLimitApp).post('/dp-forgot-password').send({ email: 'test@example.com' });
        }
        const res = await request(rateLimitApp).post('/dp-forgot-password').send({ email: 'test@example.com' });
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/dp-forgot-password');
    });
});
