import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';
import * as tar from 'tar';
import { logger } from '../config/logger.js';
import models from '../models/index.js';
import { verifyPassword } from '../services/auth.service.js';
import { getAvailableSites } from '../services/site.service.js';
import { assignUserToSites, updateUserSiteAssignments } from '../services/siteUser.service.js';
import {
    findUsersWithFilters,
    getAllUsersWithCreator,
    userExists,
    createUserAdmin,
    deleteUserWithRelations,
    getUserWithRelations,
    updateUserAdmin,
} from '../services/user.service.js';

// Chemins pour les logs
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.resolve(__dirname, '../../logs');
const archiveDir = path.join(logDir, 'archives');

/**
 * Compte le nombre de lignes dans un fichier
 * @param {string} filePath - Chemin du fichier
 * @returns {Promise<number>} Nombre de lignes
 */
const countFileLines = async (filePath) => {
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
const countFilesRecursive = async (dirPath) => {
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
 * Page d'administration
 */
export const admin = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const userRole = req.session.user?.role;

        let stats = {
            users: 0,
            sites: 0,
            forms: 0,
            entries: 0,
        };

        let activityStats = {
            connectedUsers: 0,
            errorsCount: 0,
            todaySites: 0,
            todayForms: 0,
            totalFiles: 0,
        };

        // Début de la journée (minuit)
        const todayStart = dayjs().startOf('day').toDate();

        // Stats communes à tous les rôles - Utilisateurs connectés
        try {
            const nowTimestamp = Math.floor(Date.now() / 1000);

            const sessions = await models.sequelize.query(`SELECT data FROM sessions WHERE expires > :now`, {
                replacements: { now: nowTimestamp },
                type: models.Sequelize.QueryTypes.SELECT,
            });

            // Parser les sessions et compter les utilisateurs uniques connectés
            const connectedUserIds = new Set();
            for (const session of sessions) {
                try {
                    const sessionData = JSON.parse(session.data);
                    // L'utilisateur est stocké dans session.user.id (pas passport)
                    if (sessionData?.user?.id) {
                        connectedUserIds.add(sessionData.user.id);
                    }
                } catch {
                    // Session invalide, ignorer
                }
            }
            activityStats.connectedUsers = connectedUserIds.size;
        } catch (err) {
            console.error('Error counting connected users:', err);
            activityStats.connectedUsers = 0;
        }

        // Nombre d'erreurs dans error.log
        const errorLogPath = path.join(logDir, 'error.log');
        activityStats.errorsCount = await countFileLines(errorLogPath);

        // Nombre total de fichiers uploadés
        const uploadsDir = path.resolve(__dirname, '../../storage/uploads');
        activityStats.totalFiles = await countFilesRecursive(uploadsDir);

        if (userRole === 'super_admin') {
            // Super admin voit tout
            const [usersCount, sitesCount, formsCount, entriesCount, todaySites, todayForms] = await Promise.all([
                models.User.count(),
                models.Site.count(),
                models.Form.count(),
                models.Inbox.count(),
                models.Site.count({ where: { createdAt: { [models.Op.gte]: todayStart } } }),
                models.Form.count({ where: { createdAt: { [models.Op.gte]: todayStart } } }),
            ]);

            stats = {
                users: usersCount,
                sites: sitesCount,
                forms: formsCount,
                entries: entriesCount,
            };

            activityStats.todaySites = todaySites;
            activityStats.todayForms = todayForms;
        } else if (userRole === 'owner') {
            // Owner voit uniquement ses données

            // Utilisateurs créés par lui
            const usersCount = await models.User.count({
                where: { created_by: userId },
            });

            // Sites rattachés à l'owner
            const userSites = await models.SiteUser.findAll({
                where: { fk_id_user: userId },
                attributes: ['fk_id_site'],
            });
            const siteIds = userSites.map((su) => su.fk_id_site);
            const sitesCount = siteIds.length;

            // Formulaires des sites de l'owner
            let formsCount = 0;
            let entriesCount = 0;
            let todaySites = 0;
            let todayForms = 0;

            if (siteIds.length > 0) {
                const [formsCountResult, formsAll, todaySitesResult, todayFormsResult] = await Promise.all([
                    models.Form.count({
                        where: { fk_id_site: { [models.Op.in]: siteIds } },
                    }),
                    models.Form.findAll({
                        where: { fk_id_site: { [models.Op.in]: siteIds } },
                        attributes: ['id'],
                    }),
                    models.Site.count({
                        where: {
                            id: { [models.Op.in]: siteIds },
                            createdAt: { [models.Op.gte]: todayStart },
                        },
                    }),
                    models.Form.count({
                        where: {
                            fk_id_site: { [models.Op.in]: siteIds },
                            createdAt: { [models.Op.gte]: todayStart },
                        },
                    }),
                ]);

                formsCount = formsCountResult;
                todaySites = todaySitesResult;
                todayForms = todayFormsResult;

                const formIds = formsAll.map((f) => f.id);
                if (formIds.length > 0) {
                    entriesCount = await models.Inbox.count({
                        where: { fk_id_form: { [models.Op.in]: formIds } },
                    });
                }
            }

            stats = {
                users: usersCount,
                sites: sitesCount,
                forms: formsCount,
                entries: entriesCount,
            };

            activityStats.todaySites = todaySites;
            activityStats.todayForms = todayForms;
        }

        res.render('admin/index', {
            layout: 'admin',
            stats,
            activityStats,
        });
    } catch (err) {
        console.error('admin error:', err);
        res.redirect('/dashboard');
    }
};

