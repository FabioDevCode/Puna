import { validatePasswordStrength } from '../../../src/utils/password.js';

describe('validatePasswordStrength', () => {
    it('should return valid: false with 5 errors for null', () => {
        const result = validatePasswordStrength(null);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(5);
    });

    it('should return valid: false with 5 errors for undefined', () => {
        const result = validatePasswordStrength(undefined);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(5);
    });

    it('should return valid: false with 5 errors for empty string', () => {
        const result = validatePasswordStrength('');
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(5);
    });

    it('should return valid: false with password.min_length error when too short but all other criteria met', () => {
        const result = validatePasswordStrength('Abc1!');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('password.min_length');
    });

    it('should return valid: false with password.needs_uppercase error for 16 chars without uppercase', () => {
        const result = validatePasswordStrength('abcdefgh1234567!');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('password.needs_uppercase');
    });

    it('should return valid: false with password.needs_lowercase error for 16 chars without lowercase', () => {
        const result = validatePasswordStrength('ABCDEFGH1234567!');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('password.needs_lowercase');
    });

    it('should return valid: false with password.needs_digit error for 16 chars without digit', () => {
        const result = validatePasswordStrength('Abcdefghijklmno!');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('password.needs_digit');
    });

    it('should return valid: false with password.needs_special error for 16 chars without special char', () => {
        const result = validatePasswordStrength('Abcdefgh12345678');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('password.needs_special');
    });

    it('should return valid: true with no errors for exactly 16 valid chars', () => {
        const result = validatePasswordStrength('Abcdefgh1234567!');
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('should return valid: true with no errors for more than 16 valid chars', () => {
        const result = validatePasswordStrength('MyStr0ng!Passw0rd#2026');
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('should return valid: false with multiple errors for short password without uppercase, digit and special', () => {
        const result = validatePasswordStrength('abc');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('password.min_length');
        expect(result.errors).toContain('password.needs_uppercase');
        expect(result.errors).toContain('password.needs_digit');
        expect(result.errors).toContain('password.needs_special');
    });
});
