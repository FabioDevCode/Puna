import { vi } from 'vitest';

// Valid test keys: KEV = 64 hex chars (32 bytes), KIV = 32 hex chars (16 bytes)
const TEST_KEV = '00'.repeat(32);
const TEST_KIV = '00'.repeat(16);

let encryptObject, decryptObject, encryptString, decryptString;

beforeAll(async () => {
    vi.stubEnv('KEV', TEST_KEV);
    vi.stubEnv('KIV', TEST_KIV);
    const module = await import('../../../src/utils/crypto.js');
    encryptObject = module.encryptObject;
    decryptObject = module.decryptObject;
    encryptString = module.encryptString;
    decryptString = module.decryptString;
});

describe('crypto utils', () => {
    describe('encryptObject / decryptObject', () => {
        it('should round-trip an object correctly', () => {
            const original = { id: 1, name: 'test', nested: { value: true } };
            const encrypted = encryptObject(original);
            const decrypted = decryptObject(encrypted);
            expect(decrypted).toEqual(original);
        });
    });

    describe('encryptString / decryptString', () => {
        it('should round-trip a string correctly', () => {
            const original = 'hello world';
            const encrypted = encryptString(original);
            const decrypted = decryptString(encrypted);
            expect(decrypted).toBe(original);
        });

        it('should produce the same result for the same input (fixed IV)', () => {
            const input = 'same input';
            const first = encryptString(input);
            const second = encryptString(input);
            expect(first).toBe(second);
        });
    });

    describe('decryptObject with invalid hex', () => {
        it('should throw on invalid hex', () => {
            expect(() => decryptObject('not_valid_hex')).toThrow();
        });
    });

    describe('decryptString with invalid hex', () => {
        it('should throw on invalid hex', () => {
            expect(() => decryptString('not_valid_hex')).toThrow();
        });
    });
});
