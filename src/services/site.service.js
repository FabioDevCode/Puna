/**
 * Service de gestion des sites
 * Gère les opérations CRUD sur les sites et les tokens d'accès
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { logger, errorLogger } from '../config/logger.js';
import models from '../models/index.js';
import { encryptObject } from '../utils/crypto.js';
import stringUtils from '../utils/string.js';
import { getSiteWhereCondition } from './access.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../../storage/uploads');

/**
 * Récupérer tous les sites accessibles par un utilisateur
 * @param {number} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Array>} - Liste des sites
 */
export async function getSitesForUser(userId, userRole) {
    const whereCondition = getSiteWhereCondition(userId, userRole);

    const sites = await models.Site.findAll({
        where: whereCondition,
        attributes: ['id', 'domain', 'control_code', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']],
        include:
            userRole !== 'super_admin'
                ? [
                      {
                          model: models.SiteUser,
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
    const site = await models.Site.findByPk(siteId, {
        attributes: ['id', 'domain', 'control_code', 'createdAt', 'updatedAt'],
    });

    return site ? site.toJSON() : null;
}

/**
 * Récupérer un site par son domaine
 * @param {string} domain - Domaine du site
 * @returns {Promise<Object|null>} - Site ou null
 */
export async function getSiteByDomain(domain) {
    const site = await models.Site.findOne({
        where: { domain },
        attributes: ['id', 'domain', 'control_code', 'createdAt', 'updatedAt'],
    });

    return site ? site.toJSON() : null;
}

/**
 * Récupérer les sites disponibles selon le rôle (pour admin)
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Array>} - Liste des sites
 */
export async function getAvailableSites(userId, userRole) {
    const whereCondition = userRole === 'super_admin' ? {} : { fk_id_user: userId };

    const sites = await models.Site.findAll({
        where: whereCondition,
        attributes: ['id', 'domain'],
        order: [['domain', 'ASC']],
    });

    return sites.map((s) => s.toJSON());
}

/**
 * Créer un nouveau site
 * @param {Object} siteData - Données du site
 * @param {string} siteData.domain - Domaine du site
 * @param {string} siteData.control_code - Control code du site (généré)
 * @param {number} ownerId - ID de l'utilisateur propriétaire
 * @returns {Promise<Object>} - Site créé
 */
export async function createSite(siteData, ownerId = null) {
    const site = await models.Site.create({
        domain: siteData.domain,
        control_code: siteData.control_code,
        fk_id_user: ownerId,
    });

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
    const site = await models.Site.findByPk(siteId);
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
    const result = await models.Site.destroy({
        where: { id: siteId },
    });

    return result > 0;
}

/**
 * Régénérer le control_code d'un site
 * @param {number} siteId - ID du site
 * @param {string} newControlCode - Nouveau control_code (généré par le controller)
 * @returns {Promise<Object|null>} - Site avec nouveau control_code ou null
 */
export async function regenerateSiteControlCode(siteId, newControlCode) {
    const site = await models.Site.findByPk(siteId);
    if (!site) {
        return null;
    }

    await site.update({ control_code: newControlCode });
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

    const site = await models.Site.findOne({ where });
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
        return await models.Site.count();
    }

    const whereCondition = getSiteWhereCondition(userId, userRole);
    return await models.Site.count({ where: whereCondition });
}

/**
 * Récupérer les utilisateurs d'un site
 * @param {number} siteId - ID du site
 * @returns {Promise<Array>} - Liste des utilisateurs avec leur rôle sur le site
 */
export async function getSiteUsers(siteId) {
    const siteUsers = await models.SiteUser.findAll({
        where: { siteId },
        include: [
            {
                model: models.User,
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
    const siteUser = await models.SiteUser.create({
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
    const result = await models.SiteUser.destroy({
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
    const siteUser = await models.SiteUser.findOne({
        where: { siteId, userId },
    });

    if (!siteUser) {
        return null;
    }

    await siteUser.update({ role: newRole });
    return siteUser.toJSON();
}

/**
 * Vérifier l'accès à un site et récupérer ses données
 * @param {string} siteId - ID du site
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Object|null>} - Site ou null si pas d'accès
 */
export async function verifySiteAccess(siteId, userId, userRole) {
    // Récupérer le site
    const site = await models.Site.findByPk(siteId);

    if (!site) {
        return null;
    }

    // Vérifier l'accès au site selon le rôle
    const siteWhereCondition = getSiteWhereCondition(userId, userRole);

    if (siteWhereCondition) {
        const accessibleSite = await models.Site.findOne({
            where: { id: siteId, ...siteWhereCondition },
        });

        if (!accessibleSite) {
            return null;
        }
    }

    return site.toJSON();
}

/**
 * Récupérer un site avec tous ses formulaires et gérer l'onglet actif
 * @param {string} siteId - ID du site
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @param {string} activeFormId - ID du formulaire actif (optionnel)
 * @param {string} activeFormName - Nom du formulaire actif (optionnel)
 * @returns {Promise<Object|null>} - { site, forms, activeForm } ou null
 */
export async function getSiteWithForms(siteId, userId, userRole, activeFormId = null, activeFormName = null) {
    // Vérifier l'accès au site
    const site = await verifySiteAccess(siteId, userId, userRole);

    if (!site) {
        return null;
    }

    // Récupérer tous les formulaires du site
    const formsRaw = await models.Form.findAll({
        where: { fk_id_site: siteId },
        attributes: ['id', 'name', 'code', 'template', 'columns', 'file_keys', 'fk_id_site', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'ASC']],
        raw: true,
    });

    // Parser les templates
    const forms = (formsRaw || []).map((f) => {
        let templateObj = {};
        try {
            if (f.template) {
                templateObj = typeof f.template === 'string' ? JSON.parse(f.template) : f.template;
            }
        } catch (e) {
            templateObj = {};
        }

        const template_entries = Object.keys(templateObj || {}).map((k) => ({ key: k, value: templateObj[k] }));

        return {
            ...f,
            templateObj,
            template_entries,
            is_active: false,
        };
    });

    // Gérer la sélection de l'onglet actif
    let activeForm = null;
    if (forms && forms.length > 0) {
        let found = false;

        // Priorité 1: Recherche par nom (activeFormName)
        if (activeFormName) {
            const formByName = forms.find((f) => String(f.name) === String(activeFormName));
            if (formByName) {
                formByName.is_active = true;
                activeForm = formByName;
                found = true;
            }
        }

        // Priorité 2: Recherche par ID (activeFormId)
        if (!found && activeFormId) {
            const formById = forms.find((f) => String(f.id) === String(activeFormId));
            if (formById) {
                formById.is_active = true;
                activeForm = formById;
                found = true;
            }
        }

        // Priorité 3: Premier formulaire par défaut
        if (!found) {
            forms[0].is_active = true;
            activeForm = forms[0];
        }
    }

    return {
        site,
        forms,
        activeForm,
    };
}

/**
 * Supprimer un site avec tous ses formulaires après validation du domaine
 * @param {string} siteId - ID du site
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @param {string} confirmDomain - Domaine à confirmer
 * @returns {Promise<Object>} - { success: boolean, error?: string }
 */
export async function deleteSiteWithForms(siteId, userId, userRole, confirmDomain) {
    try {
        // Vérifier l'accès au site
        const site = await verifySiteAccess(siteId, userId, userRole);

        if (!site) {
            return { success: false, error: 'Site introuvable ou accès refusé' };
        }

        // Valider le domaine de confirmation
        if (site.domain !== confirmDomain.trim()) {
            return { success: false, error: 'Le domaine de confirmation ne correspond pas' };
        }

        // Supprimer le dossier uploads/{site.domain}/ et tout son contenu
        const siteUploadPath = path.join(uploadsDir, site.domain);
        try {
            await fs.rm(siteUploadPath, { recursive: true, force: true });
            logger.info({ path: siteUploadPath }, 'Dossier site supprimé');
        } catch (err) {
            errorLogger.error({ err, path: siteUploadPath }, 'Erreur suppression dossier site');
        }

        // Supprimer tous les formulaires associés
        await models.Form.destroy({ where: { fk_id_site: siteId } });

        // Supprimer le site
        await models.Site.destroy({ where: { id: siteId } });

        return { success: true };
    } catch (err) {
        errorLogger.error({ err, siteId }, 'Erreur suppression site');
        return { success: false, error: 'Erreur serveur lors de la suppression' };
    }
}

/**
 * Générer un JWT token pour l'API d'un site
 * @param {string} siteId - ID du site
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Object>} - { success: boolean, token?: string, error?: string }
 */
export async function generateSiteToken(siteId, userId, userRole) {
    try {
        // Vérifier l'accès au site
        const site = await verifySiteAccess(siteId, userId, userRole);

        if (!site) {
            return { success: false, error: 'Site introuvable ou accès refusé' };
        }

        // Vérifier que la clé secrète est configurée
        const secret = process.env.KEY_TK;
        if (!secret) {
            return { success: false, error: "KEY_TK non configurée dans les variables d'environnement" };
        }

        // Générer le payload crypté
        const payload = {
            data: encryptObject({
                id: site.id,
                control_code: site.control_code,
            }),
        };

        // Générer le JWT
        const token = jwt.sign(payload, secret);

        return { success: true, token };
    } catch (err) {
        errorLogger.error({ err, siteId }, 'Erreur génération token');
        return { success: false, error: 'Erreur serveur lors de la génération du token' };
    }
}

/**
 * Révoquer tous les tokens d'un site en régénérant le control_code
 * @param {string} siteId - ID du site
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Object>} - { success: boolean, control_code?: string, error?: string }
 */
export async function revokeSiteTokens(siteId, userId, userRole) {
    try {
        // Vérifier l'accès au site
        const site = await verifySiteAccess(siteId, userId, userRole);

        if (!site) {
            return { success: false, error: 'Site introuvable ou accès refusé' };
        }

        // Générer un nouveau control_code
        const newControlCode = stringUtils.generateCode(16);

        // Mettre à jour le site
        await models.Site.update({ control_code: newControlCode }, { where: { id: siteId } });

        return { success: true, control_code: newControlCode };
    } catch (err) {
        errorLogger.error({ err, siteId }, 'Erreur révocation tokens');
        return { success: false, error: 'Erreur serveur lors de la révocation des tokens' };
    }
}