/**
 * Page de gestion des utilisateurs
 */
export const adminUsers = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const userRole = req.session.user?.role;

        // Récupérer les sites disponibles via le service
        const sites = await getAvailableSites(userId, userRole);

        res.render('admin/users/list', {
            layout: 'admin',
            sites,
        });
    } catch (err) {
        console.error('adminUsers error:', err);
        res.redirect('/admin');
    }
};

/**
 * API - Liste des utilisateurs avec pagination
 */
export const adminUsersList = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;
        const search = req.query.search || '';
        const searchField = req.query.searchField || 'auto';

        // Récupérer les utilisateurs via le service
        const { users, total } = await findUsersWithFilters({
            limit,
            offset,
            search,
            searchField,
        });

        // Formater les données
        const formattedUsers = users.map((user) => ({
            id: user.id,
            email: user.email,
            login: user.login,
            role: user.role || 'N/A',
            status: user.status || 'pending',
            created_by: user.creator ? user.creator.login : 'N/A',
            last_connection: user.last_connection ? dayjs(user.last_connection).format('YYYY-MM-DD HH:mm') : 'N/A',
            createdAt: dayjs(user.createdAt).format('YYYY-MM-DD'),
        }));

        res.json({
            users: formattedUsers,
            total,
            limit,
            offset,
        });
    } catch (err) {
        console.error('adminUsersList error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Export Excel des utilisateurs
 */
export const adminUsersExportExcel = async (req, res) => {
    try {
        const search = req.query.search || '';

        // Récupérer tous les utilisateurs via le service
        const users = await getAllUsersWithCreator({ search });

        // Créer le workbook Excel
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Utilisateurs');

        // Définir les colonnes
        worksheet.columns = [
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Login', key: 'login', width: 20 },
            { header: 'Rôle', key: 'role', width: 15 },
            { header: 'Créé par', key: 'created_by', width: 20 },
            { header: 'Activé', key: 'enabled', width: 10 },
            { header: 'Dernière connexion', key: 'last_connection', width: 20 },
            { header: 'Créé le', key: 'createdAt', width: 20 },
        ];

        // Style des en-têtes
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'left' };

        // Ajouter les données
        users.forEach((user) => {
            worksheet.addRow({
                email: user.email,
                login: user.login,
                role: user.role || 'N/A',
                created_by: user.creator ? user.creator.login : 'N/A',
                enabled: user.enabled ? 'Oui' : 'Non',
                last_connection: user.last_connection ? dayjs(user.last_connection).format('YYYY-MM-DD HH:mm') : 'N/A',
                createdAt: dayjs(user.createdAt).format('YYYY-MM-DD HH:mm'),
            });
        });

        // Générer le fichier
        const fileName = `utilisateurs_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('adminUsersExportExcel error:', err);
        res.status(500).json({ error: "Erreur lors de l'export" });
    }
};

/**
 * Exporter les utilisateurs en CSV
 */
export const adminUsersExportCSV = async (req, res) => {
    try {
        const search = req.query.search || '';

        // Récupérer tous les utilisateurs via le service
        const users = await getAllUsersWithCreator({ search });

        // Générer le CSV via le service d'export
        const { generateUsersCSV } = await import('../services/export.service.js');
        const csvData = await generateUsersCSV(users);

        // Générer le fichier
        const fileName = `utilisateurs_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Ajouter le BOM UTF-8 pour Excel
        res.write('\uFEFF');

        // Envoyer le CSV
        res.write(csvData);
        res.end();
    } catch (err) {
        console.error('adminUsersExportCSV error:', err);
        res.status(500).json({ error: "Erreur lors de l'export" });
    }
};

/**
 * Création d'un utilisateur
 */
export const adminCreateUser = async (req, res) => {
    try {
        const { login, email, role, sites } = req.body;
        const creatorId = req.session.user?.id;

        // Validation basique
        if (!login || !email || !role) {
            return res.redirect('/admin/users');
        }

        // Vérifier si l'utilisateur existe déjà via le service
        const exists = await userExists(email, login);
        if (exists) {
            return res.redirect('/admin/users');
        }

        // Créer l'utilisateur via le service
        const newUser = await createUserAdmin({
            login,
            email,
            role,
            created_by: creatorId,
            status: 'pending',
        });

        // Assigner les sites via le service
        if (sites) {
            const siteIds = Array.isArray(sites) ? sites : [sites];
            await assignUserToSites(newUser.id, siteIds);
        }

        res.redirect('/admin/users');
    } catch (err) {
        console.error('adminCreateUser error:', err);
        res.redirect('/admin/users');
    }
};

/**
 * Suppression d'un utilisateur
 */
export const adminDeleteUser = async (req, res) => {
    try {
        const { user_id, password } = req.body;
        const currentUserId = req.session.user?.id;

        // Validation basique
        if (!user_id || !password) {
            return res.redirect('/admin/users');
        }

        // Vérifier le mot de passe de l'utilisateur connecté
        const currentUser = await models.User.findByPk(currentUserId);
        if (!currentUser) {
            return res.redirect('/admin/users');
        }

        const isPasswordValid = await verifyPassword(password, currentUser.password);
        if (!isPasswordValid) {
            // TODO: Flash message "Mot de passe incorrect"
            return res.redirect('/admin/users');
        }

        // Supprimer l'utilisateur et ses relations via le service
        await deleteUserWithRelations(user_id);

        res.redirect('/admin/users');
    } catch (err) {
        console.error('adminDeleteUser error:', err);
        res.redirect('/admin/users');
    }
};

/**
 * Affichage d'un utilisateur (lecture seule)
 */
export const adminViewUser = async (req, res) => {
    try {
        const userId = req.params.id;

        // Récupérer l'utilisateur avec ses relations via le service
        const user = await getUserWithRelations(userId);

        if (!user) {
            return res.redirect('/admin/users');
        }

        // Formater les données pour l'affichage
        user.last_connection = user.last_connection ? dayjs(user.last_connection).format('YYYY-MM-DD HH:mm') : null;
        user.createdAt = dayjs(user.createdAt).format('YYYY-MM-DD HH:mm');

        res.render('admin/users/view', {
            layout: 'admin',
            user,
        });
    } catch (err) {
        console.error('adminViewUser error:', err);
        res.redirect('/admin/users');
    }
};

/**
 * Page d'édition d'un utilisateur
 */
export const adminEditUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const currentUserId = req.session.user?.id;
        const currentUserRole = req.session.user?.role;

        // Récupérer l'utilisateur avec ses relations via le service
        const user = await getUserWithRelations(userId);

        if (!user) {
            return res.redirect('/admin/users');
        }

        // Récupérer tous les sites disponibles via le service
        const sites = await getAvailableSites(currentUserId, currentUserRole);

        // Marquer les sites assignés
        const assignedSiteIds = user.siteassignments?.map((sa) => sa.site.id) || [];
        const sitesWithAssignment = sites.map((s) => ({
            ...s,
            isAssigned: assignedSiteIds.includes(s.id),
        }));

        // Formater les données pour l'affichage
        user.last_connection = user.last_connection ? dayjs(user.last_connection).format('YYYY-MM-DD HH:mm') : null;
        user.createdAt = dayjs(user.createdAt).format('YYYY-MM-DD HH:mm');

        res.render('admin/users/edit', {
            layout: 'admin',
            user,
            sites: sitesWithAssignment,
        });
    } catch (err) {
        console.error('adminEditUser error:', err);
        res.redirect('/admin/users');
    }
};

