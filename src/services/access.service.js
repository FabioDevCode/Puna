import { Op } from 'sequelize';
import models from '../models/index.js';

/**
 * Service de gestion des accès basés sur les rôles
 * Centralise toute la logique de vérification d'accès aux ressources
 */

/**
 * Obtenir la condition WHERE pour filtrer les sites selon le rôle
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur (super_admin, owner, beta, editor, viewer)
 * @returns {Object|null} - Condition WHERE Sequelize ou null pour super_admin
 */
export async function getSiteWhereCondition(userId, userRole) {
    // Super admin a accès à tous les sites
    if (userRole === 'super_admin') {
        return null;
    }

    // Owner et beta ont accès à leurs propres sites
    if (userRole === 'owner' || userRole === 'beta') {
        return { fk_id_user: userId };
    }

    // Editor et viewer ont accès aux sites qui leur sont assignés via SiteUser
    if (userRole === 'editor' || userRole === 'viewer') {
        const siteUsers = await models.SiteUser.findAll({
            where: { fk_id_user: userId },
            attributes: ['fk_id_site'],
            raw: true,
        });

        const siteIds = siteUsers.map((su) => su.fk_id_site);

        if (siteIds.length === 0) {
            // Aucun site assigné - retourner condition impossible
            return { id: null };
        }

        return { id: { [Op.in]: siteIds } };
    }

    // Par défaut, aucun accès
    return { id: null };
}

/**
 * Vérifier si un utilisateur a accès à un site spécifique
 * @param {string} siteId - ID du site
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<boolean>} - true si accès autorisé
 */
export async function checkSiteAccess(siteId, userId, userRole) {
    // Super admin a accès à tout
    if (userRole === 'super_admin') {
        return true;
    }

    const whereCondition = await getSiteWhereCondition(userId, userRole);

    if (!whereCondition) {
        // Null = super_admin, déjà vérifié ci-dessus
        return true;
    }

    const site = await models.Site.findOne({
        where: {
            id: siteId,
            ...whereCondition,
        },
    });

    return !!site;
}

/**
 * Vérifier si un utilisateur a accès à un formulaire via son site parent
 * @param {string} formId - ID du formulaire
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<boolean>} - true si accès autorisé
 */
export async function checkFormAccess(formId, userId, userRole) {
    const form = await models.Form.findByPk(formId, {
        attributes: ['fk_id_site'],
        raw: true,
    });

    if (!form) {
        return false;
    }

    return await checkSiteAccess(form.fk_id_site, userId, userRole);
}

/**
 * Vérifier si un utilisateur a accès à une entrée inbox via form → site
 * @param {string} inboxId - ID de l'entrée inbox
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<boolean>} - true si accès autorisé
 */
export async function checkInboxAccess(inboxId, userId, userRole) {
    const inbox = await models.Inbox.findByPk(inboxId, {
        attributes: ['fk_id_form'],
        raw: true,
    });

    if (!inbox) {
        return false;
    }

    return await checkFormAccess(inbox.fk_id_form, userId, userRole);
}

/**
 * Vérifier si un utilisateur a la permission d'effectuer une action sur une entité
 * Utilise le système ACL défini dans config/permissions.js
 * @param {string} userRole - Rôle de l'utilisateur
 * @param {string} entity - Entité (site, form, inbox, user)
 * @param {string} action - Action (create, read, update, delete, export, etc.)
 * @returns {Promise<boolean>} - true si permission accordée
 */
export async function checkUserPermission(userRole, entity, action) {
    // Import dynamique pour éviter les dépendances circulaires
    const permissions = await import('../config/permissions.js');
    return permissions.can(userRole, entity, action);
}

/**
 * Obtenir tous les sites accessibles par un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Array>} - Liste des IDs de sites accessibles
 */
export async function getAccessibleSiteIds(userId, userRole) {
    if (userRole === 'super_admin') {
        const sites = await models.Site.findAll({
            attributes: ['id'],
            raw: true,
        });
        return sites.map((s) => s.id);
    }

    const whereCondition = await getSiteWhereCondition(userId, userRole);

    if (!whereCondition || whereCondition.id === null) {
        return [];
    }

    const sites = await models.Site.findAll({
        where: whereCondition,
        attributes: ['id'],
        raw: true,
    });

    return sites.map((s) => s.id);
}

export default {
    getSiteWhereCondition,
    checkSiteAccess,
    checkFormAccess,
    checkInboxAccess,
    checkUserPermission,
    getAccessibleSiteIds,
};
