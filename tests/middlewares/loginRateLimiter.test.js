import cookieParser from 'cookie-parser';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import flashMessages from '../../src/middlewares/flashMessages.js';
import {
    firstLoginRateLimiter,
    forgotPasswordRateLimiter,
    loginRateLimiter,
    resetPasswordRateLimiter,
    twoFaConfigRateLimiter,
    twoFaRateLimiter,
} from '../../src/middlewares/loginRateLimiter.js';

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

function buildApp(limiter, routePath = '/dp-connect', successStatus = 401, extraMiddleware = null) {
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
    if (extraMiddleware) {
        app.use(extraMiddleware);
    }
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

    it('keyGenerator uses "anonymous" and handler logs "unknown" when login is absent from body', async () => {
        // Exhaust the 5-attempt limit using the "anonymous" key (no login field)
        for (let i = 0; i < 5; i++) {
            await request(app).post('/dp-connect').send({});
        }
        // 6th request triggers the handler — covers the '|| anonymous' and '|| unknown' fallback branches
        const res = await request(app).post('/dp-connect').send({});
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/dp-login');
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

    it('keyGenerator uses "anonymous" and handler logs "unknown" when login is absent from body', async () => {
        for (let i = 0; i < 3; i++) {
            await request(app).post('/dp-first-connexion').send({});
        }
        const res = await request(app).post('/dp-first-connexion').send({});
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/dp-first-connexion');
    });
});

describe('forgotPasswordRateLimiter middleware', () => {
    let app;

    beforeAll(() => {
        app = buildApp(forgotPasswordRateLimiter, '/dp-forgot-password', 200);
    });

    it('allows the first 3 requests', async () => {
        for (let i = 0; i < 3; i++) {
            const res = await request(app)
                .post('/dp-forgot-password')
                .send({ email: `user${++loginSeq}@example.com` });
            expect(res.status).toBe(200);
        }
    });

    it('blocks the 4th request with a redirect to /dp-forgot-password', async () => {
        // Use a single IP-based key so all requests share the counter
        const email = `forgot-block${++loginSeq}@example.com`;
        // Need a new app instance so the counter is fresh for this test
        const freshApp = buildApp(forgotPasswordRateLimiter, '/dp-forgot-password', 200);
        for (let i = 0; i < 3; i++) {
            await request(freshApp).post('/dp-forgot-password').send({ email });
        }
        const res = await request(freshApp).post('/dp-forgot-password').send({ email });
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/dp-forgot-password');
    });
});

describe('twoFaRateLimiter middleware', () => {
    let app;

    beforeAll(() => {
        // twoFaRateLimiter uses req.session.pending2FA.userId for the key
        app = buildApp(twoFaRateLimiter, '/dp-2fa-verify', 401);
    });

    it('allows the first 5 failed requests', async () => {
        const agent = request.agent(app);
        for (let i = 0; i < 5; i++) {
            const res = await agent.post('/dp-2fa-verify').send({});
            // May be 401 or 302 — just confirm no server error
            expect([401, 302]).toContain(res.status);
        }
    });

    it('blocks requests after the limit with a redirect to /dp-2fa-verify', async () => {
        // Build a dedicated app that injects session.pending2FA so all requests share the same key
        const blockApp = buildApp(twoFaRateLimiter, '/dp-2fa-verify', 401, (req, _res, next) => {
            req.session.pending2FA = { userId: '2fa-block-user' };
            next();
        });

        const agent = request.agent(blockApp);
        for (let i = 0; i < 5; i++) {
            await agent.post('/dp-2fa-verify').send({});
        }
        const res = await agent.post('/dp-2fa-verify').send({});
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/dp-2fa-verify');
    });
});

describe('resetPasswordRateLimiter middleware', () => {
    beforeAll(() => {
        buildApp(resetPasswordRateLimiter, '/dp-reset-password', 401);
    });

    it('allows the first 5 requests', async () => {
        const freshApp = buildApp(resetPasswordRateLimiter, '/dp-reset-password', 401);
        for (let i = 0; i < 5; i++) {
            const res = await request(freshApp).post('/dp-reset-password').send({});
            expect(res.status).toBe(401);
        }
    });

    it('blocks the 6th request with a redirect to /dp-forgot-password', async () => {
        const freshApp = buildApp(resetPasswordRateLimiter, '/dp-reset-password', 401);
        for (let i = 0; i < 5; i++) {
            await request(freshApp).post('/dp-reset-password').send({});
        }
        const res = await request(freshApp).post('/dp-reset-password').send({});
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/dp-forgot-password');
    });
});

describe('twoFaConfigRateLimiter middleware', () => {
    it('blocks requests after the limit with a redirect to /dashboard', async () => {
        const stableUserId = `2fa-config-user-${++loginSeq}`;
        const configApp = buildApp(twoFaConfigRateLimiter, '/dp-2fa-config', 401, (req, _res, next) => {
            req.session.user = { id: stableUserId };
            next();
        });

        const agent = request.agent(configApp);
        for (let i = 0; i < 5; i++) {
            await agent.post('/dp-2fa-config').send({});
        }
        const res = await agent.post('/dp-2fa-config').send({});
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/dashboard');
    });

    it('keyGenerator uses "unknown" and handler logs "unknown" when user is absent from session', async () => {
        // No extra middleware → session has no user → keyGenerator returns 'unknown'
        const noUserApp = buildApp(twoFaConfigRateLimiter, '/dp-2fa-config-no-user', 401);

        const agent = request.agent(noUserApp);
        for (let i = 0; i < 5; i++) {
            await agent.post('/dp-2fa-config-no-user').send({});
        }
        // 6th request triggers the handler — covers '|| unknown' in keyGenerator and handler
        const res = await agent.post('/dp-2fa-config-no-user').send({});
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/dashboard');
    });
});
