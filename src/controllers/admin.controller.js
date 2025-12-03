import bcrypt from 'bcrypt';
import dayjs from 'dayjs';
import { Op } from 'sequelize';
import models from '../models/index.js';

/**
 * Page d'administration
 */
export const admin = async (req, res) => {
    try {
        res.render('admin/index', {
            layout: 'admin',
        });
    } catch (err) {
        console.error('admin error:', err);
        res.redirect('/dashboard');
    }
};

/**
 * Page de gestion des utilisateurs
 */
export const adminUsers = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const userRole = req.session.user?.role;

        // Récupérer les sites disponibles (super_admin voit tous les sites)
        const whereCondition = userRole === 'super_admin' ? {} : { fk_id_user: userId };

        const sites = await models.Site.findAll({
            where: whereCondition,
            attributes: ['id', 'domain'],
            order: [['domain', 'ASC']],
        });

        res.render('admin/users/list', {
            layout: 'admin',
            sites: sites.map((s) => s.toJSON()),
        });
    } catch (err) {
        console.error('adminUsers error:', err);
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

        // Construire les conditions de recherche
        const whereConditions = {};
        if (search) {
            if (searchField === 'auto' || searchField === 'email') {
                whereConditions.email = { [Op.like]: `%${search}%` };
            } else if (searchField === 'login') {
                whereConditions.login = { [Op.like]: `%${search}%` };
            } else if (searchField === 'role') {
                whereConditions.role = { [Op.like]: `%${search}%` };
            }
        }

        // Récupérer les utilisateurs avec pagination
        const { count, rows: users } = await models.User.findAndCountAll({
            where: whereConditions,
            limit,
            offset,
            order: [['createdAt', 'DESC']],
            include: [
                {
                    model: models.User,
                    as: 'creator',
                    attributes: ['id', 'login', 'email'],
                    required: false,
                    ...(searchField === 'created_by' && search
                        ? {
                              where: {
                                  login: { [Op.like]: `%${search}%` },
                              },
                          }
                        : {}),
                },
            ],
            attributes: ['id', 'email', 'login', 'role', 'status', 'last_connection', 'createdAt', 'created_by'],
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
            total: count,
            limit,
            offset,
        });
    } catch (err) {
        console.error('adminUsersList error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Export Excel des utilisateurs
 */
export const adminUsersExportExcel = async (req, res) => {
    try {
        const search = req.query.search || '';

        // Construire les conditions de recherche
        const whereConditions = {};
        if (search) {
            whereConditions[Op.or] = [{ email: { [Op.like]: `%${search}%` } }, { login: { [Op.like]: `%${search}%` } }];
        }

        // Récupérer tous les utilisateurs
        const users = await models.User.findAll({
            where: whereConditions,
            order: [['createdAt', 'DESC']],
            include: [
                {
                    model: models.User,
                    as: 'creator',
                    attributes: ['login'],
                },
            ],
        });

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
        console.error('adminUsersExportExcel error:', err);
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
            return res.redirect('/admin/users');
        }

        // Vérifier si l'utilisateur existe déjà
        const existingUser = await models.User.findOne({
            where: {
                [Op.or]: [{ email }, { login }],
            },
        });

        if (existingUser) {
            return res.redirect('/admin/users');
        }

        // Créer l'utilisateur
        const newUser = await models.User.create({
            login,
            email,
            role,
            created_by: creatorId,
            status: 'pending',
        });

        // Assigner les sites
        if (sites) {
            const siteIds = Array.isArray(sites) ? sites : [sites];
            const siteAssignments = siteIds.map((siteId) => ({
                fk_id_user: newUser.id,
                fk_id_site: siteId, // UUID string (pas parseInt !)
            }));
            await models.SiteUser.bulkCreate(siteAssignments);
        }

        res.redirect('/admin/users');
    } catch (err) {
        console.error('adminCreateUser error:', err);
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
            return res.redirect('/admin/users');
        }

        // Vérifier le mot de passe de l'utilisateur connecté
        const currentUser = await models.User.findByPk(currentUserId);
        if (!currentUser) {
            return res.redirect('/admin/users');
        }

        const isPasswordValid = await bcrypt.compare(password, currentUser.password);
        if (!isPasswordValid) {
            // TODO: Flash message "Mot de passe incorrect"
            return res.redirect('/admin/users');
        }

        // Supprimer les associations dans SiteUser
        await models.SiteUser.destroy({
            where: { fk_id_user: user_id },
        });

        // Supprimer l'utilisateur
        await models.User.destroy({
            where: { id: user_id },
        });

        res.redirect('/admin/users');
    } catch (err) {
        console.error('adminDeleteUser error:', err);
        res.redirect('/admin/users');
    }
};

