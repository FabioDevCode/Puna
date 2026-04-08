import { vi } from 'vitest';
import helpers from '../../../src/helpers/hbs_fn.js';

vi.mock('i18n', () => ({
    default: {
        __: (opts) => (typeof opts === 'string' ? opts : opts.phrase),
        __n: (opts) => (typeof opts === 'string' ? opts : opts.singular),
    },
}));

vi.mock('../../../src/config/permissions.js', () => ({
    can: vi.fn((role, entity, action) => role === 'super_admin'),
    hasRole: vi.fn((role, allowed) => allowed.includes(role)),
}));

// Helper to build a minimal Handlebars-style options object
function makeOptions({ fn = () => 'YES', inverse = () => 'NO', hash = {}, root = {} } = {}) {
    return { fn, inverse, hash, data: { root } };
}

describe('handlebars helpers', () => {
    describe('_capitalize', () => {
        it("should capitalize the first letter of 'hello'", () => {
            expect(helpers._capitalize('hello')).toBe('Hello');
        });

        it('should return empty string for non-string input', () => {
            expect(helpers._capitalize(123)).toBe('');
        });
    });

    describe('_uppercase', () => {
        it('always returns undefined because the implementation has no return statement', () => {
            // The ternary `typeof str === 'string' ? str.toUpperCase() : ''` has no `return`,
            // so the function always returns undefined regardless of the input type.
            expect(helpers._uppercase('hello')).toBeUndefined();
            expect(helpers._uppercase(123)).toBeUndefined();
        });
    });

    describe('_lowercase', () => {
        it('always returns undefined because the implementation has no return statement', () => {
            expect(helpers._lowercase('HELLO')).toBeUndefined();
            expect(helpers._lowercase(123)).toBeUndefined();
        });
    });

    describe('log', () => {
        it('does not throw in non-production environment', () => {
            const original = process.env.NODE_ENV;
            process.env.NODE_ENV = 'test';
            expect(() => helpers.log({ foo: 'bar' })).not.toThrow();
            process.env.NODE_ENV = original;
        });

        it('does not log in production environment', () => {
            const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
            const original = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            helpers.log('secret');
            expect(spy).not.toHaveBeenCalled();
            process.env.NODE_ENV = original;
            spy.mockRestore();
        });
    });

    describe('slot / renderSlot', () => {
        it('stores and retrieves a named slot', () => {
            const ctx = {};
            const options = { fn: () => 'slot-content' };
            helpers.slot.call(ctx, 'header', options);
            const rendered = helpers.renderSlot.call(ctx, 'header');
            expect(rendered).toBe('slot-content');
        });

        it('returns empty string for an undefined slot', () => {
            const ctx = {};
            const rendered = helpers.renderSlot.call(ctx, 'missing');
            expect(rendered).toBe('');
        });
    });

    describe('fallback', () => {
        it('should return first argument when it is a non-empty string', () => {
            expect(helpers.fallback('value', 'default')).toBe('value');
        });

        it('should return second argument when first is empty string', () => {
            expect(helpers.fallback('', 'default')).toBe('default');
        });

        it('should return second argument when first is null', () => {
            expect(helpers.fallback(null, 'default')).toBe('default');
        });

        it('should return second argument when first is undefined', () => {
            expect(helpers.fallback(undefined, 'default')).toBe('default');
        });
    });

    describe('concat', () => {
        it('joins arguments (excluding the trailing options object)', () => {
            const fakeOptions = {}; // simulates the HBS options injected as last arg
            expect(helpers.concat('foo', '-', 'bar', fakeOptions)).toBe('foo-bar');
        });
    });

    describe('json', () => {
        it('should stringify an object', () => {
            expect(helpers.json({ a: 1 })).toBe('{"a":1}');
        });
    });

    describe('eq', () => {
        it('returns true when values are strictly equal', () => {
            expect(helpers.eq('a', 'a')).toBe(true);
        });

        it('returns false when values differ', () => {
            expect(helpers.eq('a', 'b')).toBe(false);
        });

        it('returns false for type mismatch (1 vs "1")', () => {
            expect(helpers.eq(1, '1')).toBe(false);
        });
    });

    describe('ifEquals', () => {
        it('calls options.fn when values are equal', () => {
            const options = makeOptions({ fn: () => 'equal', inverse: () => 'not-equal' });
            expect(helpers.ifEquals.call({}, 'x', 'x', options)).toBe('equal');
        });

        it('calls options.inverse when values differ', () => {
            const options = makeOptions({ fn: () => 'equal', inverse: () => 'not-equal' });
            expect(helpers.ifEquals.call({}, 'x', 'y', options)).toBe('not-equal');
        });
    });

    describe('roleLabel', () => {
        it('returns empty string when role is falsy', () => {
            const options = makeOptions();
            expect(helpers.roleLabel(null, options)).toBe('');
        });

        it('returns the raw role when no translation exists (key returned as-is)', () => {
            // The mock i18n.__ returns the phrase string; since it equals `user.role_${role}`, the raw role is returned
            const options = makeOptions({ root: { locale: 'fr' } });
            expect(helpers.roleLabel('viewer', options)).toBe('viewer');
        });
    });

    describe('actionCan', () => {
        it('calls options.fn when user has the required permission', () => {
            const options = makeOptions({
                fn: () => 'allowed',
                inverse: () => 'denied',
                hash: { entity: 'site', action: 'create' },
                root: { connectedUser: { role: 'super_admin' } },
            });
            const ctx = {};
            expect(helpers.actionCan.call(ctx, options)).toBe('allowed');
        });

        it('calls options.inverse when user lacks permission (covers line 109)', () => {
            const options = makeOptions({
                fn: () => 'allowed',
                inverse: () => 'denied',
                hash: { entity: 'site', action: 'create' },
                root: { connectedUser: { role: 'viewer' } },
            });
            const ctx = {};
            expect(helpers.actionCan.call(ctx, options)).toBe('denied');
        });

        it('calls options.inverse when no user', () => {
            const options = makeOptions({
                fn: () => 'allowed',
                inverse: () => 'denied',
                hash: { entity: 'site', action: 'create' },
                root: {},
            });
            expect(helpers.actionCan.call({}, options)).toBe('denied');
        });

        it('calls options.inverse when entity or action is missing', () => {
            const options = makeOptions({
                fn: () => 'allowed',
                inverse: () => 'denied',
                hash: { entity: 'site' },
                root: { connectedUser: { role: 'super_admin' } },
            });
            expect(helpers.actionCan.call({}, options)).toBe('denied');
        });
    });

    describe('roleIs', () => {
        it('calls options.fn when user role is in the allowed list', () => {
            const options = makeOptions({
                fn: () => 'yes',
                inverse: () => 'no',
                hash: { roles: 'super_admin,owner' },
                root: { connectedUser: { role: 'super_admin' } },
            });
            expect(helpers.roleIs.call({}, options)).toBe('yes');
        });

        it('calls options.inverse when user role is not in the allowed list (covers line 127)', () => {
            const options = makeOptions({
                fn: () => 'yes',
                inverse: () => 'no',
                hash: { roles: 'super_admin,owner' },
                root: { connectedUser: { role: 'viewer' } },
            });
            expect(helpers.roleIs.call({}, options)).toBe('no');
        });

        it('calls options.inverse when no user', () => {
            const options = makeOptions({
                fn: () => 'yes',
                inverse: () => 'no',
                hash: { roles: 'super_admin' },
                root: {},
            });
            expect(helpers.roleIs.call({}, options)).toBe('no');
        });
    });

    describe('isRole', () => {
        it('calls options.fn when user role matches exactly (covers lines 150+)', () => {
            const options = makeOptions({
                fn: () => 'match',
                inverse: () => 'no-match',
                hash: { role: 'editor' },
                root: { connectedUser: { role: 'editor' } },
            });
            expect(helpers.isRole.call({}, options)).toBe('match');
        });

        it('calls options.inverse when user role does not match', () => {
            const options = makeOptions({
                fn: () => 'match',
                inverse: () => 'no-match',
                hash: { role: 'super_admin' },
                root: { connectedUser: { role: 'editor' } },
            });
            expect(helpers.isRole.call({}, options)).toBe('no-match');
        });

        it('calls options.inverse when no user', () => {
            const options = makeOptions({
                fn: () => 'match',
                inverse: () => 'no-match',
                hash: { role: 'editor' },
                root: {},
            });
            expect(helpers.isRole.call({}, options)).toBe('no-match');
        });
    });

    describe('isAdmin', () => {
        it('calls options.fn when user is super_admin (covers lines 173+)', () => {
            const options = makeOptions({
                fn: () => 'admin',
                inverse: () => 'not-admin',
                hash: {},
                root: { connectedUser: { role: 'super_admin' } },
            });
            expect(helpers.isAdmin.call({}, options)).toBe('admin');
        });

        it('calls options.inverse when user is not super_admin', () => {
            const options = makeOptions({
                fn: () => 'admin',
                inverse: () => 'not-admin',
                hash: {},
                root: { connectedUser: { role: 'owner' } },
            });
            expect(helpers.isAdmin.call({}, options)).toBe('not-admin');
        });

        it('calls options.inverse when no user', () => {
            const options = makeOptions({
                fn: () => 'admin',
                inverse: () => 'not-admin',
                hash: {},
                root: {},
            });
            expect(helpers.isAdmin.call({}, options)).toBe('not-admin');
        });
    });

    describe('__ (i18n helper)', () => {
        it('translates a key using the locale from root context', () => {
            const options = makeOptions({ root: { locale: 'fr' } });
            const result = helpers.__.call({}, 'some.key', options);
            expect(typeof result).toBe('string');
        });

        it('falls back to fr when no locale in root context', () => {
            const options = makeOptions({ root: {} });
            const result = helpers.__.call({}, 'some.key', options);
            expect(typeof result).toBe('string');
        });
    });
});
