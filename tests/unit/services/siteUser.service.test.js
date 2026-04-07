/**
 * @file tests/unit/services/siteUser.service.test.js
 * Unit tests for siteUser.service.js
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import models from '../../../src/models/index.js';
import {
    assignUserToSites,
    removeUserFromAllSites,
    updateUserSiteAssignments,
    getUserSiteAssignments,
    getSiteUserAssignments,
    isUserAssignedToSite,
    countUserSites,
    countSiteUsers,
} from '../../../src/services/siteUser.service.js';

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
        SiteUser: {
            bulkCreate: vi.fn(),
            destroy: vi.fn(),
            findAll: vi.fn(),
            findOne: vi.fn(),
            count: vi.fn(),
        },
        Site: {},
        User: {},
    },
}));

vi.mock('../../../src/utils/crypto.js', () => ({
    encryptString: vi.fn((s) => `enc:${s}`),
    decryptString: vi.fn((s) => s.replace('enc:', '')),
    encryptObject: vi.fn((o) => `encobj:${JSON.stringify(o)}`),
    decryptObject: vi.fn((s) => JSON.parse(s.replace('encobj:', ''))),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('siteUser.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    describe('assignUserToSites(userId, siteIds)', () => {
        it('returns empty array when siteIds is empty', async () => {
            const result = await assignUserToSites('u1', []);
            expect(result).toEqual([]);
            expect(models.SiteUser.bulkCreate).not.toHaveBeenCalled();
        });

        it('returns empty array when siteIds is not provided', async () => {
            const result = await assignUserToSites('u1');
            expect(result).toEqual([]);
        });

        it('creates assignments in bulk and returns plain objects', async () => {
            const mockCreated = [{ toJSON: () => ({ fk_id_user: 'u1', fk_id_site: 's1' }) }, { toJSON: () => ({ fk_id_user: 'u1', fk_id_site: 's2' }) }];
            vi.mocked(models.SiteUser.bulkCreate).mockResolvedValue(mockCreated);

            const result = await assignUserToSites('u1', ['s1', 's2']);

            expect(models.SiteUser.bulkCreate).toHaveBeenCalledWith(
                [
                    { fk_id_user: 'u1', fk_id_site: 's1' },
                    { fk_id_user: 'u1', fk_id_site: 's2' },
                ],
                { ignoreDuplicates: true }
            );
            expect(result).toEqual([
                { fk_id_user: 'u1', fk_id_site: 's1' },
                { fk_id_user: 'u1', fk_id_site: 's2' },
            ]);
        });
    });

    // -------------------------------------------------------------------------
    describe('removeUserFromAllSites(userId)', () => {
        it('destroys all assignments for the user and returns count', async () => {
            vi.mocked(models.SiteUser.destroy).mockResolvedValue(3);

            const result = await removeUserFromAllSites('u1');

            expect(models.SiteUser.destroy).toHaveBeenCalledWith({ where: { fk_id_user: 'u1' } });
            expect(result).toBe(3);
        });

        it('returns 0 when no assignments exist', async () => {
            vi.mocked(models.SiteUser.destroy).mockResolvedValue(0);
            const result = await removeUserFromAllSites('u99');
            expect(result).toBe(0);
        });
    });

    // -------------------------------------------------------------------------
    describe('updateUserSiteAssignments(userId, siteIds)', () => {
        it('removes all existing and creates new assignments', async () => {
            vi.mocked(models.SiteUser.destroy).mockResolvedValue(2);
            const mockCreated = [{ toJSON: () => ({ fk_id_user: 'u1', fk_id_site: 's3' }) }];
            vi.mocked(models.SiteUser.bulkCreate).mockResolvedValue(mockCreated);

            const result = await updateUserSiteAssignments('u1', ['s3']);

            expect(models.SiteUser.destroy).toHaveBeenCalledWith({ where: { fk_id_user: 'u1' } });
            expect(models.SiteUser.bulkCreate).toHaveBeenCalled();
            expect(result).toEqual([{ fk_id_user: 'u1', fk_id_site: 's3' }]);
        });

        it('returns empty array when new siteIds is empty', async () => {
            vi.mocked(models.SiteUser.destroy).mockResolvedValue(1);

            const result = await updateUserSiteAssignments('u1', []);
            expect(result).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    describe('getUserSiteAssignments(userId)', () => {
        it('returns plain objects with site info', async () => {
            const mockAssignments = [
                {
                    toJSON: () => ({
                        fk_id_user: 'u1',
                        fk_id_site: 's1',
                        site: { id: 's1', domain: 'example.com', status: 'active' },
                    }),
                },
            ];
            vi.mocked(models.SiteUser.findAll).mockResolvedValue(mockAssignments);

            const result = await getUserSiteAssignments('u1');

            expect(models.SiteUser.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { fk_id_user: 'u1' } }));
            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('site');
        });

        it('returns empty array when no assignments', async () => {
            vi.mocked(models.SiteUser.findAll).mockResolvedValue([]);
            const result = await getUserSiteAssignments('u1');
            expect(result).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    describe('getSiteUserAssignments(siteId)', () => {
        it('returns plain objects with user info', async () => {
            const mockAssignments = [
                {
                    toJSON: () => ({
                        fk_id_site: 's1',
                        fk_id_user: 'u1',
                        user: { id: 'u1', login: 'alice', email: 'a@a.com', role: 'editor' },
                    }),
                },
            ];
            vi.mocked(models.SiteUser.findAll).mockResolvedValue(mockAssignments);

            const result = await getSiteUserAssignments('s1');

            expect(models.SiteUser.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { fk_id_site: 's1' } }));
            expect(result[0]).toHaveProperty('user');
        });

        it('returns empty array when no users assigned', async () => {
            vi.mocked(models.SiteUser.findAll).mockResolvedValue([]);
            const result = await getSiteUserAssignments('s1');
            expect(result).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    describe('isUserAssignedToSite(userId, siteId)', () => {
        it('returns true when assignment exists', async () => {
            vi.mocked(models.SiteUser.findOne).mockResolvedValue({ id: 1 });

            const result = await isUserAssignedToSite('u1', 's1');
            expect(result).toBe(true);
            expect(models.SiteUser.findOne).toHaveBeenCalledWith({
                where: { fk_id_user: 'u1', fk_id_site: 's1' },
            });
        });

        it('returns false when assignment does not exist', async () => {
            vi.mocked(models.SiteUser.findOne).mockResolvedValue(null);

            const result = await isUserAssignedToSite('u1', 's99');
            expect(result).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    describe('countUserSites(userId)', () => {
        it('returns the count of sites for user', async () => {
            vi.mocked(models.SiteUser.count).mockResolvedValue(5);

            const result = await countUserSites('u1');
            expect(result).toBe(5);
            expect(models.SiteUser.count).toHaveBeenCalledWith({ where: { fk_id_user: 'u1' } });
        });

        it('returns 0 when no sites assigned', async () => {
            vi.mocked(models.SiteUser.count).mockResolvedValue(0);
            const result = await countUserSites('u99');
            expect(result).toBe(0);
        });
    });

    // -------------------------------------------------------------------------
    describe('countSiteUsers(siteId)', () => {
        it('returns the count of users for site', async () => {
            vi.mocked(models.SiteUser.count).mockResolvedValue(3);

            const result = await countSiteUsers('s1');
            expect(result).toBe(3);
            expect(models.SiteUser.count).toHaveBeenCalledWith({ where: { fk_id_site: 's1' } });
        });

        it('returns 0 when no users assigned', async () => {
            vi.mocked(models.SiteUser.count).mockResolvedValue(0);
            const result = await countSiteUsers('s99');
            expect(result).toBe(0);
        });
    });
});
