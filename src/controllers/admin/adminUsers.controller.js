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
        res.status(500).json({ error: 'Erreur serveur' });
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
        const worksheet = workbook.addWorksheet('Utilisateurs');

        // Définir les colonnes
        worksheet.columns = [
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Login', key: 'login', width: 20 },
            { header: 'Rôle', key: 'role', width: 15 },
            { header: 'Créé par', key: 'created_by', width: 20 },
            { header: 'Activé', key: 'enabled', width: 10 },
            { header: 'Dernière connexion', key: 'last_connection', width: 20 },
            { header: 'Créé le', key: 'createdAt', width: 20 },
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
                enabled: user.enabled ? 'Oui' : 'Non',
                last_connection: user.last_connection ? dayjs(user.last_connection).format('YYYY-MM-DD HH:mm') : 'N/A',
                createdAt: dayjs(user.createdAt).format('YYYY-MM-DD HH:mm'),
            });
        });

        // Générer le fichier
        const fileName = `utilisateurs_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'adminUsersExportExcel error');
        res.status(500).json({ error: "Erreur lors de l'export" });
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
        const csvData = await generateUsersCSV(users);

        // Générer le fichier
        const fileName = `utilisateurs_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Ajouter le BOM UTF-8 pour Excel
        res.write('\uFEFF');

        // Envoyer le CSV
        res.write(csvData);
        res.end();
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'adminUsersExportCSV error');
        res.status(500).json({ error: "Erreur lors de l'export" });
    }
};

/**
 * Création d'un utilisateur
 */
export const adminCreateUser = async (req, res) => {
    try {
        const { login, email, role, sites } = req.body;
        const creatorId = req.session.user?.id;

        // Validation basique
        if (!login || !email || !role) {
            res.flash('warning', 'Veuillez remplir tous les champs obligatoires.');
            return res.redirect('/admin/users');
        }

        // Vérifier si l'utilisateur existe déjà via le service
        const exists = await userExists(email, login);
        if (exists) {
            res.flash('error', 'Un utilisateur avec cet email ou login existe déjà.');
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

        res.flash('success', 'Utilisateur créé avec succès.');
        res.redirect('/admin/users');
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'adminCreateUser error');
        res.flash('error', "Erreur lors de la création de l'utilisateur.");
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
            res.flash('warning', 'Données manquantes pour la suppression.');
            return res.redirect('/admin/users');
        }

        // Vérifier le mot de passe de l'utilisateur connecté
        const currentUser = await models.User.findByPk(currentUserId);
        if (!currentUser) {
            res.flash('error', 'Session invalide.');
            return res.redirect('/admin/users');
        }

        const isPasswordValid = await verifyPassword(password, currentUser.password);
        if (!isPasswordValid) {
            res.flash('error', 'Mot de passe incorrect.');
            return res.redirect('/admin/users');
        }

        // Soft-supprimer l'utilisateur via le service (audit trail inclus)
        const changedBy = {
            userId: currentUserId,
            login: req.session.user?.login,
            role: req.session.user?.role,
        };
        await changeUserStatus(user_id, 'deleted', changedBy);

        res.flash('success', 'Utilisateur supprimé.');
        res.redirect('/admin/users');
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'adminDeleteUser error');
        res.flash('error', "Erreur lors de la suppression de l'utilisateur.");
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

        res.render('admin/users/edit', {
            layout: 'admin',
            user,
            sites: sitesWithAssignment,
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
        const { sites } = req.body;

        // Gérer les sites assignés via le service
        const siteIds = sites ? (Array.isArray(sites) ? sites : [sites]) : [];
        await updateUserSiteAssignments(userId, siteIds);

        res.flash('success', 'Utilisateur mis à jour.');
        res.redirect(`/admin/users/${userId}/view`);
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'adminUpdateUser error');
        res.flash('error', "Erreur lors de la mise à jour de l'utilisateur.");
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
            res.flash('warning', 'Statut manquant.');
            return res.redirect(`/admin/users/${targetUserId}/view`);
        }

        if (status === 'banned' && (!reason || !reason.trim())) {
            res.flash('warning', 'Un motif est obligatoire pour bannir un utilisateur.');
            return res.redirect(`/admin/users/${targetUserId}/view`);
        }

        await changeUserStatus(
            targetUserId,
            status,
            { userId: admin.id, login: admin.login, role: admin.role },
            reason || null,
            'manual',
            req.ip || null
        );

        res.flash('success', `Statut mis à jour : ${status}.`);
        return res.redirect(`/admin/users/${targetUserId}/view`);
    } catch (err) {
        if (
            err.message === 'Cannot change your own status' ||
            err.message === 'Reason is required when banning a user' ||
            err.message === 'Only super_admin can un-ban a user' ||
            err.message?.startsWith('Owner cannot set status') ||
            err.message?.startsWith('Cannot change a pending user') ||
            err.message?.startsWith('Invalid status')
        ) {
            res.flash('error', err.message);
            return res.redirect(`/admin/users/${targetUserId}/view`);
        }

        errorLogger.error({ err, userId: req.session?.user?.id }, 'adminChangeUserStatus error');
        res.flash('error', 'Erreur lors du changement de statut.');
        return res.redirect(`/admin/users/${targetUserId}/view`);
    }
};
