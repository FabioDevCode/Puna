/**
 * Service de statistiques
 * Gère les calculs de statistiques pour le dashboard
 */

import dayjs from 'dayjs';
import models from '../models/index.js';

/**
 * Récupérer les statistiques globales d'un utilisateur
 * @param {number} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Object>} - Statistiques (sites, forms, submissions, etc.)
 */
export async function getGlobalStats(userId, userRole) {
    const siteWhere = userRole === 'super_admin' ? {} : { fk_id_user: userId };

    const [sitesCount, formsCount, submissionsCount] = await Promise.all([
        models.Site.count({ where: siteWhere }),
        models.Form.count({
            include: [
                {
                    model: models.Site,
                    as: 'site',
                    where: siteWhere,
                    attributes: [],
                },
            ],
        }),
        models.Inbox.count({
            include: [
                {
                    model: models.Form,
                    as: 'form',
                    include: [
                        {
                            model: models.Site,
                            as: 'site',
                            where: siteWhere,
                            attributes: [],
                        },
                    ],
                    attributes: [],
                },
            ],
        }),
    ]);

    return {
        sites: sitesCount,
        forms: formsCount,
        submissions: submissionsCount,
    };
}

/**
 * Récupérer le top des formulaires par nombre de soumissions
 * @param {number} userId - ID de l'utilisateur
 * @param {number} days - Nombre de jours (7 ou 30)
 * @returns {Promise<Array>} - Top formulaires avec compteurs
 */
export async function getTopForms(userId, days = 7) {
    const end = dayjs().endOf('day');
    const start = dayjs()
        .startOf('day')
        .subtract(days - 1, 'day');

    const sql = `
        SELECT i.fk_id_form AS fk_id_form, f.name AS form_name, s.id AS site_id, s.domain AS site_domain, COUNT(i.id) AS cnt
        FROM inbox i
        JOIN form f ON f.id = i.fk_id_form
        JOIN site s ON s.id = f.fk_id_site
        WHERE s.fk_id_user = :userId
          AND i.createdAt BETWEEN :start AND :end
        GROUP BY i.fk_id_form, f.name, s.domain
        ORDER BY cnt DESC
        LIMIT 5
    `;

    const rows = await models.sequelize.query(sql, {
        replacements: {
            userId,
            start: start.toDate(),
            end: end.toDate(),
        },
        type: models.Sequelize.QueryTypes.SELECT,
    });

    return (rows || []).map((r, idx) => ({
        rank: idx + 1,
        form_name: r.form_name || null,
        site_id: r.site_id || null,
        site_domain: r.site_domain || null,
        count: Number(r.cnt) || 0,
    }));
}

/**
 * Récupérer le nombre de soumissions par jour
 * @param {number} userId - ID de l'utilisateur
 * @param {number} days - Nombre de jours (7 ou 30)
 * @returns {Promise<Object>} - { labels, data }
 */
export async function getInboxCountsByDay(userId, days = 7) {
    const end = dayjs().endOf('day');
    const start = dayjs()
        .startOf('day')
        .subtract(days - 1, 'day');

    // Construire les labels (dates)
    const labels = [];
    for (let i = 0; i < days; i++) {
        const dt = dayjs(start).add(i, 'day');
        labels.push(dt.format('YYYY-MM-DD'));
    }

    // Requête SQL pour compter par jour
    const sql = `
        SELECT DATE(i.createdAt) AS day_str, COUNT(i.id) AS cnt
        FROM inbox i
        JOIN form f ON f.id = i.fk_id_form
        JOIN site s ON s.id = f.fk_id_site
        WHERE s.fk_id_user = :userId
          AND i.createdAt BETWEEN :start AND :end
        GROUP BY DATE(i.createdAt)
    `;

    const rows = await models.sequelize.query(sql, {
        replacements: {
            userId,
            start: start.toDate(),
            end: end.toDate(),
        },
        type: models.Sequelize.QueryTypes.SELECT,
    });

    // Mapper dans un dictionnaire pour accès rapide
    const countMap = {};
    rows.forEach((r) => {
        const dayStr = dayjs(r.day_str).format('YYYY-MM-DD');
        countMap[dayStr] = Number(r.cnt) || 0;
    });

    // Remplir les données
    const data = labels.map((label) => countMap[label] || 0);

    return { labels, data };
}

/**
 * Récupérer les sites avec leurs compteurs de formulaires et soumissions
 * @param {number} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Array>} - Sites avec compteurs
 */
