/**
 * @file tests/integration/services/userStatus.service.test.js
 * Integration tests for changeUserStatus service function
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import models from '../../../src/models/index.js';
import { changeUserStatus } from '../../../src/services/user.service.js';

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
    it('inactive → active: restores active status', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue(makeMockUser({ status: 'inactive' }));

        const result = await changeUserStatus('target-user-uuid', 'active', ADMIN_SUPER);

        expect(models.User.update).toHaveBeenCalledWith({ status: 'active' }, { where: { id: 'target-user-uuid' } });
        expect(result).toEqual({ success: true, previousStatus: 'inactive', newStatus: 'active' });
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
