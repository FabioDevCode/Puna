/**
 * @file tests/unit/controllers/dashboard.controller.test.js
 * Unit tests for dashboard.controller.js
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    rootRedirect,
    dashboard,
    getTopFroms,
    getInboxCounts,
    getInboxCountsBySite,
    getInboxHeatmap,
    error,
    dpLogin,
    dpFirstCo,
} from '../../../src/controllers/dashboard.controller.js';
import models from '../../../src/models/index.js';
import {
    getSitesWithCounts,
    getGlobalStatsFromSites,
    getTopForms,
    getInboxCountsByDay,
    getInboxCountsBySite as getInboxCountsBySiteService,
    getInboxHeatmap as getInboxHeatmapService,
} from '../../../src/services/stats.service.js';

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
    default: {
        User: { findByPk: vi.fn() },
    },
}));

vi.mock('../../../src/utils/crypto.js', () => ({
    encryptString: vi.fn((s) => `enc:${s}`),
    decryptString: vi.fn((s) => s.replace('enc:', '')),
    encryptObject: vi.fn((o) => `encobj:${JSON.stringify(o)}`),
    decryptObject: vi.fn((s) => JSON.parse(s.replace('encobj:', ''))),
}));

vi.mock('../../../src/services/stats.service.js', () => ({
    getSitesWithCounts: vi.fn(),
    getGlobalStatsFromSites: vi.fn(),
    getTopForms: vi.fn(),
    getInboxCountsByDay: vi.fn(),
    getInboxCountsBySite: vi.fn(),
    getInboxHeatmap: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(overrides = {}) {
    return {
        params: {},
        query: {},
        body: {},
        session: { user: { id: 'user-1', role: 'owner', locale: 'fr' } },
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
        end: vi.fn(),
    };
}

// ---------------------------------------------------------------------------
// rootRedirect
// ---------------------------------------------------------------------------

describe('rootRedirect', () => {
    it('always redirects to /dashboard', () => {
        const req = makeReq();
        const res = makeRes();

        rootRedirect(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });
});

// ---------------------------------------------------------------------------
// dashboard
// ---------------------------------------------------------------------------

describe('dashboard', () => {
    let req, res;

    beforeEach(() => {
        req = makeReq();
        res = makeRes();
        vi.clearAllMocks();
    });

    it('renders dashboard with stats', async () => {
        getSitesWithCounts.mockResolvedValue([{ id: 's1' }]);
        getGlobalStatsFromSites.mockReturnValue({ total: 1 });
        models.User.findByPk.mockResolvedValue(null);

        await dashboard(req, res);

        expect(getSitesWithCounts).toHaveBeenCalledWith('user-1', 'owner');
        expect(res.render).toHaveBeenCalledWith('dashboard', expect.objectContaining({ stats: { total: 1 } }));
    });

    it('shows 2FA banner when TOTP is enabled and user has no 2FA', async () => {
        vi.stubEnv('TOTP_ENABLED', 'true');
        getSitesWithCounts.mockResolvedValue([]);
        getGlobalStatsFromSites.mockReturnValue({});
        models.User.findByPk.mockResolvedValue({ totp_enabled: false });

        await dashboard(req, res);

        const call = res.render.mock.calls[0][1];
        expect(call.show2FABanner).toBe(true);

        vi.unstubAllEnvs();
    });

    it('does not show 2FA banner when user already has 2FA enabled', async () => {
        vi.stubEnv('TOTP_ENABLED', 'true');
        getSitesWithCounts.mockResolvedValue([]);
        getGlobalStatsFromSites.mockReturnValue({});
        models.User.findByPk.mockResolvedValue({ totp_enabled: true });

        await dashboard(req, res);

        const call = res.render.mock.calls[0][1];
        expect(call.show2FABanner).toBe(false);

        vi.unstubAllEnvs();
    });

    it('does not check 2FA when TOTP is disabled', async () => {
        vi.stubEnv('TOTP_ENABLED', 'false');
        getSitesWithCounts.mockResolvedValue([]);
        getGlobalStatsFromSites.mockReturnValue({});

        await dashboard(req, res);

        expect(models.User.findByPk).not.toHaveBeenCalled();

        vi.unstubAllEnvs();
    });

    it('renders dashboard with empty object on service error', async () => {
        getSitesWithCounts.mockRejectedValue(new Error('DB error'));

        await dashboard(req, res);

        expect(res.render).toHaveBeenCalledWith('dashboard', {});
    });
});

// ---------------------------------------------------------------------------
// getTopFroms
// ---------------------------------------------------------------------------

describe('getTopFroms', () => {
    let req, res;

    beforeEach(() => {
        req = makeReq({ query: { days: '7' } });
        res = makeRes();
        vi.clearAllMocks();
    });

    it('returns top forms for valid days=7', async () => {
        getTopForms.mockResolvedValue([{ id: 'f1', name: 'Form1', count: 10 }]);

        await getTopFroms(req, res);

        expect(getTopForms).toHaveBeenCalledWith('user-1', 7);
        expect(res.json).toHaveBeenCalledWith({
            days: 7,
            items: [{ id: 'f1', name: 'Form1', count: 10 }],
        });
    });

    it('uses default 7 days when days param is invalid', async () => {
        req.query.days = 'invalid';
        getTopForms.mockResolvedValue([]);

        await getTopFroms(req, res);

        expect(getTopForms).toHaveBeenCalledWith('user-1', 7);
    });

    it('uses default 7 days when days is not in allowed values', async () => {
        req.query.days = '14';
        getTopForms.mockResolvedValue([]);

        await getTopFroms(req, res);

        expect(getTopForms).toHaveBeenCalledWith('user-1', 7);
    });

    it('allows days=30', async () => {
        req.query.days = '30';
        getTopForms.mockResolvedValue([]);

        await getTopFroms(req, res);

        expect(getTopForms).toHaveBeenCalledWith('user-1', 30);
    });

    it('returns 500 on service error', async () => {
        getTopForms.mockRejectedValue(new Error('DB error'));

        await getTopFroms(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
    });
});

// ---------------------------------------------------------------------------
// getInboxCounts
// ---------------------------------------------------------------------------

describe('getInboxCounts', () => {
    let req, res;

    beforeEach(() => {
        req = makeReq({ query: { days: '7' } });
        res = makeRes();
        vi.clearAllMocks();
    });

    it('returns inbox counts for valid days=7', async () => {
        getInboxCountsByDay.mockResolvedValue({ labels: [], data: [] });

        await getInboxCounts(req, res);

        expect(getInboxCountsByDay).toHaveBeenCalledWith('user-1', 7);
        expect(res.json).toHaveBeenCalledWith({ labels: [], data: [], days: 7 });
    });

    it('uses default 7 days when query param invalid', async () => {
        req.query.days = 'bad';
        getInboxCountsByDay.mockResolvedValue({ labels: [], data: [] });

        await getInboxCounts(req, res);

        expect(getInboxCountsByDay).toHaveBeenCalledWith('user-1', 7);
    });

    it('allows days=30', async () => {
        req.query.days = '30';
        getInboxCountsByDay.mockResolvedValue({ labels: [], data: [] });

        await getInboxCounts(req, res);

        expect(getInboxCountsByDay).toHaveBeenCalledWith('user-1', 30);
    });

    it('returns 500 on service error', async () => {
        getInboxCountsByDay.mockRejectedValue(new Error('DB error'));

        await getInboxCounts(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
    });
});

// ---------------------------------------------------------------------------
// getInboxCountsBySite
// ---------------------------------------------------------------------------

describe('getInboxCountsBySite', () => {
    let req, res;

    beforeEach(() => {
        req = makeReq();
        res = makeRes();
        vi.clearAllMocks();
    });

    it('returns inbox counts by site', async () => {
        getInboxCountsBySiteService.mockResolvedValue([{ siteId: 's1', count: 5 }]);

        await getInboxCountsBySite(req, res);

        expect(getInboxCountsBySiteService).toHaveBeenCalledWith('user-1');
        expect(res.json).toHaveBeenCalledWith([{ siteId: 's1', count: 5 }]);
    });

    it('returns 500 on service error', async () => {
        getInboxCountsBySiteService.mockRejectedValue(new Error('DB error'));

        await getInboxCountsBySite(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
    });
});

// ---------------------------------------------------------------------------
// getInboxHeatmap
// ---------------------------------------------------------------------------

describe('getInboxHeatmap', () => {
    let req, res;

    beforeEach(() => {
        req = makeReq({ query: { days: '7' } });
        res = makeRes();
        vi.clearAllMocks();
    });

    it('returns heatmap data for valid days', async () => {
        getInboxHeatmapService.mockResolvedValue({ weeks: [] });

        await getInboxHeatmap(req, res);

        expect(getInboxHeatmapService).toHaveBeenCalledWith('user-1', 'owner', 7, 'fr');
        expect(res.json).toHaveBeenCalledWith({ weeks: [] });
    });

    it('uses default 7 days when query param invalid', async () => {
        req.query.days = 'bad';
        getInboxHeatmapService.mockResolvedValue({});

        await getInboxHeatmap(req, res);

        expect(getInboxHeatmapService).toHaveBeenCalledWith('user-1', 'owner', 7, 'fr');
    });

    it('allows days=30', async () => {
        req.query.days = '30';
        getInboxHeatmapService.mockResolvedValue({});

        await getInboxHeatmap(req, res);

        expect(getInboxHeatmapService).toHaveBeenCalledWith('user-1', 'owner', 30, 'fr');
    });

    it('returns 500 on service error', async () => {
        getInboxHeatmapService.mockRejectedValue(new Error('DB error'));

        await getInboxHeatmap(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
    });
});

// ---------------------------------------------------------------------------
// error
// ---------------------------------------------------------------------------

describe('error', () => {
    it('renders the generic error page without layout', async () => {
        const req = makeReq();
        const res = makeRes();

        await error(req, res);

        expect(res.render).toHaveBeenCalledWith('errors/generic', { layout: false });
    });
});

// ---------------------------------------------------------------------------
// dpLogin
// ---------------------------------------------------------------------------

describe('dpLogin', () => {
    it('renders the auth login page with auth layout', () => {
        const req = makeReq();
        const res = makeRes();

        dpLogin(req, res);

        expect(res.render).toHaveBeenCalledWith('auth/login', { layout: 'auth' });
    });
});

// ---------------------------------------------------------------------------
// dpFirstCo
// ---------------------------------------------------------------------------

describe('dpFirstCo', () => {
    it('renders the first-login page with auth layout', () => {
        const req = makeReq();
        const res = makeRes();

        dpFirstCo(req, res);

        expect(res.render).toHaveBeenCalledWith('auth/first-login', { layout: 'auth' });
    });
});
