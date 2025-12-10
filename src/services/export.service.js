/**
 * Service d'export
 * Gère les exports de données (Excel, ZIP)
 */

import fs from 'node:fs';
import archiver from 'archiver';
import ExcelJS from 'exceljs';
import { Inbox, Form, Site } from '../models/index.js';
import { getSiteWhereCondition } from './access.service.js';

/**
 * Récupérer les données d'une soumission avec ses fichiers
 * @param {number} inboxId - ID de la soumission
 * @param {number} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Object|null>} - { inbox, form, site, files }
 */
export async function getInboxWithFiles(inboxId, userId, userRole) {
    const siteWhereCondition = getSiteWhereCondition(userId, userRole);

    const inbox = await Inbox.findByPk(inboxId, {
        include: [
            {
                model: Form,
                as: 'form',
                include: [
                    {
                        model: Site,
                        as: 'site',
                        where: siteWhereCondition,
                    },
                ],
            },
        ],
    });

    if (!inbox) {
        return null;
    }

    const form = inbox.form;
    const site = form?.site;

    if (!site) {
        return null;
    }

    // Parser le contenu pour récupérer les fichiers
    let contentObj = {};
    try {
        contentObj = typeof inbox.content === 'string' ? JSON.parse(inbox.content) : inbox.content;
    } catch (e) {
        contentObj = {};
    }

    // Récupérer les clés de fichiers depuis le formulaire
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
        fileKeys,
    };
}

/**
 * Collecter tous les fichiers d'une soumission
 * @param {Object} site - Objet site
 * @param {Object} form - Objet formulaire
 * @param {Object} contentObj - Contenu parsé de la soumission
 * @param {Array} fileKeys - Clés des champs fichiers
 * @param {Function} finalPathFor - Fonction pour obtenir le chemin du fichier
 * @returns {Array} - Liste des fichiers avec leur chemin et nom
 */
export function collectFiles(site, form, contentObj, fileKeys, finalPathFor) {
    const allFiles = [];

    for (const key of fileKeys) {
        const value = contentObj[key];
        if (value) {
            const filenames = Array.isArray(value) ? value : [value];
            for (const filename of filenames) {
                const { path: filePath } = finalPathFor(site, form, filename);
                if (fs.existsSync(filePath)) {
                    const originalFilename = filename.split('_').slice(1).join('_');
                    allFiles.push({
                        path: filePath,
                        name: originalFilename,
                    });
                }
            }
        }
    }

    return allFiles;
}

/**
 * Créer une archive ZIP avec les fichiers
 * @param {Array} files - Liste des fichiers { path, name }
 * @returns {Promise<archiver.Archiver>} - Archive ZIP
 */
export function createZipArchive(files) {
    const archive = archiver('zip', {
        zlib: { level: 9 }, // Compression maximale
    });

    for (const file of files) {
        archive.file(file.path, { name: file.name });
    }

    archive.finalize();
    return archive;
}

/**
 * Récupérer toutes les soumissions d'un formulaire pour export Excel
 * @param {number} formId - ID du formulaire
 * @param {number} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Object|null>} - { form, site, submissions }
 */
