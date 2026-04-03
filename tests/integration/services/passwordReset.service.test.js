/**
 * @file tests/integration/services/passwordReset.service.test.js
 * Tests for password reset service functions
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import models from '../../../src/models/index.js';
import { createPasswordResetRequest, validateResetToken, resetPassword } from '../../../src/services/passwordReset.service.js';

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
            findOne: vi.fn(),
            findByPk: vi.fn(),
            update: vi.fn(),
            count: vi.fn(),
            create: vi.fn(),
        },
        sequelize: { sync: vi.fn().mockResolvedValue(undefined) },
        Sequelize: {},
        Op: { gt: Symbol('gt') },
    },
}));

vi.mock('../../../src/config/mailer.js', () => ({
    mailEnabled: true,
    sendMail: vi.fn(),
}));

vi.mock('../../../src/services/auth.service.js', () => ({
    hashPassword: vi.fn(),
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
    return {
        ...base,
        update: vi.fn().mockResolvedValue(base),
        toJSON: vi.fn().mockReturnValue({ ...base }),
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('passwordReset.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    describe('createPasswordResetRequest', () => {
        it('returns silently when user does not exist (anti-enumeration)', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(null);

            await expect(createPasswordResetRequest('unknown@example.com')).resolves.toBeUndefined();
        });

        it('updates user with hashed token and sends email when user exists', async () => {
            const { sendMail } = await import('../../../src/config/mailer.js');
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
                    subject: 'Réinitialisation de votre mot de passe — Puna',
                    html: expect.stringContaining('Puna'),
                })
            );
        });

        it('queries only active users', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(null);

            await createPasswordResetRequest('test@example.com');

            expect(models.User.findOne).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ email: 'test@example.com', status: 'active' }),
                })
            );
        });

        it('throws when mail service is not configured', async () => {
            vi.doMock('../../../src/config/mailer.js', () => ({
                mailEnabled: false,
                sendMail: vi.fn(),
            }));

            const { createPasswordResetRequest: createRequest } = await import('../../../src/services/passwordReset.service.js?mailDisabled');

            await expect(createRequest('test@example.com')).rejects.toThrow('Mail service is not configured');
        });
    });

    // -----------------------------------------------------------------------
    describe('validateResetToken', () => {
        it('returns user when token is valid and not expired', async () => {
            const mockUser = makeMockUser();
            vi.mocked(models.User.findOne).mockResolvedValue(mockUser);

            const result = await validateResetToken('validrawtoken');

            expect(result).toBe(mockUser);
        });

        it('returns null when no user is found (expired or invalid token)', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(null);

            const result = await validateResetToken('invalidtoken');

            expect(result).toBeNull();
        });

        it('hashes the raw token before querying the database', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(null);

            await validateResetToken('rawtoken123');

            const callArg = vi.mocked(models.User.findOne).mock.calls[0][0];
            // The stored token must not be the raw token itself
            expect(callArg.where.password_reset_token).not.toBe('rawtoken123');
            // It should be a 64-char hex SHA-256 digest
            expect(callArg.where.password_reset_token).toMatch(/^[0-9a-f]{64}$/);
        });
    });

    // -----------------------------------------------------------------------
    describe('resetPassword', () => {
        it('returns false when token is invalid', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(null);

            const result = await resetPassword('badtoken', 'NewPassword123!');

            expect(result).toBe(false);
        });

        it('updates password, clears token fields, resets failed_login_attempts', async () => {
            const { hashPassword } = await import('../../../src/services/auth.service.js');
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
    });
});
