import dayjs from 'dayjs';
import { errorLogger } from '../../config/logger.js';
import models from '../../models/index.js';
import { verifyPassword } from '../../services/auth.service.js';
import { getAvailableSites } from '../../services/site.service.js';
import { assignUserToSites, updateUserSiteAssignments } from '../../services/siteUser.service.js';
import {
    findUsersWithFilters,
    getAllUsersWithCreator,
    userExists,
    createUserAdmin,
    getUserWithRelations,
    updateUserAdmin,
    changeUserStatus,
    deleteUserWithRelations,
    sendWelcomeEmail,
} from '../../services/user.service.js';

/**
 * Page de gestion des utilisateurs
 */
export const adminUsers = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const userRole = req.session.user?.role;

        // Récupérer les sites disponibles via le service
        const sites = await getAvailableSites(userId, userRole);

        res.render('admin/users/list', {
            layout: 'admin',
            sites,
        });
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'adminUsers error');
        res.redirect('/admin');
    }
};

/**
 * API - Liste des utilisateurs avec pagination
 */
export const adminUsersList = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;
        const search = req.query.search || '';
        const searchField = req.query.searchField || 'auto';

        // Récupérer les utilisateurs via le service
        const { users, total } = await findUsersWithFilters({
            limit,
            offset,
            search,
            searchField,
        });

        // Formater les données
        const formattedUsers = users.map((user) => ({
            id: user.id,
            email: user.email,
            login: user.login,
            role: user.role || 'N/A',
            status: user.status || 'pending',
            created_by: user.creator ? user.creator.login : 'N/A',
            last_connection: user.last_connection ? dayjs(user.last_connection).format('YYYY-MM-DD HH:mm') : 'N/A',
            createdAt: dayjs(user.createdAt).format('YYYY-MM-DD'),
        }));

        res.json({
            users: formattedUsers,
            total,
            limit,
            offset,
        });
    } catch (err) {
        errorLogger.error({ err }, 'adminUsersList error');
        res.status(500).json({ error: req.__('flash.server_error') });
    }
};

/**
 * Export Excel des utilisateurs
 */
export const adminUsersExportExcel = async (req, res) => {
    try {
        const search = req.query.search || '';

        // Récupérer tous les utilisateurs via le service
        const users = await getAllUsersWithCreator({ search });

        // Créer le workbook Excel
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(req.__('export.users_sheet'));

        // Définir les colonnes
        worksheet.columns = [
            { header: req.__('export.header_email'), key: 'email', width: 30 },
            { header: req.__('export.header_login'), key: 'login', width: 20 },
            { header: req.__('export.header_role'), key: 'role', width: 15 },
            { header: req.__('export.header_created_by'), key: 'created_by', width: 20 },
            { header: req.__('export.header_enabled'), key: 'enabled', width: 10 },
            { header: req.__('export.header_last_connection'), key: 'last_connection', width: 20 },
            { header: req.__('export.header_created_at'), key: 'createdAt', width: 20 },
        ];

        // Style des en-têtes
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'left' };

        // Ajouter les données
        users.forEach((user) => {
            worksheet.addRow({
                email: user.email,
                login: user.login,
                role: user.role || 'N/A',
                created_by: user.creator ? user.creator.login : 'N/A',
                enabled: user.enabled ? req.__('export.yes') : req.__('export.no'),
                last_connection: user.last_connection ? dayjs(user.last_connection).format('YYYY-MM-DD HH:mm') : 'N/A',
                createdAt: dayjs(user.createdAt).format('YYYY-MM-DD HH:mm'),
            });
        });

        // Générer le fichier
        const fileName = `${req.__('export.users_filename_prefix')}${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'adminUsersExportExcel error');
        res.status(500).json({ error: req.__('flash.export_error') });
    }
};

/**
 * Exporter les utilisateurs en CSV
 */
export const adminUsersExportCSV = async (req, res) => {
    try {
        const search = req.query.search || '';

        // Récupérer tous les utilisateurs via le service
        const users = await getAllUsersWithCreator({ search });

        // Générer le CSV via le service d'export
        const { generateUsersCSV } = await import('../../services/export.service.js');
        const labels = {
            email: req.__('export.header_email'),
            login: req.__('export.header_login'),
            role: req.__('export.header_role'),
            created_by: req.__('export.header_created_by'),
            enabled: req.__('export.header_enabled'),
            last_connection: req.__('export.header_last_connection'),
            created_at: req.__('export.header_created_at'),
            yes: req.__('export.yes'),
            no: req.__('export.no'),
        };
        const csvData = await generateUsersCSV(users, labels);

        // Générer le fichier
        const fileName = `${req.__('export.users_filename_prefix')}${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Ajouter le BOM UTF-8 pour Excel
        res.write('\uFEFF');

        // Envoyer le CSV
        res.write(csvData);
        res.end();
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'adminUsersExportCSV error');
        res.status(500).json({ error: req.__('flash.export_error') });
    }
};

