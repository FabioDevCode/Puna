import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as tar from 'tar';
import { logger } from '../../config/logger.js';

// Chemins pour les logs
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.resolve(__dirname, '../../../logs');
const archiveDir = path.join(logDir, 'archives');

const LOG_TYPES = ['app', 'api', 'audit', 'error'];

/**
 * Compte le nombre de lignes dans un fichier
 * @param {string} filePath - Chemin du fichier
 * @returns {Promise<number>} Nombre de lignes
 */
export const countFileLines = async (filePath) => {
    try {
        const content = await fs.readFile(filePath, 'utf8');
        if (!content.trim()) {
            return 0;
        }
        return content.trim().split('\n').length;
    } catch {
        return 0;
    }
};

/**
 * Compte récursivement les fichiers dans un dossier
 * @param {string} dirPath - Chemin du dossier
 * @returns {Promise<number>} Nombre de fichiers
 */
export const countFilesRecursive = async (dirPath) => {
    try {
        await fs.access(dirPath);
    } catch {
        return 0;
    }

    let count = 0;
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        if (item.isDirectory()) {
            count += await countFilesRecursive(itemPath);
        } else if (item.isFile()) {
            count++;
        }
    }

    return count;
};

/**
 * Formate une date pour l'affichage dans le sélecteur
 * @param {string} dateStr - Date au format YYYY-MM-DD ou YYYY-MM-DD-HHmmss
 * @param {boolean} isManual - Indique si c'est une archive manuelle
 * @returns {string} Date formatée
 */
const formatDateLabel = (dateStr, isManual = false, t = null) => {
    if (dateStr === 'today') {
        return t ? t('admin.logs_today') : "Aujourd'hui";
    }
    // Pour les archives manuelles, afficher la date avec l'heure et un indicateur
    if (isManual) {
        // Format: YYYY-MM-DD-HHmmss -> YYYY-MM-DD HH:mm ⚙
        const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})(\d{2})$/);
        if (match) {
            return `${match[1]} ${match[2]}:${match[3]} ⚙`;
        }
        return `${dateStr} ⚙`;
    }
    return dateStr; // Format YYYY-MM-DD déjà présent
};

/**
 * Liste les archives disponibles dans le dossier archives
 * @returns {Promise<Array>} Liste des archives avec date et label
 */
const listArchives = async (t = null) => {
    try {
        await fs.access(archiveDir);
    } catch {
        return [];
    }

    const files = await fs.readdir(archiveDir);
    const archives = [];

    for (const f of files) {
        // Archive quotidienne automatique: YYYY-MM-DD-archive-log.tar.gz
        if (f.endsWith('-archive-log.tar.gz')) {
            const dateStr = f.replace('-archive-log.tar.gz', '');
            archives.push({
                filename: f,
                date: dateStr,
                label: formatDateLabel(dateStr, false, t),
                isManual: false,
            });
        } else if (f.endsWith('-manual.tar.gz')) {
            // Archive manuelle: YYYY-MM-DD-HHmmss-manual.tar.gz
            const dateTimeStr = f.replace('-manual.tar.gz', '');
            archives.push({
                filename: f,
                date: dateTimeStr,
                label: formatDateLabel(dateTimeStr, true, t),
                isManual: true,
            });
        }
    }

    // Trier par date décroissante (plus récent en premier)
    archives.sort((a, b) => b.date.localeCompare(a.date));

    return archives;
};

/**
 * Extrait et lit un fichier de log depuis une archive tar.gz
 * @param {string} archiveFilename - Nom du fichier archive
 * @param {string} logType - Type de log (app, api, audit, error)
 * @returns {Promise<string>} Contenu du fichier de log
 */
