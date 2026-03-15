/**
 * @file tests/unit/services/twoFactor.service.test.js
 * Unit tests for the twoFactor service layer.
 * Database, crypto utils, bcrypt, and otpauth are fully mocked.
 */

import bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import models from '../../../src/models/index.js';
import {
    generateTotpSetup,
    verifyTotpToken,
    generateBackupCodes,
    verifyBackupCode,
    enableTotpForUser,
    disableTotpForUser,
    regenerateBackupCodes,
    getTotpStatus,
} from '../../../src/services/twoFactor.service.js';
import { decryptObject, encryptObject, encryptString } from '../../../src/utils/crypto.js';

// ---------------------------------------------------------------------------
// Mocks — vi.mock() is hoisted above imports by Vitest
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
        User: {
            findByPk: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock('../../../src/utils/crypto.js', () => ({
    encryptString: vi.fn((s) => `enc:${s}`),
    decryptString: vi.fn((s) => s.replace('enc:', '')),
    encryptObject: vi.fn((o) => `encobj:${JSON.stringify(o)}`),
    decryptObject: vi.fn((s) => JSON.parse(s.replace('encobj:', ''))),
}));

vi.mock('bcrypt', () => ({
    default: {
        hash: vi.fn(async (data) => `hashed:${data}`),
        compare: vi.fn(),
    },
}));

const mockTotpInstance = vi.hoisted(() => ({
    toString: vi.fn(() => 'otpauth://totp/Puna:user?secret=BASE32SECRET&issuer=Puna'),
    validate: vi.fn(),
}));

vi.mock('otpauth', () => {
    class MockSecret {
        constructor() {
            this.base32 = 'BASE32SECRET';
        }
        static fromBase32(s) {
            return { base32: s };
        }
    }
    function MockTOTP() {
        return mockTotpInstance;
    }
    return {
        TOTP: MockTOTP,
        Secret: MockSecret,
    };
});

vi.mock('qrcode', () => ({
    default: {
        toDataURL: vi.fn(async () => 'data:image/png;base64,MOCKQR'),
    },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('twoFactor.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    describe('generateTotpSetup(login)', () => {
        it('returns secret, qrCodeDataUrl, and otpauthUrl', async () => {
            const result = await generateTotpSetup('testuser');
            expect(result).toHaveProperty('secret', 'BASE32SECRET');
            expect(result).toHaveProperty('qrCodeDataUrl', 'data:image/png;base64,MOCKQR');
            expect(result).toHaveProperty('otpauthUrl');
            expect(result.otpauthUrl).toContain('otpauth://');
        });
    });

    // -------------------------------------------------------------------------
    describe('verifyTotpToken(encryptedSecret, token)', () => {
        it('returns true when delta is not null', () => {
            mockTotpInstance.validate.mockReturnValue(0);
            expect(verifyTotpToken('enc:BASE32SECRET', '123456')).toBe(true);
        });

        it('returns false when delta is null', () => {
            mockTotpInstance.validate.mockReturnValue(null);
            expect(verifyTotpToken('enc:BASE32SECRET', '000000')).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    describe('generateBackupCodes()', () => {
        it('returns 8 plainCodes and 8 hashedCodes', async () => {
            const { plainCodes, hashedCodes } = await generateBackupCodes();
            expect(plainCodes).toHaveLength(8);
            expect(hashedCodes).toHaveLength(8);
        });

        it('plainCodes match the xxxx-xxxx format', async () => {
            const { plainCodes } = await generateBackupCodes();
            for (const code of plainCodes) {
                expect(code).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}$/);
            }
        });

        it('calls bcrypt.hash with 4 rounds for each code', async () => {
            await generateBackupCodes();
            expect(bcrypt.hash).toHaveBeenCalledTimes(8);
            for (const call of bcrypt.hash.mock.calls) {
                expect(call[1]).toBe(4);
            }
        });

        it('hashedCodes are the bcrypt hashes of plainCodes', async () => {
            const { plainCodes, hashedCodes } = await generateBackupCodes();
            for (let i = 0; i < 8; i++) {
                expect(hashedCodes[i]).toBe(`hashed:${plainCodes[i]}`);
            }
        });
    });

    // -------------------------------------------------------------------------
    describe('verifyBackupCode(encryptedCodes, inputCode)', () => {
        const mockHashes = ['hashed:code-a', 'hashed:code-b', 'hashed:code-c'];
        const encryptedCodes = `encobj:${JSON.stringify(mockHashes)}`;

        it('returns valid:true and removes the matched code', async () => {
            vi.mocked(bcrypt.compare).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

            const result = await verifyBackupCode(encryptedCodes, 'code-b');

            expect(result.valid).toBe(true);
            expect(result.remainingCount).toBe(2);
            expect(result.updatedEncryptedCodes).toBeDefined();

            const remaining = decryptObject(result.updatedEncryptedCodes);
            expect(remaining).not.toContain('hashed:code-b');
            expect(remaining).toContain('hashed:code-a');
            expect(remaining).toContain('hashed:code-c');
        });

        it('returns valid:false when no code matches', async () => {
            vi.mocked(bcrypt.compare).mockResolvedValue(false);

            const result = await verifyBackupCode(encryptedCodes, 'wrong-code');
            expect(result).toEqual({ valid: false });
        });

        it('decrements remainingCount by 1 on successful use', async () => {
            vi.mocked(bcrypt.compare).mockResolvedValueOnce(true);

            const result = await verifyBackupCode(encryptedCodes, 'code-a');
            expect(result.remainingCount).toBe(mockHashes.length - 1);
        });
    });

    // -------------------------------------------------------------------------
    describe('enableTotpForUser(userId, rawSecret, hashedCodes)', () => {
        it('calls User.update with encrypted secret and backup codes, returns true on success', async () => {
            vi.mocked(models.User.update).mockResolvedValue([1]);

            const result = await enableTotpForUser(1, 'BASE32SECRET', ['hash1', 'hash2']);

            expect(encryptString).toHaveBeenCalledWith('BASE32SECRET');
            expect(encryptObject).toHaveBeenCalledWith(['hash1', 'hash2']);
            expect(models.User.update).toHaveBeenCalledWith(expect.objectContaining({ totp_enabled: true }), { where: { id: 1 } });
            expect(result).toBe(true);
        });

        it('returns false when no rows updated', async () => {
            vi.mocked(models.User.update).mockResolvedValue([0]);
            const result = await enableTotpForUser(99, 'SECRET', []);
            expect(result).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    describe('disableTotpForUser(userId)', () => {
        it('calls User.update with null values and returns true on success', async () => {
            vi.mocked(models.User.update).mockResolvedValue([1]);

            const result = await disableTotpForUser(1);

            expect(models.User.update).toHaveBeenCalledWith({ totp_secret: null, totp_enabled: false, totp_backup_codes: null }, { where: { id: 1 } });
            expect(result).toBe(true);
        });

        it('returns false when no rows updated', async () => {
            vi.mocked(models.User.update).mockResolvedValue([0]);
            const result = await disableTotpForUser(99);
            expect(result).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    describe('regenerateBackupCodes(userId)', () => {
        it('updates backup codes and returns plainCodes', async () => {
            vi.mocked(models.User.update).mockResolvedValue([1]);

            const result = await regenerateBackupCodes(1);

            expect(result).toHaveProperty('plainCodes');
            expect(result.plainCodes).toHaveLength(8);
            expect(models.User.update).toHaveBeenCalledWith(expect.objectContaining({ totp_backup_codes: expect.any(String) }), { where: { id: 1 } });
        });
    });

    // -------------------------------------------------------------------------
    describe('getTotpStatus(userId)', () => {
        it('returns enabled:true and backupCodesRemaining count when 2FA active', async () => {
            const mockCodes = ['h1', 'h2', 'h3'];
            const encCodes = `encobj:${JSON.stringify(mockCodes)}`;
            vi.mocked(models.User.findByPk).mockResolvedValue({
                toJSON: () => ({ totp_enabled: true, totp_backup_codes: encCodes }),
            });

            const result = await getTotpStatus(1);
            expect(result).toEqual({ enabled: true, backupCodesRemaining: 3 });
        });

        it('returns enabled:false and backupCodesRemaining:0 when 2FA disabled', async () => {
            vi.mocked(models.User.findByPk).mockResolvedValue({
                toJSON: () => ({ totp_enabled: false, totp_backup_codes: null }),
            });

            const result = await getTotpStatus(1);
            expect(result).toEqual({ enabled: false, backupCodesRemaining: 0 });
        });

        it('returns enabled:false and backupCodesRemaining:0 when user not found', async () => {
            vi.mocked(models.User.findByPk).mockResolvedValue(null);

            const result = await getTotpStatus(99);
            expect(result).toEqual({ enabled: false, backupCodesRemaining: 0 });
        });
    });
});
