import path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';
import { errorLogger } from '../../config/logger.js';
import models from '../../models/index.js';
import { countFileLines, countFilesRecursive } from './adminLogs.controller.js';

// Chemins pour les logs et uploads
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.resolve(__dirname, '../../../logs');
const uploadsDir = path.resolve(__dirname, '../../../storage/uploads');

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
            errorLogger.error({ err, userId: req.session?.user?.id }, 'Error counting connected users');
            activityStats.connectedUsers = 0;
        }

        // Nombre d'erreurs dans error.log
        const errorLogPath = path.join(logDir, 'error.log');
        activityStats.errorsCount = await countFileLines(errorLogPath);

        // Nombre total de fichiers uploadés
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
        errorLogger.error({ err, userId: req.session?.user?.id }, 'admin error');
        res.redirect('/dashboard');
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
        errorLogger.error({ err, userId: req.session?.user?.id }, 'adminSettings error');
        res.redirect('/admin');
    }
};
