import fs from 'node:fs';
import dayjs from 'dayjs';
import { getSiteWhereCondition } from '../helpers/site.helpers.js';
import models from '../models/index.js';

/**
 * Télécharger tous les fichiers d'une entrée inbox en ZIP
 */
export const downloadInboxZip = async (req, res) => {
    const { inboxId } = req.params;
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';

    try {
        // Vérifier l'accès au site selon le rôle
        const siteWhereCondition = await getSiteWhereCondition(userId, userRole);
        const includeOptions = {
            model: models.Form,
            as: 'form',
            include: [
                {
                    model: models.Site,
                    as: 'site',
                },
            ],
        };

        if (siteWhereCondition) {
            includeOptions.include[0].where = siteWhereCondition;
        }

        // Verify inbox exists and user has access
        const inbox = await models.Inbox.findByPk(inboxId, {
            include: [includeOptions],
        });

        if (!inbox) {
            return res.status(404).json({ error: 'Inbox entry not found' });
        }

        const form = inbox.form;
        const site = form?.site;

        if (!site) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Parse content to get all files
        let contentObj = {};
        try {
            contentObj = typeof inbox.content === 'string' ? JSON.parse(inbox.content) : inbox.content;
        } catch (e) {
            contentObj = {};
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

        // Collect all files
        const allFiles = [];
        const { finalPathFor } = await import('../helpers/upload_utils.js');

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

        // Check if there are files to zip
        if (allFiles.length === 0) {
            return res.status(404).json({ error: 'No files found to download' });
        }

        // Create ZIP using archiver
        const archiver = (await import('archiver')).default;
        const archive = archiver('zip', {
            zlib: { level: 9 }, // Maximum compression
        });

        // Set response headers
        const zipFilename = `inbox_${inboxId}_documents.zip`;
        res.attachment(zipFilename);
        res.setHeader('Content-Type', 'application/zip');

        // Handle archiver errors
        archive.on('error', (err) => {
            console.error('Archive error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error creating archive' });
            }
        });

        // Pipe archive to response
        archive.pipe(res);

        // Add files to archive
        for (const file of allFiles) {
            archive.file(file.path, { name: file.name });
        }

        // Finalize the archive
        await archive.finalize();
    } catch (err) {
        console.error('downloadInboxZip error:', err);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Server error' });
        }
    }
};

/**
 * Exporter les données d'un formulaire en Excel
 */
export const exportFormToExcel = async (req, res) => {
    const formId = req.params.id;
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';

    try {
        // Vérifier l'accès au site selon le rôle
        const siteWhereCondition = await getSiteWhereCondition(userId, userRole);
        const includeOptions = {
            model: models.Site,
            as: 'site',
        };

        if (siteWhereCondition) {
            includeOptions.where = siteWhereCondition;
        }

        // Verify form exists and user has access
        const form = await models.Form.findByPk(formId, {
            include: [includeOptions],
        });

        if (!form) {
            return res.status(404).json({ error: 'Form not found' });
        }

        const site = form.site;
        if (!site) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Get all inbox entries for this form
        const inboxEntries = await models.Inbox.findAll({
            where: { fk_id_form: formId },
            order: [['createdAt', 'DESC']],
            raw: true,
        });

        // Parse template to get column headers
        let templateObj = {};
        try {
            if (form.template) {
                templateObj = typeof form.template === 'string' ? JSON.parse(form.template) : form.template;
            }
        } catch (e) {
            templateObj = {};
        }

        // Get all unique keys from all entries
        const allKeys = new Set();
        inboxEntries.forEach((entry) => {
            let contentObj = {};
            try {
                contentObj = typeof entry.content === 'string' ? JSON.parse(entry.content) : entry.content;
            } catch (e) {
                contentObj = {};
            }
            Object.keys(contentObj).forEach((key) => allKeys.add(key));
        });

        const keysArray = Array.from(allKeys);

        // Create workbook
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Données');

        // Define columns
        const columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Date de création', key: 'createdAt', width: 20 },
        ];

        keysArray.forEach((key) => {
            const label = templateObj[key] || key;
            columns.push({
                header: label,
                key: key,
                width: 20,
            });
        });

        worksheet.columns = columns;

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // Add data rows
        inboxEntries.forEach((entry) => {
            let contentObj = {};
            try {
                contentObj = typeof entry.content === 'string' ? JSON.parse(entry.content) : entry.content;
            } catch (e) {
                contentObj = {};
            }

            const row = {
                id: entry.id,
                createdAt: dayjs(entry.createdAt).format('YYYY-MM-DD HH:mm:ss'),
            };

            keysArray.forEach((key) => {
                row[key] = contentObj[key] || '';
            });

            worksheet.addRow(row);
        });

        // Generate filename
        const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
        const filename = `export_${form.name}_${timestamp}.xlsx`;

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Write to response
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('exportFormToExcel error:', err);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Server error' });
        }
    }
};
