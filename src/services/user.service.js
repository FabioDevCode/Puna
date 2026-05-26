/**
 * Service de gestion des utilisateurs
 * Gère les opérations CRUD sur les utilisateurs (admin)
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Op } from 'sequelize';
import { auditLogger, logger as appLogger } from '../config/logger.js';
import { sendMail, mailEnabled } from '../config/mailer.js';
import { renderMailTemplate } from '../helpers/mail.helpers.js';
import models from '../models/index.js';
import { hashPassword } from './auth.service.js';
import { destroyUserSessions } from './session.service.js';

const VALID_STATUSES = ['active', 'inactive', 'suspended', 'banned', 'anonymized'];

/**
 * Récupérer tous les utilisateurs avec pagination
 * @param {number} page - Numéro de page (commence à 1)
 * @param {number} limit - Nombre d'utilisateurs par page
 * @returns {Promise<Object>} - { users, total, totalPages }
 */
export async function getAllUsers(page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const { rows: users, count: total } = await models.User.findAndCountAll({
        attributes: ['id', 'email', 'name', 'role', 'createdAt'],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
    });

    return {
        users: users.map((u) => u.toJSON()),
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
    };
}

/**
 * Rechercher des utilisateurs par email ou nom
 * @param {string} query - Terme de recherche
 * @param {number} limit - Nombre maximum de résultats
 * @returns {Promise<Array>} - Liste des utilisateurs trouvés
 */
export async function searchUsers(query, limit = 20) {
    const users = await models.User.findAll({
        where: {
            [Op.or]: [{ email: { [Op.like]: `%${query}%` } }, { name: { [Op.like]: `%${query}%` } }],
        },
        attributes: ['id', 'email', 'name', 'role'],
        limit,
    });

    return users.map((u) => u.toJSON());
}

/**
 * Récupérer un utilisateur par son ID
 * @param {number} userId - ID de l'utilisateur
 * @param {boolean} includePassword - Inclure le hash du mot de passe
 * @returns {Promise<Object|null>} - Utilisateur ou null
 */
export async function getUserById(userId, includePassword = false) {
    const user = await models.User.findByPk(userId);
    if (!user) return null;

    const data = user.toJSON();
    if (!includePassword) {
        delete data.password;
    }
    return data;
}

/**
 * Créer un nouvel utilisateur
 * @param {Object} userData - Données de l'utilisateur
 * @param {string} userData.email - Email
 * @param {string} userData.name - Nom
 * @param {string} userData.password - Mot de passe en clair
 * @param {string} userData.role - Rôle (super_admin, owner, unique, editor, viewer)
 * @returns {Promise<Object>} - Utilisateur créé (sans mot de passe)
 */
