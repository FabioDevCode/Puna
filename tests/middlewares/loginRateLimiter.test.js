import cookieParser from 'cookie-parser';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import flashMessages from '../../src/middlewares/flashMessages.js';
import { firstLoginRateLimiter, loginRateLimiter } from '../../src/middlewares/loginRateLimiter.js';

vi.mock('../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    errorLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn().mockResolvedValue(undefined),
    formatBytes: vi.fn((b) => `${b} B`),
}));

// Use an incrementing counter so each test gets a unique login, keeping
// rate-limit counters fully isolated between tests.
let loginSeq = 0;
const uniqueLogin = (prefix = 'user') => `${prefix}-${++loginSeq}`;

function buildApp(limiter, routePath = '/dp-connect', successStatus = 401) {
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(
        session({
            secret: 'test-secret',
            resave: false,
            saveUninitialized: true,
            cookie: { secure: false },
        })
    );
    app.use(flashMessages);
    // Stub i18n: req.__ is needed by rate limiter handlers
    app.use((req, _res, next) => {
        req.__ = (key) => key;
        next();
    });
    app.post(routePath, limiter, (_req, res) => res.status(successStatus).json({ ok: true }));
    return app;
}

describe('loginRateLimiter middleware', () => {
    let app;
    let successApp;

    beforeAll(() => {
        // failApp: route returns 401 (failed request) — counts toward the limit
        app = buildApp(loginRateLimiter, '/dp-connect', 401);
        // successApp: route returns 200 (successful request) — does NOT count
        successApp = buildApp(loginRateLimiter, '/dp-connect', 200);
    });

    it('allows the first 5 failed requests', async () => {
        const login = uniqueLogin('rl');
        for (let i = 0; i < 5; i++) {
            const res = await request(app).post('/dp-connect').send({ login });
            expect(res.status).toBe(401);
        }
    });

    it('blocks the 6th failed request with a redirect to /dp-login', async () => {
        const login = uniqueLogin('rl');
        for (let i = 0; i < 5; i++) {
            await request(app).post('/dp-connect').send({ login });
        }
        const res = await request(app).post('/dp-connect').send({ login });
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/dp-login');
    });

    it('does not count successful requests toward the limit (skipSuccessfulRequests)', async () => {
        const login = uniqueLogin('skip');
        // Send 7 successful requests — none should be blocked
        for (let i = 0; i < 7; i++) {
            const res = await request(successApp).post('/dp-connect').send({ login });
            expect(res.status).toBe(200);
        }
    });

    it('keyGenerator: different logins have independent counters', async () => {
        const loginA = uniqueLogin('key-a');
        const loginB = uniqueLogin('key-b');

        // Exhaust the limit for loginA
        for (let i = 0; i < 5; i++) {
            await request(app).post('/dp-connect').send({ login: loginA });
        }
        const blockedA = await request(app).post('/dp-connect').send({ login: loginA });
        expect(blockedA.status).toBe(302); // loginA is blocked

        // loginB should still be under the limit
        const notBlockedB = await request(app).post('/dp-connect').send({ login: loginB });
        expect(notBlockedB.status).toBe(401); // loginB passes
    });
});

describe('firstLoginRateLimiter middleware', () => {
    let app;

    beforeAll(() => {
        app = buildApp(firstLoginRateLimiter, '/dp-first-connexion', 401);
    });

    it('allows the first 3 failed requests', async () => {
        const login = uniqueLogin('first');
        for (let i = 0; i < 3; i++) {
            const res = await request(app).post('/dp-first-connexion').send({ login });
            expect(res.status).toBe(401);
        }
    });

    it('blocks the 4th failed request with a redirect to /dp-first-connexion', async () => {
        const login = uniqueLogin('first');
        for (let i = 0; i < 3; i++) {
            await request(app).post('/dp-first-connexion').send({ login });
        }
        const res = await request(app).post('/dp-first-connexion').send({ login });
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/dp-first-connexion');
    });
});
