/**
 * Service de gestion des sites
 * Gère les opérations CRUD sur les sites et les tokens d'accès
 */

import { Op } from 'sequelize';
import { Site, SiteUser, User } from '../models/index.js';
import { getSiteWhereCondition } from './access.service.js';

/**
 * Récupérer tous les sites accessibles par un utilisateur
 * @param {number} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Array>} - Liste des sites
 */
export async function getSitesForUser(userId, userRole) {
    const whereCondition = getSiteWhereCondition(userId, userRole);

    const sites = await Site.findAll({
        where: whereCondition,
        attributes: ['id', 'name', 'domain', 'token', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']],
        include:
            userRole !== 'super_admin'
                ? [
                      {
                          model: SiteUser,
                          as: 'siteUsers',
                          where: { userId },
                          attributes: ['role'],
                          required: false,
                      },
                  ]
                : [],
    });

    return sites.map((s) => s.toJSON());
}

/**
 * Récupérer un site par son ID
 * @param {number} siteId - ID du site
 * @returns {Promise<Object|null>} - Site ou null
 */
export async function getSiteById(siteId) {
    const site = await Site.findByPk(siteId, {
        attributes: ['id', 'name', 'domain', 'token', 'createdAt', 'updatedAt'],
    });

    return site ? site.toJSON() : null;
}

/**
 * Récupérer un site par son domaine
 * @param {string} domain - Domaine du site
 * @returns {Promise<Object|null>} - Site ou null
 */
export async function getSiteByDomain(domain) {
    const site = await Site.findOne({
        where: { domain },
        attributes: ['id', 'name', 'domain', 'token', 'createdAt', 'updatedAt'],
    });

    return site ? site.toJSON() : null;
}

/**
 * Créer un nouveau site
 * @param {Object} siteData - Données du site
 * @param {string} siteData.name - Nom du site
 * @param {string} siteData.domain - Domaine du site
 * @param {string} siteData.token - Token d'accès (généré)
 * @param {number} ownerId - ID de l'utilisateur propriétaire (pour créer SiteUser)
 * @returns {Promise<Object>} - Site créé
 */
export async function createSite(siteData, ownerId = null) {
    const site = await Site.create({
        name: siteData.name,
        domain: siteData.domain,
        token: siteData.token,
    });

    // Si un propriétaire est spécifié, créer l'entrée SiteUser
    if (ownerId) {
        await SiteUser.create({
            siteId: site.id,
            userId: ownerId,
            role: 'owner',
        });
    }

    return site.toJSON();
}

/**
 * Mettre à jour un site
 * @param {number} siteId - ID du site
 * @param {Object} updateData - Données à mettre à jour
 * @param {string} [updateData.name] - Nouveau nom
 * @param {string} [updateData.domain] - Nouveau domaine
 * @returns {Promise<Object|null>} - Site mis à jour ou null
 */
export async function updateSite(siteId, updateData) {
    const site = await Site.findByPk(siteId);
    if (!site) {
        return null;
    }

    await site.update(updateData);
    return site.toJSON();
}

/**
 * Supprimer un site
 * @param {number} siteId - ID du site
 * @returns {Promise<boolean>} - true si suppression réussie
 */
export async function deleteSite(siteId) {
    const result = await Site.destroy({
        where: { id: siteId },
    });

    return result > 0;
}

/**
 * Régénérer le token d'un site
 * @param {number} siteId - ID du site
 * @param {string} newToken - Nouveau token (généré par le controller)
 * @returns {Promise<Object|null>} - Site avec nouveau token ou null
 */
export async function regenerateSiteToken(siteId, newToken) {
    const site = await Site.findByPk(siteId);
    if (!site) {
        return null;
    }

    await site.update({ token: newToken });
    return site.toJSON();
}

/**
 * Vérifier si un domaine existe déjà
 * @param {string} domain - Domaine à vérifier
 * @param {number} excludeSiteId - ID site à exclure (pour updates)
 * @returns {Promise<boolean>} - true si le domaine existe
 */
export async function domainExists(domain, excludeSiteId = null) {
    const where = { domain };

    if (excludeSiteId) {
        where.id = { [Op.ne]: excludeSiteId };
    }

    const site = await Site.findOne({ where });
    return !!site;
}

/**
 * Compter le nombre de sites
 * @param {number} userId - ID utilisateur (optionnel, pour filtrer par user)
 * @param {string} userRole - Rôle utilisateur (optionnel)
 * @returns {Promise<number>} - Nombre de sites
 */
export async function countSites(userId = null, userRole = null) {
    if (!userId || userRole === 'super_admin') {
        return await Site.count();
    }

    const whereCondition = getSiteWhereCondition(userId, userRole);
    return await Site.count({ where: whereCondition });
}

/**
 * Récupérer les utilisateurs d'un site
 * @param {number} siteId - ID du site
 * @returns {Promise<Array>} - Liste des utilisateurs avec leur rôle sur le site
 */
export async function getSiteUsers(siteId) {
    const siteUsers = await SiteUser.findAll({
        where: { siteId },
        include: [
            {
                model: User,
                as: 'user',
                attributes: ['id', 'email', 'name', 'role'],
            },
        ],
        attributes: ['id', 'role', 'createdAt'],
    });

    return siteUsers.map((su) => ({
        id: su.id,
        siteRole: su.role,
        createdAt: su.createdAt,
        user: su.user.toJSON(),
    }));
}

/**
 * Ajouter un utilisateur à un site
 * @param {number} siteId - ID du site
 * @param {number} userId - ID de l'utilisateur
 * @param {string} role - Rôle sur le site (owner, beta, editor, viewer)
 * @returns {Promise<Object>} - SiteUser créé
 */
export async function addUserToSite(siteId, userId, role = 'viewer') {
    const siteUser = await SiteUser.create({
        siteId,
        userId,
        role,
    });

    return siteUser.toJSON();
}

/**
 * Retirer un utilisateur d'un site
 * @param {number} siteId - ID du site
 * @param {number} userId - ID de l'utilisateur
 * @returns {Promise<boolean>} - true si suppression réussie
 */
export async function removeUserFromSite(siteId, userId) {
    const result = await SiteUser.destroy({
        where: { siteId, userId },
    });

    return result > 0;
}

/**
 * Mettre à jour le rôle d'un utilisateur sur un site
 * @param {number} siteId - ID du site
 * @param {number} userId - ID de l'utilisateur
 * @param {string} newRole - Nouveau rôle
 * @returns {Promise<Object|null>} - SiteUser mis à jour ou null
 */
export async function updateUserRoleOnSite(siteId, userId, newRole) {
    const siteUser = await SiteUser.findOne({
        where: { siteId, userId },
    });

    if (!siteUser) {
        return null;
    }

    await siteUser.update({ role: newRole });
    return siteUser.toJSON();
}
