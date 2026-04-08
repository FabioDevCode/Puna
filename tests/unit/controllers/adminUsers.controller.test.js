/**
 * @file tests/unit/controllers/adminUsers.controller.test.js
 * Unit tests for adminUsers.controller.js
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    adminUsers,
    adminUsersList,
    adminCreateUser,
    adminDeleteUser,
    adminViewUser,
    adminEditUser,
    adminUpdateUser,
    adminChangeUserStatus,
} from '../../../src/controllers/admin/adminUsers.controller.js';
import models from '../../../src/models/index.js';
import { verifyPassword } from '../../../src/services/auth.service.js';
import { getAvailableSites } from '../../../src/services/site.service.js';
import { assignUserToSites, updateUserSiteAssignments } from '../../../src/services/siteUser.service.js';
import {
    createUserAdmin,
    sendWelcomeEmail,
    userExists,
    findUsersWithFilters,
    getUserWithRelations,
    changeUserStatus,
    deleteUserWithRelations,
} from '../../../src/services/user.service.js';

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

        it('redirige avec flash error si une erreur inattendue se produit', async () => {
            createUserAdmin.mockRejectedValueOnce(new Error('DB error'));
            const req = makeReq();
            const res = makeRes();

            await adminCreateUser(req, res);

            expect(res.flash).toHaveBeenCalledWith('error', 'flash.admin_user_create_error');
            expect(res.redirect).toHaveBeenCalledWith('/admin/users');
        });
    });

    // -------------------------------------------------------------------------
    describe('adminUsers()', () => {
        it('rend la page de liste des utilisateurs', async () => {
            getAvailableSites.mockResolvedValueOnce([{ id: 'site1', domain: 'example.com' }]);

            const req = makeReq();
            const res = makeRes();

            await adminUsers(req, res);

            expect(getAvailableSites).toHaveBeenCalledWith('admin-uuid', 'super_admin');
            expect(res.render).toHaveBeenCalledWith('admin/users/list', expect.objectContaining({ layout: 'admin', sites: expect.any(Array) }));
        });

        it("redirige vers /admin en cas d'erreur", async () => {
            getAvailableSites.mockRejectedValueOnce(new Error('DB error'));

            const req = makeReq();
            const res = makeRes();

            await adminUsers(req, res);

            expect(res.redirect).toHaveBeenCalledWith('/admin');
        });
    });

    // -------------------------------------------------------------------------
    describe('adminUsersList()', () => {
        it('retourne la liste paginée des utilisateurs formatée', async () => {
            findUsersWithFilters.mockResolvedValueOnce({
                users: [
                    {
                        id: 'u1',
                        email: 'a@a.com',
                        login: 'alice',
                        role: 'viewer',
                        status: 'active',
                        creator: { login: 'admin' },
                        last_connection: new Date('2025-01-10T12:00:00'),
                        createdAt: new Date('2024-06-01'),
                    },
                ],
                total: 1,
            });

            const req = {
                query: { limit: '10', offset: '0', search: '', searchField: 'auto' },
                __: vi.fn((key) => key),
            };
            const res = makeRes();

            await adminUsersList(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    total: 1,
                    users: expect.arrayContaining([expect.objectContaining({ login: 'alice', email: 'a@a.com' })]),
                })
            );
        });

        it('utilise les valeurs par défaut de pagination', async () => {
            findUsersWithFilters.mockResolvedValueOnce({ users: [], total: 0 });

            const req = { query: {}, __: vi.fn((key) => key) };
            const res = makeRes();

            await adminUsersList(req, res);

            expect(findUsersWithFilters).toHaveBeenCalledWith(expect.objectContaining({ limit: 10, offset: 0 }));
        });

        it("retourne 500 en cas d'erreur", async () => {
            findUsersWithFilters.mockRejectedValueOnce(new Error('DB error'));

            const req = { query: {}, __: vi.fn((key) => key) };
            const res = makeRes();

            await adminUsersList(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'flash.server_error' });
        });
    });

    // -------------------------------------------------------------------------
    describe('adminDeleteUser()', () => {
        const makeDeleteReq = (overrides = {}) => ({
            body: { user_id: 'target-uuid', password: 'MyP@ssword1!', ...overrides },
            session: { user: { id: 'admin-uuid', role: 'super_admin' } },
            __: vi.fn((key) => key),
        });

        beforeEach(() => {
            models.User.findByPk.mockResolvedValue({ id: 'admin-uuid', password: 'hashed' });
            verifyPassword.mockResolvedValue(true);
            deleteUserWithRelations.mockResolvedValue(undefined);
        });

        it('flash warning si user_id ou password manquant', async () => {
            const req = makeDeleteReq({ user_id: '' });
            const res = makeRes();

            await adminDeleteUser(req, res);

            expect(res.flash).toHaveBeenCalledWith('warning', 'flash.admin_delete_data_missing');
            expect(deleteUserWithRelations).not.toHaveBeenCalled();
        });

        it("flash error si l'utilisateur courant est introuvable", async () => {
            models.User.findByPk.mockResolvedValueOnce(null);

            const req = makeDeleteReq();
            const res = makeRes();

            await adminDeleteUser(req, res);

            expect(res.flash).toHaveBeenCalledWith('error', 'flash.session_invalid');
            expect(deleteUserWithRelations).not.toHaveBeenCalled();
        });

        it('flash error si le mot de passe est incorrect', async () => {
            verifyPassword.mockResolvedValueOnce(false);

            const req = makeDeleteReq();
            const res = makeRes();

            await adminDeleteUser(req, res);

            expect(res.flash).toHaveBeenCalledWith('error', 'flash.wrong_password');
            expect(deleteUserWithRelations).not.toHaveBeenCalled();
        });

        it("supprime l'utilisateur et redirige avec succès", async () => {
            const req = makeDeleteReq();
            const res = makeRes();

            await adminDeleteUser(req, res);

            expect(deleteUserWithRelations).toHaveBeenCalledWith('target-uuid');
            expect(res.flash).toHaveBeenCalledWith('success', 'flash.admin_user_deleted');
            expect(res.redirect).toHaveBeenCalledWith('/admin/users');
        });

        it("flash error en cas d'erreur inattendue", async () => {
            deleteUserWithRelations.mockRejectedValueOnce(new Error('DB error'));

            const req = makeDeleteReq();
            const res = makeRes();

            await adminDeleteUser(req, res);

            expect(res.flash).toHaveBeenCalledWith('error', 'flash.admin_user_delete_error');
            expect(res.redirect).toHaveBeenCalledWith('/admin/users');
        });
    });

    // -------------------------------------------------------------------------
    describe('adminViewUser()', () => {
        it("rend la vue d'un utilisateur", async () => {
            getUserWithRelations.mockResolvedValueOnce({
                id: 'u1',
                login: 'alice',
                email: 'a@a.com',
                role: 'viewer',
                last_connection: new Date('2025-01-10T12:00:00'),
                createdAt: new Date('2024-06-01'),
            });

            const req = { params: { id: 'u1' }, session: { user: { id: 'admin-uuid' } }, __: vi.fn((k) => k) };
            const res = makeRes();

            await adminViewUser(req, res);

            expect(res.render).toHaveBeenCalledWith('admin/users/view', expect.objectContaining({ layout: 'admin', user: expect.objectContaining({ login: 'alice' }) }));
        });

        it('redirige vers /admin/users si utilisateur introuvable', async () => {
            getUserWithRelations.mockResolvedValueOnce(null);

            const req = { params: { id: 'unknown' }, session: { user: { id: 'admin-uuid' } }, __: vi.fn((k) => k) };
            const res = makeRes();

            await adminViewUser(req, res);

            expect(res.redirect).toHaveBeenCalledWith('/admin/users');
        });

        it("redirige vers /admin/users en cas d'erreur", async () => {
            getUserWithRelations.mockRejectedValueOnce(new Error('DB error'));

            const req = { params: { id: 'u1' }, session: { user: { id: 'admin-uuid' } }, __: vi.fn((k) => k) };
            const res = makeRes();

            await adminViewUser(req, res);

            expect(res.redirect).toHaveBeenCalledWith('/admin/users');
        });
    });

    // -------------------------------------------------------------------------
    describe('adminEditUser()', () => {
        const mockUser = {
            id: 'u1',
            login: 'alice',
            email: 'a@a.com',
            role: 'viewer',
            last_connection: null,
            createdAt: new Date('2024-06-01'),
            siteassignments: [],
        };

        it("rend la page d'édition avec les sites assignés", async () => {
            getUserWithRelations.mockResolvedValueOnce(mockUser);
            getAvailableSites.mockResolvedValueOnce([{ id: 'site1', domain: 'example.com' }]);

            const req = {
                params: { id: 'u1' },
                session: { user: { id: 'admin-uuid', role: 'super_admin' } },
                __: vi.fn((k) => k),
            };
            const res = makeRes();

            await adminEditUser(req, res);

            expect(res.render).toHaveBeenCalledWith('admin/users/edit', expect.objectContaining({ layout: 'admin', user: expect.any(Object), sites: expect.any(Array) }));
        });

        it('redirige vers /admin/users si utilisateur introuvable', async () => {
            getUserWithRelations.mockResolvedValueOnce(null);

            const req = {
                params: { id: 'unknown' },
                session: { user: { id: 'admin-uuid', role: 'super_admin' } },
                __: vi.fn((k) => k),
            };
            const res = makeRes();

            await adminEditUser(req, res);

            expect(res.redirect).toHaveBeenCalledWith('/admin/users');
        });

        it('un owner ne peut pas éditer un super_admin', async () => {
            getUserWithRelations.mockResolvedValueOnce({ ...mockUser, role: 'super_admin' });

            const req = {
                params: { id: 'u1' },
                session: { user: { id: 'owner-uuid', role: 'owner' } },
                __: vi.fn((k) => k),
            };
            const res = makeRes();

            await adminEditUser(req, res);

            expect(res.flash).toHaveBeenCalledWith('error', 'flash.admin_cannot_edit_superadmin');
            expect(res.redirect).toHaveBeenCalledWith('/admin/users/u1/view');
        });

        it("redirige en cas d'erreur", async () => {
            getUserWithRelations.mockRejectedValueOnce(new Error('DB error'));

            const req = {
                params: { id: 'u1' },
                session: { user: { id: 'admin-uuid', role: 'super_admin' } },
                __: vi.fn((k) => k),
            };
            const res = makeRes();

            await adminEditUser(req, res);

            expect(res.redirect).toHaveBeenCalledWith('/admin/users');
        });
    });

    // -------------------------------------------------------------------------
    describe('adminUpdateUser()', () => {
        it("met à jour l'utilisateur et redirige", async () => {
            getUserWithRelations.mockResolvedValueOnce({ id: 'u1', role: 'viewer' });
            updateUserSiteAssignments.mockResolvedValueOnce(undefined);

            const req = {
                params: { id: 'u1' },
                body: { sites: ['site1', 'site2'] },
                session: { user: { id: 'admin-uuid', role: 'super_admin' } },
                __: vi.fn((k) => k),
            };
            const res = makeRes();

            await adminUpdateUser(req, res);

            expect(updateUserSiteAssignments).toHaveBeenCalledWith('u1', ['site1', 'site2']);
            expect(res.flash).toHaveBeenCalledWith('success', 'flash.admin_user_updated');
            expect(res.redirect).toHaveBeenCalledWith('/admin/users/u1/view');
        });

        it('gère le cas où sites est une chaîne (pas un tableau)', async () => {
            getUserWithRelations.mockResolvedValueOnce({ id: 'u1', role: 'viewer' });
            updateUserSiteAssignments.mockResolvedValueOnce(undefined);

            const req = {
                params: { id: 'u1' },
                body: { sites: 'site1' },
                session: { user: { id: 'admin-uuid', role: 'super_admin' } },
                __: vi.fn((k) => k),
            };
            const res = makeRes();

            await adminUpdateUser(req, res);

            expect(updateUserSiteAssignments).toHaveBeenCalledWith('u1', ['site1']);
        });

        it('gère le cas où sites est absent', async () => {
            getUserWithRelations.mockResolvedValueOnce({ id: 'u1', role: 'viewer' });
            updateUserSiteAssignments.mockResolvedValueOnce(undefined);

            const req = {
                params: { id: 'u1' },
                body: {},
                session: { user: { id: 'admin-uuid', role: 'super_admin' } },
                __: vi.fn((k) => k),
            };
            const res = makeRes();

            await adminUpdateUser(req, res);

            expect(updateUserSiteAssignments).toHaveBeenCalledWith('u1', []);
        });

        it('un owner ne peut pas mettre à jour un super_admin', async () => {
            getUserWithRelations.mockResolvedValueOnce({ id: 'u1', role: 'super_admin' });

            const req = {
                params: { id: 'u1' },
                body: {},
                session: { user: { id: 'owner-uuid', role: 'owner' } },
                __: vi.fn((k) => k),
            };
            const res = makeRes();

            await adminUpdateUser(req, res);

            expect(res.flash).toHaveBeenCalledWith('error', 'flash.admin_cannot_edit_superadmin');
            expect(res.redirect).toHaveBeenCalledWith('/admin/users/u1/view');
        });

        it("flash error en cas d'erreur inattendue", async () => {
            getUserWithRelations.mockResolvedValueOnce({ id: 'u1', role: 'viewer' });
            updateUserSiteAssignments.mockRejectedValueOnce(new Error('DB error'));

            const req = {
                params: { id: 'u1' },
                body: {},
                session: { user: { id: 'admin-uuid', role: 'super_admin' } },
                __: vi.fn((k) => k),
            };
            const res = makeRes();

            await adminUpdateUser(req, res);

            expect(res.flash).toHaveBeenCalledWith('error', 'flash.admin_user_update_error');
            expect(res.redirect).toHaveBeenCalledWith('/admin/users/u1/edit');
        });
    });

    // -------------------------------------------------------------------------
    describe('adminChangeUserStatus()', () => {
        const makeStatusReq = (bodyOverrides = {}) => ({
            params: { id: 'target-uuid' },
            body: { status: 'active', ...bodyOverrides },
            session: { user: { id: 'admin-uuid', login: 'admin', role: 'super_admin' } },
            ip: '127.0.0.1',
            __: vi.fn((key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key)),
        });

        beforeEach(() => {
            changeUserStatus.mockResolvedValue(undefined);
        });

        it('flash warning si status manquant', async () => {
            const req = makeStatusReq({ status: '' });
            const res = makeRes();

            await adminChangeUserStatus(req, res);

            expect(res.flash).toHaveBeenCalledWith('warning', 'flash.admin_status_missing');
            expect(changeUserStatus).not.toHaveBeenCalled();
        });

        it('flash warning si status=banned sans raison', async () => {
            const req = makeStatusReq({ status: 'banned', reason: '  ' });
            const res = makeRes();

            await adminChangeUserStatus(req, res);

            expect(res.flash).toHaveBeenCalledWith('warning', 'flash.admin_ban_reason_required');
            expect(changeUserStatus).not.toHaveBeenCalled();
        });

        it('change le statut avec succès et redirige', async () => {
            const req = makeStatusReq({ status: 'active' });
            const res = makeRes();

            await adminChangeUserStatus(req, res);

            expect(changeUserStatus).toHaveBeenCalledWith('target-uuid', 'active', expect.objectContaining({ userId: 'admin-uuid' }), null, 'manual', '127.0.0.1');
            expect(res.flash).toHaveBeenCalledWith('success', expect.any(String));
            expect(res.redirect).toHaveBeenCalledWith('/admin/users/target-uuid/view');
        });

        it('change le statut banned avec raison valide', async () => {
            const req = makeStatusReq({ status: 'banned', reason: 'Violation des CGU' });
            const res = makeRes();

            await adminChangeUserStatus(req, res);

            expect(changeUserStatus).toHaveBeenCalledWith('target-uuid', 'banned', expect.any(Object), 'Violation des CGU', 'manual', '127.0.0.1');
            expect(res.redirect).toHaveBeenCalledWith('/admin/users/target-uuid/view');
        });

        it("flash error avec le message d'erreur pour une erreur connue", async () => {
            changeUserStatus.mockRejectedValueOnce(new Error('Cannot change your own status'));

            const req = makeStatusReq();
            const res = makeRes();

            await adminChangeUserStatus(req, res);

            expect(res.flash).toHaveBeenCalledWith('error', 'Cannot change your own status');
            expect(res.redirect).toHaveBeenCalledWith('/admin/users/target-uuid/view');
        });

        it('flash error pour les erreurs "Only super_admin"', async () => {
            changeUserStatus.mockRejectedValueOnce(new Error('Only super_admin can un-ban a user'));

            const req = makeStatusReq();
            const res = makeRes();

            await adminChangeUserStatus(req, res);

            expect(res.flash).toHaveBeenCalledWith('error', 'Only super_admin can un-ban a user');
        });

        it('flash error avec clé i18n pour une erreur inattendue', async () => {
            changeUserStatus.mockRejectedValueOnce(new Error('Unexpected DB error'));

            const req = makeStatusReq();
            const res = makeRes();

            await adminChangeUserStatus(req, res);

            expect(res.flash).toHaveBeenCalledWith('error', 'flash.admin_status_error');
            expect(res.redirect).toHaveBeenCalledWith('/admin/users/target-uuid/view');
        });
    });
});