/**
 * Mise à jour d'un utilisateur
 */
export const adminUpdateUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const { login, email, role, sites, clear_password } = req.body;

        // Validation basique
        if (!login || !email || !role) {
            return res.redirect(`/admin/users/${userId}/edit`);
        }

        const updateData = {
            login,
            email,
            role,
        };

        // Si le mot de passe est vidé, désactiver l'utilisateur
        if (clear_password === 'true') {
            updateData.password = null;
            updateData.status = 'pending';
        }

        // Mettre à jour l'utilisateur via le service
        await updateUserAdmin(userId, updateData);

        // Gérer les sites assignés via le service
        const siteIds = sites ? (Array.isArray(sites) ? sites : [sites]) : [];
        await updateUserSiteAssignments(userId, siteIds);

        res.redirect('/admin/users');
    } catch (err) {
        console.error('adminUpdateUser error:', err);
        res.redirect(`/admin/users/${req.params.id}/edit`);
    }
};

/**
 * Page de paramètres de l'administration
 */
export const adminSettings = async (req, res) => {
    try {
        res.render('admin/settings', {
            layout: 'admin',
        });
    } catch (err) {
        console.error('adminSettings error:', err);
        res.redirect('/admin');
    }
};

// ============================================================================
// LOGS VIEWER
// ============================================================================