/**
 * Création d'un utilisateur
 */
export const adminCreateUser = async (req, res) => {
    try {
        const { login, email, role, sites, sendWelcomeEmail: sendEmail } = req.body;
        const creatorId = req.session.user?.id;

        // Validation basique
        if (!login || !email || !role) {
            res.flash('warning', req.__('flash.admin_fields_required'));
            return res.redirect('/admin/users');
        }

        // Vérifier si l'utilisateur existe déjà via le service
        const exists = await userExists(email, login);
        if (exists) {
            res.flash('error', req.__('flash.admin_user_exists'));
            return res.redirect('/admin/users');
        }

        // Créer l'utilisateur via le service
        const newUser = await createUserAdmin({
            login,
            email,
            role,
            created_by: creatorId,
            status: 'pending',
        });

        // Assigner les sites via le service
        if (sites) {
            const siteIds = Array.isArray(sites) ? sites : [sites];
            await assignUserToSites(newUser.id, siteIds);
        }

        res.flash('success', req.__('flash.admin_user_created'));

        // Envoi optionnel de l'email de bienvenue (n'empêche pas la création en cas d'échec)
        if (sendEmail === 'on') {
            try {
                await sendWelcomeEmail(newUser);
                res.flash('info', req.__('flash.admin_welcome_email_sent'));
            } catch (mailErr) {
                errorLogger.error({ err: mailErr, userId: newUser.id }, 'sendWelcomeEmail error');
                res.flash('warning', req.__('flash.admin_welcome_email_error'));
            }
        }

        return res.redirect('/admin/users');
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'adminCreateUser error');
        res.flash('error', req.__('flash.admin_user_create_error'));
        res.redirect('/admin/users');
    }
};

/**
 * Suppression d'un utilisateur
 */
export const adminDeleteUser = async (req, res) => {
    try {
        const { user_id, password } = req.body;
        const currentUserId = req.session.user?.id;

        // Validation basique
        if (!user_id || !password) {
            res.flash('warning', req.__('flash.admin_delete_data_missing'));
            return res.redirect('/admin/users');
        }

        // Vérifier le mot de passe de l'utilisateur connecté
        const currentUser = await models.User.findByPk(currentUserId);
        if (!currentUser) {
            res.flash('error', req.__('flash.session_invalid'));
            return res.redirect('/admin/users');
        }

        const isPasswordValid = await verifyPassword(password, currentUser.password);
        if (!isPasswordValid) {
            res.flash('error', req.__('flash.wrong_password'));
            return res.redirect('/admin/users');
        }

        // Supprimer l'utilisateur et ses relations via le service
        await deleteUserWithRelations(user_id);

        res.flash('success', req.__('flash.admin_user_deleted'));
        res.redirect('/admin/users');
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'adminDeleteUser error');
        res.flash('error', req.__('flash.admin_user_delete_error'));
        res.redirect('/admin/users');
    }
};

/**
 * Affichage d'un utilisateur (lecture seule)
 */
export const adminViewUser = async (req, res) => {
    try {
        const userId = req.params.id;

        // Récupérer l'utilisateur avec ses relations via le service
        const user = await getUserWithRelations(userId);

        if (!user) {
            return res.redirect('/admin/users');
        }

        // Formater les données pour l'affichage
        user.last_connection = user.last_connection ? dayjs(user.last_connection).format('YYYY-MM-DD HH:mm') : null;
        user.createdAt = dayjs(user.createdAt).format('YYYY-MM-DD HH:mm');

        res.render('admin/users/view', {
            layout: 'admin',
            user,
        });
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'adminViewUser error');
        res.redirect('/admin/users');
    }
};

/**
 * Page d'édition d'un utilisateur
 */
