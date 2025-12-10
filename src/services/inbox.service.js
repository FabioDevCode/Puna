/**
 * Service de gestion des soumissions (inbox)
 * Gère les opérations CRUD sur les soumissions de formulaires
 */

import { Op } from 'sequelize';
import { Inbox, Form, Site } from '../models/index.js';
import { getSiteWhereCondition } from './access.service.js';

/**
 * Récupérer toutes les soumissions d'un formulaire avec pagination
 * @param {number} formId - ID du formulaire
 * @param {number} page - Numéro de page (commence à 1)
 * @param {number} limit - Nombre de soumissions par page
 * @returns {Promise<Object>} - { submissions, total, totalPages }
 */
export async function getSubmissionsByForm(formId, page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    const { rows: submissions, count: total } = await Inbox.findAndCountAll({
        where: { formId },
        attributes: ['id', 'content', 'file_keys', 'createdAt'],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
    });

    return {
        submissions: submissions.map((s) => s.toJSON()),
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
    };
}

/**
 * Récupérer toutes les soumissions accessibles par un utilisateur
 * @param {number} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @param {number} page - Numéro de page
 * @param {number} limit - Nombre de soumissions par page
 * @returns {Promise<Object>} - { submissions, total, totalPages }
 */
export async function getSubmissionsForUser(userId, userRole, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const siteWhereCondition = getSiteWhereCondition(userId, userRole);

    const { rows: submissions, count: total } = await Inbox.findAndCountAll({
        attributes: ['id', 'content', 'file_keys', 'createdAt'],
        include: [
            {
                model: Form,
                as: 'form',
                attributes: ['id', 'name', 'endpoint'],
                include: [
                    {
                        model: Site,
                        as: 'site',
                        where: siteWhereCondition,
                        attributes: ['id', 'name', 'domain'],
                    },
                ],
            },
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
    });

    return {
        submissions: submissions.map((s) => s.toJSON()),
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
    };
}

/**
 * Récupérer une soumission par son ID
 * @param {number} submissionId - ID de la soumission
 * @param {boolean} includeForm - Inclure les infos du formulaire
 * @returns {Promise<Object|null>} - Soumission ou null
 */
export async function getSubmissionById(submissionId, includeForm = false) {
    const options = {
        attributes: ['id', 'content', 'file_keys', 'formId', 'createdAt'],
    };

    if (includeForm) {
        options.include = [
            {
                model: Form,
                as: 'form',
                attributes: ['id', 'name', 'endpoint', 'siteId'],
                include: [
                    {
                        model: Site,
                        as: 'site',
                        attributes: ['id', 'name', 'domain'],
                    },
                ],
            },
        ];
    }

    const submission = await Inbox.findByPk(submissionId, options);
    return submission ? submission.toJSON() : null;
}

/**
 * Créer une nouvelle soumission
 * @param {Object} submissionData - Données de la soumission
 * @param {number} submissionData.formId - ID du formulaire
 * @param {Object} submissionData.content - Contenu JSON de la soumission
 * @param {Array} [submissionData.file_keys] - Clés des fichiers uploadés
 * @returns {Promise<Object>} - Soumission créée
 */
export async function createSubmission(submissionData) {
    const submission = await Inbox.create({
        formId: submissionData.formId,
        content: submissionData.content,
        file_keys: submissionData.file_keys || null,
    });

    return submission.toJSON();
}

/**
 * Supprimer une soumission
 * @param {number} submissionId - ID de la soumission
 * @returns {Promise<boolean>} - true si suppression réussie
 */
export async function deleteSubmission(submissionId) {
    const result = await Inbox.destroy({
        where: { id: submissionId },
    });

    return result > 0;
}

/**
 * Supprimer toutes les soumissions d'un formulaire
 * @param {number} formId - ID du formulaire
 * @returns {Promise<number>} - Nombre de soumissions supprimées
 */
export async function deleteSubmissionsByForm(formId) {
    const result = await Inbox.destroy({
        where: { formId },
    });

    return result;
}

/**
 * Compter le nombre de soumissions
 * @param {number} formId - ID formulaire (optionnel)
 * @returns {Promise<number>} - Nombre de soumissions
 */
export async function countSubmissions(formId = null) {
    const where = formId ? { formId } : {};
    return await Inbox.count({ where });
}

/**
 * Récupérer les soumissions avec fichiers
 * @param {number} formId - ID du formulaire (optionnel)
 * @returns {Promise<Array>} - Soumissions ayant des fichiers
 */
export async function getSubmissionsWithFiles(formId = null) {
    const where = {
        file_keys: { [Op.ne]: null },
    };

    if (formId) {
        where.formId = formId;
    }

    const submissions = await Inbox.findAll({
        where,
        attributes: ['id', 'content', 'file_keys', 'formId', 'createdAt'],
        include: [
            {
                model: Form,
                as: 'form',
                attributes: ['id', 'name', 'endpoint'],
            },
        ],
    });

    return submissions.map((s) => s.toJSON());
}

/**
 * Récupérer les soumissions entre deux dates
 * @param {Date} startDate - Date de début
 * @param {Date} endDate - Date de fin
 * @param {number} formId - ID formulaire (optionnel)
 * @returns {Promise<Array>} - Liste des soumissions
 */
export async function getSubmissionsByDateRange(startDate, endDate, formId = null) {
    const where = {
        createdAt: {
            [Op.between]: [startDate, endDate],
        },
    };

    if (formId) {
        where.formId = formId;
    }

    const submissions = await Inbox.findAll({
        where,
        attributes: ['id', 'content', 'file_keys', 'formId', 'createdAt'],
        order: [['createdAt', 'DESC']],
    });

    return submissions.map((s) => s.toJSON());
}

/**
 * Rechercher dans le contenu des soumissions
 * @param {string} searchQuery - Terme de recherche
 * @param {number} formId - ID formulaire (optionnel)
 * @param {number} limit - Nombre maximum de résultats
 * @returns {Promise<Array>} - Soumissions correspondantes
 */
export async function searchSubmissions(searchQuery, formId = null, limit = 50) {
    const where = {};

    if (formId) {
        where.formId = formId;
    }

    // Note: La recherche dans JSON nécessite une approche spécifique selon la BDD
    // Pour MariaDB/MySQL, on peut utiliser JSON_SEARCH ou LIKE sur le champ JSON
    // Cette implémentation basique peut être améliorée selon les besoins

    const submissions = await Inbox.findAll({
        where,
        attributes: ['id', 'content', 'file_keys', 'formId', 'createdAt'],
        limit,
        order: [['createdAt', 'DESC']],
    });

    // Filtrage côté application pour rechercher dans le contenu JSON
    const filtered = submissions.filter((s) => {
        const content = JSON.stringify(s.content);
        return content.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return filtered.map((s) => s.toJSON());
}
