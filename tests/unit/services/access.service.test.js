/**
 * @file tests/unit/services/access.service.test.js
 * Unit tests for access.service.js
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import models from '../../../src/models/index.js';
import { getSiteWhereCondition, checkSiteAccess, checkFormAccess, checkInboxAccess, checkUserPermission, getAccessibleSiteIds } from '../../../src/services/access.service.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    errorLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn(),
    formatBytes: vi.fn(),
}));

vi.mock('../../../src/models/index.js', () => ({
    default: {
        SiteUser: { findAll: vi.fn() },
        Site: { findOne: vi.fn(), findAll: vi.fn() },
        Form: { findByPk: vi.fn() },
        Inbox: { findByPk: vi.fn() },
    },
}));

vi.mock('../../../src/utils/crypto.js', () => ({
    encryptString: vi.fn((s) => `enc:${s}`),
    decryptString: vi.fn((s) => s.replace('enc:', '')),
    encryptObject: vi.fn((o) => `encobj:${JSON.stringify(o)}`),
    decryptObject: vi.fn((s) => JSON.parse(s.replace('encobj:', ''))),
}));

vi.mock('../../../src/config/permissions.js', () => ({
    can: vi.fn(),
    default: { can: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('access.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    describe('getSiteWhereCondition(userId, userRole)', () => {
        it('returns null for super_admin', async () => {
            const result = await getSiteWhereCondition('u1', 'super_admin');
            expect(result).toBeNull();
        });

        it('returns { fk_id_user: userId } for owner', async () => {
            const result = await getSiteWhereCondition('u1', 'owner');
            expect(result).toEqual({ fk_id_user: 'u1' });
        });

        it('returns { fk_id_user: userId } for beta', async () => {
            const result = await getSiteWhereCondition('u1', 'beta');
            expect(result).toEqual({ fk_id_user: 'u1' });
        });

        it('returns { id: { [Op.in]: siteIds } } for editor with assigned sites', async () => {
            vi.mocked(models.SiteUser.findAll).mockResolvedValue([{ fk_id_site: 'site1' }, { fk_id_site: 'site2' }]);

            const result = await getSiteWhereCondition('u1', 'editor');
            expect(result).toHaveProperty('id');
            expect(models.SiteUser.findAll).toHaveBeenCalledWith({
                where: { fk_id_user: 'u1' },
                attributes: ['fk_id_site'],
                raw: true,
            });
        });

        it('returns { id: null } for editor with no assigned sites', async () => {
            vi.mocked(models.SiteUser.findAll).mockResolvedValue([]);

            const result = await getSiteWhereCondition('u1', 'editor');
            expect(result).toEqual({ id: null });
        });

        it('returns { id: { [Op.in]: siteIds } } for viewer with assigned sites', async () => {
            vi.mocked(models.SiteUser.findAll).mockResolvedValue([{ fk_id_site: 'site3' }]);

            const result = await getSiteWhereCondition('u1', 'viewer');
            expect(result).toHaveProperty('id');
        });

        it('returns { id: null } for viewer with no assigned sites', async () => {
            vi.mocked(models.SiteUser.findAll).mockResolvedValue([]);
            const result = await getSiteWhereCondition('u1', 'viewer');
            expect(result).toEqual({ id: null });
        });

        it('returns { id: null } for unknown role', async () => {
            const result = await getSiteWhereCondition('u1', 'unknown');
            expect(result).toEqual({ id: null });
        });
    });

    // -------------------------------------------------------------------------
    describe('checkSiteAccess(siteId, userId, userRole)', () => {
        it('returns true for super_admin without DB call', async () => {
            const result = await checkSiteAccess('s1', 'u1', 'super_admin');
            expect(result).toBe(true);
            expect(models.Site.findOne).not.toHaveBeenCalled();
        });

        it('returns true for owner when site is found', async () => {
            vi.mocked(models.Site.findOne).mockResolvedValue({ id: 's1' });
            const result = await checkSiteAccess('s1', 'u1', 'owner');
            expect(result).toBe(true);
        });

        it('returns false for owner when site is not found', async () => {
            vi.mocked(models.Site.findOne).mockResolvedValue(null);
            const result = await checkSiteAccess('s1', 'u1', 'owner');
            expect(result).toBe(false);
        });

        it('returns true for editor when site is accessible', async () => {
            vi.mocked(models.SiteUser.findAll).mockResolvedValue([{ fk_id_site: 's1' }]);
            vi.mocked(models.Site.findOne).mockResolvedValue({ id: 's1' });

            const result = await checkSiteAccess('s1', 'u1', 'editor');
            expect(result).toBe(true);
        });

        it('returns false for editor when site is not accessible', async () => {
            vi.mocked(models.SiteUser.findAll).mockResolvedValue([{ fk_id_site: 's2' }]);
            vi.mocked(models.Site.findOne).mockResolvedValue(null);

            const result = await checkSiteAccess('s1', 'u1', 'editor');
            expect(result).toBe(false);
        });

        it('returns false for editor with no assigned sites', async () => {
            vi.mocked(models.SiteUser.findAll).mockResolvedValue([]);
            vi.mocked(models.Site.findOne).mockResolvedValue(null);

            const result = await checkSiteAccess('s1', 'u1', 'editor');
            expect(result).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    describe('checkFormAccess(formId, userId, userRole)', () => {
        it('returns false when form is not found', async () => {
            vi.mocked(models.Form.findByPk).mockResolvedValue(null);

            const result = await checkFormAccess('f1', 'u1', 'owner');
            expect(result).toBe(false);
        });

        it('delegates to checkSiteAccess when form is found', async () => {
            vi.mocked(models.Form.findByPk).mockResolvedValue({ fk_id_site: 's1' });
            vi.mocked(models.Site.findOne).mockResolvedValue({ id: 's1' });

            const result = await checkFormAccess('f1', 'u1', 'owner');
            expect(result).toBe(true);
        });

        it('returns false when site access is denied', async () => {
            vi.mocked(models.Form.findByPk).mockResolvedValue({ fk_id_site: 's1' });
            vi.mocked(models.Site.findOne).mockResolvedValue(null);

            const result = await checkFormAccess('f1', 'u1', 'viewer');
            expect(result).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    describe('checkInboxAccess(inboxId, userId, userRole)', () => {
        it('returns false when inbox is not found', async () => {
            vi.mocked(models.Inbox.findByPk).mockResolvedValue(null);

            const result = await checkInboxAccess('i1', 'u1', 'owner');
            expect(result).toBe(false);
        });

        it('delegates to checkFormAccess when inbox is found', async () => {
            vi.mocked(models.Inbox.findByPk).mockResolvedValue({ fk_id_form: 'f1' });
            vi.mocked(models.Form.findByPk).mockResolvedValue({ fk_id_site: 's1' });
            vi.mocked(models.Site.findOne).mockResolvedValue({ id: 's1' });

            const result = await checkInboxAccess('i1', 'u1', 'owner');
            expect(result).toBe(true);
        });

        it('returns false when form access is denied', async () => {
            vi.mocked(models.Inbox.findByPk).mockResolvedValue({ fk_id_form: 'f1' });
            vi.mocked(models.Form.findByPk).mockResolvedValue(null);

            const result = await checkInboxAccess('i1', 'u1', 'owner');
            expect(result).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    describe('checkUserPermission(userRole, entity, action)', () => {
        it('delegates to permissions.can and returns true when allowed', async () => {
            const { can } = await import('../../../src/config/permissions.js');
            vi.mocked(can).mockReturnValue(true);

            const result = await checkUserPermission('owner', 'site', 'create');
            expect(result).toBe(true);
            expect(can).toHaveBeenCalledWith('owner', 'site', 'create');
        });

        it('returns false when permission is denied', async () => {
            const { can } = await import('../../../src/config/permissions.js');
            vi.mocked(can).mockReturnValue(false);

            const result = await checkUserPermission('viewer', 'form', 'delete');
            expect(result).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    describe('getAccessibleSiteIds(userId, userRole)', () => {
        it('returns all site ids for super_admin', async () => {
            vi.mocked(models.Site.findAll).mockResolvedValue([{ id: 's1' }, { id: 's2' }]);

            const result = await getAccessibleSiteIds('u1', 'super_admin');
            expect(result).toEqual(['s1', 's2']);
        });

        it('returns filtered site ids for owner', async () => {
            vi.mocked(models.Site.findAll).mockResolvedValue([{ id: 's1' }]);

            const result = await getAccessibleSiteIds('u1', 'owner');
            expect(result).toEqual(['s1']);
        });

        it('returns empty array for editor with no assigned sites', async () => {
            vi.mocked(models.SiteUser.findAll).mockResolvedValue([]);

            const result = await getAccessibleSiteIds('u1', 'editor');
            expect(result).toEqual([]);
        });

        it('returns empty array for unknown role (id: null condition)', async () => {
            const result = await getAccessibleSiteIds('u1', 'unknown');
            expect(result).toEqual([]);
        });

        it('returns site ids for viewer with assigned sites', async () => {
            vi.mocked(models.SiteUser.findAll).mockResolvedValue([{ fk_id_site: 's3' }]);
            vi.mocked(models.Site.findAll).mockResolvedValue([{ id: 's3' }]);

            const result = await getAccessibleSiteIds('u1', 'viewer');
            expect(result).toEqual(['s3']);
        });
    });
});
