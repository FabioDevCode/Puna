import dayjs from 'dayjs';
import { errorLogger } from '../config/logger.js';
import { getFileTypeInfo } from '../helpers/file.helpers.js';
import { getInboxForDisplay, deleteInboxWithFiles, verifyFileAccessAndGetPath } from '../services/inbox.service.js';

/**
 * Afficher une entrée inbox
 */
export const showInbox = async (req, res) => {
    const inboxId = req.params.id;
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';

    try {
        const data = await getInboxForDisplay(inboxId, userId, userRole);

        if (!data) {
            return res.redirect('/dashboard');
        }

        const { inbox, form, site, contentObj, templateObj, fileKeys } = data;

        // Parse template pour les file entries
        const template = typeof form.template === 'string' ? JSON.parse(form.template) : form.template;

        // Extract files from content
        const fileEntries = [];
        for (const key of fileKeys) {
            const value = contentObj[key];
            if (value) {
                const label = templateObj[key] || key;
                const filenames = Array.isArray(value) ? value : [value];

                filenames.forEach((filename) => {
                    const typeInfo = getFileTypeInfo(filename);
                    fileEntries.push({
                        key,
                        template: template[key],
                        label,
                        filename,
                        original_filename: filename.split('_').slice(1).join('_'),
                        ...typeInfo,
                    });
                });
            }
        }

        // Prepare content entries with labels from template (excluding files)
        const contentEntries = Object.keys(contentObj || {})
            .filter((key) => !fileKeys.includes(key))
            .map((key) => ({
                key,
                label: templateObj[key] || key,
                value: contentObj[key] !== undefined && contentObj[key] !== null ? String(contentObj[key]) : '-',
            }));

        // Format date
        const formattedDate = inbox.createdAt ? dayjs(inbox.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-';

        res.render('inbox/show', {
            inbox,
            form,
            site,
            contentEntries,
            fileEntries,
            formattedDate,
        });
    } catch (err) {
        errorLogger.error({ err, inboxId, userId }, 'showInbox error');
        res.redirect('/dashboard');
    }
};

/**
 * Supprimer une entrée inbox
 */
export const deleteInbox = async (req, res) => {
    const inboxId = req.params.id;
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';

    try {
        // Récupérer les infos avant suppression pour redirection
        const data = await getInboxForDisplay(inboxId, userId, userRole);
        if (!data) {
            res.flash('error', 'Entrée introuvable ou accès refusé.');
            return res.redirect('/dashboard');
        }

        const siteId = data.form.fk_id_site;

        // Supprimer avec les fichiers
        const result = await deleteInboxWithFiles(inboxId, userId, userRole);

        if (!result.success) {
            errorLogger.warn({ error: result.error, inboxId, userId }, 'deleteInbox service returned error');
            res.flash('error', 'Erreur lors de la suppression.');
            return res.redirect('/dashboard');
        }

        res.flash('success', 'Entrée supprimée.');
        res.redirect(`/site/${siteId}/view?f=${data.form.name}`);
    } catch (err) {
        errorLogger.error({ err, inboxId, userId }, 'deleteInbox error');
        res.flash('error', 'Erreur lors de la suppression.');
        res.redirect('/dashboard');
    }
};

/**
 * Télécharger un fichier d'une entrée inbox
 */
export const downloadFile = async (req, res) => {
    const { inboxId, filename } = req.params;
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';

    try {
        const result = await verifyFileAccessAndGetPath(inboxId, filename, userId, userRole);

        if (!result.success) {
            return res.status(404).json({ error: result.error });
        }

        // Get original filename (remove timestamp prefix)
        const originalFilename = filename.split('_').slice(1).join('_');

        // Send file for download
        res.download(result.filePath, originalFilename, (err) => {
            if (err) {
                errorLogger.error({ err, inboxId, filename }, 'downloadFile error');
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Error downloading file' });
                }
            }
        });
    } catch (err) {
        errorLogger.error({ err, inboxId, filename }, 'downloadFile server error');
        return res.status(500).json({ error: 'Server error' });
    }
};
