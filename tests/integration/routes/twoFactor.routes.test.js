/**
 * @file tests/integration/routes/twoFactor.routes.test.js
 * Integration tests for 2FA configuration routes
 *
 * Routes tested:
 *   GET  /dp-2fa-setup          — 2FA setup page (requires auth)
 *   POST /dp-2fa-setup          — verify TOTP code and enable 2FA (requires auth)
 *   GET  /dp-2fa-backup-codes   — display backup codes once (requires auth)
 *   POST /dp-2fa-disable        — disable 2FA (requires auth + password)
 *   POST /dp-2fa-regenerate     — regenerate backup codes (requires auth + password)
 *   POST /dp-dismiss-2fa-banner — dismiss the 2FA suggestion banner (requires auth)
 */

import cookieParser from 'cookie-parser';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializePassport } from '../../../src/helpers/authHelper.js';
import flashMessages from '../../../src/middlewares/flashMessages.js';
import { injectUserRole } from '../../../src/middlewares/injectUserRole.js';
import defaultRouter from '../../../src/routes/default.routes.js';

// ---------------------------------------------------------------------------
// Mocks
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
    decryptObject: vi.fn(() => []),
    encryptString: vi.fn(() => 'mock-encrypted-str'),
    decryptString: vi.fn(() => 'MOCK32BASE32SECRET'),
}));

