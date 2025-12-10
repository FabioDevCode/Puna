/**
 * Service de gestion des formulaires
 * Gère les opérations CRUD sur les formulaires et leurs templates
 */

import { Op } from 'sequelize';
import { Form, Site } from '../models/index.js';
import { getSiteWhereCondition } from './access.service.js';

/**
 * Récupérer tous les formulaires d'un site
 * @param {number} siteId - ID du site
 * @returns {Promise<Array>} - Liste des formulaires
 */
export async function getFormsBySite(siteId) {
    const forms = await Form.findAll({
        where: { siteId },
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

    const forms = await Form.findAll({
        attributes: ['id', 'name', 'endpoint', 'template', 'columns', 'createdAt', 'updatedAt'],
        include: [
            {
                model: Site,
                as: 'site',
                where: siteWhereCondition,
                attributes: ['id', 'name', 'domain'],
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
        attributes: ['id', 'name', 'endpoint', 'template', 'columns', 'siteId', 'createdAt', 'updatedAt'],
    };

    if (includeSite) {
        options.include = [
            {
                model: Site,
                as: 'site',
                attributes: ['id', 'name', 'domain'],
            },
        ];
    }

    const form = await Form.findByPk(formId, options);
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
        attributes: ['id', 'name', 'endpoint', 'template', 'columns', 'siteId', 'createdAt', 'updatedAt'],
    };

    if (includeSite) {
        options.include = [
            {
                model: Site,
                as: 'site',
                attributes: ['id', 'name', 'domain', 'token'],
            },
        ];
    }

    const form = await Form.findOne(options);
    return form ? form.toJSON() : null;
}

/**
 * Créer un nouveau formulaire
 * @param {Object} formData - Données du formulaire
 * @param {number} formData.siteId - ID du site parent
 * @param {string} formData.name - Nom du formulaire
 * @param {string} formData.endpoint - Endpoint unique
 * @param {Object} [formData.template] - Template JSON (optionnel)
 * @param {Array} [formData.columns] - Colonnes personnalisées (optionnel)
 * @returns {Promise<Object>} - Formulaire créé
 */
export async function createForm(formData) {
    const form = await Form.create({
        siteId: formData.siteId,
        name: formData.name,
        endpoint: formData.endpoint,
        template: formData.template || null,
        columns: formData.columns || null,
    });

    return form.toJSON();
}

/**
 * Mettre à jour un formulaire
 * @param {number} formId - ID du formulaire
 * @param {Object} updateData - Données à mettre à jour
 * @param {string} [updateData.name] - Nouveau nom
 * @param {string} [updateData.endpoint] - Nouvel endpoint
 * @param {Object} [updateData.template] - Nouveau template
 * @param {Array} [updateData.columns] - Nouvelles colonnes
 * @returns {Promise<Object|null>} - Formulaire mis à jour ou null
 */
export async function updateForm(formId, updateData) {
    const form = await Form.findByPk(formId);
    if (!form) {
        return null;
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
    const result = await Form.destroy({
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

    const form = await Form.findOne({ where });
    return !!form;
}

/**
 * Compter le nombre de formulaires
 * @param {number} siteId - ID site (optionnel, pour filtrer par site)
 * @returns {Promise<number>} - Nombre de formulaires
 */
export async function countForms(siteId = null) {
    const where = siteId ? { siteId } : {};
    return await Form.count({ where });
}

/**
 * Récupérer les templates de formulaires
 * @returns {Promise<Array>} - Liste des formulaires ayant un template
 */
export async function getFormTemplates() {
    const forms = await Form.findAll({
        where: {
            template: { [Op.ne]: null },
        },
        attributes: ['id', 'name', 'endpoint', 'template', 'siteId'],
        include: [
            {
                model: Site,
                as: 'site',
                attributes: ['id', 'name'],
            },
        ],
    });

    return forms.map((f) => f.toJSON());
}
