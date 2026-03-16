/**
 * @file tests/integration/routes/userStatus.test.js
 * Integration tests for POST /admin/users/:id/status
 *
 * Tests cover:
 *   - super_admin can change status → 302 redirect to view
 *   - owner can set inactive → 302 redirect to view
 *   - owner cannot ban → 302 redirect (controller handles logic error)
 *   - unauthenticated request → redirect to /dp-login
 *   - editor role → 403 Forbidden
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
    decryptObject: vi.fn(() => ({ id: 'test-site-id', control_code: 'test-control-code' })),
    encryptString: vi.fn(() => 'mock-encrypted-str'),
    decryptString: vi.fn(() => 'mock-decrypted-str'),
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
    twoFaRateLimiter: vi.fn((_req, _res, next) => next()),
    twoFaConfigRateLimiter: vi.fn((_req, _res, next) => next()),
}));
vi.mock('../../../src/services/user.service.js', () => ({
    getUserStatus: vi.fn().mockResolvedValue('active'),
    changeUserStatus: vi.fn().mockResolvedValue({ success: true, previousStatus: 'active', newStatus: 'inactive' }),
}));

vi.mock('../../../src/controllers/admin/index.js', () => ({
    admin: vi.fn((_req, res) => res.status(200).end()),
    adminUsers: vi.fn((_req, res) => res.status(200).end()),
    adminUsersList: vi.fn((_req, res) => res.status(200).json([])),
    adminUsersExportExcel: vi.fn((_req, res) => res.status(200).end()),
    adminUsersExportCSV: vi.fn((_req, res) => res.status(200).end()),
    adminCreateUser: vi.fn((_req, res) => res.redirect('/admin/users')),
    adminDeleteUser: vi.fn((_req, res) => res.redirect('/admin/users')),
    adminViewUser: vi.fn((_req, res) => res.status(200).end()),
    adminEditUser: vi.fn((_req, res) => res.status(200).end()),
    adminUpdateUser: vi.fn((_req, res) => res.redirect('/admin/users')),
    adminChangeUserStatus: vi.fn((_req, res) => res.redirect(`/admin/users/${_req.params.id}/view`)),
    adminSettings: vi.fn((_req, res) => res.status(200).end()),
    logsViewer: vi.fn((_req, res) => res.status(200).end()),
    readLogs: vi.fn((_req, res) => res.json([])),
    getArchives: vi.fn((_req, res) => res.json([])),
}));

vi.mock('../../../src/controllers/dashboard.controller.js', () => ({
    rootRedirect: vi.fn((_req, res) => res.redirect('/dashboard')),
    dashboard: vi.fn((_req, res) => res.status(200).end()),
    dpLogin: vi.fn((_req, res) => res.status(200).end()),
    dpFirstCo: vi.fn((_req, res) => res.status(200).end()),
    getTopFroms: vi.fn((_req, res) => res.json([])),
    getInboxCounts: vi.fn((_req, res) => res.json({})),
    getInboxCountsBySite: vi.fn((_req, res) => res.json([])),
    getInboxHeatmap: vi.fn((_req, res) => res.json([])),
    error: vi.fn((_req, res) => res.status(200).end()),
}));

vi.mock('../../../src/controllers/site.controller.js', () => ({
    allSite: vi.fn((_req, res) => res.status(200).end()),
    createSite: vi.fn((_req, res) => res.redirect('/site/all')),
    showSite: vi.fn((_req, res) => res.status(200).end()),
    deleteSite: vi.fn((_req, res) => res.redirect('/site/all')),
    getSiteToken: vi.fn((_req, res) => res.json({ token: 'mock' })),
    revokeSiteTokens: vi.fn((_req, res) => res.json({ success: true })),
}));

vi.mock('../../../src/controllers/auth.controller.js', () => ({
    dpConnect: vi.fn((_req, res) => res.redirect('/dashboard')),
    dpLogout: vi.fn((_req, res) => res.redirect('/dp-login')),
    dpFirstCoPost: vi.fn((_req, res) => res.redirect('/dp-login')),
}));

vi.mock('../../../src/controllers/form.controller.js', () => ({
    createForm: vi.fn((_req, res) => res.redirect('/site/all')),
    deleteForm: vi.fn((_req, res) => res.redirect('/site/all')),
    getFormInbox: vi.fn((_req, res) => res.status(200).end()),
    updateFormColumns: vi.fn((_req, res) => res.status(200).end()),
    updateFormTemplateSave: vi.fn((_req, res) => res.status(200).end()),
}));

vi.mock('../../../src/controllers/inbox.controller.js', () => ({
    showInbox: vi.fn((_req, res) => res.status(200).end()),
    deleteInbox: vi.fn((_req, res) => res.redirect('back')),
    downloadFile: vi.fn((_req, res) => res.status(200).end()),
}));

vi.mock('../../../src/controllers/export.controller.js', () => ({
    exportFormToExcel: vi.fn((_req, res) => res.status(200).end()),
    exportFormToCSV: vi.fn((_req, res) => res.status(200).end()),
    downloadInboxZip: vi.fn((_req, res) => res.status(200).end()),
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
// Helpers
// ---------------------------------------------------------------------------

function makeSessionUser(role) {
    return JSON.stringify({
        id: `user-${role}-id`,
        login: role,
        email: `${role}@test.com`,
        role,
        status: 'active',
    });
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
        next();
    });

    initializePassport();
    app.use(passport.initialize());
    app.use(passport.session());

    app.use(flashMessages);
    app.use(injectUserRole);

    // Stub res.render — capture status code set by middlewares
    app.use((_req, res, next) => {
        res.render = (_view) => {
            const code = res.statusCode && res.statusCode !== 200 ? res.statusCode : 200;
            res.status(code).send('<html><body>ok</body></html>');
        };
        next();
    });

    app.use('/', defaultRouter);

    return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /admin/users/:id/status', () => {
    let app;
    const TARGET_USER_ID = 'some-target-user-id';

    beforeAll(() => {
        app = buildTestApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('super_admin can change status → 302 to view page', async () => {
        const res = await request(app).post(`/admin/users/${TARGET_USER_ID}/status`).set('X-Test-User', makeSessionUser('super_admin')).send({ status: 'inactive' });

        expect(res.status).toBe(302);
        expect(res.headers.location).toContain(`/admin/users/${TARGET_USER_ID}/view`);
    });

    it('owner can set inactive → 302 to view page', async () => {
        const res = await request(app).post(`/admin/users/${TARGET_USER_ID}/status`).set('X-Test-User', makeSessionUser('owner')).send({ status: 'inactive' });

        expect(res.status).toBe(302);
        expect(res.headers.location).toContain(`/admin/users/${TARGET_USER_ID}/view`);
    });

    it('owner trying to ban → still routed (controller enforces restriction, not RBAC middleware)', async () => {
        // The roleAccess middleware only restricts by role (super_admin/owner), not by status value.
        // Business logic (owner cannot ban) is enforced inside the controller/service.
        // Here we verify the route itself is accessible by owner (gets to the controller).
        const res = await request(app).post(`/admin/users/${TARGET_USER_ID}/status`).set('X-Test-User', makeSessionUser('owner')).send({ status: 'banned' });

        // The mocked controller redirects, so we expect 302
        expect(res.status).toBe(302);
    });

    it('unauthenticated request → redirects to /dp-login', async () => {
        const res = await request(app).post(`/admin/users/${TARGET_USER_ID}/status`).send({ status: 'inactive' });

        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/dp-login');
    });

    it('editor role → 403 Forbidden', async () => {
        const res = await request(app).post(`/admin/users/${TARGET_USER_ID}/status`).set('X-Test-User', makeSessionUser('editor')).send({ status: 'inactive' });

        expect(res.status).toBe(403);
    });
});

// ---------------------------------------------------------------------------
// POST /admin/users/delete — soft delete (super_admin only)
// ---------------------------------------------------------------------------

describe('POST /admin/users/delete', () => {
    let app;

    beforeAll(() => {
        app = buildTestApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('super_admin can soft-delete a user → 302 redirect to /admin/users', async () => {
        const res = await request(app).post('/admin/users/delete').set('X-Test-User', makeSessionUser('super_admin')).send({ user_id: 'some-target-user-id', password: 'secret' });

        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/admin/users');
    });

    it('owner → 403 Forbidden (route restricted to super_admin)', async () => {
        const res = await request(app).post('/admin/users/delete').set('X-Test-User', makeSessionUser('owner')).send({ user_id: 'some-target-user-id', password: 'secret' });

        expect(res.status).toBe(403);
    });

    it('unauthenticated → redirects to /dp-login', async () => {
        const res = await request(app).post('/admin/users/delete').send({ user_id: 'some-target-user-id', password: 'secret' });

        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/dp-login');
    });

    it('editor role → 403 Forbidden', async () => {
        const res = await request(app).post('/admin/users/delete').set('X-Test-User', makeSessionUser('editor')).send({ user_id: 'some-target-user-id', password: 'secret' });

        expect(res.status).toBe(403);
    });
});