export async function createUser(userData) {
    const hashedPassword = await hashPassword(userData.password);

    const user = await models.User.create({
        email: userData.email,
        name: userData.name,
        password: hashedPassword,
        role: userData.role || 'viewer',
    });

    const { password: _, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
}

/**
 * Mettre à jour un utilisateur
 * @param {number} userId - ID de l'utilisateur
 * @param {Object} updateData - Données à mettre à jour
 * @param {string} [updateData.email] - Nouvel email
 * @param {string} [updateData.name] - Nouveau nom
 * @param {string} [updateData.password] - Nouveau mot de passe (en clair)
 * @param {string} [updateData.role] - Nouveau rôle
 * @returns {Promise<Object|null>} - Utilisateur mis à jour ou null
 */
export async function updateUser(userId, updateData) {
    const user = await models.User.findByPk(userId);
    if (!user) {
        return null;
    }

    const dataToUpdate = { ...updateData };

    // Si un nouveau mot de passe est fourni, le hasher
    if (dataToUpdate.password) {
        dataToUpdate.password = await hashPassword(dataToUpdate.password);
    }

    await user.update(dataToUpdate);

    const { password: _, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
}

/**
 * Supprimer un utilisateur
 * @param {number} userId - ID de l'utilisateur
 * @returns {Promise<boolean>} - true si suppression réussie
 */
export async function deleteUser(userId) {
    const result = await models.User.destroy({
        where: { id: userId },
    });

    return result > 0;
}

/**
 * Vérifier si un email existe déjà
 * @param {string} email - Email à vérifier
 * @param {number} excludeUserId - ID utilisateur à exclure (pour updates)
 * @returns {Promise<boolean>} - true si l'email existe
 */
export async function emailExists(email, excludeUserId = null) {
    const where = { email };

    if (excludeUserId) {
        where.id = { [Op.ne]: excludeUserId };
    }

    const user = await models.User.findOne({ where });
    return !!user;
}

/**
 * Compter le nombre total d'utilisateurs
 * @returns {Promise<number>} - Nombre d'utilisateurs
 */
export async function countUsers() {
    return await models.User.count();
}

/**
 * Compter les utilisateurs par rôle
 * @returns {Promise<Object>} - { super_admin: 1, owner: 5, ... }
 */
export async function countUsersByRole() {
    const users = await models.User.findAll({
        attributes: ['role'],
    });

    const counts = {};
    users.forEach((user) => {
        counts[user.role] = (counts[user.role] || 0) + 1;
    });

    return counts;
}

/**
 * Récupérer tous les utilisateurs avec leur créateur (pour export Excel)
 * @param {Object} filters - Filtres optionnels
 * @param {string} [filters.search] - Recherche sur email ou login
 * @returns {Promise<Array>} - Liste des utilisateurs avec créateur
 */
export async function getAllUsersWithCreator(filters = {}) {
    const where = {};

    if (filters.search) {
        where[Op.or] = [{ email: { [Op.like]: `%${filters.search}%` } }, { login: { [Op.like]: `%${filters.search}%` } }];
    }

    const users = await models.User.findAll({
        where,
        order: [['createdAt', 'DESC']],
        include: [
            {
                model: models.User,
                as: 'creator',
                attributes: ['id', 'login', 'email'],
                required: false,
            },
        ],
    });

    return users.map((u) => u.toJSON());
}

/**
 * Récupérer les utilisateurs avec pagination et filtres avancés
 * @param {Object} options - Options de recherche
 * @param {number} options.limit - Nombre de résultats par page
 * @param {number} options.offset - Décalage
 * @param {string} [options.search] - Terme de recherche
 * @param {string} [options.searchField] - Champ de recherche (email, login, role, created_by, auto)
 * @returns {Promise<Object>} - { users, total }
 */
export async function findUsersWithFilters(options = {}) {
    const { limit = 10, offset = 0, search = '', searchField = 'auto' } = options;

    const whereConditions = {};

    const includeCreator = {
        model: models.User,
        as: 'creator',
        attributes: ['id', 'login', 'email'],
        required: false,
    };

    if (search) {
        if (searchField === 'auto' || searchField === 'email') {
            whereConditions.email = { [Op.like]: `%${search}%` };
        } else if (searchField === 'login') {
            whereConditions.login = { [Op.like]: `%${search}%` };
        } else if (searchField === 'role') {
            whereConditions.role = { [Op.like]: `%${search}%` };
        } else if (searchField === 'created_by') {
            includeCreator.where = {
                login: { [Op.like]: `%${search}%` },
            };
        }
    }

    const { count, rows: users } = await models.User.findAndCountAll({
        where: whereConditions,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
        include: [includeCreator],
        attributes: ['id', 'email', 'login', 'role', 'status', 'last_connection', 'createdAt', 'created_by'],
    });

    return {
        users: users.map((u) => u.toJSON()),
        total: count,
    };
}

/**
 * Récupérer un utilisateur avec ses relations (creator + sites assignés)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Object|null>} - Utilisateur avec relations ou null
 */
export async function getUserWithRelations(userId) {
    const user = await models.User.findByPk(userId, {
        include: [
            {
                model: models.User,
                as: 'creator',
                attributes: ['id', 'login', 'email'],
                required: false,
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

    return user ? user.toJSON() : null;
}

/**
 * Créer un utilisateur (version admin avec login, status, created_by)
 * @param {Object} userData - Données de l'utilisateur
 * @param {string} userData.login - Login
 * @param {string} userData.email - Email
 * @param {string} userData.role - Rôle
 * @param {string} [userData.created_by] - ID du créateur
 * @param {string} [userData.status] - Statut (pending, active)
 * @param {string} [userData.password] - Mot de passe optionnel
 * @returns {Promise<Object>} - Utilisateur créé
 */
export async function createUserAdmin(userData) {
    const dataToCreate = {
        login: userData.login,
        email: userData.email,
        role: userData.role || 'viewer',
        created_by: userData.created_by || null,
        status: userData.status || 'pending',
    };

    // Hash du password seulement s'il est fourni
    if (userData.password) {
        dataToCreate.password = await hashPassword(userData.password);
    }

    const user = await models.User.create(dataToCreate);
    return user.toJSON();
}

/**
 * Envoyer un email de bienvenue à un nouvel utilisateur
 * @param {Object} user - Objet utilisateur (doit contenir login et email)
 * @param {string} user.login - Login de l'utilisateur
 * @param {string} user.email - Email de l'utilisateur
 * @returns {Promise<void>}
 * @throws {Error} Si le service mail n'est pas configuré ou si l'email est absent
 */
export async function sendWelcomeEmail(user) {
    if (!mailEnabled) {
        throw new Error('Mail service is not configured');
    }

    if (!user.email) {
        throw new Error('User has no email address');
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const firstLoginUrl = `${appUrl}/dp-first-connexion`;

    const html = await renderMailTemplate('welcome-user', { login: user.login, firstLoginUrl });

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const logoPath = path.join(__dirname, '../public/img/puna_logo.png');

    await sendMail({
        to: user.email,
        subject: 'Bienvenue sur Puna — Activez votre compte',
        html,
        attachments: [
            {
                filename: 'puna_logo.png',
                path: logoPath,
                cid: 'puna_logo',
            },
        ],
    });

    appLogger.info({ action: 'WELCOME_EMAIL_SENT', userLogin: user.login, email: user.email }, 'Welcome email sent to new user');
}

/**
 * Vérifier si un utilisateur existe (par email ou login)
 * @param {string} email - Email
 * @param {string} login - Login
 * @param {string} [excludeUserId] - ID à exclure (pour updates)
 * @returns {Promise<boolean>} - true si l'utilisateur existe
 */
export async function userExists(email, login, excludeUserId = null) {
    const where = {
        [Op.or]: [{ email }, { login }],
    };

    if (excludeUserId) {
        where.id = { [Op.ne]: excludeUserId };
    }

    const user = await models.User.findOne({ where });
    return !!user;
}

/**
 * Soft-supprimer un utilisateur (status = 'anonymized', password = null)
 * Les relations SiteUser sont conservées en base pour traçabilité.
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<boolean>} - true si mise à jour réussie
 */
export async function deleteUserWithRelations(userId) {
    // Supprimer d'abord les SiteUser
    await models.SiteUser.destroy({
        where: { fk_id_user: userId },
    });

    // Puis supprimer l'utilisateur
    const result = await models.User.destroy({
        where: { id: userId },
    });

    // Purger les sessions de l'utilisateur supprimé
    await destroyUserSessions(userId);

    return result > 0;
}

/**
 * Mettre à jour un utilisateur (sans hasher le password si null)
 * @param {string} userId - ID de l'utilisateur
 * @param {Object} updateData - Données à mettre à jour
 * @returns {Promise<boolean>} - true si mise à jour réussie
 */
export async function updateUserAdmin(userId, updateData) {
    const result = await models.User.update(updateData, {
        where: { id: userId },
    });

    return result[0] > 0;
}

/**
 * Incrémenter le compteur de tentatives de connexion échouées.
 * Si le compteur atteint le seuil configuré, le statut passe automatiquement
 * à `suspended` et un log d'audit est émis.
 * @param {string} userId - ID de l'utilisateur
 * @param {string} [userLogin] - Login (pour le log)
 * @param {string|null} [ip=null] - Adresse IP de la tentative
 * @returns {Promise<{failedAttempts: number, suspended: boolean}>}
 */
export async function incrementFailedAttempts(userId, userLogin = null, ip = null) {
    const maxAttempts = parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS || '10', 10);

    await models.User.increment('failed_login_attempts', { where: { id: userId } });

    const user = await models.User.findByPk(userId, {
        attributes: ['id', 'login', 'status', 'failed_login_attempts'],
    });

    if (!user) return { failedAttempts: 0, suspended: false };

    const failedAttempts = user.failed_login_attempts;
    const login = userLogin || user.login;
    let suspended = false;

    auditLogger.warn({
        action: 'LOGIN_FAILED_ATTEMPT_COUNT',
        userId,
        userLogin: login,
        failedAttempts,
        maxAttempts,
        ip,
    });

    if (failedAttempts >= maxAttempts && user.status !== 'suspended') {
        await models.User.update({ status: 'suspended' }, { where: { id: userId } });
        suspended = true;

        auditLogger.info({
            action: 'USER_STATUS_CHANGE',
            marker: '🔄 STATUS_CHANGE',
            previousStatus: user.status,
            newStatus: 'suspended',
            source: 'auto_rate_limit',
            reason: `Exceeded maximum failed login attempts (${maxAttempts})`,
            userId,
            userLogin: login,
        });
    }

    return { failedAttempts, suspended };
}

/**
 * Réinitialiser le compteur de tentatives de connexion échouées
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<boolean>} - true si mise à jour réussie
 */
export async function resetFailedAttempts(userId) {
    const [updated] = await models.User.update({ failed_login_attempts: 0 }, { where: { id: userId } });
    return updated > 0;
}

/**
 * Mettre à jour la dernière connexion d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<boolean>} - true si mise à jour réussie
 */
export async function updateLastConnection(userId) {
    const [updated] = await models.User.update({ last_connection: new Date() }, { where: { id: userId } });

    return updated > 0;
}

/**
 * Mettre à jour la locale d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {string} locale - Nouvelle locale ('fr' ou 'en')
 * @returns {Promise<Object>} - Utilisateur mis à jour
 */
export async function updateUserLocale(userId, locale) {
    const user = await models.User.findByPk(userId);
    if (!user) throw new Error('Utilisateur introuvable');
    await user.update({ locale });
    return user.toJSON();
}

/**
 * Récupérer uniquement le statut d'un utilisateur (requête légère)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<string|null>} - Statut de l'utilisateur ou null s'il n'existe pas
 */
export async function getUserStatus(userId) {
    const user = await models.User.findByPk(userId, {
        attributes: ['status'],
    });

    return user ? user.status : null;
}

/**
 * Changer le statut d'un utilisateur avec audit trail
 * @param {string} userId - ID de l'utilisateur cible
 * @param {string} newStatus - Nouveau statut (active, inactive, suspended, banned, anonymized)
 * @param {Object} changedBy - Informations sur l'admin qui effectue le changement
 * @param {string} changedBy.userId - ID de l'admin
 * @param {string} changedBy.login - Login de l'admin
 * @param {string} changedBy.role - Rôle de l'admin
 * @param {string|null} [reason=null] - Motif (obligatoire pour banned, optionnel sinon)
 * @param {string} [source='manual'] - Source du changement (manual, auto_rate_limit, auto_cron)
 * @param {string|null} [ip=null] - Adresse IP de l'admin
 * @returns {Promise<Object>} - { success, previousStatus, newStatus }
 */
export async function changeUserStatus(userId, newStatus, changedBy, reason = null, source = 'manual', ip = null) {
    if (!VALID_STATUSES.includes(newStatus)) {
        throw new Error(`Invalid status: ${newStatus}`);
    }

    if (changedBy.userId === userId) {
        throw new Error('Cannot change your own status');
    }

    const user = await models.User.findByPk(userId, {
        attributes: ['id', 'login', 'role', 'status', 'password'],
    });

    if (!user) {
        throw new Error(`User not found: ${userId}`);
    }

    const previousStatus = user.status;

    // Owner cannot act on a super_admin
    if (changedBy.role === 'owner' && user.role === 'super_admin') {
        throw new Error('Owner cannot change the status of a super_admin');
    }

    // Owner can only set active or inactive
    if (changedBy.role === 'owner' && !['active', 'inactive'].includes(newStatus)) {
        throw new Error(`Owner cannot set status to ${newStatus}`);
    }

    // Only super_admin can un-ban (change from banned status)
    if (previousStatus === 'banned' && changedBy.role !== 'super_admin') {
        throw new Error('Only super_admin can un-ban a user');
    }

    // reason is mandatory when banning
    if (newStatus === 'banned' && (!reason || !reason.trim())) {
        throw new Error('Reason is required when banning a user');
    }

    // A pending user can only be set to active, anonymized, or banned
    if (previousStatus === 'pending' && !['active', 'anonymized', 'banned'].includes(newStatus)) {
        throw new Error(`Cannot change a pending user's status to ${newStatus}`);
    }

    const updateData = { status: newStatus };

    // Anonymize user data (RGPD)
    if (newStatus === 'anonymized') {
        updateData.password = null;
        updateData.login = `anon_${userId.slice(0, 8)}`;
        updateData.email = null;
    }

    // Reset failed login attempts when reactivating
    if (newStatus === 'active') {
        updateData.failed_login_attempts = 0;
    }

    await models.User.update(updateData, { where: { id: userId } });

    auditLogger.info({
        action: 'USER_STATUS_CHANGE',
        marker: '🔄 STATUS_CHANGE',
        userId,
        userLogin: user.login,
        previousStatus,
        newStatus,
        changedBy: {
            userId: changedBy.userId,
            login: changedBy.login,
            role: changedBy.role,
        },
        reason,
        source,
        ip,
        timestamp: new Date().toISOString(),
    });

    // Purger immédiatement les sessions de l'utilisateur si le statut est non-actif
    if (newStatus !== 'active') {
        await destroyUserSessions(userId);
    }

    return { success: true, previousStatus, newStatus };
}
