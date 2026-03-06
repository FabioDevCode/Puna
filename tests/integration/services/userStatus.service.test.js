/**
 * @file tests/integration/services/userStatus.service.test.js
 * Integration tests for changeUserStatus, incrementFailedAttempts,
 * and resetFailedAttempts service functions
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import models from '../../../src/models/index.js';
import { changeUserStatus, incrementFailedAttempts, resetFailedAttempts } from '../../../src/services/user.service.js';

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
            increment: vi.fn(),
        },
        sequelize: { sync: vi.fn().mockResolvedValue(undefined) },
        Sequelize: {},
        Op: {},
    },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMockUser(overrides = {}) {
    const base = {
        id: 'target-user-uuid',
        login: 'targetuser',
        email: 'target@example.com',
        role: 'editor',
        status: 'active',
        password: '$2b$10$mock-hashed-password',
        failed_login_attempts: 0,
        ...overrides,
    };
    return { ...base, toJSON: vi.fn().mockReturnValue({ ...base }) };
}

const ADMIN_SUPER = { userId: 'admin-uuid', login: 'superadmin', role: 'super_admin' };
const ADMIN_OWNER = { userId: 'owner-uuid', login: 'owner', role: 'owner' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('changeUserStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: update succeeds
        vi.mocked(models.User.update).mockResolvedValue([1]);
    });

    // -----------------------------------------------------------------------
    it('active → inactive: updates status in DB', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue(makeMockUser({ status: 'active' }));

        const result = await changeUserStatus('target-user-uuid', 'inactive', ADMIN_SUPER);

        expect(models.User.update).toHaveBeenCalledWith({ status: 'inactive' }, { where: { id: 'target-user-uuid' } });
        expect(result).toEqual({ success: true, previousStatus: 'active', newStatus: 'inactive' });
    });

    // -----------------------------------------------------------------------
    it('inactive → active: restores active status and resets failed_login_attempts', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue(makeMockUser({ status: 'inactive' }));

        const result = await changeUserStatus('target-user-uuid', 'active', ADMIN_SUPER);

        expect(models.User.update).toHaveBeenCalledWith(
            { status: 'active', failed_login_attempts: 0 },
            { where: { id: 'target-user-uuid' } }
        );
        expect(result).toEqual({ success: true, previousStatus: 'inactive', newStatus: 'active' });
    });

    // -----------------------------------------------------------------------
    it('suspended → active: resets failed_login_attempts to 0', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue(makeMockUser({ status: 'suspended' }));

        await changeUserStatus('target-user-uuid', 'active', ADMIN_SUPER);

        expect(models.User.update).toHaveBeenCalledWith(
            { status: 'active', failed_login_attempts: 0 },
            { where: { id: 'target-user-uuid' } }
        );
    });

    // -----------------------------------------------------------------------
    it('→ banned: reason is passed through and logged', async () => {
        const { auditLogger } = await import('../../../src/config/logger.js');
        vi.mocked(models.User.findByPk).mockResolvedValue(makeMockUser({ status: 'active' }));

        await changeUserStatus('target-user-uuid', 'banned', ADMIN_SUPER, 'Spam abuse');

        expect(auditLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'USER_STATUS_CHANGE',
                marker: '🔄 STATUS_CHANGE',
                newStatus: 'banned',
                reason: 'Spam abuse',
            })
        );
    });

    // -----------------------------------------------------------------------
    it('→ banned without reason: throws', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue(makeMockUser({ status: 'active' }));

        await expect(changeUserStatus('target-user-uuid', 'banned', ADMIN_SUPER)).rejects.toThrow(
            'Reason is required when banning a user'
        );
        expect(models.User.update).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    it('→ banned with empty reason: throws', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue(makeMockUser({ status: 'active' }));

        await expect(changeUserStatus('target-user-uuid', 'banned', ADMIN_SUPER, '   ')).rejects.toThrow(
            'Reason is required when banning a user'
        );
        expect(models.User.update).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    it('banned → active (debanning): super_admin can un-ban', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue(makeMockUser({ status: 'banned' }));

        const result = await changeUserStatus('target-user-uuid', 'active', ADMIN_SUPER, 'Appeal accepted');

        expect(models.User.update).toHaveBeenCalledWith(
            { status: 'active', failed_login_attempts: 0 },
            { where: { id: 'target-user-uuid' } }
        );
        expect(result).toEqual({ success: true, previousStatus: 'banned', newStatus: 'active' });
    });

    // -----------------------------------------------------------------------
    it('banned → active (debanning): owner cannot un-ban', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue(makeMockUser({ status: 'banned' }));

        await expect(changeUserStatus('target-user-uuid', 'active', ADMIN_OWNER)).rejects.toThrow(
            'Only super_admin can un-ban a user'
        );
        expect(models.User.update).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    it('→ deleted: clears the password field', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue(makeMockUser({ status: 'active' }));

        await changeUserStatus('target-user-uuid', 'deleted', ADMIN_SUPER);

        expect(models.User.update).toHaveBeenCalledWith(
            { status: 'deleted', password: null },
            { where: { id: 'target-user-uuid' } }
        );
    });

    // -----------------------------------------------------------------------
    it('self-change: throws when changedBy.userId equals target userId', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue(makeMockUser({ id: ADMIN_SUPER.userId }));

        await expect(changeUserStatus(ADMIN_SUPER.userId, 'inactive', ADMIN_SUPER)).rejects.toThrow(
            'Cannot change your own status'
        );
        expect(models.User.update).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    it('owner cannot ban: throws when owner tries to set banned', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue(makeMockUser({ status: 'active' }));

        await expect(changeUserStatus('target-user-uuid', 'banned', ADMIN_OWNER)).rejects.toThrow(
            'Owner cannot set status to banned'
        );
        expect(models.User.update).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    it('invalid status: throws for unrecognised status value', async () => {
        await expect(changeUserStatus('target-user-uuid', 'unknown_status', ADMIN_SUPER)).rejects.toThrow(
            'Invalid status: unknown_status'
        );
        expect(models.User.findByPk).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    it('audit log: auditLogger.info is called with correct format', async () => {
        const { auditLogger } = await import('../../../src/config/logger.js');
        vi.mocked(models.User.findByPk).mockResolvedValue(makeMockUser({ status: 'active', login: 'targetuser' }));

        await changeUserStatus('target-user-uuid', 'inactive', ADMIN_SUPER, null, 'manual', '127.0.0.1');

        expect(auditLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'USER_STATUS_CHANGE',
                marker: '🔄 STATUS_CHANGE',
                userId: 'target-user-uuid',
                userLogin: 'targetuser',
                previousStatus: 'active',
                newStatus: 'inactive',
                changedBy: {
                    userId: ADMIN_SUPER.userId,
                    login: ADMIN_SUPER.login,
                    role: ADMIN_SUPER.role,
                },
                source: 'manual',
                ip: '127.0.0.1',
            })
        );
    });
});

// ---------------------------------------------------------------------------
// incrementFailedAttempts
// ---------------------------------------------------------------------------

describe('incrementFailedAttempts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(models.User.increment).mockResolvedValue([1]);
        vi.mocked(models.User.update).mockResolvedValue([1]);
    });

    it('user with 9 failed attempts after increment: status remains active, failedAttempts = 9', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue(makeMockUser({ status: 'active', failed_login_attempts: 9 }));

        const result = await incrementFailedAttempts('target-user-uuid', 'targetuser', '127.0.0.1');

        expect(models.User.increment).toHaveBeenCalledWith('failed_login_attempts', {
            where: { id: 'target-user-uuid' },
        });
        expect(result.failedAttempts).toBe(9);
        expect(result.suspended).toBe(false);
        expect(models.User.update).not.toHaveBeenCalled();
    });

    it('user with 10 failed attempts after increment: status becomes suspended', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue(
            makeMockUser({ status: 'active', failed_login_attempts: 10 })
        );

        const result = await incrementFailedAttempts('target-user-uuid', 'targetuser', '127.0.0.1');

        expect(result.failedAttempts).toBe(10);
        expect(result.suspended).toBe(true);
        expect(models.User.update).toHaveBeenCalledWith({ status: 'suspended' }, { where: { id: 'target-user-uuid' } });
    });

    it('logs USER_STATUS_CHANGE audit event when auto-suspending', async () => {
        const { auditLogger } = await import('../../../src/config/logger.js');
        vi.mocked(models.User.findByPk).mockResolvedValue(
            makeMockUser({ status: 'active', failed_login_attempts: 10 })
        );

        await incrementFailedAttempts('target-user-uuid', 'targetuser', '10.0.0.1');

        expect(auditLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'USER_STATUS_CHANGE',
                marker: '🔄 STATUS_CHANGE',
                previousStatus: 'active',
                newStatus: 'suspended',
                source: 'auto_rate_limit',
                userId: 'target-user-uuid',
                userLogin: 'targetuser',
            })
        );
    });

    it('logs LOGIN_FAILED_ATTEMPT_COUNT on every increment', async () => {
        const { auditLogger } = await import('../../../src/config/logger.js');
        vi.mocked(models.User.findByPk).mockResolvedValue(makeMockUser({ status: 'active', failed_login_attempts: 7 }));

        await incrementFailedAttempts('target-user-uuid', 'targetuser', '10.0.0.2');

        expect(auditLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'LOGIN_FAILED_ATTEMPT_COUNT',
                userId: 'target-user-uuid',
                userLogin: 'targetuser',
                failedAttempts: 7,
                ip: '10.0.0.2',
            })
        );
    });

    it('already suspended: does not update status again', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue(
            makeMockUser({ status: 'suspended', failed_login_attempts: 15 })
        );

        const result = await incrementFailedAttempts('target-user-uuid', 'targetuser', '127.0.0.1');

        expect(result.suspended).toBe(false);
        expect(models.User.update).not.toHaveBeenCalled();
    });

    it('returns {failedAttempts: 0, suspended: false} when user not found', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue(null);

        const result = await incrementFailedAttempts('nonexistent-uuid', 'noone', '127.0.0.1');

        expect(result).toEqual({ failedAttempts: 0, suspended: false });
    });
});

// ---------------------------------------------------------------------------
// resetFailedAttempts
// ---------------------------------------------------------------------------

describe('resetFailedAttempts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(models.User.update).mockResolvedValue([1]);
    });

    it('resets failed_login_attempts to 0 on successful login', async () => {
        const result = await resetFailedAttempts('target-user-uuid');

        expect(models.User.update).toHaveBeenCalledWith(
            { failed_login_attempts: 0 },
            { where: { id: 'target-user-uuid' } }
        );
        expect(result).toBe(true);
    });

    it('returns false when user not found', async () => {
        vi.mocked(models.User.update).mockResolvedValue([0]);

        const result = await resetFailedAttempts('nonexistent-uuid');

        expect(result).toBe(false);
    });
});
