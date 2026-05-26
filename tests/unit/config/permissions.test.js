import { ACTIONS, ENTITIES, ROLES, can, getPermissions, getRateLimit, hasRole, isRateLimitReached, permissions, rateLimits } from '../../../src/config/permissions.js';

describe('permissions config', () => {
    describe('can', () => {
        it('super_admin can create site', () => {
            expect(can('super_admin', 'site', 'create')).toBe(true);
        });

        it('viewer cannot delete form', () => {
            expect(can('viewer', 'form', 'delete')).toBe(false);
        });

        it('editor can read inbox', () => {
            expect(can('editor', 'inbox', 'read')).toBe(true);
        });

        it('returns false when role is null', () => {
            expect(can(null, 'site', 'read')).toBe(false);
        });

        it('returns false for unknown role', () => {
            expect(can('unknown_role', 'site', 'read')).toBe(false);
        });
    });

    describe('hasRole', () => {
        it('returns true when role is in the allowed list', () => {
            expect(hasRole('super_admin', ['super_admin', 'owner'])).toBe(true);
        });

        it('returns false when role is not in the allowed list', () => {
            expect(hasRole('viewer', ['super_admin', 'owner'])).toBe(false);
        });

        it('returns false when role is null', () => {
            expect(hasRole(null, ['super_admin'])).toBe(false);
        });
    });

    describe('getPermissions', () => {
        it('returns a non-null object with expected entity keys for viewer', () => {
            const perms = getPermissions('viewer');
            expect(perms).not.toBeNull();
            expect(perms).toHaveProperty('user');
            expect(perms).toHaveProperty('site');
            expect(perms).toHaveProperty('form');
            expect(perms).toHaveProperty('inbox');
        });

        it('returns null for an unknown role', () => {
            expect(getPermissions('inexistant')).toBeNull();
        });
    });

    describe('isRateLimitReached', () => {
        it('returns true when unique site count equals the max (4)', () => {
            expect(isRateLimitReached('unique', 'site', 4)).toBe(true);
        });

        it('returns false when unique site count is below the max (3)', () => {
            expect(isRateLimitReached('unique', 'site', 3)).toBe(false);
        });

        it('returns false for non-unique roles regardless of count', () => {
            expect(isRateLimitReached('owner', 'site', 100)).toBe(false);
        });
    });

    describe('getRateLimit', () => {
        it('returns limit object for unique site', () => {
            const limit = getRateLimit('unique', 'site');
            expect(limit).not.toBeNull();
            expect(limit).toHaveProperty('max', 4);
            expect(limit).toHaveProperty('info');
        });

        it('returns null for non-unique roles', () => {
            expect(getRateLimit('owner', 'site')).toBeNull();
        });
    });

    describe('constants', () => {
        it('ROLES contains exactly the expected roles', () => {
            expect(ROLES).toEqual(['super_admin', 'owner', 'editor', 'viewer', 'unique']);
        });

        it('ENTITIES contains the expected entities', () => {
            expect(ENTITIES).toEqual(['user', 'site', 'form', 'inbox']);
        });

        it('ACTIONS contains the expected actions', () => {
            expect(ACTIONS).toEqual(['read', 'create', 'update', 'delete']);
        });
    });

    describe('exported objects', () => {
        it('permissions is a non-null object', () => {
            expect(permissions).toBeTruthy();
            expect(typeof permissions).toBe('object');
        });

        it('rateLimits is a non-null object', () => {
            expect(rateLimits).toBeTruthy();
            expect(typeof rateLimits).toBe('object');
        });
    });
});