export const adminEditUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const currentUserId = req.session.user?.id;
        const currentUserRole = req.session.user?.role;

        // Récupérer l'utilisateur avec ses relations via le service
        const user = await getUserWithRelations(userId);

        if (!user) {
            return res.redirect('/admin/users');
        }

        // Un owner ne peut pas modifier un super_admin
        if (currentUserRole === 'owner' && user.role === 'super_admin') {
            res.flash('error', req.__('flash.admin_cannot_edit_superadmin'));
            return res.redirect(`/admin/users/${userId}/view`);
        }

        // Récupérer tous les sites disponibles via le service
        const sites = await getAvailableSites(currentUserId, currentUserRole);

        // Marquer les sites assignés
        const assignedSiteIds = user.siteassignments?.map((sa) => sa.site.id) || [];
        const sitesWithAssignment = sites.map((s) => ({
            ...s,
            isAssigned: assignedSiteIds.includes(s.id),
        }));

        // Formater les données pour l'affichage
        user.last_connection = user.last_connection ? dayjs(user.last_connection).format('YYYY-MM-DD HH:mm') : null;
        user.createdAt = dayjs(user.createdAt).format('YYYY-MM-DD HH:mm');

        const showMcpAdmin = process.env.MCP_ENABLED === 'true' && currentUserRole === 'super_admin';

        res.render('admin/users/edit', {
            layout: 'admin',
            user,
            sites: sitesWithAssignment,
            showMcpAdmin,
        });
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'adminEditUser error');
        res.redirect('/admin/users');
    }
};

/**
 * Mise à jour d'un utilisateur
 */
export const adminUpdateUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const currentUserRole = req.session.user?.role;
        const { sites } = req.body;

        // Un owner ne peut pas modifier un super_admin
        const targetUser = await getUserWithRelations(userId);
        if (targetUser && currentUserRole === 'owner' && targetUser.role === 'super_admin') {
            res.flash('error', req.__('flash.admin_cannot_edit_superadmin'));
            return res.redirect(`/admin/users/${userId}/view`);
        }

        // Gérer les sites assignés via le service
        const siteIds = sites ? (Array.isArray(sites) ? sites : [sites]) : [];
        await updateUserSiteAssignments(userId, siteIds);

        // Mise à jour mcp_enabled (super_admin uniquement, si MCP activé globalement)
        if (process.env.MCP_ENABLED === 'true' && currentUserRole === 'super_admin') {
            const mcpEnabled = req.body.mcp_enabled === 'on';
            await updateUserAdmin(userId, { mcp_enabled: mcpEnabled });
        }

        res.flash('success', req.__('flash.admin_user_updated'));
        res.redirect(`/admin/users/${userId}/view`);
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'adminUpdateUser error');
        res.flash('error', req.__('flash.admin_user_update_error'));
        res.redirect(`/admin/users/${req.params.id}/edit`);
    }
};

/**
 * Changement de statut d'un utilisateur (avec audit trail)
 */
export const adminChangeUserStatus = async (req, res) => {
    const targetUserId = req.params.id;
    try {
        const { status, reason } = req.body;
        const admin = req.session.user;

        if (!status) {
            res.flash('warning', req.__('flash.admin_status_missing'));
            return res.redirect(`/admin/users/${targetUserId}/view`);
        }

        if (status === 'banned' && (!reason || !reason.trim())) {
            res.flash('warning', req.__('flash.admin_ban_reason_required'));
            return res.redirect(`/admin/users/${targetUserId}/view`);
        }

        await changeUserStatus(targetUserId, status, { userId: admin.id, login: admin.login, role: admin.role }, reason || null, 'manual', req.ip || null);

        res.flash('success', req.__('flash.admin_status_updated', { status }));
        return res.redirect(`/admin/users/${targetUserId}/view`);
    } catch (err) {
        if (
            err.message === 'Cannot change your own status' ||
            err.message === 'Reason is required when banning a user' ||
            err.message === 'Only super_admin can un-ban a user' ||
            err.message === 'Owner cannot change the status of a super_admin' ||
            err.message?.startsWith('Owner cannot set status') ||
            err.message?.startsWith('Cannot change a pending user') ||
            err.message?.startsWith('Invalid status')
        ) {
            res.flash('error', err.message);
            return res.redirect(`/admin/users/${targetUserId}/view`);
        }

        errorLogger.error({ err, userId: req.session?.user?.id }, 'adminChangeUserStatus error');
        res.flash('error', req.__('flash.admin_status_error'));
        return res.redirect(`/admin/users/${targetUserId}/view`);
    }
};