export async function getFormDataForExport(formId, userId, userRole) {
    const siteWhereCondition = getSiteWhereCondition(userId, userRole);

    const form = await Form.findByPk(formId, {
        include: [
            {
                model: Site,
                as: 'site',
                where: siteWhereCondition,
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

    const submissions = await Inbox.findAll({
        where: { formId },
        attributes: ['id', 'content', 'file_keys', 'createdAt'],
        order: [['createdAt', 'DESC']],
    });

    return {
        form: form.toJSON(),
        site: site.toJSON(),
        submissions: submissions.map((s) => s.toJSON()),
    };
}

/**
 * Générer un fichier Excel à partir des soumissions
 * @param {Object} form - Formulaire
 * @param {Array} submissions - Liste des soumissions
 * @returns {Promise<ExcelJS.Workbook>} - Workbook Excel
 */
export async function generateExcelWorkbook(form, submissions) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Submissions');

    // Parser les colonnes personnalisées si elles existent
    let customColumns = [];
    try {
        if (form.columns) {
            const parsed = typeof form.columns === 'string' ? JSON.parse(form.columns) : form.columns;
            if (Array.isArray(parsed)) {
                customColumns = parsed;
            }
        }
    } catch (e) {
        customColumns = [];
    }

    // Extraire toutes les clés uniques des contenus
    const allKeys = new Set();
    submissions.forEach((sub) => {
        let contentObj = {};
        try {
            contentObj = typeof sub.content === 'string' ? JSON.parse(sub.content) : sub.content;
        } catch (e) {
            contentObj = {};
        }
        Object.keys(contentObj).forEach((k) => allKeys.add(k));
    });

    // Définir les colonnes
    const columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Date', key: 'createdAt', width: 20 },
    ];

    // Ajouter les colonnes personnalisées ou auto-détectées
    if (customColumns.length > 0) {
        customColumns.forEach((col) => {
            columns.push({ header: col, key: col, width: 20 });
        });
    } else {
        Array.from(allKeys).forEach((key) => {
            columns.push({ header: key, key, width: 20 });
        });
    }

    worksheet.columns = columns;

    // Style de l'en-tête
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
    };

    // Ajouter les données
    submissions.forEach((sub) => {
        let contentObj = {};
        try {
            contentObj = typeof sub.content === 'string' ? JSON.parse(sub.content) : sub.content;
        } catch (e) {
            contentObj = {};
        }

        const row = {
            id: sub.id,
            createdAt: sub.createdAt,
        };

        // Ajouter les valeurs des colonnes
        const keysToUse = customColumns.length > 0 ? customColumns : Array.from(allKeys);
        keysToUse.forEach((key) => {
            const value = contentObj[key];
            // Convertir les tableaux et objets en chaînes
            if (Array.isArray(value)) {
                row[key] = value.join(', ');
            } else if (typeof value === 'object' && value !== null) {
                row[key] = JSON.stringify(value);
            } else {
                row[key] = value;
            }
        });

        worksheet.addRow(row);
    });

    return workbook;
}

/**
 * Récupérer toutes les soumissions accessibles pour export Excel
 * @param {number} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Array>} - Liste des soumissions avec infos form/site
 */
export async function getAllSubmissionsForExport(userId, userRole) {
    const siteWhereCondition = getSiteWhereCondition(userId, userRole);

    const submissions = await Inbox.findAll({
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
    });

    return submissions.map((s) => s.toJSON());
}

/**
 * Générer un fichier Excel avec toutes les soumissions (multi-forms)
 * @param {Array} submissions - Liste des soumissions
 * @returns {Promise<ExcelJS.Workbook>} - Workbook Excel
 */
export async function generateMultiFormExcelWorkbook(submissions) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('All Submissions');

    // Extraire toutes les clés uniques
    const allKeys = new Set();
    submissions.forEach((sub) => {
        let contentObj = {};
        try {
            contentObj = typeof sub.content === 'string' ? JSON.parse(sub.content) : sub.content;
        } catch (e) {
            contentObj = {};
        }
        Object.keys(contentObj).forEach((k) => allKeys.add(k));
    });

    // Définir les colonnes
    const columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Site', key: 'site', width: 20 },
        { header: 'Form', key: 'form', width: 20 },
        { header: 'Date', key: 'createdAt', width: 20 },
    ];

    Array.from(allKeys).forEach((key) => {
        columns.push({ header: key, key, width: 20 });
    });

    worksheet.columns = columns;

    // Style de l'en-tête
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
    };

    // Ajouter les données
    submissions.forEach((sub) => {
        let contentObj = {};
        try {
            contentObj = typeof sub.content === 'string' ? JSON.parse(sub.content) : sub.content;
        } catch (e) {
            contentObj = {};
        }

        const row = {
            id: sub.id,
            site: sub.form?.site?.domain || '',
            form: sub.form?.name || '',
            createdAt: sub.createdAt,
        };

        Array.from(allKeys).forEach((key) => {
            const value = contentObj[key];
            if (Array.isArray(value)) {
                row[key] = value.join(', ');
            } else if (typeof value === 'object' && value !== null) {
                row[key] = JSON.stringify(value);
            } else {
                row[key] = value;
            }
        });

        worksheet.addRow(row);
    });

    return workbook;
}
