/**
 * @file tests/unit/controllers/profile.controller.test.js
 * Unit tests for profile.controller.js
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { profilePage, updateLocale } from '../../../src/controllers/profile.controller.js';
import { getUserById, updateUserLocale } from '../../../src/services/user.service.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    errorLogger: { error: vi.fn(), warn: vi.fn() },
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn(),
    formatBytes: vi.fn(),
}));

vi.mock('../../../src/models/index.js', () => ({
    default: {},
}));

vi.mock('../../../src/utils/crypto.js', () => ({
    encryptString: vi.fn((s) => `enc:${s}`),
    decryptString: vi.fn((s) => s.replace('enc:', '')),
    encryptObject: vi.fn((o) => `encobj:${JSON.stringify(o)}`),
    decryptObject: vi.fn((s) => JSON.parse(s.replace('encobj:', ''))),
}));

vi.mock('../../../src/services/user.service.js', () => ({
    getUserById: vi.fn(),
    updateUserLocale: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(overrides = {}) {
    return {
        params: {},
        query: {},
        body: {},
        session: { user: { id: 'user-1', locale: 'fr' } },
        userRole: 'owner',
        __: vi.fn((key) => key),
        ...overrides,
    };
}

function makeRes() {
    return {
        flash: vi.fn(),
        redirect: vi.fn(),
        render: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        setHeader: vi.fn(),
        send: vi.fn(),
        cookie: vi.fn(),
        __: vi.fn((key) => key),
    };
}

// ---------------------------------------------------------------------------
// profilePage
// ---------------------------------------------------------------------------

describe('profilePage', () => {
    let req, res;

    beforeEach(() => {
        req = makeReq();
        res = makeRes();
        vi.clearAllMocks();
    });

    it('renders the profile page with user data', async () => {
        const user = { id: 'user-1', login: 'alice', email: 'alice@example.com' };
        getUserById.mockResolvedValue(user);

        await profilePage(req, res);

        expect(getUserById).toHaveBeenCalledWith('user-1');
        expect(res.render).toHaveBeenCalledWith(
            'profile/index',
            expect.objectContaining({
                user,
                show2FABanner: false,
            })
        );
    });

    it('redirects to dashboard on service error', async () => {
        getUserById.mockRejectedValue(new Error('DB error'));

        await profilePage(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
        expect(res.render).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// updateLocale
// ---------------------------------------------------------------------------

describe('updateLocale', () => {
    let req, res;

    beforeEach(() => {
        req = makeReq({ body: { locale: 'fr' } });
        res = makeRes();
        vi.clearAllMocks();
    });

    it('flashes error and redirects when locale is invalid', async () => {
        req.body.locale = 'de';

        await updateLocale(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', expect.any(String));
        expect(res.redirect).toHaveBeenCalledWith('/profile');
        expect(updateUserLocale).not.toHaveBeenCalled();
    });

    it('updates locale to "fr" and redirects with success flash', async () => {
        req.body.locale = 'fr';
        updateUserLocale.mockResolvedValue(undefined);

        await updateLocale(req, res);

        expect(updateUserLocale).toHaveBeenCalledWith('user-1', 'fr');
        expect(req.session.user.locale).toBe('fr');
        expect(res.cookie).toHaveBeenCalledWith('lang', 'fr', expect.any(Object));
        expect(res.flash).toHaveBeenCalledWith('success', expect.any(String));
        expect(res.redirect).toHaveBeenCalledWith('/profile');
    });

    it('updates locale to "en" and redirects with success flash', async () => {
        req.body.locale = 'en';
        updateUserLocale.mockResolvedValue(undefined);

        await updateLocale(req, res);

        expect(updateUserLocale).toHaveBeenCalledWith('user-1', 'en');
        expect(req.session.user.locale).toBe('en');
        expect(res.cookie).toHaveBeenCalledWith('lang', 'en', expect.any(Object));
        expect(res.flash).toHaveBeenCalledWith('success', expect.any(String));
        expect(res.redirect).toHaveBeenCalledWith('/profile');
    });

    it('sets cookie with correct attributes', async () => {
        req.body.locale = 'en';
        updateUserLocale.mockResolvedValue(undefined);

        await updateLocale(req, res);

        expect(res.cookie).toHaveBeenCalledWith(
            'lang',
            'en',
            expect.objectContaining({
                httpOnly: true,
                sameSite: 'lax',
                maxAge: expect.any(Number),
            })
        );
    });

    it('flashes error and redirects on service exception', async () => {
        req.body.locale = 'fr';
        updateUserLocale.mockRejectedValue(new Error('DB error'));

        await updateLocale(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', expect.any(String));
        expect(res.redirect).toHaveBeenCalledWith('/profile');
    });
});
