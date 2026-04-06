/**
 * @file tests/unit/controllers/adminUsers.controller.test.js
 * Unit tests for adminCreateUser in adminUsers.controller.js,
 * focused on the welcome email feature.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminCreateUser } from '../../../src/controllers/admin/adminUsers.controller.js';
import { assignUserToSites } from '../../../src/services/siteUser.service.js';
import { createUserAdmin, sendWelcomeEmail, userExists } from '../../../src/services/user.service.js';

// ---------------------------------------------------------------------------
// Mocks — vi.mock() is hoisted above imports by Vitest
// ---------------------------------------------------------------------------

vi.mock('../../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    errorLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn(),
    formatBytes: vi.fn(),
}));

vi.mock('../../../src/models/index.js', () => ({
    default: {
        User: { findByPk: vi.fn(), create: vi.fn(), findOne: vi.fn(), update: vi.fn() },
    },
}));

vi.mock('../../../src/utils/crypto.js', () => ({
    encryptString: vi.fn((s) => `enc:${s}`),
    decryptString: vi.fn((s) => s.replace('enc:', '')),
    encryptObject: vi.fn((o) => `encobj:${JSON.stringify(o)}`),
    decryptObject: vi.fn((s) => JSON.parse(s.replace('encobj:', ''))),
}));

vi.mock('../../../src/services/user.service.js', () => ({
    userExists: vi.fn(),
    createUserAdmin: vi.fn(),
    sendWelcomeEmail: vi.fn(),
    findUsersWithFilters: vi.fn(),
    getAllUsersWithCreator: vi.fn(),
    getUserWithRelations: vi.fn(),
    changeUserStatus: vi.fn(),
    deleteUserWithRelations: vi.fn(),
}));

vi.mock('../../../src/services/siteUser.service.js', () => ({
    assignUserToSites: vi.fn(),
    updateUserSiteAssignments: vi.fn(),
}));

vi.mock('../../../src/services/site.service.js', () => ({
    getAvailableSites: vi.fn().mockResolvedValue([]),
    verifySiteAccess: vi.fn(),
    createSite: vi.fn(),
    getSiteWithForms: vi.fn(),
    deleteSiteWithForms: vi.fn(),
    generateSiteToken: vi.fn(),
    revokeSiteTokens: vi.fn(),
    domainExists: vi.fn(),
}));

vi.mock('../../../src/services/auth.service.js', () => ({
    verifyPassword: vi.fn(),
    hashPassword: vi.fn(),
}));

vi.mock('../../../src/services/export.service.js', () => ({
    exportUsersToCSV: vi.fn(),
    exportUsersToExcel: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(bodyOverrides = {}) {
    return {
        body: {
            login: 'jdupont',
            email: 'jean.dupont@example.com',
            role: 'viewer',
            ...bodyOverrides,
        },
        session: { user: { id: 'admin-uuid', role: 'super_admin' } },
        __: vi.fn((key) => key),
    };
}

function makeRes() {
    return {
        flash: vi.fn(),
        redirect: vi.fn(),
        render: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
    };
}

const mockNewUser = { id: 'new-user-uuid', login: 'jdupont', email: 'jean.dupont@example.com', role: 'viewer', status: 'pending' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('adminUsers.controller', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        userExists.mockResolvedValue(false);
        createUserAdmin.mockResolvedValue(mockNewUser);
        assignUserToSites.mockResolvedValue(undefined);
        sendWelcomeEmail.mockResolvedValue(undefined);
    });

    // -------------------------------------------------------------------------
    describe('adminCreateUser()', () => {
        it("crée l'utilisateur et redirige sans envoyer d'email si la checkbox n'est pas cochée", async () => {
            const req = makeReq(); // sendWelcomeEmail absent du body
            const res = makeRes();

            await adminCreateUser(req, res);

            expect(createUserAdmin).toHaveBeenCalledOnce();
            expect(sendWelcomeEmail).not.toHaveBeenCalled();
            expect(res.flash).toHaveBeenCalledWith('success', 'flash.admin_user_created');
            expect(res.redirect).toHaveBeenCalledWith('/admin/users');
        });

        it('envoie l\'email de bienvenue si sendWelcomeEmail vaut "on"', async () => {
            const req = makeReq({ sendWelcomeEmail: 'on' });
            const res = makeRes();

            await adminCreateUser(req, res);

            expect(createUserAdmin).toHaveBeenCalledOnce();
            expect(sendWelcomeEmail).toHaveBeenCalledOnce();
            expect(sendWelcomeEmail).toHaveBeenCalledWith(mockNewUser);
            expect(res.flash).toHaveBeenCalledWith('success', 'flash.admin_user_created');
            expect(res.flash).toHaveBeenCalledWith('info', 'flash.admin_welcome_email_sent');
            expect(res.redirect).toHaveBeenCalledWith('/admin/users');
        });

        it("flash warning si l'envoi d'email échoue mais crée quand même l'utilisateur", async () => {
            sendWelcomeEmail.mockRejectedValueOnce(new Error('SMTP connection refused'));
            const req = makeReq({ sendWelcomeEmail: 'on' });
            const res = makeRes();

            await adminCreateUser(req, res);

            expect(createUserAdmin).toHaveBeenCalledOnce();
            expect(sendWelcomeEmail).toHaveBeenCalledOnce();
            expect(res.flash).toHaveBeenCalledWith('success', 'flash.admin_user_created');
            expect(res.flash).toHaveBeenCalledWith('warning', 'flash.admin_welcome_email_error');
            expect(res.redirect).toHaveBeenCalledWith('/admin/users');
        });

        it('ne tente pas d\'envoyer l\'email si la checkbox a une valeur différente de "on"', async () => {
            const req = makeReq({ sendWelcomeEmail: 'off' });
            const res = makeRes();

            await adminCreateUser(req, res);

            expect(sendWelcomeEmail).not.toHaveBeenCalled();
        });

        it("redirige avec un flash error si l'utilisateur existe déjà", async () => {
            userExists.mockResolvedValueOnce(true);
            const req = makeReq({ sendWelcomeEmail: 'on' });
            const res = makeRes();

            await adminCreateUser(req, res);

            expect(createUserAdmin).not.toHaveBeenCalled();
            expect(sendWelcomeEmail).not.toHaveBeenCalled();
            expect(res.flash).toHaveBeenCalledWith('error', 'flash.admin_user_exists');
            expect(res.redirect).toHaveBeenCalledWith('/admin/users');
        });

        it('redirige avec un flash warning si des champs obligatoires sont manquants', async () => {
            const req = makeReq({ login: '', sendWelcomeEmail: 'on' });
            const res = makeRes();

            await adminCreateUser(req, res);

            expect(createUserAdmin).not.toHaveBeenCalled();
            expect(sendWelcomeEmail).not.toHaveBeenCalled();
            expect(res.flash).toHaveBeenCalledWith('warning', 'flash.admin_fields_required');
        });

        it("assigne les sites avant de tenter l'envoi de l'email", async () => {
            const callOrder = [];
            createUserAdmin.mockImplementationOnce(async () => {
                callOrder.push('create');
                return mockNewUser;
            });
            assignUserToSites.mockImplementationOnce(async () => {
                callOrder.push('assign');
            });
            sendWelcomeEmail.mockImplementationOnce(async () => {
                callOrder.push('email');
            });

            const req = makeReq({ sites: ['site-uuid-1'], sendWelcomeEmail: 'on' });
            const res = makeRes();

            await adminCreateUser(req, res);

            expect(callOrder).toEqual(['create', 'assign', 'email']);
        });
    });
});
