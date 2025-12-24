/**
 * Service de gestion des formulaires
 * Gère les opérations CRUD sur les formulaires et leurs templates
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Op } from 'sequelize';
import models from '../models/index.js';
import stringUtils from '../utils/string.js';
import { getSiteWhereCondition } from './access.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../../storage/uploads');

/**
 * Récupérer tous les formulaires d'un site
 * @param {number} siteId - ID du site
 * @returns {Promise<Array>} - Liste des formulaires
 */
export async function getFormsBySite(siteId) {
    const forms = await models.Form.findAll({
        where: { fk_id_site: siteId },
        attributes: ['id', 'name', 'endpoint', 'template', 'columns', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']],
    });

    return forms.map((f) => f.toJSON());
}

/**
 * Récupérer tous les formulaires accessibles par un utilisateur
 * @param {number} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Array>} - Liste des formulaires avec infos du site
 */
export async function getFormsForUser(userId, userRole) {
    const siteWhereCondition = getSiteWhereCondition(userId, userRole);

    const forms = await models.Form.findAll({
        attributes: ['id', 'name', 'endpoint', 'template', 'columns', 'createdAt', 'updatedAt'],
        include: [
            {
                model: models.Site,
                as: 'site',
                where: siteWhereCondition,
                attributes: ['id', 'domain'],
            },
        ],
        order: [['createdAt', 'DESC']],
    });

    return forms.map((f) => f.toJSON());
}

/**
 * Récupérer un formulaire par son ID
 * @param {number} formId - ID du formulaire
 * @param {boolean} includeSite - Inclure les infos du site parent
 * @returns {Promise<Object|null>} - Formulaire ou null
 */
export async function getFormById(formId, includeSite = false) {
    const options = {
        attributes: ['id', 'name', 'endpoint', 'template', 'columns', 'fk_id_site', 'createdAt', 'updatedAt'],
    };

    if (includeSite) {
        options.include = [
            {
                model: models.Site,
                as: 'site',
                attributes: ['id', 'domain'],
            },
        ];
    }

    const form = await models.Form.findByPk(formId, options);
    return form ? form.toJSON() : null;
}

/**
 * Récupérer un formulaire par son endpoint
 * @param {string} endpoint - Endpoint du formulaire
 * @param {boolean} includeSite - Inclure les infos du site parent
 * @returns {Promise<Object|null>} - Formulaire ou null
 */
export async function getFormByEndpoint(endpoint, includeSite = false) {
    const options = {
        where: { endpoint },
        attributes: ['id', 'name', 'endpoint', 'template', 'columns', 'fk_id_site', 'createdAt', 'updatedAt'],
    };

    if (includeSite) {
        options.include = [
            {
                model: models.Site,
                as: 'site',
                attributes: ['id', 'domain', 'token'],
            },
        ];
    }

    const form = await models.Form.findOne(options);
    return form ? form.toJSON() : null;
}

/**
 * Créer un nouveau formulaire
 * @param {Object} formData - Données du formulaire
 * @param {string} formData.fk_id_site - ID du site parent
 * @param {string} formData.name - Nom du formulaire
 * @param {string} [formData.code] - Code unique (généré automatiquement si non fourni)
 * @param {Object|string} [formData.template] - Template JSON (optionnel)
 * @param {Object|string} [formData.columns] - Colonnes personnalisées (optionnel)
 * @returns {Promise<Object>} - Formulaire créé
 */
export async function createForm(formData) {
    // Générer un code automatiquement si non fourni
    const code = formData.code || stringUtils.generateCode(10);

    // Stringifier template et columns si ce sont des objets
    let template = formData.template || null;
    if (template && typeof template === 'object') {
        template = JSON.stringify(template);
    }

    let columns = formData.columns || null;
    if (columns && typeof columns === 'object') {
        columns = JSON.stringify(columns);
    }

    const form = await models.Form.create({
        fk_id_site: formData.fk_id_site || formData.siteId,
        name: formData.name,
        code: code,
        template: template,
        columns: columns,
    });

    return form.toJSON();
}

/**
 * Mettre à jour un formulaire
 * @param {number} formId - ID du formulaire
 * @param {Object} updateData - Données à mettre à jour
 * @param {string} [updateData.name] - Nouveau nom
 * @param {string} [updateData.code] - Nouveau code
 * @param {Object|string} [updateData.template] - Nouveau template
 * @param {Object|string} [updateData.columns] - Nouvelles colonnes
 * @returns {Promise<Object|null>} - Formulaire mis à jour ou null
 */
export async function updateForm(formId, updateData) {
    const form = await models.Form.findByPk(formId);
    if (!form) {
        return null;
    }

    // Stringifier template si c'est un objet
    if (updateData.template && typeof updateData.template === 'object') {
        updateData.template = JSON.stringify(updateData.template);
    }

    // Stringifier columns si c'est un objet
    if (updateData.columns && typeof updateData.columns === 'object') {
        updateData.columns = JSON.stringify(updateData.columns);
    }

    await form.update(updateData);
    return form.toJSON();
}

/**
 * Supprimer un formulaire
 * @param {number} formId - ID du formulaire
 * @returns {Promise<boolean>} - true si suppression réussie
 */
export async function deleteForm(formId) {
    // Récupérer le form avec le site pour avoir le nom du site et le code du form
    const form = await models.Form.findByPk(formId, {
        attributes: ['id', 'name', 'code'],
        include: [
            {
                model: models.Site,
                as: 'site',
                attributes: ['domain'],
            },
        ],
    });

    if (form && form.site) {
        // Supprimer le dossier uploads/{site.domain}/{form.code}/
        const formUploadPath = path.join(uploadsDir, form.site.domain, form.name);

        try {
            await fs.rm(formUploadPath, { recursive: true, force: true });
            console.log(`Dossier supprimé: ${formUploadPath}`);
        } catch (err) {
            console.error(`Erreur lors de la suppression du dossier ${formUploadPath}:`, err);
        }
    }

    const result = await models.Form.destroy({
        where: { id: formId },
    });

    return result > 0;
}

/**
 * Vérifier si un endpoint existe déjà
 * @param {string} endpoint - Endpoint à vérifier
 * @param {number} excludeFormId - ID formulaire à exclure (pour updates)
 * @returns {Promise<boolean>} - true si l'endpoint existe
 */
export async function endpointExists(endpoint, excludeFormId = null) {
    const where = { endpoint };

    if (excludeFormId) {
        where.id = { [Op.ne]: excludeFormId };
    }

    const form = await models.Form.findOne({ where });
    return !!form;
}

/**
 * Compter le nombre de formulaires
 * @param {number} siteId - ID site (optionnel, pour filtrer par site)
 * @returns {Promise<number>} - Nombre de formulaires
 */
export async function countForms(siteId = null) {
    const where = siteId ? { fk_id_site: siteId } : {};
    return await models.Form.count({ where });
}

/**
 * Récupérer les templates de formulaires
 * @returns {Promise<Array>} - Liste des formulaires ayant un template
 */
export async function getFormTemplates() {
    const forms = await models.Form.findAll({
        where: {
            template: { [Op.ne]: null },
        },
        attributes: ['id', 'name', 'endpoint', 'template', 'fk_id_site'],
        include: [
            {
                model: models.Site,
                as: 'site',
                attributes: ['id', 'domain'],
            },
        ],
    });

    return forms.map((f) => f.toJSON());
}

/**
 * Vérifier l'accès à un formulaire et récupérer ses données
 * @param {string} formId - ID du formulaire
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Object|null>} - { form, site } ou null si pas d'accès
 */
export async function verifyFormAccess(formId, userId, userRole) {
    // Récupérer le formulaire avec le site
    const form = await models.Form.findByPk(formId, {
        include: [
            {
                model: models.Site,
                as: 'site',
                attributes: ['id', 'domain'],
            },
        ],
    });

    if (!form) {
        return null;
    }

    const site = form.site;
    if (!site) {
        return null;
    }

    // Vérifier l'accès au site selon le rôle
    const siteWhereCondition = getSiteWhereCondition(userId, userRole);

    if (siteWhereCondition) {
        const accessibleSite = await models.Site.findOne({
            where: { id: site.id, ...siteWhereCondition },
        });

        if (!accessibleSite) {
            return null;
        }
    }

    return {
        form: form.toJSON(),
        site: site.toJSON(),
    };
}
