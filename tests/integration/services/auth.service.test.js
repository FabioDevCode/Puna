/**
 * @file tests/integration/services/auth.service.test.js
 * Tests for authentication service functions
 */

import bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import models from '../../../src/models/index.js';
import { activateUserAccount, authenticateUserByLogin, findUserByLogin } from '../../../src/services/auth.service.js';

// ---------------------------------------------------------------------------
// Mocks — vi.mock() is hoisted above imports by Vitest
// ---------------------------------------------------------------------------

// Prevent logger from accessing the file system or scheduling cron jobs
vi.mock('../../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    errorLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn(),
    formatBytes: vi.fn(),
}));

// Replace Sequelize models to avoid a real MariaDB connection
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
        Op: {},
    },
}));

// Mock bcrypt to make tests fast and deterministic
vi.mock('bcrypt', () => ({
    default: {
        compare: vi.fn(),
        hash: vi.fn(),
    },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const MOCK_HASHED_PASSWORD = '$2b$10$mock-hashed-password-fixture';

function makeMockUser(overrides = {}) {
    const base = {
        id: 'user-uuid-1',
        login: 'testuser',
        email: 'test@example.com',
        role: 'editor',
        status: 'active',
        password: MOCK_HASHED_PASSWORD,
        last_connection: null,
        ...overrides,
    };
    return {
        ...base,
        toJSON: vi.fn().mockReturnValue({ ...base }),
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('auth.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    describe('authenticateUserByLogin', () => {
        it('returns user without password when credentials are valid', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(makeMockUser());
            vi.mocked(bcrypt.compare).mockResolvedValue(true);

            const result = await authenticateUserByLogin('testuser', 'correctpassword');

            expect(result).not.toBeNull();
            expect(result).not.toHaveProperty('password');
            expect(result).toHaveProperty('login', 'testuser');
            expect(result).toHaveProperty('role', 'editor');
            expect(result).toHaveProperty('status', 'active');
        });

        it('returns null when user does not exist', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(null);

            const result = await authenticateUserByLogin('unknown', 'password');

            expect(result).toBeNull();
        });

        it('returns null when password is incorrect', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(makeMockUser());
            vi.mocked(bcrypt.compare).mockResolvedValue(false);

            const result = await authenticateUserByLogin('testuser', 'wrongpassword');

            expect(result).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    describe('findUserByLogin', () => {
        it('returns user data when user exists', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(makeMockUser());

            const result = await findUserByLogin('testuser');

            expect(result).not.toBeNull();
            expect(result).toHaveProperty('login', 'testuser');
        });

        it('returns null when user does not exist', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(null);

            const result = await findUserByLogin('nobody');

            expect(result).toBeNull();
        });

        it('filters by status when status argument is provided', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(makeMockUser());

            await findUserByLogin('testuser', 'active');

            expect(models.User.findOne).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ login: 'testuser', status: 'active' }),
                })
            );
        });

        it('does not add status to the query when no status is provided', async () => {
            vi.mocked(models.User.findOne).mockResolvedValue(makeMockUser());

            await findUserByLogin('testuser');

            const call = vi.mocked(models.User.findOne).mock.calls[0][0];
            expect(call.where).not.toHaveProperty('status');
        });
    });

    // -----------------------------------------------------------------------
    describe('activateUserAccount (first login - password setup)', () => {
        it('returns true when account is successfully activated', async () => {
            vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$new-hashed-password');
            vi.mocked(models.User.update).mockResolvedValue([1]);

            const result = await activateUserAccount('user-uuid-1', 'NewPassword123!');

            expect(result).toBe(true);
            expect(models.User.update).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'active' }),
                expect.objectContaining({ where: { id: 'user-uuid-1' } })
            );
        });

        it('returns false when no user row is updated', async () => {
            vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$new-hashed-password');
            vi.mocked(models.User.update).mockResolvedValue([0]);

            const result = await activateUserAccount('nonexistent-uuid', 'NewPassword123!');

            expect(result).toBe(false);
        });
    });
});