export async function getSitesWithCounts(userId, userRole) {
    const siteWhere = userRole === 'super_admin' ? {} : { fk_id_user: userId };

    const sites = await models.Site.findAll({
        where: siteWhere,
        attributes: ['id', 'domain'],
        include: [
            {
                model: models.User,
                as: 'user',
                attributes: ['login'],
            },
        ],
    });

    const sitesWithCounts = await Promise.all(
        sites.map(async (site) => {
            let formCount = 0;
            let inboxCount = 0;

            const forms = await models.Form.findAll({
                where: { fk_id_site: site.id },
                attributes: ['id'],
                raw: true,
            });

            if (forms?.length) {
                formCount = forms.length;
                const formIds = forms.map((f) => f.id);
                inboxCount = await models.Inbox.count({
                    where: { fk_id_form: formIds },
                });
            }

            return {
                id: site.id,
                domain: site.domain,
                creatorLogin: site.user?.login || null,
                form: formCount,
                inbox: inboxCount,
            };
        })
    );

    // Tri alphabétique par domaine
    sitesWithCounts.sort((a, b) => a.domain.localeCompare(b.domain));
    return sitesWithCounts;
}

/**
 * Calculer les statistiques globales à partir des sites avec compteurs
 * @param {Array} sitesWithCounts - Sites avec compteurs form/inbox
 * @returns {Object} - Statistiques globales
 */
export function getGlobalStatsFromSites(sitesWithCounts) {
    const globalInbox = sitesWithCounts.reduce((acc, site) => acc + (site.inbox || 0), 0);
    const globalForm = sitesWithCounts.reduce((acc, site) => acc + (site.form || 0), 0);
    const globalSite = sitesWithCounts.length;

    return {
        globalInbox,
        globalInbox_icon: 'fas fa-inbox',
        globalForm,
        globalForm_icon: 'fas fa-file-alt',
        globalSite,
        globalSite_icon: 'fas fa-globe',
    };
}

/**
 * Compter les inbox par site
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Object>} - { labels: [domains], data: [counts] }
 */
export async function getInboxCountsBySite(userId) {
    const sql = `
        SELECT s.id AS site_id, s.domain AS site_domain, COUNT(i.id) AS cnt
        FROM site s
        LEFT JOIN form f ON f.fk_id_site = s.id
        LEFT JOIN inbox i ON i.fk_id_form = f.id
        WHERE s.fk_id_user = :userId
        GROUP BY s.id, s.domain
        ORDER BY s.domain ASC
    `;

    const rows = await models.sequelize.query(sql, {
        replacements: { userId },
        type: models.Sequelize.QueryTypes.SELECT,
    });

    const labels = (rows || []).map((r) => r.site_domain);
    const data = (rows || []).map((r) => Number(r.cnt) || 0);
    const ids = (rows || []).map((r) => r.site_id);

    return { labels, data, ids };
}

/**
 * Générer la heatmap des inbox (jour de semaine x heure)
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @param {number} days - Nombre de jours (7 ou 30)
 * @returns {Promise<Object>} - { hours: [], series: [{ name, data }] }
 */
export async function getInboxHeatmap(userId, userRole, days = 7, locale = 'fr') {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const siteFilter = userRole === 'super_admin' ? '' : 'AND s.fk_id_user = :userId';

    const sql = `
        SELECT
            DAYOFWEEK(i.createdAt) AS dow,
            HOUR(i.createdAt)      AS h,
            COUNT(i.id)            AS cnt
        FROM inbox i
        JOIN form f ON f.id = i.fk_id_form
        JOIN site s ON s.id = f.fk_id_site
        WHERE i.createdAt BETWEEN :start AND :end
          ${siteFilter}
        GROUP BY DAYOFWEEK(i.createdAt), HOUR(i.createdAt)
    `;

    const rows = await models.sequelize.query(sql, {
        replacements: { userId, start, end },
        type: models.Sequelize.QueryTypes.SELECT,
    });

    // Préparer matrice 7x24 (Lundi..Dimanche, heures 00..23)
    const daysOfWeekByLocale = {
        fr: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],
        en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    };
    const daysOfWeek = daysOfWeekByLocale[locale] ?? daysOfWeekByLocale.fr;
    const hours = Array.from({ length: 24 }, (_, i) => (i === 0 ? '00' : String(i)));
    const matrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));

    // DAYOFWEEK() retourne 1=Dimanche..7=Samedi -> on veut Lundi=0..Dimanche=6
    (rows || []).forEach((r) => {
        const mysqlDow = Number(r.dow); // 1=Dim, 2=Lun, ..., 7=Sam
        const mondayIndex = (mysqlDow + 5) % 7; // Lun=0, Mar=1, ..., Dim=6
        const hour = Number(r.h);
        if (matrix[mondayIndex] && typeof matrix[mondayIndex][hour] !== 'undefined') {
            matrix[mondayIndex][hour] = Number(r.cnt) || 0;
        }
    });

    let series = daysOfWeek.map((d, i) => ({
        name: d,
        data: hours.map((h, j) => ({ x: h, y: matrix[i][j] })),
    }));

    series = series.reverse();

    return { hours, series };
}