/**
 * Affichage d'un utilisateur (lecture seule)
 */
export const adminViewUser = async (req, res) => {
    try {
        const userId = req.params.id;

        const user = await models.User.findByPk(userId, {
            include: [
                {
                    model: models.User,
                    as: 'creator',
                    attributes: ['login'],
                },
                {
                    model: models.SiteUser,
                    as: 'siteassignments',
                    include: [
                        {
                            model: models.Site,
                            as: 'site',
                            attributes: ['id', 'domain'],
                        },
                    ],
                },
            ],
        });

        if (!user) {
            return res.redirect('/admin/users');
        }

        // Formater les données pour l'affichage
        const userData = user.toJSON();
        userData.last_connection = userData.last_connection
            ? dayjs(userData.last_connection).format('YYYY-MM-DD HH:mm')
            : null;
        userData.createdAt = dayjs(userData.createdAt).format('YYYY-MM-DD HH:mm');

        res.render('admin/users/view', {
            layout: 'admin',
            user: userData,
        });
    } catch (err) {
        console.error('adminViewUser error:', err);
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

        const user = await models.User.findByPk(userId, {
            include: [
                {
                    model: models.User,
                    as: 'creator',
                    attributes: ['login'],
                },
                {
                    model: models.SiteUser,
                    as: 'siteassignments',
                    include: [
                        {
                            model: models.Site,
                            as: 'site',
                            attributes: ['id', 'domain'],
                        },
                    ],
                },
            ],
        });

        if (!user) {
            return res.redirect('/admin/users');
        }

        // Récupérer tous les sites disponibles
        const currentUserRole = req.session.user?.role;
        const whereCondition =
            currentUserRole === 'super_admin'
                ? {} // Super_admin voit TOUS les sites
                : { fk_id_user: currentUserId }; // Autres voient seulement leurs sites

        const sites = await models.Site.findAll({
            where: whereCondition,
            attributes: ['id', 'domain'],
            order: [['domain', 'ASC']],
        });

        // Marquer les sites assignés
        const assignedSiteIds = user.siteassignments?.map((sa) => sa.site.id) || [];
        const sitesWithAssignment = sites.map((s) => ({
            ...s.toJSON(),
            isAssigned: assignedSiteIds.includes(s.id),
        }));

        // Formater les données pour l'affichage
        const userData = user.toJSON();
        userData.last_connection = userData.last_connection
            ? dayjs(userData.last_connection).format('YYYY-MM-DD HH:mm')
            : null;
        userData.createdAt = dayjs(userData.createdAt).format('YYYY-MM-DD HH:mm');

        res.render('admin/users/edit', {
            layout: 'admin',
            user: userData,
            sites: sitesWithAssignment,
        });
    } catch (err) {
        console.error('adminEditUser error:', err);
        res.redirect('/admin/users');
    }
};

/**
 * Mise à jour d'un utilisateur
 */
export const adminUpdateUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const { login, email, role, sites, clear_password } = req.body;

        // Validation basique
        if (!login || !email || !role) {
            return res.redirect(`/admin/users/${userId}/edit`);
        }

        const updateData = {
            login,
            email,
            role,
        };

        // Si le mot de passe est vidé, désactiver l'utilisateur
        if (clear_password === 'true') {
            updateData.password = null;
            updateData.status = 'pending';
        }

        // Mettre à jour l'utilisateur
        await models.User.update(updateData, {
            where: { id: userId },
        });

        // Gérer les sites assignés
        // D'abord supprimer toutes les assignations existantes
        await models.SiteUser.destroy({
            where: { fk_id_user: userId },
        });

        // Puis recréer les assignations si des sites sont sélectionnés
        if (sites) {
            const siteIds = Array.isArray(sites) ? sites : [sites];
            const siteAssignments = siteIds.map((siteId) => ({
                fk_id_user: userId, // UUID string
                fk_id_site: siteId, // UUID string (pas parseInt !)
            }));
            await models.SiteUser.bulkCreate(siteAssignments);
        }

        res.redirect('/admin/users');
    } catch (err) {
        console.error('adminUpdateUser error:', err);
        res.redirect(`/admin/users/${req.params.id}/edit`);
    }
};

/**
 * Page de paramètres de l'administration
 */
export const adminSettings = async (req, res) => {
    try {
        res.render('admin/settings', {
            layout: 'admin',
        });
    } catch (err) {
        console.error('adminSettings error:', err);
        res.redirect('/admin');
    }
};
