/**
 * @file tests/unit/services/site.service.test.js
 * Unit tests for site.service.js
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import models from '../../../src/models/index.js';
import {
    getSitesForUser,
    getSiteById,
    getSiteByDomain,
    createSite,
    updateSite,
    deleteSite,
    domainExists,
    verifySiteAccess,
    getSiteWithForms,
    deleteSiteWithForms,
    generateSiteToken,
    revokeSiteTokens,
    getSiteUsers,
    addUserToSite,
    removeUserFromSite,
    updateUserRoleOnSite,
    regenerateSiteControlCode,
    countSites,
    getAvailableSites,
} from '../../../src/services/site.service.js';
import { encryptObject } from '../../../src/utils/crypto.js';

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
        Site: {
            findAll: vi.fn(),
            findByPk: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            destroy: vi.fn(),
            count: vi.fn(),
            update: vi.fn(),
        },
        Form: {
            findAll: vi.fn(),
            destroy: vi.fn(),
        },
        SiteUser: {
            findAll: vi.fn(),
            create: vi.fn(),
            destroy: vi.fn(),
            findOne: vi.fn(),
        },
        User: {},
    },
}));

vi.mock('../../../src/utils/crypto.js', () => ({
    encryptString: vi.fn((s) => `enc:${s}`),
    decryptString: vi.fn((s) => s.replace('enc:', '')),
    encryptObject: vi.fn((o) => `encobj:${JSON.stringify(o)}`),
    decryptObject: vi.fn((s) => JSON.parse(s.replace('encobj:', ''))),
}));

vi.mock('../../../src/services/access.service.js', () => ({
    getSiteWhereCondition: vi.fn(),
}));

vi.mock('fs/promises', () => ({
    default: {
        rm: vi.fn().mockResolvedValue(undefined),
    },
    rm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/utils/string.js', () => ({
    default: {
        generateCode: vi.fn(() => 'NEWCODE16'),
        capitalizeFirstLetter: vi.fn((s) => s),
    },
}));

vi.mock('jsonwebtoken', () => ({
    default: {
        sign: vi.fn(() => 'mock.jwt.token'),
    },
    sign: vi.fn(() => 'mock.jwt.token'),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockSite(overrides = {}) {
    const data = {
        id: 's1',
        domain: 'example.com',
        control_code: 'CC123',
        fk_id_user: 'u1',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        ...overrides,
    };
    return { ...data, toJSON: () => data, update: vi.fn().mockResolvedValue(data) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('site.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.KEY_TK = 'test-jwt-secret-key-minimum-32-chars!!';
    });

    // -------------------------------------------------------------------------
    describe('getSiteById(siteId)', () => {
        it('returns plain object when site found', async () => {
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findByPk).mockResolvedValue(mockSite);

            const result = await getSiteById('s1');
            expect(result).toEqual(expect.objectContaining({ id: 's1', domain: 'example.com' }));
            expect(typeof result.toJSON).toBe('undefined');
        });

        it('returns null when site not found', async () => {
            vi.mocked(models.Site.findByPk).mockResolvedValue(null);
            const result = await getSiteById('s99');
            expect(result).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    describe('getSiteByDomain(domain)', () => {
        it('returns plain object when site found', async () => {
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findOne).mockResolvedValue(mockSite);

            const result = await getSiteByDomain('example.com');
            expect(result).toEqual(expect.objectContaining({ domain: 'example.com' }));
        });

        it('returns null when domain not found', async () => {
            vi.mocked(models.Site.findOne).mockResolvedValue(null);
            const result = await getSiteByDomain('missing.com');
            expect(result).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    describe('getSitesForUser(userId, userRole)', () => {
        it('returns sites for super_admin without include filter', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findAll).mockResolvedValue([mockSite]);

            const result = await getSitesForUser('u1', 'super_admin');
            expect(result).toHaveLength(1);
        });

        it('returns sites for owner with site-user include', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue({ fk_id_user: 'u1' });
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findAll).mockResolvedValue([mockSite]);

            const result = await getSitesForUser('u1', 'owner');
            expect(result).toHaveLength(1);
        });
    });

    // -------------------------------------------------------------------------
    describe('getAvailableSites(userId, userRole)', () => {
        it('returns all sites for super_admin', async () => {
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findAll).mockResolvedValue([mockSite]);

            const result = await getAvailableSites('u1', 'super_admin');
            expect(models.Site.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
            expect(result).toHaveLength(1);
        });

        it('returns user-owned sites for owner', async () => {
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findAll).mockResolvedValue([mockSite]);

            const result = await getAvailableSites('u1', 'owner');
            expect(models.Site.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { fk_id_user: 'u1' } }));
            expect(result).toHaveLength(1);
        });
    });

    // -------------------------------------------------------------------------
    describe('createSite(siteData, ownerId)', () => {
        it('creates a site and returns plain object', async () => {
            const mockSite = makeMockSite();
            vi.mocked(models.Site.create).mockResolvedValue(mockSite);

            const result = await createSite({ domain: 'example.com', control_code: 'CC123' }, 'u1');

            expect(models.Site.create).toHaveBeenCalledWith({
                domain: 'example.com',
                control_code: 'CC123',
                fk_id_user: 'u1',
            });
            expect(result).toEqual(expect.objectContaining({ id: 's1' }));
        });
    });

    // -------------------------------------------------------------------------
    describe('updateSite(siteId, updateData)', () => {
        it('returns null when site not found', async () => {
            vi.mocked(models.Site.findByPk).mockResolvedValue(null);
            const result = await updateSite('s99', { domain: 'new.com' });
            expect(result).toBeNull();
        });

        it('updates site and returns plain object', async () => {
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findByPk).mockResolvedValue(mockSite);

            const result = await updateSite('s1', { domain: 'new.com' });
            expect(mockSite.update).toHaveBeenCalledWith({ domain: 'new.com' });
            expect(result).toEqual(expect.objectContaining({ id: 's1' }));
        });
    });

    // -------------------------------------------------------------------------
    describe('deleteSite(siteId)', () => {
        it('returns true when site deleted', async () => {
            vi.mocked(models.Site.destroy).mockResolvedValue(1);
            const result = await deleteSite('s1');
            expect(result).toBe(true);
        });

        it('returns false when site not found', async () => {
            vi.mocked(models.Site.destroy).mockResolvedValue(0);
            const result = await deleteSite('s99');
            expect(result).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    describe('domainExists(domain, excludeSiteId)', () => {
        it('returns true when domain exists', async () => {
            vi.mocked(models.Site.findOne).mockResolvedValue({ id: 's1' });
            const result = await domainExists('example.com');
            expect(result).toBe(true);
        });

        it('returns false when domain does not exist', async () => {
            vi.mocked(models.Site.findOne).mockResolvedValue(null);
            const result = await domainExists('missing.com');
            expect(result).toBe(false);
        });

        it('excludes a site id from the check', async () => {
            vi.mocked(models.Site.findOne).mockResolvedValue(null);

            await domainExists('example.com', 's1');

            expect(models.Site.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ domain: 'example.com', id: expect.anything() }) }));
        });
    });

    // -------------------------------------------------------------------------
    describe('regenerateSiteControlCode(siteId, newControlCode)', () => {
        it('returns null when site not found', async () => {
            vi.mocked(models.Site.findByPk).mockResolvedValue(null);
            const result = await regenerateSiteControlCode('s99', 'NEWCC');
            expect(result).toBeNull();
        });

        it('updates control_code and returns plain object', async () => {
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findByPk).mockResolvedValue(mockSite);

            const result = await regenerateSiteControlCode('s1', 'NEWCC');
            expect(mockSite.update).toHaveBeenCalledWith({ control_code: 'NEWCC' });
            expect(result).toEqual(expect.objectContaining({ id: 's1' }));
        });
    });

    // -------------------------------------------------------------------------
    describe('countSites(userId, userRole)', () => {
        it('counts all sites when no userId provided', async () => {
            vi.mocked(models.Site.count).mockResolvedValue(10);
            const result = await countSites();
            expect(models.Site.count).toHaveBeenCalledWith();
            expect(result).toBe(10);
        });

        it('counts all sites for super_admin', async () => {
            vi.mocked(models.Site.count).mockResolvedValue(10);
            const result = await countSites('u1', 'super_admin');
            expect(models.Site.count).toHaveBeenCalledWith();
            expect(result).toBe(10);
        });

        it('counts sites filtered by user for non-admin', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue({ fk_id_user: 'u1' });
            vi.mocked(models.Site.count).mockResolvedValue(3);

            const result = await countSites('u1', 'owner');
            expect(models.Site.count).toHaveBeenCalledWith({ where: { fk_id_user: 'u1' } });
            expect(result).toBe(3);
        });
    });

    // -------------------------------------------------------------------------
    describe('verifySiteAccess(siteId, userId, userRole)', () => {
        it('returns null when site not found', async () => {
            vi.mocked(models.Site.findByPk).mockResolvedValue(null);

            const result = await verifySiteAccess('s99', 'u1', 'owner');
            expect(result).toBeNull();
        });

        it('returns plain site object for super_admin (null condition)', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findByPk).mockResolvedValue(mockSite);

            const result = await verifySiteAccess('s1', 'u1', 'super_admin');
            expect(result).toEqual(expect.objectContaining({ id: 's1' }));
        });

        it('returns site when access is granted', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue({ fk_id_user: 'u1' });
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findByPk).mockResolvedValue(mockSite);
            vi.mocked(models.Site.findOne).mockResolvedValue(mockSite);

            const result = await verifySiteAccess('s1', 'u1', 'owner');
            expect(result).toEqual(expect.objectContaining({ id: 's1' }));
        });

        it('returns null when access is denied', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue({ fk_id_user: 'u2' });
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findByPk).mockResolvedValue(mockSite);
            vi.mocked(models.Site.findOne).mockResolvedValue(null);

            const result = await verifySiteAccess('s1', 'u2', 'owner');
            expect(result).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    describe('getSiteWithForms(siteId, userId, userRole, activeFormId, activeFormName)', () => {
        it('returns null when site access denied', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue({ fk_id_user: 'u2' });
            vi.mocked(models.Site.findByPk).mockResolvedValue(null);

            const result = await getSiteWithForms('s99', 'u2', 'owner');
            expect(result).toBeNull();
        });

        it('returns site with forms and first form active by default', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findByPk).mockResolvedValue(mockSite);
            vi.mocked(models.Site.findOne).mockResolvedValue(mockSite);

            const mockForms = [
                { id: 'f1', name: 'Form1', template: null },
                { id: 'f2', name: 'Form2', template: null },
            ];
            vi.mocked(models.Form.findAll).mockResolvedValue(mockForms);

            const result = await getSiteWithForms('s1', 'u1', 'super_admin');
            expect(result).toHaveProperty('site');
            expect(result).toHaveProperty('forms');
            expect(result.forms).toHaveLength(2);
            expect(result.activeForm).toBeTruthy();
            expect(result.activeForm.is_active).toBe(true);
        });

        it('selects active form by name when activeFormName provided', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findByPk).mockResolvedValue(mockSite);
            vi.mocked(models.Site.findOne).mockResolvedValue(mockSite);

            const mockForms = [
                { id: 'f1', name: 'Form1', template: null },
                { id: 'f2', name: 'Form2', template: null },
            ];
            vi.mocked(models.Form.findAll).mockResolvedValue(mockForms);

            const result = await getSiteWithForms('s1', 'u1', 'super_admin', null, 'Form2');
            expect(result.activeForm.name).toBe('Form2');
        });

        it('selects active form by ID when activeFormId provided', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findByPk).mockResolvedValue(mockSite);
            vi.mocked(models.Site.findOne).mockResolvedValue(mockSite);

            const mockForms = [
                { id: 'f1', name: 'Form1', template: null },
                { id: 'f2', name: 'Form2', template: null },
            ];
            vi.mocked(models.Form.findAll).mockResolvedValue(mockForms);

            const result = await getSiteWithForms('s1', 'u1', 'super_admin', 'f2', null);
            expect(result.activeForm.id).toBe('f2');
        });

        it('returns site with empty forms array when no forms exist', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findByPk).mockResolvedValue(mockSite);
            vi.mocked(models.Site.findOne).mockResolvedValue(mockSite);
            vi.mocked(models.Form.findAll).mockResolvedValue([]);

            const result = await getSiteWithForms('s1', 'u1', 'super_admin');
            expect(result.forms).toEqual([]);
            expect(result.activeForm).toBeNull();
        });

        it('handles form with JSON template string', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findByPk).mockResolvedValue(mockSite);
            vi.mocked(models.Site.findOne).mockResolvedValue(mockSite);

            const mockForms = [{ id: 'f1', name: 'Form1', template: '{"field":"label"}' }];
            vi.mocked(models.Form.findAll).mockResolvedValue(mockForms);

            const result = await getSiteWithForms('s1', 'u1', 'super_admin');
            expect(result.forms[0].templateObj).toEqual({ field: 'label' });
            expect(result.forms[0].template_entries).toEqual([{ key: 'field', value: 'label' }]);
        });
    });

    // -------------------------------------------------------------------------
    describe('deleteSiteWithForms(siteId, userId, userRole, confirmDomain)', () => {
        it('returns error when site not found', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            vi.mocked(models.Site.findByPk).mockResolvedValue(null);

            const result = await deleteSiteWithForms('s99', 'u1', 'owner', 'example.com');
            expect(result).toEqual({ success: false, error: expect.any(String) });
        });

        it('returns error when confirm domain does not match', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findByPk).mockResolvedValue(mockSite);
            vi.mocked(models.Site.findOne).mockResolvedValue(mockSite);

            const result = await deleteSiteWithForms('s1', 'u1', 'owner', 'wrong.com');
            expect(result).toEqual({ success: false, error: expect.any(String) });
        });

        it('deletes forms and site on success', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findByPk).mockResolvedValue(mockSite);
            vi.mocked(models.Site.findOne).mockResolvedValue(mockSite);
            vi.mocked(models.Form.destroy).mockResolvedValue(2);
            vi.mocked(models.Site.destroy).mockResolvedValue(1);

            const result = await deleteSiteWithForms('s1', 'u1', 'owner', 'example.com');
            expect(result).toEqual({ success: true });
            expect(models.Form.destroy).toHaveBeenCalledWith({ where: { fk_id_site: 's1' } });
            expect(models.Site.destroy).toHaveBeenCalledWith({ where: { id: 's1' } });
        });

        it('returns error on unexpected exception', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            vi.mocked(models.Site.findByPk).mockRejectedValue(new Error('DB error'));

            const result = await deleteSiteWithForms('s1', 'u1', 'owner', 'example.com');
            expect(result).toEqual({ success: false, error: expect.any(String) });
        });
    });

    // -------------------------------------------------------------------------
    describe('generateSiteToken(siteId, userId, userRole)', () => {
        it('returns error when site not accessible', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            vi.mocked(models.Site.findByPk).mockResolvedValue(null);

            const result = await generateSiteToken('s99', 'u1', 'owner');
            expect(result).toEqual({ success: false, error: expect.any(String) });
        });

        it('returns JWT token on success', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findByPk).mockResolvedValue(mockSite);
            vi.mocked(models.Site.findOne).mockResolvedValue(mockSite);

            const result = await generateSiteToken('s1', 'u1', 'super_admin');
            expect(result.success).toBe(true);
            expect(result.token).toBe('mock.jwt.token');
            expect(encryptObject).toHaveBeenCalledWith({ id: 's1', control_code: 'CC123' });
        });

        it('returns error when KEY_TK is missing', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findByPk).mockResolvedValue(mockSite);
            vi.mocked(models.Site.findOne).mockResolvedValue(mockSite);

            const savedKey = process.env.KEY_TK;
            delete process.env.KEY_TK;

            const result = await generateSiteToken('s1', 'u1', 'super_admin');
            expect(result.success).toBe(false);

            process.env.KEY_TK = savedKey;
        });

        it('returns error on unexpected exception', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            vi.mocked(models.Site.findByPk).mockRejectedValue(new Error('DB error'));

            const result = await generateSiteToken('s1', 'u1', 'super_admin');
            expect(result.success).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    describe('revokeSiteTokens(siteId, userId, userRole)', () => {
        it('returns error when site not accessible', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            vi.mocked(models.Site.findByPk).mockResolvedValue(null);

            const result = await revokeSiteTokens('s99', 'u1', 'owner');
            expect(result).toEqual({ success: false, error: expect.any(String) });
        });

        it('regenerates control_code and returns success', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            const mockSite = makeMockSite();
            vi.mocked(models.Site.findByPk).mockResolvedValue(mockSite);
            vi.mocked(models.Site.findOne).mockResolvedValue(mockSite);
            vi.mocked(models.Site.update).mockResolvedValue([1]);

            const result = await revokeSiteTokens('s1', 'u1', 'super_admin');
            expect(result.success).toBe(true);
            expect(result.control_code).toBe('NEWCODE16');
        });

        it('returns error on unexpected exception', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            vi.mocked(models.Site.findByPk).mockRejectedValue(new Error('DB error'));

            const result = await revokeSiteTokens('s1', 'u1', 'super_admin');
            expect(result.success).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    describe('getSiteUsers(siteId)', () => {
        it('returns users with their site role', async () => {
            const mockSiteUser = {
                id: 1,
                role: 'editor',
                createdAt: new Date('2024-01-01'),
                user: { toJSON: () => ({ id: 'u1', email: 'a@a.com', name: 'Alice', role: 'editor' }) },
            };
            vi.mocked(models.SiteUser.findAll).mockResolvedValue([mockSiteUser]);

            const result = await getSiteUsers('s1');
            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('siteRole', 'editor');
            expect(result[0]).toHaveProperty('user');
        });

        it('returns empty array when no users', async () => {
            vi.mocked(models.SiteUser.findAll).mockResolvedValue([]);
            const result = await getSiteUsers('s1');
            expect(result).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    describe('addUserToSite(siteId, userId, role)', () => {
        it('creates a SiteUser and returns plain object', async () => {
            const data = { siteId: 's1', userId: 'u1', role: 'editor' };
            const mockSiteUser = { ...data, toJSON: () => data };
            vi.mocked(models.SiteUser.create).mockResolvedValue(mockSiteUser);

            const result = await addUserToSite('s1', 'u1', 'editor');
            expect(models.SiteUser.create).toHaveBeenCalledWith({ siteId: 's1', userId: 'u1', role: 'editor' });
            expect(result).toEqual(expect.objectContaining({ role: 'editor' }));
        });

        it('uses viewer as default role', async () => {
            const data = { siteId: 's1', userId: 'u1', role: 'viewer' };
            vi.mocked(models.SiteUser.create).mockResolvedValue({ ...data, toJSON: () => data });

            await addUserToSite('s1', 'u1');
            expect(models.SiteUser.create).toHaveBeenCalledWith({ siteId: 's1', userId: 'u1', role: 'viewer' });
        });
    });

    // -------------------------------------------------------------------------
    describe('removeUserFromSite(siteId, userId)', () => {
        it('returns true when assignment deleted', async () => {
            vi.mocked(models.SiteUser.destroy).mockResolvedValue(1);
            const result = await removeUserFromSite('s1', 'u1');
            expect(result).toBe(true);
        });

        it('returns false when assignment not found', async () => {
            vi.mocked(models.SiteUser.destroy).mockResolvedValue(0);
            const result = await removeUserFromSite('s1', 'u99');
            expect(result).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    describe('updateUserRoleOnSite(siteId, userId, newRole)', () => {
        it('returns null when SiteUser not found', async () => {
            vi.mocked(models.SiteUser.findOne).mockResolvedValue(null);
            const result = await updateUserRoleOnSite('s1', 'u99', 'editor');
            expect(result).toBeNull();
        });

        it('updates role and returns plain object', async () => {
            const data = { siteId: 's1', userId: 'u1', role: 'editor' };
            const mockSiteUser = {
                ...data,
                toJSON: () => data,
                update: vi.fn().mockResolvedValue(data),
            };
            vi.mocked(models.SiteUser.findOne).mockResolvedValue(mockSiteUser);

            const result = await updateUserRoleOnSite('s1', 'u1', 'editor');
            expect(mockSiteUser.update).toHaveBeenCalledWith({ role: 'editor' });
            expect(result).toEqual(expect.objectContaining({ role: 'editor' }));
        });
    });
});
