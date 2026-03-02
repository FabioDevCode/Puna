/**
 * Service d'export
 * Gère les exports de données (Excel, CSV, ZIP)
 */

import fs from 'node:fs';
import archiver from 'archiver';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import { format } from 'fast-csv';
import { finalPathFor } from '../helpers/upload_utils.js';
import models from '../models/index.js';
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

    const inbox = await models.Inbox.findByPk(inboxId, {
        include: [
            {
                model: models.Form,
                as: 'form',
                include: [
                    {
                        model: models.Site,
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

    const files = collectFiles(site.toJSON(), form.toJSON(), contentObj, fileKeys, finalPathFor);

    return {
        inbox: inbox.toJSON(),
        form: form.toJSON(),
        site: site.toJSON(),
        contentObj,
        fileKeys,
        files,
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

    const form = await models.Form.findByPk(formId, {
        include: [
            {
                model: models.Site,
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

    const submissions = await models.Inbox.findAll({
        where: { fk_id_form: formId },
        attributes: ['id', 'content', 'createdAt'],
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
 * @param {Array} customColumns - Colonnes personnalisées [{key, header}] (optionnel)
 * @returns {Promise<ExcelJS.Workbook>} - Workbook Excel
 */
export async function generateExcelWorkbook(form, submissions, customColumns = []) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Submissions');

    // Extraire toutes les clés uniques des contenus si pas de colonnes custom
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
            columns.push({
                header: col.header || col.key,
                key: col.key,
                width: 20,
            });
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
        const keysToUse = customColumns.length > 0 ? customColumns.map((c) => c.key) : Array.from(allKeys);
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

    const submissions = await models.Inbox.findAll({
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

/**
 * Générer un fichier CSV à partir des soumissions d'un formulaire
 * @param {Object} form - Formulaire
 * @param {Array} submissions - Liste des soumissions
 * @param {Array} customColumns - Colonnes personnalisées [{key, header}] (optionnel)
 * @returns {Promise<string>} - Contenu CSV
 */
export async function generateFormCSV(form, submissions, customColumns = []) {
    return new Promise((resolve, reject) => {
        const rows = [];

        // Extraire toutes les clés uniques si pas de colonnes custom
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

        // Définir les headers
        const headers = ['ID', 'Date'];
        const keysToUse =
            customColumns.length > 0 ? customColumns : Array.from(allKeys).map((key) => ({ key, header: key }));

        keysToUse.forEach((col) => {
            headers.push(col.header || col.key);
        });

        // Préparer les données
        submissions.forEach((sub) => {
            let contentObj = {};
            try {
                contentObj = typeof sub.content === 'string' ? JSON.parse(sub.content) : sub.content;
            } catch (e) {
                contentObj = {};
            }

            const row = {
                ID: sub.id,
                Date: dayjs(sub.createdAt).format('YYYY-MM-DD HH:mm:ss'),
            };

            // Ajouter les valeurs des colonnes
            keysToUse.forEach((col) => {
                const key = col.key;
                const header = col.header || col.key;
                const value = contentObj[key];

                // Convertir les tableaux et objets en chaînes
                if (Array.isArray(value)) {
                    row[header] = value.join(', ');
                } else if (typeof value === 'object' && value !== null) {
                    row[header] = JSON.stringify(value);
                } else {
                    row[header] = value ?? '';
                }
            });

            rows.push(row);
        });

        // Générer le CSV
        const csvStream = format({ headers: true, delimiter: ',' });
        let csvData = '';

        csvStream.on('data', (chunk) => {
            csvData += chunk.toString();
        });

        csvStream.on('end', () => {
            resolve(csvData);
        });

        csvStream.on('error', (err) => {
            reject(err);
        });

        rows.forEach((row) => csvStream.write(row));
        csvStream.end();
    });
}

/**
 * Générer un fichier CSV à partir de la liste des utilisateurs
 * @param {Array} users - Liste des utilisateurs
 * @returns {Promise<string>} - Contenu CSV
 */
export async function generateUsersCSV(users) {
    return new Promise((resolve, reject) => {
        const rows = [];

        // Préparer les données
        users.forEach((user) => {
            rows.push({
                Email: user.email || '',
                Login: user.login || '',
                Rôle: user.role || 'N/A',
                'Créé par': user.creator ? user.creator.login : 'N/A',
                Activé: user.enabled ? 'Oui' : 'Non',
                'Dernière connexion': user.last_connection
                    ? dayjs(user.last_connection).format('YYYY-MM-DD HH:mm')
                    : 'N/A',
                'Créé le': dayjs(user.createdAt).format('YYYY-MM-DD HH:mm'),
            });
        });

        // Générer le CSV
        const csvStream = format({ headers: true, delimiter: ',' });
        let csvData = '';

        csvStream.on('data', (chunk) => {
            csvData += chunk.toString();
        });

        csvStream.on('end', () => {
            resolve(csvData);
        });

        csvStream.on('error', (err) => {
            reject(err);
        });

        rows.forEach((row) => csvStream.write(row));
        csvStream.end();
    });
}

/**
 * Générer un fichier CSV avec toutes les soumissions (multi-forms)
 * @param {Array} submissions - Liste des soumissions
 * @returns {Promise<string>} - Contenu CSV
 */
export async function generateMultiFormCSV(submissions) {
    return new Promise((resolve, reject) => {
        const rows = [];

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

        // Préparer les données
        submissions.forEach((sub) => {
            let contentObj = {};
            try {
                contentObj = typeof sub.content === 'string' ? JSON.parse(sub.content) : sub.content;
            } catch (e) {
                contentObj = {};
            }

            const row = {
                ID: sub.id,
                Site: sub.form?.site?.domain || '',
                Form: sub.form?.name || '',
                Date: dayjs(sub.createdAt).format('YYYY-MM-DD HH:mm:ss'),
            };

            // Ajouter toutes les clés de contenu
            Array.from(allKeys).forEach((key) => {
                const value = contentObj[key];
                if (Array.isArray(value)) {
                    row[key] = value.join(', ');
                } else if (typeof value === 'object' && value !== null) {
                    row[key] = JSON.stringify(value);
                } else {
                    row[key] = value ?? '';
                }
            });

            rows.push(row);
        });

        // Générer le CSV
        const csvStream = format({ headers: true, delimiter: ',' });
        let csvData = '';

        csvStream.on('data', (chunk) => {
            csvData += chunk.toString();
        });

        csvStream.on('end', () => {
            resolve(csvData);
        });

        csvStream.on('error', (err) => {
            reject(err);
        });

        rows.forEach((row) => csvStream.write(row));
        csvStream.end();
    });
}