const extractLogFromArchive = async (archiveFilename, logType) => {
    const archivePath = path.join(archiveDir, archiveFilename);
    const logFilename = `${logType}.log`;

    try {
        await fs.access(archivePath);
    } catch {
        throw new Error(`Archive non trouvée: ${archiveFilename}`);
    }

    return new Promise((resolve, reject) => {
        const chunks = [];

        tar.t({
            file: archivePath,
            onReadEntry: (entry) => {
                if (entry.path === logFilename) {
                    entry.on('data', (chunk) => chunks.push(chunk));
                    entry.on('end', () => {
                        resolve(Buffer.concat(chunks).toString('utf8'));
                    });
                } else {
                    entry.resume();
                }
            },
        })
            .then(() => {
                if (chunks.length === 0) {
                    resolve('');
                }
            })
            .catch(reject);
    });
};

/**
 * Page du visualiseur de logs
 */
export const logsViewer = async (req, res) => {
    try {
        const archives = await listArchives(req.__);

        res.render('admin/logs/viewer', {
            layout: 'admin',
            logTypes: LOG_TYPES,
            archives,
        });
    } catch (err) {
        logger.error({ err }, 'logsViewer error');
        res.redirect('/admin');
    }
};

/**
 * API: Lecture des logs (aujourd'hui ou archive)
 */
export const readLogs = async (req, res) => {
    try {
        const { date = 'today', type = 'app', search = '', timeFrom = '', timeTo = '', level = '' } = req.query;

        if (!LOG_TYPES.includes(type)) {
            return res.status(400).json({ error: req.__('flash.admin_log_type_invalid') });
        }

        let content = '';

        if (date === 'today') {
            // Lecture du fichier de log actuel
            const logPath = path.join(logDir, `${type}.log`);
            try {
                content = await fs.readFile(logPath, 'utf8');
            } catch {
                content = '';
            }
        } else {
            // Extraction depuis une archive - déterminer le nom du fichier
            let archiveFilename;

            // Vérifier si c'est une archive manuelle (format: YYYY-MM-DD-HHmmss)
            if (/^\d{4}-\d{2}-\d{2}-\d{6}$/.test(date)) {
                archiveFilename = `${date}-manual.tar.gz`;
            } else {
                // Archive quotidienne (format: YYYY-MM-DD)
                archiveFilename = `${date}-archive-log.tar.gz`;
            }

            try {
                content = await extractLogFromArchive(archiveFilename, type);
            } catch (err) {
                return res.status(404).json({ error: err.message });
            }
        }

        // Parsing des lignes JSON et filtrage
        const lines = content
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => {
                try {
                    return JSON.parse(line);
                } catch {
                    return { raw: line, time: Date.now() };
                }
            });

        // Filtrage par recherche si spécifié
        let filteredLines = lines;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredLines = filteredLines.filter((line) => {
                const lineStr = JSON.stringify(line).toLowerCase();
                return lineStr.includes(searchLower);
            });
        }

        // Filtrage par niveau si spécifié
        if (level) {
            const levelNum = parseInt(level, 10);
            filteredLines = filteredLines.filter((line) => line.level === levelNum);
        }

        // Filtrage par plage horaire
        if (timeFrom || timeTo) {
            filteredLines = filteredLines.filter((line) => {
                if (!line.time) {
                    return false;
                }
                const logDate = new Date(line.time);
                const logTimeStr = logDate.toTimeString().slice(0, 5); // HH:MM

                if (timeFrom && logTimeStr < timeFrom) {
                    return false;
                }
                if (timeTo && logTimeStr > timeTo) {
                    return false;
                }
                return true;
            });
        }

        // Tri par temps décroissant (plus récent en premier)
        filteredLines.sort((a, b) => {
            const timeA = a.time || 0;
            const timeB = b.time || 0;
            return timeB - timeA;
        });

        res.json({
            date,
            type,
            count: filteredLines.length,
            lines: filteredLines,
        });
    } catch (err) {
        logger.error({ err }, 'readLogs error');
        res.status(500).json({ error: req.__('flash.admin_log_read_error') });
    }
};

/**
 * API: Liste des archives disponibles
 */
export const getArchives = async (req, res) => {
    try {
        const archives = await listArchives(req.__);
        res.json({ archives });
    } catch (err) {
        logger.error({ err }, 'getArchives error');
        res.status(500).json({ error: req.__('flash.admin_log_archives_error') });
    }
};
