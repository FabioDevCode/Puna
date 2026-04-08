import { describe, expect, it, vi } from 'vitest';
import { getUser, getUserId, getUserRole, injectUserRole, requireAuth } from '../../../src/middlewares/injectUserRole.js';

vi.mock('../../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    errorLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn().mockResolvedValue(undefined),
    formatBytes: vi.fn((b) => `${b} B`),
}));

function makeUser(overrides = {}) {
    return { id: 'user-uuid-1', login: 'testuser', role: 'editor', ...overrides };
}

function makeReq(user = null) {
    return {
        path: '/test',
        method: 'GET',
        ip: '127.0.0.1',
        session: user ? { user } : {},
    };
}

function makeRes() {
    const locals = {};
    return {
        locals,
        redirect: vi.fn(),
    };
}

describe('injectUserRole middleware', () => {
    describe('injectUserRole', () => {
        it('injects role, id and user into req and res.locals for an authenticated user', () => {
            const user = makeUser({ role: 'owner' });
            const req = makeReq(user);
            const res = makeRes();
            const next = vi.fn();

            injectUserRole(req, res, next);

            expect(req.userRole).toBe('owner');
            expect(req.userId).toBe('user-uuid-1');
            expect(res.locals.connectedUser).toEqual(user);
            expect(res.locals.userRole).toBe('owner');
            expect(res.locals.userId).toBe('user-uuid-1');
            expect(res.locals.isAuthenticated).toBe(true);
            expect(next).toHaveBeenCalled();
        });

        it('sets null values and isAuthenticated=false when no session user', () => {
            const req = makeReq(null);
            const res = makeRes();
            const next = vi.fn();

            injectUserRole(req, res, next);

            expect(req.userRole).toBeNull();
            expect(req.userId).toBeNull();
            expect(res.locals.connectedUser).toBeNull();
            expect(res.locals.userRole).toBeNull();
            expect(res.locals.userId).toBeNull();
            expect(res.locals.isAuthenticated).toBe(false);
            expect(next).toHaveBeenCalled();
        });

        it('sets userRole to null when session user has no role', () => {
            const user = makeUser({ role: undefined });
            const req = makeReq(user);
            const res = makeRes();
            const next = vi.fn();

            injectUserRole(req, res, next);

            expect(req.userRole).toBeNull();
            expect(res.locals.userRole).toBeNull();
            expect(res.locals.isAuthenticated).toBe(true);
            expect(next).toHaveBeenCalled();
        });

        it('sets userId to null when session user has no id', () => {
            const user = makeUser({ id: undefined });
            const req = makeReq(user);
            const res = makeRes();
            const next = vi.fn();

            injectUserRole(req, res, next);

            expect(req.userId).toBeNull();
            expect(res.locals.userId).toBeNull();
            expect(next).toHaveBeenCalled();
        });

        it('always calls next() even with no session object', () => {
            const req = { session: null };
            const res = makeRes();
            const next = vi.fn();

            injectUserRole(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });

    describe('getUserRole', () => {
        it('returns the role when session user exists', () => {
            const req = makeReq(makeUser({ role: 'super_admin' }));
            expect(getUserRole(req)).toBe('super_admin');
        });

        it('returns null when no session', () => {
            expect(getUserRole({ session: null })).toBeNull();
        });

        it('returns null when session has no user', () => {
            expect(getUserRole({ session: {} })).toBeNull();
        });

        it('returns null when user has no role', () => {
            const req = makeReq({ id: '1', login: 'x' });
            expect(getUserRole(req)).toBeNull();
        });
    });

    describe('getUserId', () => {
        it('returns the id when session user exists', () => {
            const req = makeReq(makeUser({ id: 'abc-123' }));
            expect(getUserId(req)).toBe('abc-123');
        });

        it('returns null when no session', () => {
            expect(getUserId({ session: null })).toBeNull();
        });

        it('returns null when session has no user', () => {
            expect(getUserId({ session: {} })).toBeNull();
        });
    });

    describe('getUser', () => {
        it('returns the full user object when session user exists', () => {
            const user = makeUser();
            const req = makeReq(user);
            expect(getUser(req)).toEqual(user);
        });

        it('returns null when no session', () => {
            expect(getUser({ session: null })).toBeNull();
        });

        it('returns null when session has no user', () => {
            expect(getUser({ session: {} })).toBeNull();
        });
    });

    describe('requireAuth', () => {
        it('calls next() when user is authenticated', () => {
            const req = makeReq(makeUser());
            const res = makeRes();
            const next = vi.fn();

            requireAuth(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.redirect).not.toHaveBeenCalled();
        });

        it('redirects to /dp-login when no session', () => {
            const req = { path: '/test', method: 'GET', ip: '127.0.0.1', session: null };
            const res = makeRes();
            const next = vi.fn();

            requireAuth(req, res, next);

            expect(res.redirect).toHaveBeenCalledWith('/dp-login');
            expect(next).not.toHaveBeenCalled();
        });

        it('redirects to /dp-login when session has no user', () => {
            const req = makeReq(null);
            const res = makeRes();
            const next = vi.fn();

            requireAuth(req, res, next);

            expect(res.redirect).toHaveBeenCalledWith('/dp-login');
            expect(next).not.toHaveBeenCalled();
        });
    });
});
