import { describe, expect, it, vi } from 'vitest';
import { actionAccess, logAccess, requireAdmin, requireOwner, requireRoleAndPermission, roleAccess } from '../../src/middlewares/checkAccess.js';

vi.mock('../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    errorLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn().mockResolvedValue(undefined),
    formatBytes: vi.fn((b) => `${b} B`),
}));

describe('checkAccess middleware', () => {
    function makeReq(role) {
        if (!role) {
            return { path: '/test', method: 'GET', session: {}, __: (key) => key };
        }
        return {
            path: '/test',
            method: 'GET',
            session: { user: { id: 'user-1', login: role, role } },
            __: (key) => key,
        };
    }

    function makeRes() {
        return {
            status: vi.fn().mockReturnThis(),
            render: vi.fn(),
            redirect: vi.fn(),
        };
    }

    describe('actionAccess', () => {
        it('redirects to /dp-login when there is no session user', () => {
            const req = makeReq(null);
            const res = makeRes();
            const next = vi.fn();
            actionAccess('site', 'create')(req, res, next);
            expect(res.redirect).toHaveBeenCalledWith('/dp-login');
            expect(next).not.toHaveBeenCalled();
        });

        it('redirects to /dp-login when session user has no role', () => {
            const req = { path: '/test', method: 'GET', session: { user: { id: '1', login: 'x' } } };
            const res = makeRes();
            const next = vi.fn();
            actionAccess('site', 'create')(req, res, next);
            expect(res.redirect).toHaveBeenCalledWith('/dp-login');
            expect(next).not.toHaveBeenCalled();
        });

        it('calls next() for super_admin with site:create permission', () => {
            const req = makeReq('super_admin');
            const res = makeRes();
            const next = vi.fn();
            actionAccess('site', 'create')(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('returns 403 for viewer with form:delete (permission denied)', () => {
            const req = makeReq('viewer');
            const res = makeRes();
            const next = vi.fn();
            actionAccess('form', 'delete')(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it('calls next() for editor with inbox:read permission', () => {
            const req = makeReq('editor');
            const res = makeRes();
            const next = vi.fn();
            actionAccess('inbox', 'read')(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
    });

    describe('roleAccess', () => {
        it('redirects to /dp-login when there is no session user', () => {
            const req = makeReq(null);
            const res = makeRes();
            const next = vi.fn();
            roleAccess(['super_admin', 'owner'])(req, res, next);
            expect(res.redirect).toHaveBeenCalledWith('/dp-login');
            expect(next).not.toHaveBeenCalled();
        });

        it('calls next() for super_admin when role is in the allowed list', () => {
            const req = makeReq('super_admin');
            const res = makeRes();
            const next = vi.fn();
            roleAccess(['super_admin', 'owner'])(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('returns 403 for viewer when role is not in the allowed list', () => {
            const req = makeReq('viewer');
            const res = makeRes();
            const next = vi.fn();
            roleAccess(['super_admin', 'owner'])(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it('calls next() for beta when role is in the allowed list', () => {
            const req = makeReq('beta');
            const res = makeRes();
            const next = vi.fn();
            roleAccess(['super_admin', 'owner', 'beta'])(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('redirects to /dp-login when session user has no role', () => {
            const req = { path: '/test', method: 'GET', session: { user: { id: '1', login: 'x' } } };
            const res = makeRes();
            const next = vi.fn();
            roleAccess(['super_admin'])(req, res, next);
            expect(res.redirect).toHaveBeenCalledWith('/dp-login');
            expect(next).not.toHaveBeenCalled();
        });

        it('returns 403 for editor when role is not in the allowed list', () => {
            const req = makeReq('editor');
            const res = makeRes();
            const next = vi.fn();
            roleAccess(['super_admin', 'owner'])(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('requireAdmin', () => {
        it('calls next() for super_admin', () => {
            const req = makeReq('super_admin');
            const res = makeRes();
            const next = vi.fn();
            requireAdmin()(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('returns 403 for owner (not super_admin)', () => {
            const req = makeReq('owner');
            const res = makeRes();
            const next = vi.fn();
            requireAdmin()(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it('returns 403 for editor', () => {
            const req = makeReq('editor');
            const res = makeRes();
            const next = vi.fn();
            requireAdmin()(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('returns 403 for viewer', () => {
            const req = makeReq('viewer');
            const res = makeRes();
            const next = vi.fn();
            requireAdmin()(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('returns 403 for beta', () => {
            const req = makeReq('beta');
            const res = makeRes();
            const next = vi.fn();
            requireAdmin()(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('requireOwner', () => {
        it('calls next() for super_admin', () => {
            const req = makeReq('super_admin');
            const res = makeRes();
            const next = vi.fn();
            requireOwner()(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('calls next() for owner', () => {
            const req = makeReq('owner');
            const res = makeRes();
            const next = vi.fn();
            requireOwner()(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('returns 403 for beta', () => {
            const req = makeReq('beta');
            const res = makeRes();
            const next = vi.fn();
            requireOwner()(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('returns 403 for editor', () => {
            const req = makeReq('editor');
            const res = makeRes();
            const next = vi.fn();
            requireOwner()(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('returns 403 for viewer', () => {
            const req = makeReq('viewer');
            const res = makeRes();
            const next = vi.fn();
            requireOwner()(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('requireRoleAndPermission', () => {
        it('calls next() when role is allowed and action is permitted', () => {
            const req = makeReq('super_admin');
            const res = makeRes();
            const next = vi.fn();
            requireRoleAndPermission(['super_admin', 'owner'], 'site', 'create')(req, res, next);
            expect(next).toHaveBeenCalledWith();
        });

        it('returns 403 when role is not in the allowed list', () => {
            const req = makeReq('viewer');
            const res = makeRes();
            const next = vi.fn();
            requireRoleAndPermission(['super_admin', 'owner'], 'site', 'create')(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it('returns 403 when role is allowed but action is not permitted', () => {
            const req = makeReq('editor');
            const res = makeRes();
            const next = vi.fn();
            // editor cannot create users
            requireRoleAndPermission(['editor'], 'user', 'create')(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('logAccess', () => {
        it('calls next() and logs when user is in session', () => {
            const req = {
                ...makeReq('editor'),
                params: { id: '1' },
                query: {},
                ip: '127.0.0.1',
                get: vi.fn().mockReturnValue('test-agent'),
            };
            const res = makeRes();
            const next = vi.fn();
            logAccess('inbox')(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('calls next() without logging when no user in session', () => {
            const req = { path: '/test', method: 'GET', session: {}, params: {}, query: {} };
            const res = makeRes();
            const next = vi.fn();
            logAccess()(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('calls next() without resourceType when not provided', () => {
            const req = {
                ...makeReq('super_admin'),
                params: {},
                query: {},
                ip: '127.0.0.1',
                get: vi.fn().mockReturnValue('agent'),
            };
            const res = makeRes();
            const next = vi.fn();
            logAccess()(req, res, next);
            expect(next).toHaveBeenCalled();
        });
    });
});
