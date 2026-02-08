import fs from 'node:fs';
import path from 'node:path';
import dayjs from 'dayjs';
import { Op } from 'sequelize';
import models from '../models/index.js';
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

    const { rows: submissions, count: total } = await models.Inbox.findAndCountAll({
        where: { fk_id_form: formId },
        attributes: ['id', 'content', 'createdAt'],
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

    const { rows: submissions, count: total } = await models.Inbox.findAndCountAll({
        attributes: ['id', 'content', 'createdAt'],
        include: [
            {
                model: models.Form,
                as: 'form',
                attributes: ['id', 'name', 'endpoint'],
                include: [
                    {
                        model: models.Site,
                        as: 'site',
                        where: siteWhereCondition,
                        attributes: ['id', 'domain'],
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
        attributes: ['id', 'content', 'fk_id_form', 'createdAt'],
    };

    if (includeForm) {
        options.include = [
            {
                model: models.Form,
                as: 'form',
                attributes: ['id', 'name', 'endpoint', 'fk_id_site'],
                include: [
                    {
                        model: models.Site,
                        as: 'site',
                        attributes: ['id', 'domain'],
                    },
                ],
            },
        ];
    }

    const submission = await models.Inbox.findByPk(submissionId, options);
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
    const submission = await models.Inbox.create({
        fk_id_form: submissionData.fk_id_form || submissionData.formId,
        content: submissionData.content,
    });

    return submission.toJSON();
}

/**
 * Supprimer une soumission
 * @param {number} submissionId - ID de la soumission
 * @returns {Promise<boolean>} - true si suppression réussie
 */
export async function deleteSubmission(submissionId) {
    const result = await models.Inbox.destroy({
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
    const result = await models.Inbox.destroy({
        where: { fk_id_form: formId },
    });

    return result;
}

/**
 * Compter le nombre de soumissions
 * @param {number} formId - ID formulaire (optionnel)
 * @returns {Promise<number>} - Nombre de soumissions
 */
export async function countSubmissions(formId = null) {
    const where = formId ? { fk_id_form: formId } : {};
    return await models.Inbox.count({ where });
}

/**
 * Récupérer les soumissions avec fichiers
 * @param {number} formId - ID du formulaire (optionnel)
 * @returns {Promise<Array>} - Soumissions ayant des fichiers
 */
export async function getSubmissionsWithFiles(formId = null) {
    const where = {};

    if (formId) {
        where.fk_id_form = formId;
    }

    const submissions = await models.Inbox.findAll({
        where,
        attributes: ['id', 'content', 'fk_id_form', 'createdAt'],
        include: [
            {
                model: models.Form,
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
        where.fk_id_form = formId;
    }

    const submissions = await models.Inbox.findAll({
        where,
        attributes: ['id', 'content', 'fk_id_form', 'createdAt'],
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
        where.fk_id_form = formId;
    }

    // Note: La recherche dans JSON nécessite une approche spécifique selon la BDD
    // Pour MariaDB/MySQL, on peut utiliser JSON_SEARCH ou LIKE sur le champ JSON
    // Cette implémentation basique peut être améliorée selon les besoins

    const submissions = await models.Inbox.findAll({
        where,
        attributes: ['id', 'content', 'fk_id_form', 'createdAt'],
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

/**
 * Récupérer les soumissions d'un formulaire avec filtres avancés et pagination
 * @param {string} formId - ID du formulaire
 * @param {Object} filters - Filtres JSON { fieldName: value, createdAt: 'YYYY-MM-DD' }
 * @param {number} limit - Nombre de résultats (10, 25, 50, 100)
 * @param {number} offset - Offset pour pagination
 * @returns {Promise<Object>} - { items, total }
 */
export async function getSubmissionsByFormWithFilters(formId, filters = {}, limit = 10, offset = 0) {
    const Sequelize = models.Sequelize;
    const Op = Sequelize.Op;

    // Construction de la clause WHERE de base
    let whereClause = { fk_id_form: formId };

    // Si des filtres sont fournis, construire les conditions dynamiques
    if (filters && typeof filters === 'object' && Object.keys(filters).length > 0) {
        const conditions = [];
        const SAFE_KEY_REGEX = /^[a-zA-Z0-9_]+$/;

        for (const [key, value] of Object.entries(filters)) {
            // Ignorer les valeurs vides
            if (value === null || typeof value === 'undefined' || String(value).trim() === '') {
                continue;
            }

            if (key !== 'createdAt' && !SAFE_KEY_REGEX.test(key)) {
                // Skip unsafe keys to prevent SQL injection in JSON path
                continue;
            }

            if (key === 'createdAt') {
                // Filtrage par date : DATE(createdAt) = 'YYYY-MM-DD'
                conditions.push(Sequelize.where(Sequelize.fn('DATE', Sequelize.col('createdAt')), String(value)));
            } else {
                // Filtrage par contenu JSON : JSON_UNQUOTE(JSON_EXTRACT(content, '$.key')) LIKE '%value%'
                const expr = Sequelize.where(
                    Sequelize.fn(
                        'JSON_UNQUOTE',
                        Sequelize.fn('JSON_EXTRACT', Sequelize.col('content'), Sequelize.literal(`'$.${key}'`))
                    ),
                    { [Op.like]: `%${String(value)}%` }
                );
                conditions.push(expr);
            }
        }

        // Si on a des conditions, les ajouter avec AND
        if (conditions.length > 0) {
            whereClause = { [Op.and]: [{ fk_id_form: formId }, ...conditions] };
        }
    }

    // Récupérer les données avec pagination
    const result = await models.Inbox.findAndCountAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        raw: true,
    });

    const rows = result.rows || [];
    const total = typeof result.count === 'number' ? result.count : result.count || 0;

    // Parser le contenu JSON de chaque entrée
    const items = rows.map((r) => {
        let parsed = null;
        try {
            parsed = typeof r.content === 'string' ? JSON.parse(r.content) : r.content;
        } catch (e) {
            parsed = null;
        }
        return {
            id: r.id,
            content: parsed,
            createdAt: new dayjs(r.createdAt).format('YYYY-MM-DD HH:mm'),
        };
    });

    return { items, total };
}

/**
 * Récupérer une soumission avec toutes les métadonnées pour l'affichage
 * @param {number} inboxId - ID de la soumission
 * @param {number} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Object|null>} - Données complètes pour l'affichage ou null
 */
export async function getInboxForDisplay(inboxId, userId, userRole) {
    const siteWhereCondition = getSiteWhereCondition(userId, userRole);

    const includeOptions = {
        model: models.Form,
        as: 'form',
        attributes: ['id', 'name', 'code', 'template', 'file_keys', 'fk_id_site'],
        include: [
            {
                model: models.Site,
                as: 'site',
                attributes: ['id', 'domain', 'control_code'],
            },
        ],
    };

    // Ajouter le filtre WHERE seulement si nécessaire (pas super_admin)
    if (siteWhereCondition) {
        includeOptions.include[0].where = siteWhereCondition;
    }

    const inbox = await models.Inbox.findByPk(inboxId, {
        attributes: ['id', 'content', 'fk_id_form', 'createdAt'],
        include: [includeOptions],
    });

    if (!inbox) {
        return null;
    }

    const form = inbox.form;
    const site = form?.site;

    if (!site) {
        return null;
    }

    // Parse content
    let contentObj = {};
    try {
        contentObj = typeof inbox.content === 'string' ? JSON.parse(inbox.content) : inbox.content;
    } catch (e) {
        contentObj = {};
    }

    // Get template labels
    let templateObj = {};
    try {
        if (form.template) {
            templateObj = typeof form.template === 'string' ? JSON.parse(form.template) : form.template;
        }
    } catch (e) {
        templateObj = {};
    }

    // Get file_keys from form
    let fileKeys = [];
    try {
        if (form.file_keys) {
            const parsed = typeof form.file_keys === 'string' ? JSON.parse(form.file_keys) : form.file_keys;
            if (Array.isArray(parsed)) {
                fileKeys = parsed;
            }
        }
    } catch (e) {
        fileKeys = [];
    }

    return {
        inbox: inbox.toJSON(),
        form: form.toJSON(),
        site: site.toJSON(),
        contentObj,
        templateObj,
        fileKeys,
    };
}

/**
 * Supprimer une soumission avec ses fichiers associés
 * @param {number} inboxId - ID de la soumission
 * @param {number} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Object>} - { success: boolean, message?: string, error?: string }
 */
export async function deleteInboxWithFiles(inboxId, userId, userRole) {
    try {
        const siteWhereCondition = getSiteWhereCondition(userId, userRole);

        const includeOptions = {
            model: models.Form,
            as: 'form',
            attributes: ['id', 'name', 'file_keys', 'fk_id_site'],
            include: [
                {
                    model: models.Site,
                    as: 'site',
                    attributes: ['id', 'domain'],
                },
            ],
        };

        // Ajouter le filtre WHERE seulement si nécessaire (pas super_admin)
        if (siteWhereCondition) {
            includeOptions.include[0].where = siteWhereCondition;
        }

        const inbox = await models.Inbox.findByPk(inboxId, {
            attributes: ['id', 'content', 'fk_id_form'],
            include: [includeOptions],
        });

        if (!inbox) {
            return { success: false, error: 'Soumission introuvable ou accès refusé' };
        }

        const form = inbox.form;
        const site = form?.site;

        if (!site) {
            return { success: false, error: 'Site introuvable' };
        }

        // Parse content
        let contentObj = {};
        try {
            contentObj = typeof inbox.content === 'string' ? JSON.parse(inbox.content) : inbox.content;
        } catch (e) {
            contentObj = {};
        }

        // Get file_keys
        let fileKeys = [];
        try {
            if (form.file_keys) {
                const parsed = typeof form.file_keys === 'string' ? JSON.parse(form.file_keys) : form.file_keys;
                if (Array.isArray(parsed)) {
                    fileKeys = parsed;
                }
            }
        } catch (e) {
            fileKeys = [];
        }

        // Delete physical files
        const uploadDir = path.join(process.cwd(), 'storage', 'uploads', site.domain);
        const resolvedUploadDir = path.resolve(uploadDir);

        for (const key of fileKeys) {
            const value = contentObj[key];
            if (value) {
                const filenames = Array.isArray(value) ? value : [value];
                for (const filename of filenames) {
                    const filePath = path.join(uploadDir, filename);
                    const resolvedPath = path.resolve(filePath);

                    // Vérifier path traversal
                    if (!resolvedPath.startsWith(resolvedUploadDir)) {
                        console.error(`Path traversal attempt detected: ${filename}`);
                        continue;
                    }

                    try {
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                        }
                    } catch (err) {
                        console.error(`Erreur lors de la suppression du fichier ${filename}:`, err.message);
                    }
                }
            }
        }

        // Delete inbox record
        await inbox.destroy();

        return { success: true, message: 'Soumission et fichiers supprimés avec succès' };
    } catch (err) {
        console.error('Erreur lors de la suppression de la soumission:', err);
        return { success: false, error: 'Erreur serveur lors de la suppression' };
    }
}

/**
 * Vérifier l'accès à un fichier et retourner son chemin
 * @param {number} inboxId - ID de la soumission
 * @param {string} filename - Nom du fichier
 * @param {number} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Object>} - { success: boolean, filePath?: string, error?: string }
 */
export async function verifyFileAccessAndGetPath(inboxId, filename, userId, userRole) {
    try {
        const siteWhereCondition = getSiteWhereCondition(userId, userRole);

        const includeOptions = {
            model: models.Form,
            as: 'form',
            attributes: ['id', 'file_keys', 'fk_id_site'],
            include: [
                {
                    model: models.Site,
                    as: 'site',
                    attributes: ['id', 'domain'],
                },
            ],
        };

        // Ajouter le filtre WHERE seulement si nécessaire (pas super_admin)
        if (siteWhereCondition) {
            includeOptions.include[0].where = siteWhereCondition;
        }

        const inbox = await models.Inbox.findByPk(inboxId, {
            attributes: ['id', 'content', 'fk_id_form'],
            include: [includeOptions],
        });

        if (!inbox) {
            return { success: false, error: 'Soumission introuvable ou accès refusé' };
        }

        const form = inbox.form;
        const site = form?.site;

        if (!site) {
            return { success: false, error: 'Site introuvable' };
        }

        // Parse content
        let contentObj = {};
        try {
            contentObj = typeof inbox.content === 'string' ? JSON.parse(inbox.content) : inbox.content;
        } catch (e) {
            contentObj = {};
        }

        // Get file_keys
        let fileKeys = [];
        try {
            if (form.file_keys) {
                const parsed = typeof form.file_keys === 'string' ? JSON.parse(form.file_keys) : form.file_keys;
                if (Array.isArray(parsed)) {
                    fileKeys = parsed;
                }
            }
        } catch (e) {
            fileKeys = [];
        }

        // Verify file exists in content
        let fileFound = false;
        for (const key of fileKeys) {
            const value = contentObj[key];
            if (value) {
                const filenames = Array.isArray(value) ? value : [value];
                if (filenames.includes(filename)) {
                    fileFound = true;
                    break;
                }
            }
        }

        if (!fileFound) {
            return { success: false, error: 'Fichier introuvable dans cette soumission' };
        }

        const uploadDir = path.join(process.cwd(), 'storage', 'uploads', site.domain);
        const filePath = path.join(uploadDir, filename);
        const resolvedPath = path.resolve(filePath);
        const resolvedUploadDir = path.resolve(uploadDir);

        // Vérifier path traversal
        if (!resolvedPath.startsWith(resolvedUploadDir)) {
            return { success: false, error: 'Nom de fichier invalide' };
        }

        if (!fs.existsSync(filePath)) {
            return { success: false, error: 'Fichier physique introuvable' };
        }

        return { success: true, filePath };
    } catch (err) {
        console.error('Erreur lors de la vérification du fichier:', err);
        return { success: false, error: 'Erreur serveur lors de la vérification du fichier' };
    }
}
