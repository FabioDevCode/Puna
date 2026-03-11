/**
 * @file tests/unit/services/passwordReset.service.test.js
 * Unit tests for the passwordReset service layer.
 * The database and mailer are fully mocked.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMail } from '../../../src/config/mailer.js';
import models from '../../../src/models/index.js';
import { hashPassword } from '../../../src/services/auth.service.js';
import { generateResetToken, createPasswordResetRequest, validateResetToken, resetPassword } from '../../../src/services/passwordReset.service.js';

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
        User: { findOne: vi.fn() },
        Op: { gt: Symbol('gt') },
    },
}));

vi.mock('../../../src/config/mailer.js', () => ({
    mailEnabled: true,
    sendMail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/services/auth.service.js', () => ({
    hashPassword: vi.fn().mockResolvedValue('$2b$10$hashed'),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMockUser(overrides = {}) {
    const base = {
        id: 'user-uuid-1',
        email: 'test@example.com',
        status: 'active',
        password_reset_token: null,
        password_reset_expires: null,
        failed_login_attempts: 0,
        ...overrides,
    };
    return { ...base, update: vi.fn().mockResolvedValue(base) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('passwordReset.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    describe('generateResetToken()', () => {
        it('returns an object with rawToken, hashedToken, and expires', () => {
            const result = generateResetToken();
            expect(result).toHaveProperty('rawToken');
            expect(result).toHaveProperty('hashedToken');
            expect(result).toHaveProperty('expires');
        });

        it('rawToken is a 64-char hex string (32 bytes)', () => {
            const { rawToken } = generateResetToken();
            expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
        });

        it('hashedToken is a 64-char hex string (SHA-256 output)', () => {
            const { hashedToken } = generateResetToken();
            expect(hashedToken).toMatch(/^[0-9a-f]{64}$/);
        });

        it('rawToken and hashedToken are different', () => {
            const { rawToken, hashedToken } = generateResetToken();
            expect(rawToken).not.toBe(hashedToken);
        });

        it('expires is a Date roughly 1 hour in the future', () => {
            const before = Date.now();
            const { expires } = generateResetToken();
            const after = Date.now();
            const oneHour = 60 * 60 * 1000;
            expect(expires).toBeInstanceOf(Date);
            expect(expires.getTime()).toBeGreaterThanOrEqual(before + oneHour - 1000);
            expect(expires.getTime()).toBeLessThanOrEqual(after + oneHour + 1000);
        });
    });

    // -------------------------------------------------------------------------
    describe('createPasswordResetRequest(email)', () => {
        it('when mailEnabled is false: throws an error', async () => {
            vi.doMock('../../../src/config/mailer.js', () => ({
                mailEnabled: false,
                sendMail: vi.fn(),
            }));
            const { createPasswordResetRequest: freshCreate } = await import('../../../src/services/passwordReset.service.js?nomail');
            await expect(freshCreate('test@example.com')).rejects.toThrow('Mail service is not configured');
        });

        it('when user does not exist: resolves silently (anti-enumeration), does NOT call sendMail', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(null);
            await expect(createPasswordResetRequest('unknown@example.com')).resolves.toBeUndefined();
            expect(sendMail).not.toHaveBeenCalled();
        });

        it('when user exists with active status: updates password_reset_token and password_reset_expires, calls sendMail', async () => {
            const mockUser = makeMockUser();
            vi.mocked(models.User.findOne).mockResolvedValue(mockUser);

            await createPasswordResetRequest('test@example.com');

            expect(mockUser.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    password_reset_token: expect.any(String),
                    password_reset_expires: expect.any(Date),
                })
            );
            expect(sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'test@example.com',
                    subject: expect.stringContaining('Réinitialisation'),
                    html: expect.any(String),
                })
            );
        });

        it('when user status is not active (e.g., banned): does NOT call sendMail', async () => {
            // The service queries { email, status: 'active' }, so a non-active user returns null
            vi.mocked(models.User.findOne).mockResolvedValue(null);
            await createPasswordResetRequest('banned@example.com');
            expect(sendMail).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    describe('validateResetToken(rawToken)', () => {
        it('with valid non-expired token: returns the user', async () => {
            const mockUser = makeMockUser();
            vi.mocked(models.User.findOne).mockResolvedValue(mockUser);
            const result = await validateResetToken('validrawtoken');
            expect(result).toBe(mockUser);
        });

        it('with valid but expired token: returns null', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(null);
            const result = await validateResetToken('expiredtoken');
            expect(result).toBeNull();
        });

        it('with invalid token (no match in DB): returns null', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(null);
            const result = await validateResetToken('invalidtoken');
            expect(result).toBeNull();
        });

        it('hashes the raw token before querying the database', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(null);
            await validateResetToken('rawtoken123');
            const callArg = vi.mocked(models.User.findOne).mock.calls[0][0];
            expect(callArg.where.password_reset_token).not.toBe('rawtoken123');
            expect(callArg.where.password_reset_token).toMatch(/^[0-9a-f]{64}$/);
        });
    });

    // -------------------------------------------------------------------------
    describe('resetPassword(rawToken, newPassword)', () => {
        it('with valid token: updates password (hashed), clears token fields, resets failed_login_attempts to 0, returns true', async () => {
            const mockUser = makeMockUser();
            vi.mocked(models.User.findOne).mockResolvedValue(mockUser);
            vi.mocked(hashPassword).mockResolvedValue('$2b$10$hashed-new-password');

            const result = await resetPassword('validtoken', 'NewPassword123!');

            expect(result).toBe(true);
            expect(mockUser.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    password: '$2b$10$hashed-new-password',
                    password_reset_token: null,
                    password_reset_expires: null,
                    failed_login_attempts: 0,
                })
            );
        });

        it('with invalid/expired token: returns false', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(null);
            const result = await resetPassword('badtoken', 'NewPassword123!');
            expect(result).toBe(false);
        });
    });
});
