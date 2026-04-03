import { beforeEach, describe, expect, it, vi } from 'vitest';
import checkUserStatus, { STATUS_CHECK_TTL_MS } from '../../src/middlewares/checkUserStatus.js';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    errorLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn().mockResolvedValue(undefined),
    formatBytes: vi.fn((b) => `${b} B`),
}));

const mockGetUserStatus = vi.fn();
vi.mock('../../src/services/user.service.js', () => ({
    getUserStatus: (...args) => mockGetUserStatus(...args),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeReq(overrides = {}) {
    return {
        ip: '127.0.0.1',
        session: {
            user: { id: 'user-uuid-1', login: 'testuser' },
            statusCheckedAt: 0, // expired by default
            destroy: vi.fn((cb) => cb && cb()),
            save: vi.fn((cb) => cb && cb()),
            ...overrides.session,
        },
        ...overrides,
    };
}

function makeRes() {
    return {
        flash: vi.fn(),
        redirect: vi.fn(),
        __: (key) => key,
    };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('checkUserStatus middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls next() and updates statusCheckedAt when status is active', async () => {
        mockGetUserStatus.mockResolvedValue('active');
        const req = makeReq();
        const res = makeRes();
        const next = vi.fn();

        await checkUserStatus(req, res, next);

        expect(mockGetUserStatus).toHaveBeenCalledWith('user-uuid-1');
        expect(next).toHaveBeenCalledOnce();
        expect(req.session.destroy).not.toHaveBeenCalled();
        expect(res.redirect).not.toHaveBeenCalled();
        expect(req.session.statusCheckedAt).toBeGreaterThan(0);
    });

    it('destroys session and redirects when status is inactive', async () => {
        mockGetUserStatus.mockResolvedValue('inactive');
        const req = makeReq();
        const res = makeRes();
        const next = vi.fn();

        await checkUserStatus(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(req.session.destroy).toHaveBeenCalledOnce();
        expect(res.redirect).toHaveBeenCalledWith('/dp-login');
        expect(res.flash).toHaveBeenCalledWith('error', 'flash.status_inactive');
    });

    it('destroys session and redirects when status is suspended', async () => {
        mockGetUserStatus.mockResolvedValue('suspended');
        const req = makeReq();
        const res = makeRes();
        const next = vi.fn();

        await checkUserStatus(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(req.session.destroy).toHaveBeenCalledOnce();
        expect(res.redirect).toHaveBeenCalledWith('/dp-login');
        expect(res.flash).toHaveBeenCalledWith('error', 'flash.status_suspended');
    });

    it('destroys session and redirects when status is banned', async () => {
        mockGetUserStatus.mockResolvedValue('banned');
        const req = makeReq();
        const res = makeRes();
        const next = vi.fn();

        await checkUserStatus(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(req.session.destroy).toHaveBeenCalledOnce();
        expect(res.redirect).toHaveBeenCalledWith('/dp-login');
        expect(res.flash).toHaveBeenCalledWith('error', 'flash.status_banned');
    });

    it('destroys session and redirects when status is anonymized', async () => {
        mockGetUserStatus.mockResolvedValue('anonymized');
        const req = makeReq();
        const res = makeRes();
        const next = vi.fn();

        await checkUserStatus(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(req.session.destroy).toHaveBeenCalledOnce();
        expect(res.redirect).toHaveBeenCalledWith('/dp-login');
        expect(res.flash).toHaveBeenCalledWith('error', 'flash.status_anonymized');
    });

    it('destroys session and redirects when user does not exist in DB (null status)', async () => {
        mockGetUserStatus.mockResolvedValue(null);
        const req = makeReq();
        const res = makeRes();
        const next = vi.fn();

        await checkUserStatus(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(req.session.destroy).toHaveBeenCalledOnce();
        expect(res.redirect).toHaveBeenCalledWith('/dp-login');
        expect(res.flash).toHaveBeenCalledWith('error', 'flash.status_anonymized');
    });

    it('skips DB check and calls next() when statusCheckedAt is recent (cache TTL)', async () => {
        const req = makeReq({
            session: {
                user: { id: 'user-uuid-1', login: 'testuser' },
                statusCheckedAt: Date.now() - 1000, // 1 second ago (within TTL)
                destroy: vi.fn((cb) => cb && cb()),
                save: vi.fn((cb) => cb && cb()),
            },
        });
        const res = makeRes();
        const next = vi.fn();

        await checkUserStatus(req, res, next);

        expect(mockGetUserStatus).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledOnce();
        expect(res.redirect).not.toHaveBeenCalled();
    });

    it('performs DB check when statusCheckedAt is expired (cache expired)', async () => {
        mockGetUserStatus.mockResolvedValue('active');
        const req = makeReq({
            session: {
                user: { id: 'user-uuid-1', login: 'testuser' },
                // Expired: more than STATUS_CHECK_TTL_MS ago
                statusCheckedAt: Date.now() - STATUS_CHECK_TTL_MS - 1000,
                destroy: vi.fn((cb) => cb && cb()),
                save: vi.fn((cb) => cb && cb()),
            },
        });
        const res = makeRes();
        const next = vi.fn();

        await checkUserStatus(req, res, next);

        expect(mockGetUserStatus).toHaveBeenCalledWith('user-uuid-1');
        expect(next).toHaveBeenCalledOnce();
    });

    it('calls next() and does not query DB when there is no session user', async () => {
        const req = makeReq({ session: { destroy: vi.fn() } });
        const res = makeRes();
        const next = vi.fn();

        await checkUserStatus(req, res, next);

        expect(mockGetUserStatus).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledOnce();
        expect(res.redirect).not.toHaveBeenCalled();
    });

    it('calls next() when a DB error occurs (fail-open to avoid blocking)', async () => {
        mockGetUserStatus.mockRejectedValue(new Error('DB connection error'));
        const req = makeReq();
        const res = makeRes();
        const next = vi.fn();

        await checkUserStatus(req, res, next);

        expect(next).toHaveBeenCalledOnce();
        expect(res.redirect).not.toHaveBeenCalled();
    });
});
