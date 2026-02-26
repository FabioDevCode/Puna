import { vi } from 'vitest';
import helpers from '../../../src/helpers/hbs_fn.js';

vi.mock('i18n', () => ({
    default: { __: (s) => s, __n: (s) => s },
}));

describe('handlebars helpers', () => {
    describe('_capitalize', () => {
        it("should capitalize the first letter of 'hello'", () => {
            expect(helpers._capitalize('hello')).toBe('Hello');
        });

        it('should return empty string for non-string input', () => {
            expect(helpers._capitalize(123)).toBe('');
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

    describe('json', () => {
        it('should stringify an object', () => {
            expect(helpers.json({ a: 1 })).toBe('{"a":1}');
        });
    });
});
