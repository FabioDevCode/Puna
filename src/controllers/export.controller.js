import dayjs from 'dayjs';
import {
    getInboxWithFiles,
    createZipArchive,
    getFormDataForExport,
    generateExcelWorkbook,
    generateFormCSV,
    getAllSubmissionsForExport,
    generateMultiFormCSV,
} from '../services/export.service.js';

/**
 * Télécharger tous les fichiers d'une entrée inbox en ZIP
 */
export const downloadInboxZip = async (req, res) => {
    const { inboxId } = req.params;
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';

    try {
        // Récupérer l'inbox avec vérification d'accès
        const result = await getInboxWithFiles(inboxId, userId, userRole);

        if (!result) {
            return res.status(404).json({ error: 'Inbox entry not found or access denied' });
        }

        const { files } = result;

        // Vérifier s'il y a des fichiers à télécharger
        if (files.length === 0) {
            return res.status(404).json({ error: 'No files found to download' });
        }

        // Créer l'archive ZIP
        const archive = await createZipArchive(files);

        // Définir les headers de réponse
        const zipFilename = `inbox_${inboxId}_documents.zip`;
        res.attachment(zipFilename);
        res.setHeader('Content-Type', 'application/zip');

        // Gérer les erreurs de l'archive
        archive.on('error', (err) => {
            console.error('Archive error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error creating archive' });
            }
        });

        // Envoyer l'archive en réponse
        archive.pipe(res);
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
        // Récupérer les données du formulaire avec vérification d'accès
        const result = await getFormDataForExport(formId, userId, userRole);

        if (!result) {
            return res.status(404).json({ error: 'Form not found or access denied' });
        }

        const { form, submissions } = result;

        // Parse le template pour obtenir les labels des colonnes
        let templateObj = {};
        try {
            if (form.template) {
                templateObj = typeof form.template === 'string' ? JSON.parse(form.template) : form.template;
            }
        } catch (e) {
            templateObj = {};
        }

        // Extraire toutes les clés uniques de toutes les entrées
        const allKeys = new Set();
        submissions.forEach((entry) => {
            let contentObj = {};
            try {
                contentObj = typeof entry.content === 'string' ? JSON.parse(entry.content) : entry.content;
            } catch (e) {
                contentObj = {};
            }
            Object.keys(contentObj).forEach((key) => allKeys.add(key));
        });

        // Créer les colonnes personnalisées avec les labels du template
        const customColumns = Array.from(allKeys).map((key) => ({
            key,
            header: templateObj[key] || key,
        }));

        // Générer le workbook Excel
        const workbook = await generateExcelWorkbook(form, submissions, customColumns);

        // Générer le nom de fichier
        const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
        const filename = `export_${form.name}_${timestamp}.xlsx`;

        // Définir les headers de réponse
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Envoyer le fichier Excel
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('exportFormToExcel error:', err);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Server error' });
        }
    }
};

/**
 * Exporter les données d'un formulaire en CSV
 */
export const exportFormToCSV = async (req, res) => {
    const formId = req.params.id;
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';

    try {
        // Récupérer les données du formulaire avec vérification d'accès
        const result = await getFormDataForExport(formId, userId, userRole);

        if (!result) {
            return res.status(404).json({ error: 'Form not found or access denied' });
        }

        const { form, submissions } = result;

        // Parse le template pour obtenir les labels des colonnes
        let templateObj = {};
        try {
            if (form.template) {
                templateObj = typeof form.template === 'string' ? JSON.parse(form.template) : form.template;
            }
        } catch (e) {
            templateObj = {};
        }

        // Extraire toutes les clés uniques de toutes les entrées
        const allKeys = new Set();
        submissions.forEach((entry) => {
            let contentObj = {};
            try {
                contentObj = typeof entry.content === 'string' ? JSON.parse(entry.content) : entry.content;
            } catch (e) {
                contentObj = {};
            }
            Object.keys(contentObj).forEach((key) => allKeys.add(key));
        });

        // Créer les colonnes personnalisées avec les labels du template
        const customColumns = Array.from(allKeys).map((key) => ({
            key,
            header: templateObj[key] || key,
        }));

        // Générer le CSV
        const csvData = await generateFormCSV(form, submissions, customColumns);

        // Générer le nom de fichier
        const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
        const filename = `export_${form.name}_${timestamp}.csv`;

        // Définir les headers de réponse
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Ajouter le BOM UTF-8 pour Excel
        res.write('\uFEFF');

        // Envoyer le fichier CSV
        res.write(csvData);
        res.end();
    } catch (err) {
        console.error('exportFormToCSV error:', err);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Server error' });
        }
    }
};

/**
 * Exporter toutes les soumissions accessibles en CSV
 */
export const exportAllSubmissionsToCSV = async (req, res) => {
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';

    try {
        // Récupérer toutes les soumissions accessibles
        const submissions = await getAllSubmissionsForExport(userId, userRole);

        if (!submissions || submissions.length === 0) {
            return res.status(404).json({ error: 'No submissions found' });
        }

        // Générer le CSV
        const csvData = await generateMultiFormCSV(submissions);

        // Générer le nom de fichier
        const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
        const filename = `export_all_submissions_${timestamp}.csv`;

        // Définir les headers de réponse
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Ajouter le BOM UTF-8 pour Excel
        res.write('\uFEFF');

        // Envoyer le fichier CSV
        res.write(csvData);
        res.end();
    } catch (err) {
        console.error('exportAllSubmissionsToCSV error:', err);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Server error' });
        }
    }
};
