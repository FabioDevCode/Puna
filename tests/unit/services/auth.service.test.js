/**
 * @file tests/unit/services/auth.service.test.js
 * Unit tests for the auth service layer.
 * Database and bcrypt are fully mocked.
 */

import bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import models from '../../../src/models/index.js';
import {
    authenticateUser,
    hashPassword,
    emailExists,
    getUserForSession,
    verifyPassword,
    findUserByLogin,
    activateUserAccount,
    authenticateUserByLogin,
} from '../../../src/services/auth.service.js';

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('auth.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    describe('authenticateUser(email, password)', () => {
        it('returns user without password on valid credentials', async () => {
            const mockUser = {
                password: 'hashed',
                toJSON: () => ({ id: 1, email: 'a@b.com', password: 'hashed', role: 'editor', name: 'Alice' }),
            };
            vi.mocked(models.User.findOne).mockResolvedValue(mockUser);
            vi.mocked(bcrypt.compare).mockResolvedValue(true);

            const result = await authenticateUser('a@b.com', 'secret');

            expect(models.User.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { email: 'a@b.com' } }));
            expect(bcrypt.compare).toHaveBeenCalledWith('secret', 'hashed');
            expect(result).not.toHaveProperty('password');
            expect(result).toMatchObject({ id: 1, email: 'a@b.com', role: 'editor', name: 'Alice' });
        });

        it('returns null when user is not found', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(null);

            const result = await authenticateUser('unknown@b.com', 'secret');

            expect(result).toBeNull();
            expect(bcrypt.compare).not.toHaveBeenCalled();
        });

        it('returns null when password is incorrect', async () => {
            const mockUser = {
                password: 'hashed',
                toJSON: () => ({ id: 1, email: 'a@b.com', password: 'hashed', role: 'editor', name: 'Alice' }),
            };
            vi.mocked(models.User.findOne).mockResolvedValue(mockUser);
            vi.mocked(bcrypt.compare).mockResolvedValue(false);

            const result = await authenticateUser('a@b.com', 'wrong');

            expect(result).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    describe('hashPassword(password)', () => {
        it('returns a bcrypt hash of the password', async () => {
            const result = await hashPassword('mypassword');

            expect(bcrypt.hash).toHaveBeenCalledWith('mypassword', 10);
            expect(result).toBe('hashed:mypassword');
        });
    });

    // -------------------------------------------------------------------------
    describe('emailExists(email, excludeUserId)', () => {
        it('returns true when user with email exists', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue({ id: 1 });

            const result = await emailExists('exists@b.com');

            expect(result).toBe(true);
            expect(models.User.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { email: 'exists@b.com' } }));
        });

        it('returns false when no user with email exists', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(null);

            const result = await emailExists('missing@b.com');

            expect(result).toBe(false);
        });

        it('includes id exclusion in where clause when excludeUserId is provided', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(null);

            await emailExists('a@b.com', 42);

            const callArg = vi.mocked(models.User.findOne).mock.calls[0][0];
            expect(callArg.where).toHaveProperty('id');
        });

        it('does not include id exclusion when excludeUserId is null', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(null);

            await emailExists('a@b.com', null);

            const callArg = vi.mocked(models.User.findOne).mock.calls[0][0];
            expect(callArg.where).not.toHaveProperty('id');
        });
    });

    // -------------------------------------------------------------------------
    describe('getUserForSession(userId)', () => {
        it('returns minimal user object when user exists', async () => {
            const mockUser = {
                toJSON: () => ({ id: 5, email: 'u@b.com', role: 'viewer', name: 'Bob' }),
            };
            vi.mocked(models.User.findByPk).mockResolvedValue(mockUser);

            const result = await getUserForSession(5);

            expect(models.User.findByPk).toHaveBeenCalledWith(5, expect.objectContaining({ attributes: ['id', 'email', 'role', 'name'] }));
            expect(result).toEqual({ id: 5, email: 'u@b.com', role: 'viewer', name: 'Bob' });
        });

        it('returns null when user is not found', async () => {
            vi.mocked(models.User.findByPk).mockResolvedValue(null);

            const result = await getUserForSession(999);

            expect(result).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    describe('verifyPassword(password, hash)', () => {
        it('returns true when password matches hash', async () => {
            vi.mocked(bcrypt.compare).mockResolvedValue(true);

            const result = await verifyPassword('plaintext', 'hashed');

            expect(bcrypt.compare).toHaveBeenCalledWith('plaintext', 'hashed');
            expect(result).toBe(true);
        });

        it('returns false when password does not match hash', async () => {
            vi.mocked(bcrypt.compare).mockResolvedValue(false);

            const result = await verifyPassword('wrong', 'hashed');

            expect(result).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    describe('findUserByLogin(login, status)', () => {
        it('returns user when found by login without status filter', async () => {
            const mockUser = {
                toJSON: () => ({ id: 2, login: 'bob', role: 'editor', status: 'active' }),
            };
            vi.mocked(models.User.findOne).mockResolvedValue(mockUser);

            const result = await findUserByLogin('bob');

            expect(models.User.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { login: 'bob' } }));
            expect(result).toMatchObject({ id: 2, login: 'bob' });
        });

        it('includes status in where clause when status is provided', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(null);

            await findUserByLogin('bob', 'pending');

            const callArg = vi.mocked(models.User.findOne).mock.calls[0][0];
            expect(callArg.where).toMatchObject({ login: 'bob', status: 'pending' });
        });

        it('does not include status in where clause when status is null', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(null);

            await findUserByLogin('bob', null);

            const callArg = vi.mocked(models.User.findOne).mock.calls[0][0];
            expect(callArg.where).not.toHaveProperty('status');
        });

        it('returns null when user is not found', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(null);

            const result = await findUserByLogin('unknown');

            expect(result).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    describe('activateUserAccount(userId, password)', () => {
        it('hashes password, updates user to active, and returns true on success', async () => {
            vi.mocked(models.User.update).mockResolvedValue([1]);

            const result = await activateUserAccount(10, 'newpassword');

            expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 10);
            expect(models.User.update).toHaveBeenCalledWith({ password: 'hashed:newpassword', status: 'active' }, { where: { id: 10 } });
            expect(result).toBe(true);
        });

        it('returns false when no rows were updated', async () => {
            vi.mocked(models.User.update).mockResolvedValue([0]);

            const result = await activateUserAccount(999, 'newpassword');

            expect(result).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    describe('authenticateUserByLogin(login, password)', () => {
        it('returns user without password on valid credentials', async () => {
            const mockUser = {
                password: 'hashed',
                toJSON: () => ({
                    id: 3,
                    email: 'c@b.com',
                    login: 'charlie',
                    password: 'hashed',
                    role: 'editor',
                    status: 'active',
                    last_connection: null,
                }),
            };
            vi.mocked(models.User.findOne).mockResolvedValue(mockUser);
            vi.mocked(bcrypt.compare).mockResolvedValue(true);

            const result = await authenticateUserByLogin('charlie', 'secret');

            expect(models.User.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { login: 'charlie', status: 'active' } }));
            expect(bcrypt.compare).toHaveBeenCalledWith('secret', 'hashed');
            expect(result).not.toHaveProperty('password');
            expect(result).toMatchObject({ id: 3, login: 'charlie', role: 'editor' });
        });

        it('returns null when user is not found (or not active)', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(null);

            const result = await authenticateUserByLogin('charlie', 'secret');

            expect(result).toBeNull();
            expect(bcrypt.compare).not.toHaveBeenCalled();
        });

        it('returns null when password is incorrect', async () => {
            const mockUser = {
                password: 'hashed',
                toJSON: () => ({
                    id: 3,
                    email: 'c@b.com',
                    login: 'charlie',
                    password: 'hashed',
                    role: 'editor',
                    status: 'active',
                    last_connection: null,
                }),
            };
            vi.mocked(models.User.findOne).mockResolvedValue(mockUser);
            vi.mocked(bcrypt.compare).mockResolvedValue(false);

            const result = await authenticateUserByLogin('charlie', 'wrongpass');

            expect(result).toBeNull();
        });
    });
});
