/**
 * Service de gestion des assignations utilisateur-site (SiteUser)
 * Gère les opérations sur la table de liaison entre User et Site
 */

import models from '../models/index.js';

/**
 * Assigner un utilisateur à plusieurs sites
 * @param {string} userId - ID de l'utilisateur
 * @param {Array<string>} siteIds - Tableau d'IDs de sites
 * @returns {Promise<Array>} - Assignations créées
 */
export async function assignUserToSites(userId, siteIds = []) {
    if (!siteIds || siteIds.length === 0) {
        return [];
    }

    const assignments = siteIds.map((siteId) => ({
        fk_id_user: userId,
        fk_id_site: siteId,
    }));

    const created = await models.SiteUser.bulkCreate(assignments, {
        ignoreDuplicates: true,
    });

    return created.map((a) => a.toJSON());
}

/**
 * Supprimer toutes les assignations d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<number>} - Nombre d'assignations supprimées
 */
export async function removeUserFromAllSites(userId) {
    const count = await models.SiteUser.destroy({
        where: { fk_id_user: userId },
    });

    return count;
}

/**
 * Remplacer toutes les assignations d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {Array<string>} siteIds - Nouveaux IDs de sites
 * @returns {Promise<Array>} - Nouvelles assignations
 */
export async function updateUserSiteAssignments(userId, siteIds = []) {
    // Supprimer toutes les assignations existantes
    await removeUserFromAllSites(userId);

    // Créer les nouvelles assignations
    return assignUserToSites(userId, siteIds);
}

/**
 * Récupérer toutes les assignations d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Array>} - Assignations avec infos des sites
 */
export async function getUserSiteAssignments(userId) {
    const assignments = await models.SiteUser.findAll({
        where: { fk_id_user: userId },
        include: [
            {
                model: models.Site,
                as: 'site',
                attributes: ['id', 'domain', 'status'],
            },
        ],
    });

    return assignments.map((a) => a.toJSON());
}

/**
 * Récupérer tous les utilisateurs d'un site
 * @param {string} siteId - ID du site
 * @returns {Promise<Array>} - Utilisateurs assignés
 */
export async function getSiteUserAssignments(siteId) {
    const assignments = await models.SiteUser.findAll({
        where: { fk_id_site: siteId },
        include: [
            {
                model: models.User,
                as: 'user',
                attributes: ['id', 'login', 'email', 'role'],
            },
        ],
    });

    return assignments.map((a) => a.toJSON());
}

/**
 * Vérifier si un utilisateur est assigné à un site
 * @param {string} userId - ID de l'utilisateur
 * @param {string} siteId - ID du site
 * @returns {Promise<boolean>} - true si assignation existe
 */
export async function isUserAssignedToSite(userId, siteId) {
    const assignment = await models.SiteUser.findOne({
        where: {
            fk_id_user: userId,
            fk_id_site: siteId,
        },
    });

    return !!assignment;
}

/**
 * Compter les sites assignés à un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<number>} - Nombre de sites
 */
export async function countUserSites(userId) {
    const count = await models.SiteUser.count({
        where: { fk_id_user: userId },
    });

    return count;
}

/**
 * Compter les utilisateurs assignés à un site
 * @param {string} siteId - ID du site
 * @returns {Promise<number>} - Nombre d'utilisateurs
 */
export async function countSiteUsers(siteId) {
    const count = await models.SiteUser.count({
        where: { fk_id_site: siteId },
    });

    return count;
}
