/**
 * @file tests/unit/controllers/admin.controller.test.js
 * Unit tests for admin.controller.js (admin dashboard and settings pages).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { admin, adminSettings } from '../../../src/controllers/admin/admin.controller.js';
import { countFileLines, countFilesRecursive } from '../../../src/controllers/admin/adminLogs.controller.js';
import models from '../../../src/models/index.js';

// ---------------------------------------------------------------------------
// Mocks — vi.mock() is hoisted above imports by Vitest
// ---------------------------------------------------------------------------

vi.mock('../../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    errorLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn(),
    formatBytes: vi.fn(),
}));

vi.mock('../../../src/models/index.js', () => ({
    default: {
        sequelize: { query: vi.fn() },
        Sequelize: { QueryTypes: { SELECT: 'SELECT' } },
        Op: { gte: 'gte', in: 'in' },
        User: { count: vi.fn() },
        Site: { count: vi.fn() },
        Form: { count: vi.fn(), findAll: vi.fn() },
        Inbox: { count: vi.fn() },
        SiteUser: { findAll: vi.fn() },
    },
}));

vi.mock('../../../src/utils/crypto.js', () => ({
    encryptString: vi.fn((s) => `enc:${s}`),
    decryptString: vi.fn((s) => s.replace('enc:', '')),
    encryptObject: vi.fn((o) => `encobj:${JSON.stringify(o)}`),
    decryptObject: vi.fn((s) => JSON.parse(s.replace('encobj:', ''))),
}));

vi.mock('../../../src/controllers/admin/adminLogs.controller.js', () => ({
    countFileLines: vi.fn(),
    countFilesRecursive: vi.fn(),
    logsViewer: vi.fn(),
    readLogs: vi.fn(),
    getArchives: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(role = 'super_admin') {
    return {
        session: { user: { id: 'admin-uuid', role } },
        __: vi.fn((key) => key),
    };
}

function makeRes() {
    return {
        flash: vi.fn(),
        redirect: vi.fn(),
        render: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('admin.controller', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        countFileLines.mockResolvedValue(0);
        countFilesRecursive.mockResolvedValue(0);
    });

    // -------------------------------------------------------------------------
    describe('admin()', () => {
        it('renders admin/index with stats for super_admin', async () => {
            models.sequelize.query.mockResolvedValue([{ data: JSON.stringify({ user: { id: 'user1' } }) }, { data: JSON.stringify({ user: { id: 'user2' } }) }]);
            models.User.count.mockResolvedValue(5);
            models.Site.count.mockResolvedValue(3);
            models.Form.count.mockResolvedValue(10);
            models.Inbox.count.mockResolvedValue(50);
            countFileLines.mockResolvedValue(2);
            countFilesRecursive.mockResolvedValue(7);

            const req = makeReq('super_admin');
            const res = makeRes();

            await admin(req, res);

            expect(res.render).toHaveBeenCalledWith(
                'admin/index',
                expect.objectContaining({
                    layout: 'admin',
                    stats: expect.objectContaining({ users: 5, sites: 3, forms: 10, entries: 50 }),
                    activityStats: expect.objectContaining({ connectedUsers: 2, errorsCount: 2, totalFiles: 7 }),
                })
            );
        });

        it('deduplicates connected users from session data', async () => {
            // Two session rows with the same userId → should count as 1
            models.sequelize.query.mockResolvedValue([{ data: JSON.stringify({ user: { id: 'same-user' } }) }, { data: JSON.stringify({ user: { id: 'same-user' } }) }]);
            models.User.count.mockResolvedValue(1);
            models.Site.count.mockResolvedValue(0);
            models.Form.count.mockResolvedValue(0);
            models.Inbox.count.mockResolvedValue(0);

            const req = makeReq('super_admin');
            const res = makeRes();

            await admin(req, res);

            const call = res.render.mock.calls[0][1];
            expect(call.activityStats.connectedUsers).toBe(1);
        });

        it('renders admin/index with stats for owner with sites', async () => {
            models.sequelize.query.mockResolvedValue([]);
            models.User.count.mockResolvedValue(2);
            models.SiteUser.findAll.mockResolvedValue([{ fk_id_site: 'site1' }, { fk_id_site: 'site2' }]);
            models.Form.count.mockResolvedValue(5);
            models.Form.findAll.mockResolvedValue([{ id: 'f1' }, { id: 'f2' }]);
            models.Site.count.mockResolvedValue(1);
            models.Inbox.count.mockResolvedValue(20);
            countFileLines.mockResolvedValue(0);
            countFilesRecursive.mockResolvedValue(3);

            const req = makeReq('owner');
            const res = makeRes();

            await admin(req, res);

            expect(res.render).toHaveBeenCalledWith(
                'admin/index',
                expect.objectContaining({
                    layout: 'admin',
                    stats: expect.objectContaining({ users: 2 }),
                })
            );
        });

        it('renders with zero stats for owner with no sites', async () => {
            models.sequelize.query.mockResolvedValue([]);
            models.User.count.mockResolvedValue(0);
            models.SiteUser.findAll.mockResolvedValue([]);
            countFileLines.mockResolvedValue(0);
            countFilesRecursive.mockResolvedValue(0);

            const req = makeReq('owner');
            const res = makeRes();

            await admin(req, res);

            expect(res.render).toHaveBeenCalledWith(
                'admin/index',
                expect.objectContaining({
                    stats: { users: 0, sites: 0, forms: 0, entries: 0 },
                })
            );
        });

        it('renders when owner has sites but no forms', async () => {
            models.sequelize.query.mockResolvedValue([]);
            models.User.count.mockResolvedValue(1);
            models.SiteUser.findAll.mockResolvedValue([{ fk_id_site: 'site1' }]);
            models.Form.count.mockResolvedValue(0);
            models.Form.findAll.mockResolvedValue([]);
            models.Site.count.mockResolvedValue(0);
            // Inbox.count should NOT be called if formIds.length === 0

            const req = makeReq('owner');
            const res = makeRes();

            await admin(req, res);

            expect(res.render).toHaveBeenCalledWith('admin/index', expect.any(Object));
            // entriesCount stays 0 when no forms
            const call = res.render.mock.calls[0][1];
            expect(call.stats.entries).toBe(0);
        });

        it('still renders when session query fails (non-fatal inner error)', async () => {
            models.sequelize.query.mockRejectedValue(new Error('Session DB error'));
            models.User.count.mockResolvedValue(1);
            models.Site.count.mockResolvedValue(0);
            models.Form.count.mockResolvedValue(0);
            models.Inbox.count.mockResolvedValue(0);

            const req = makeReq('super_admin');
            const res = makeRes();

            await admin(req, res);

            expect(res.render).toHaveBeenCalledWith('admin/index', expect.any(Object));
            // connectedUsers falls back to 0 on inner error
            const call = res.render.mock.calls[0][1];
            expect(call.activityStats.connectedUsers).toBe(0);
        });

        it('handles invalid JSON in session data gracefully', async () => {
            models.sequelize.query.mockResolvedValue([{ data: 'not-valid-json' }, { data: JSON.stringify({ user: { id: 'u1' } }) }]);
            models.User.count.mockResolvedValue(1);
            models.Site.count.mockResolvedValue(0);
            models.Form.count.mockResolvedValue(0);
            models.Inbox.count.mockResolvedValue(0);

            const req = makeReq('super_admin');
            const res = makeRes();

            await admin(req, res);

            expect(res.render).toHaveBeenCalledWith('admin/index', expect.any(Object));
            const call = res.render.mock.calls[0][1];
            // Only 1 valid user session out of 2 rows
            expect(call.activityStats.connectedUsers).toBe(1);
        });

        it('redirects to /dashboard when a main service throws', async () => {
            models.sequelize.query.mockResolvedValue([]);
            countFileLines.mockResolvedValue(0);
            countFilesRecursive.mockResolvedValue(0);
            models.User.count.mockRejectedValue(new Error('DB error'));

            const req = makeReq('super_admin');
            const res = makeRes();

            await admin(req, res);

            expect(res.redirect).toHaveBeenCalledWith('/dashboard');
            expect(res.render).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    describe('adminSettings()', () => {
        it('renders admin/settings', async () => {
            const req = makeReq();
            const res = makeRes();

            await adminSettings(req, res);

            expect(res.render).toHaveBeenCalledWith('admin/settings', { layout: 'admin' });
        });

        it('redirects to /admin when render throws', async () => {
            const req = makeReq();
            const res = {
                ...makeRes(),
                render: vi.fn().mockImplementation(() => {
                    throw new Error('Render error');
                }),
            };

            await adminSettings(req, res);

            expect(res.redirect).toHaveBeenCalledWith('/admin');
        });
    });
});