vi.mock('../../../src/models/index.js', () => ({
    default: {
        User: {
            findOne: vi.fn().mockResolvedValue(null),
            findByPk: vi.fn().mockResolvedValue(null),
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
        Inbox: { count: vi.fn().mockResolvedValue(0), create: vi.fn() },
        SiteUser: { findAll: vi.fn().mockResolvedValue([]) },
        sequelize: {
            sync: vi.fn().mockResolvedValue(undefined),
            query: vi.fn().mockResolvedValue([]),
        },
        Sequelize: { QueryTypes: { SELECT: 'SELECT' } },
        Op: {},
    },
}));

vi.mock('../../../src/middlewares/loginRateLimiter.js', () => ({
    loginRateLimiter: vi.fn((_req, _res, next) => next()),
    firstLoginRateLimiter: vi.fn((_req, _res, next) => next()),
    forgotPasswordRateLimiter: vi.fn((_req, _res, next) => next()),
    resetPasswordRateLimiter: vi.fn((_req, _res, next) => next()),
    twoFaConfigRateLimiter: vi.fn((_req, _res, next) => next()),
}));

vi.mock('../../../src/services/user.service.js', () => ({
    getUserStatus: vi.fn().mockResolvedValue('active'),
    changeUserStatus: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../../src/services/twoFactor.service.js', () => ({
    generateTotpSetup: vi.fn().mockResolvedValue({
        secret: 'MOCK32BASE32SECRET',
        qrCodeDataUrl: 'data:image/png;base64,MOCKQR',
        otpauthUrl: 'otpauth://totp/Puna:testuser?secret=MOCK32BASE32SECRET&issuer=Puna',
    }),
    verifyTotpToken: vi.fn().mockReturnValue(true),
    generateBackupCodes: vi.fn().mockResolvedValue({
        plainCodes: ['aaaa-bbbb', 'cccc-dddd', 'eeee-ffff', 'gggg-hhhh', 'iiii-jjjj', 'kkkk-llll', 'mmmm-nnnn', 'oooo-pppp'],
        hashedCodes: ['hashed1', 'hashed2', 'hashed3', 'hashed4', 'hashed5', 'hashed6', 'hashed7', 'hashed8'],
    }),
    enableTotpForUser: vi.fn().mockResolvedValue(true),
    disableTotpForUser: vi.fn().mockResolvedValue(true),
    regenerateBackupCodes: vi.fn().mockResolvedValue({
        plainCodes: ['aaaa-bbbb', 'cccc-dddd', 'eeee-ffff', 'gggg-hhhh', 'iiii-jjjj', 'kkkk-llll', 'mmmm-nnnn', 'oooo-pppp'],
    }),
    getTotpStatus: vi.fn().mockResolvedValue({ enabled: false, backupCodesRemaining: 0 }),
    verifyBackupCode: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock('../../../src/services/auth.service.js', () => ({
    findUserByLogin: vi.fn().mockResolvedValue(null),
    activateUserAccount: vi.fn().mockResolvedValue(true),
    authenticateUserByLogin: vi.fn().mockResolvedValue(null),
    hashPassword: vi.fn().mockResolvedValue('$2b$10$hashed'),
    verifyPassword: vi.fn().mockResolvedValue(true),
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

vi.mock('otpauth', () => {
    class MockSecret {
        static fromBase32(_str) {
            return new MockSecret();
        }
    }
    class MockTOTP {
        constructor(_opts) {}
        validate(_opts) {
            return 0; // valid by default
        }
    }
    return { TOTP: MockTOTP, Secret: MockSecret };
});

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
// Helpers
// ---------------------------------------------------------------------------

const mockUser = {
    id: 'user-id-1',
    login: 'testuser',
    email: 'test@example.com',
    role: 'viewer',
    status: 'active',
};

function makeSessionUser(user = mockUser) {
    return JSON.stringify(user);
}

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

    // Inject test user from request header
    app.use((req, _res, next) => {
        const header = req.headers['x-test-user'];
        if (header) {
            try {
                req.session.user = JSON.parse(header);
            } catch {
                // ignore malformed header
            }
        }
        // Inject totp_temp_secret if specified
        const totpSecret = req.headers['x-test-totp-secret'];
        if (totpSecret) {
            req.session.totp_temp_secret = totpSecret;
        }
        // Inject backup codes if specified
        const backupCodes = req.headers['x-test-backup-codes'];
        if (backupCodes) {
            try {
                req.session.totp_backup_codes_plain = JSON.parse(backupCodes);
            } catch {
                // ignore
            }
        }
        next();
    });

    initializePassport();
    app.use(passport.initialize());
    app.use(passport.session());

    app.use(flashMessages);
    app.use(injectUserRole);

    // Stub res.render
    app.use((_req, res, next) => {
        res.render = (view) => {
            const code = res.statusCode && res.statusCode !== 200 ? res.statusCode : 200;
            res.status(code).send(`<html><body>${view}</body></html>`);
        };
        next();
    });

    app.use('/', defaultRouter);

    return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('2FA configuration routes', () => {
    let app;

    beforeAll(() => {
        app = buildTestApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    describe('GET /dp-2fa-setup', () => {
        it('redirects to /dp-login when unauthenticated', async () => {
            const res = await request(app).get('/dp-2fa-setup');

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dp-login');
        });

        it('renders setup page when authenticated and 2FA not enabled', async () => {
            const { getTotpStatus } = await import('../../../src/services/twoFactor.service.js');
            vi.mocked(getTotpStatus).mockResolvedValueOnce({ enabled: false, backupCodesRemaining: 0 });

            const res = await request(app).get('/dp-2fa-setup').set('X-Test-User', makeSessionUser());

            expect(res.status).toBe(200);
            expect(res.text).toContain('auth/two-factor-setup');
        });

        it('redirects to /dashboard when 2FA is already enabled', async () => {
            const { getTotpStatus } = await import('../../../src/services/twoFactor.service.js');
            vi.mocked(getTotpStatus).mockResolvedValueOnce({ enabled: true, backupCodesRemaining: 5 });

            const res = await request(app).get('/dp-2fa-setup').set('X-Test-User', makeSessionUser());

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dashboard');
        });
    });

    // -----------------------------------------------------------------------
    describe('POST /dp-2fa-setup', () => {
        it('redirects to /dp-login when unauthenticated', async () => {
            const res = await request(app).post('/dp-2fa-setup').send({ totp_code: '123456' });

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dp-login');
        });

        it('redirects to /dp-2fa-setup when no temp secret in session', async () => {
            const agent = request.agent(app);

            // Set user but no totp_temp_secret
            const res = await agent.post('/dp-2fa-setup').set('X-Test-User', makeSessionUser()).send({ totp_code: '123456' });

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dp-2fa-setup');
        });

        it('redirects to /dp-2fa-backup-codes on valid TOTP code', async () => {
            const { generateBackupCodes, enableTotpForUser } = await import('../../../src/services/twoFactor.service.js');
            vi.mocked(generateBackupCodes).mockResolvedValueOnce({
                plainCodes: ['aaaa-bbbb', 'cccc-dddd', 'eeee-ffff', 'gggg-hhhh', 'iiii-jjjj', 'kkkk-llll', 'mmmm-nnnn', 'oooo-pppp'],
                hashedCodes: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8'],
            });
            vi.mocked(enableTotpForUser).mockResolvedValueOnce(true);

            const res = await request(app)
                .post('/dp-2fa-setup')
                .set('X-Test-User', makeSessionUser())
                .set('X-Test-Totp-Secret', 'MOCK32BASE32SECRET')
                .send({ totp_code: '123456' });

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dp-2fa-backup-codes');
        });
    });

    // -----------------------------------------------------------------------
    describe('GET /dp-2fa-backup-codes', () => {
        it('redirects to /dp-login when unauthenticated', async () => {
            const res = await request(app).get('/dp-2fa-backup-codes');

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dp-login');
        });

        it('redirects to /dashboard when no backup codes in session', async () => {
            const res = await request(app).get('/dp-2fa-backup-codes').set('X-Test-User', makeSessionUser());

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dashboard');
        });

        it('renders backup codes page when codes are in session', async () => {
            const codes = ['aaaa-bbbb', 'cccc-dddd'];
            const res = await request(app).get('/dp-2fa-backup-codes').set('X-Test-User', makeSessionUser()).set('X-Test-Backup-Codes', JSON.stringify(codes));

            expect(res.status).toBe(200);
            expect(res.text).toContain('auth/two-factor-backup-codes');
        });
    });

    // -----------------------------------------------------------------------
    describe('POST /dp-2fa-disable', () => {
        it('redirects to /dp-login when unauthenticated', async () => {
            const res = await request(app).post('/dp-2fa-disable').send({ password: 'secret' });

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dp-login');
        });

        it('redirects to /dashboard when user not found', async () => {
            const models = (await import('../../../src/models/index.js')).default;
            vi.mocked(models.User.findByPk).mockResolvedValueOnce(null);

            const res = await request(app).post('/dp-2fa-disable').set('X-Test-User', makeSessionUser()).send({ password: 'secret' });

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dashboard');
        });

        it('redirects to /dashboard with error when password is wrong', async () => {
            const models = (await import('../../../src/models/index.js')).default;
            vi.mocked(models.User.findByPk).mockResolvedValueOnce({ id: 'user-id-1', password: '$2b$10$hash' });

            const { verifyPassword } = await import('../../../src/services/auth.service.js');
            vi.mocked(verifyPassword).mockResolvedValueOnce(false);

            const agent = request.agent(app);
            const postRes = await agent.post('/dp-2fa-disable').set('X-Test-User', makeSessionUser()).send({ password: 'wrongpassword' });

            expect(postRes.status).toBe(302);
            expect(postRes.headers.location).toContain('/dashboard');
        });

        it('disables 2FA and redirects to /dashboard on valid password', async () => {
            const models = (await import('../../../src/models/index.js')).default;
            vi.mocked(models.User.findByPk).mockResolvedValueOnce({ id: 'user-id-1', password: '$2b$10$hash' });

            const { verifyPassword } = await import('../../../src/services/auth.service.js');
            vi.mocked(verifyPassword).mockResolvedValueOnce(true);
            const { disableTotpForUser: disable } = await import('../../../src/services/twoFactor.service.js');
            vi.mocked(disable).mockResolvedValueOnce(true);

            const res = await request(app).post('/dp-2fa-disable').set('X-Test-User', makeSessionUser()).send({ password: 'correct' });

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dashboard');
        });
    });

    // -----------------------------------------------------------------------
    describe('POST /dp-2fa-regenerate', () => {
        it('redirects to /dp-login when unauthenticated', async () => {
            const res = await request(app).post('/dp-2fa-regenerate').send({ password: 'secret' });

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dp-login');
        });

        it('redirects to /dashboard when user not found', async () => {
            const models = (await import('../../../src/models/index.js')).default;
            vi.mocked(models.User.findByPk).mockResolvedValueOnce(null);

            const res = await request(app).post('/dp-2fa-regenerate').set('X-Test-User', makeSessionUser()).send({ password: 'secret' });

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dashboard');
        });

        it('redirects to /dp-2fa-backup-codes on success', async () => {
            const models = (await import('../../../src/models/index.js')).default;
            vi.mocked(models.User.findByPk).mockResolvedValueOnce({ id: 'user-id-1', password: '$2b$10$hash' });

            const { verifyPassword } = await import('../../../src/services/auth.service.js');
            vi.mocked(verifyPassword).mockResolvedValueOnce(true);

            const { regenerateBackupCodes } = await import('../../../src/services/twoFactor.service.js');
            vi.mocked(regenerateBackupCodes).mockResolvedValueOnce({ plainCodes: ['aaaa-bbbb'] });

            const res = await request(app).post('/dp-2fa-regenerate').set('X-Test-User', makeSessionUser()).send({ password: 'correct' });

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dp-2fa-backup-codes');
        });
    });

    // -----------------------------------------------------------------------
    describe('POST /dp-dismiss-2fa-banner', () => {
        it('redirects to /dp-login when unauthenticated', async () => {
            const res = await request(app).post('/dp-dismiss-2fa-banner');

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dp-login');
        });

        it('redirects to /dashboard when authenticated', async () => {
            const res = await request(app).post('/dp-dismiss-2fa-banner').set('X-Test-User', makeSessionUser());

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/dashboard');
        });
    });
});
