import { describe, expect, it, vi } from 'vitest';
import { actionAccess, roleAccess } from '../../src/middlewares/checkAccess.js';

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
    });
});