const LOG_TYPES = ['app', 'api', 'audit', 'error'];

/**
 * Formate une date pour l'affichage dans le sélecteur
 * @param {string} dateStr - Date au format YYYY-MM-DD ou YYYY-MM-DD-HHmmss
 * @param {boolean} isManual - Indique si c'est une archive manuelle
 * @returns {string} Date formatée
 */
const formatDateLabel = (dateStr, isManual = false) => {
    if (dateStr === 'today') {
        return "Aujourd'hui";
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
const listArchives = async () => {
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
                label: formatDateLabel(dateStr, false),
                isManual: false,
            });
        } else if (f.endsWith('-manual.tar.gz')) {
            // Archive manuelle: YYYY-MM-DD-HHmmss-manual.tar.gz
            const dateTimeStr = f.replace('-manual.tar.gz', '');
            archives.push({
                filename: f,
                date: dateTimeStr,
                label: formatDateLabel(dateTimeStr, true),
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
        const archives = await listArchives();

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
            return res.status(400).json({ error: 'Type de log invalide' });
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
        res.status(500).json({ error: 'Erreur lors de la lecture des logs' });
    }
};

/**
 * API: Liste des archives disponibles
 */
export const getArchives = async (req, res) => {
    try {
        const archives = await listArchives();
        res.json({ archives });
    } catch (err) {
        logger.error({ err }, 'getArchives error');
        res.status(500).json({ error: 'Erreur lors de la récupération des archives' });
    }
};
