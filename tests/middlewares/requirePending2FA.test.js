import { describe, expect, it, vi } from 'vitest';
import { requirePending2FA } from '../../src/helpers/auth.helpers.js';

vi.mock('../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    errorLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn().mockResolvedValue(undefined),
    formatBytes: vi.fn((b) => `${b} B`),
}));

vi.mock('../../src/models/index.js', () => ({ default: {} }));

vi.mock('passport', () => {
    const p = { use: vi.fn(), serializeUser: vi.fn(), deserializeUser: vi.fn() };
    return { default: p };
});

vi.mock('passport-local', () => ({ Strategy: vi.fn() }));

vi.mock('../../src/middlewares/checkUserStatus.js', () => ({ default: vi.fn((_r, _s, next) => next()) }));

function makeReq(sessionData = {}) {
    return { session: sessionData };
}

function makeRes() {
    return { redirect: vi.fn() };
}

describe('requirePending2FA', () => {
    it('should call next() if session has pending2FA', () => {
        const req = makeReq({ pending2FA: { userId: '123' } });
        const res = makeRes();
        const next = vi.fn();

        requirePending2FA(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.redirect).not.toHaveBeenCalled();
    });

    it('should redirect to /dp-login if session has no pending2FA', () => {
        const req = makeReq({});
        const res = makeRes();
        const next = vi.fn();

        requirePending2FA(req, res, next);
        expect(res.redirect).toHaveBeenCalledWith('/dp-login');
        expect(next).not.toHaveBeenCalled();
    });

    it('should redirect to /dp-login if session is undefined', () => {
        const req = { session: undefined };
        const res = makeRes();
        const next = vi.fn();

        requirePending2FA(req, res, next);
        expect(res.redirect).toHaveBeenCalledWith('/dp-login');
        expect(next).not.toHaveBeenCalled();
    });
});
