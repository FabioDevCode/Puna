import fs from 'node:fs';
import path from 'node:path';
import dayjs from 'dayjs';
import models from '../models/index.js';

/**
 * Afficher une entrée inbox
 */
export const showInbox = async (req, res) => {
    const inboxId = req.params.id;
    const userId = req.session.user?.id;

    try {
        const inbox = await models.Inbox.findByPk(inboxId, {
            include: [
                {
                    model: models.Form,
                    as: 'form',
                    include: [
                        {
                            model: models.Site,
                            as: 'site',
                            where: { fk_id_user: userId },
                        },
                    ],
                },
            ],
        });

        if (!inbox) {
            return res.redirect('/dashboard');
        }

        const form = inbox.form;
        const site = form?.site;

        if (!site) {
            return res.redirect('/dashboard');
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

        // Helper function to determine file type color and icon
        const getFileTypeInfo = (filename) => {
            if (!filename) {
                return { color: 'neutral', icon: 'fa-file', label: 'Fichier' };
            }

            const ext = filename.toLowerCase().split('.').pop();
            // Images - Purple
            if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
                return {
                    color: 'white',
                    bg_color: '#b0a010',
                    icon: 'fa-solid fa-file-image',
                    label: ext.toUpperCase(),
                };
            }

            if (['xls', 'xlsx'].includes(ext)) {
                return {
                    color: 'white',
                    bg_color: '#186E3F',
                    icon: 'fa-solid fa-file-excel',
                    label: ext.toUpperCase(),
                };
            }

            if (['csv'].includes(ext)) {
                return {
                    color: 'white',
                    bg_color: '#077D3E',
                    icon: 'fa-solid fa-file-csv',
                    label: ext.toUpperCase(),
                };
            }

            if (ext === 'pdf') {
                return {
                    color: 'white',
                    bg_color: '#AA0101',
                    icon: 'fa-solid fa-file-pdf',
                    label: 'PDF',
                };
            }

            if (['doc', 'docx'].includes(ext)) {
                return {
                    color: 'white',
                    bg_color: '#2A5893',
                    icon: 'fa-solid fa-file-word',
                    label: ext.toUpperCase(),
                };
            }

            if (['odt'].includes(ext)) {
                return {
                    color: 'white',
                    bg_color: '#4A90E2',
                    icon: 'fa-solid fa-file-lines',
                    label: ext.toUpperCase(),
                };
            }

            if (['txt'].includes(ext)) {
                return {
                    color: 'white',
                    bg_color: '#444444',
                    icon: 'fa-solid fa-file-lines',
                    label: ext.toUpperCase(),
                };
            }

            return {
                color: 'white',
                bg_color: '#1F2937',
                icon: 'fa-solid fa-file',
                label: ext.toUpperCase(),
            };
        };

        const template = JSON.parse(JSON.parse(JSON.stringify(form)).template);
        // Extract files from content
        const fileEntries = [];
        for (const key of fileKeys) {
            const value = contentObj[key];
            if (value) {
                const label = templateObj[key] || key;
                // value can be a single filename or array of filenames
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
            .filter((key) => !fileKeys.includes(key)) // Exclude file fields
            .map((key) => ({
                key,
                label: templateObj[key] || key,
                value: contentObj[key] !== undefined && contentObj[key] !== null ? String(contentObj[key]) : '-',
            }));

        // Format date
        const formattedDate = inbox.createdAt ? dayjs(inbox.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-';

        res.render('inbox/show', {
            inbox: inbox.toJSON(),
            form: form.toJSON(),
            site: site.toJSON(),
            contentEntries,
            fileEntries,
            formattedDate,
        });
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard');
    }
};

/**
 * Supprimer une entrée inbox
 */
export const deleteInbox = async (req, res) => {
    const inboxId = req.params.id;
    const userId = req.session.user?.id;

    try {
        const inbox = await models.Inbox.findByPk(inboxId, {
            include: [
                {
                    model: models.Form,
                    as: 'form',
                    include: [
                        {
                            model: models.Site,
                            as: 'site',
                            where: { fk_id_user: userId },
                        },
                    ],
                },
            ],
        });

        if (!inbox) {
            return res.redirect('/dashboard');
        }

        const siteId = inbox.form.fk_id_site;

        // Delete associated files from storage
        const form = inbox.form;
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

        // Delete files
        const siteDomain = inbox.form.site.domain;
        const uploadsDir = path.resolve(process.cwd(), `./storage/uploads/${siteDomain}`);
        let contentObj = {};
        try {
            contentObj = typeof inbox.content === 'string' ? JSON.parse(inbox.content) : inbox.content;
        } catch (e) {
            contentObj = {};
        }

        fileKeys.forEach((key) => {
            const filename = contentObj[key];
            if (filename) {
                const filePath = path.join(uploadsDir, filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        });

        await inbox.destroy();

        res.redirect(`/site/${siteId}/view`);
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard');
    }
};

/**
 * Télécharger un fichier d'une entrée inbox
 */
export const downloadFile = async (req, res) => {
    const { inboxId, filename } = req.params;
    const userId = req.session.user?.id;

    try {
        // Verify inbox exists and user has access
        const inbox = await models.Inbox.findByPk(inboxId, {
            include: [
                {
                    model: models.Form,
                    as: 'form',
                    include: [
                        {
                            model: models.Site,
                            as: 'site',
                            where: { fk_id_user: userId },
                        },
                    ],
                },
            ],
        });

        if (!inbox) {
            return res.status(404).json({ error: 'Inbox entry not found' });
        }

        const form = inbox.form;
        const site = form?.site;

        if (!site) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Parse content to verify file exists in this inbox
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

        // Check if the filename exists in any of the file fields
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
            return res.status(404).json({ error: 'File not found in this inbox entry' });
        }

        // Construct file path using the helper
        const { finalPathFor } = await import('../helpers/upload_utils.js');
        const { path: filePath } = finalPathFor(site, form, filename);

        // Check if file exists on disk
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found on server' });
        }

        // Get original filename (remove timestamp prefix)
        const originalFilename = filename.split('_').slice(1).join('_');

        // Send file for download
        res.download(filePath, originalFilename, (err) => {
            if (err) {
                console.error('Download error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Error downloading file' });
                }
            }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
};
