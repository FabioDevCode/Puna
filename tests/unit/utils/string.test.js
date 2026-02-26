import stringUtils from '../../../src/utils/string.js';

const { capitalizeFirstLetter, generateCode } = stringUtils;

describe('string utils', () => {
    describe('capitalizeFirstLetter', () => {
        it("should capitalize the first letter of 'hello'", () => {
            expect(capitalizeFirstLetter('hello')).toBe('Hello');
        });

        it('should return empty string for empty input', () => {
            expect(capitalizeFirstLetter('')).toBe('');
        });

        it("should return 'A' unchanged", () => {
            expect(capitalizeFirstLetter('A')).toBe('A');
        });
    });

    describe('generateCode', () => {
        it('should return a string of length 10 by default', () => {
            const code = generateCode();
            expect(typeof code).toBe('string');
            expect(code).toHaveLength(10);
        });

        it('should only contain A-Z and 0-9 characters', () => {
            const code = generateCode();
            expect(code).toMatch(/^[A-Z0-9]+$/);
        });

        it('should return a string of the requested length', () => {
            const code = generateCode(20);
            expect(code).toHaveLength(20);
        });

        it('should produce different results on successive calls', () => {
            const first = generateCode();
            const second = generateCode();
            // Probabilistically near-certain to differ
            expect(first).not.toBe(second);
        });
    });
});
