/**
 * Service de statistiques
 * Gère les calculs de statistiques pour le dashboard
 */

import dayjs from 'dayjs';
import { Op } from 'sequelize';
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
        SELECT i.fk_id_form AS fk_id_form, f.name AS form_name, s.domain AS site_domain, COUNT(i.id) AS cnt
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
        form_id: r.fk_id_form,
        form_name: r.form_name || null,
        site_domain: r.site_domain || null,
        count: Number(r.cnt) || 0,
    }));
}

/**
 * Récupérer le site principal avec répartition des formulaires
 * @param {number} userId - ID de l'utilisateur
 * @param {number} days - Nombre de jours (90 par défaut)
 * @returns {Promise<Object>} - { site, labels, series }
 */
export async function getTopSiteWithForms(userId, days = 90) {
    const end = dayjs().endOf('day');
    const start = dayjs()
        .startOf('day')
        .subtract(days - 1, 'day');

    // Trouver le site avec le plus de soumissions
    const sqlTopSite = `
        SELECT s.id AS site_id, s.domain AS site_domain, COUNT(i.id) AS total
        FROM inbox i
        JOIN form f ON f.id = i.fk_id_form
        JOIN site s ON s.id = f.fk_id_site
        WHERE s.fk_id_user = :userId
          AND i.createdAt BETWEEN :start AND :end
        GROUP BY s.id, s.domain
        ORDER BY total DESC
        LIMIT 1
    `;

    const topSiteRows = await models.sequelize.query(sqlTopSite, {
        replacements: { userId, start: start.toDate(), end: end.toDate() },
        type: models.Sequelize.QueryTypes.SELECT,
    });

    if (!topSiteRows || !topSiteRows.length) {
        return { site: null, labels: [], series: [] };
    }

    const topSite = topSiteRows[0];
    const siteId = topSite.site_id;

    // Compter les soumissions par formulaire pour ce site
    const sqlPerForm = `
        SELECT f.id AS form_id, f.name AS form_name, COUNT(i.id) AS cnt
        FROM form f
        LEFT JOIN inbox i ON i.fk_id_form = f.id AND i.createdAt BETWEEN :start AND :end
        WHERE f.fk_id_site = :siteId
        GROUP BY f.id, f.name
        ORDER BY cnt DESC
    `;

    const perFormRows = await models.sequelize.query(sqlPerForm, {
        replacements: { siteId, start: start.toDate(), end: end.toDate() },
        type: models.Sequelize.QueryTypes.SELECT,
    });

    const labels = (perFormRows || []).map((r) => r.form_name || `form-${r.form_id}`);
    const series = (perFormRows || []).map((r) => Number(r.cnt) || 0);

    return {
        site: {
            id: siteId,
            domain: topSite.site_domain,
            total: Number(topSite.total) || 0,
        },
        labels,
        series,
    };
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
 * Compter les soumissions dans une plage de dates
 * @param {number} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @param {Date} startDate - Date de début
 * @param {Date} endDate - Date de fin
 * @returns {Promise<number>} - Nombre de soumissions
 */
export async function countSubmissionsInRange(userId, userRole, startDate, endDate) {
    const siteWhere = userRole === 'super_admin' ? {} : { fk_id_user: userId };

    return await models.Inbox.count({
        where: {
            createdAt: {
                [Op.gte]: startDate,
                [Op.lte]: endDate,
            },
        },
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
    });
}

/**
 * Calculer les pourcentages de variation des soumissions
 * @param {number} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Object>} - { today_vs_yesterday, last7days_vs_previous7, last30days_vs_previous30 }
 */
export async function getInboxPercentages(userId, userRole) {
    const now = dayjs();

    // Aujourd'hui vs Hier
    const todayStart = now.startOf('day');
    const todayEnd = now.endOf('day');
    const yesterdayStart = now.subtract(1, 'day').startOf('day');
    const yesterdayEnd = now.subtract(1, 'day').endOf('day');

    const [todayCount, yesterdayCount] = await Promise.all([
        countSubmissionsInRange(userId, userRole, todayStart.toDate(), todayEnd.toDate()),
        countSubmissionsInRange(userId, userRole, yesterdayStart.toDate(), yesterdayEnd.toDate()),
    ]);

    const todayVsYesterday = yesterdayCount === 0 ? 100 : ((todayCount - yesterdayCount) / yesterdayCount) * 100;

    // 7 derniers jours vs 7 jours précédents
    const last7Start = now.subtract(6, 'day').startOf('day');
    const last7End = now.endOf('day');
    const prev7Start = now.subtract(13, 'day').startOf('day');
    const prev7End = now.subtract(7, 'day').endOf('day');

    const [last7Count, prev7Count] = await Promise.all([
        countSubmissionsInRange(userId, userRole, last7Start.toDate(), last7End.toDate()),
        countSubmissionsInRange(userId, userRole, prev7Start.toDate(), prev7End.toDate()),
    ]);

    const last7VsPrev7 = prev7Count === 0 ? 100 : ((last7Count - prev7Count) / prev7Count) * 100;

    // 30 derniers jours vs 30 jours précédents
    const last30Start = now.subtract(29, 'day').startOf('day');
    const last30End = now.endOf('day');
    const prev30Start = now.subtract(59, 'day').startOf('day');
    const prev30End = now.subtract(30, 'day').endOf('day');

    const [last30Count, prev30Count] = await Promise.all([
        countSubmissionsInRange(userId, userRole, last30Start.toDate(), last30End.toDate()),
        countSubmissionsInRange(userId, userRole, prev30Start.toDate(), prev30End.toDate()),
    ]);

    const last30VsPrev30 = prev30Count === 0 ? 100 : ((last30Count - prev30Count) / prev30Count) * 100;

    return {
        today_vs_yesterday: Math.round(todayVsYesterday * 10) / 10,
        last7days_vs_previous7: Math.round(last7VsPrev7 * 10) / 10,
        last30days_vs_previous30: Math.round(last30VsPrev30 * 10) / 10,
        counts: {
            today: todayCount,
            yesterday: yesterdayCount,
            last7days: last7Count,
            previous7days: prev7Count,
            last30days: last30Count,
            previous30days: prev30Count,
        },
    };
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

    return { labels, data };
}

/**
 * Générer la heatmap des inbox (jour de semaine x heure)
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @param {number} days - Nombre de jours (7, 30, 90, 180)
 * @returns {Promise<Object>} - { hours: [], series: [{ name, data }] }
 */
export async function getInboxHeatmap(userId, userRole, days = 7) {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const siteWhere = userRole === 'super_admin' ? null : { fk_id_user: userId };

    const includeOptions = {
        model: models.Form,
        as: 'form',
        attributes: [],
        include: [
            {
                model: models.Site,
                as: 'site',
                attributes: [],
            },
        ],
    };

    // Ajouter le filtre WHERE seulement si nécessaire (pas super_admin)
    if (siteWhere) {
        includeOptions.include[0].where = siteWhere;
    }

    const inboxRows = await models.Inbox.findAll({
        where: {
            createdAt: {
                [Op.gte]: start,
                [Op.lte]: end,
            },
        },
        include: [includeOptions],
    });

    // Préparer matrice 7x24 (Lundi..Dimanche, heures 00..23)
    const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const hours = Array.from({ length: 24 }, (_, i) => (i === 0 ? '00' : String(i)));
    const matrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));

    (inboxRows || []).forEach((r) => {
        const created = dayjs(r.createdAt);
        // day() -> 0 (Sunday) .. 6 (Saturday); on veut Monday=0 .. Sunday=6
        const dow = created.day();
        const mondayIndex = (dow + 6) % 7;
        const h = created.hour(); // 0..23
        if (matrix[mondayIndex] && typeof matrix[mondayIndex][h] !== 'undefined') {
            matrix[mondayIndex][h]++;
        }
    });

    let series = daysOfWeek.map((d, i) => ({
        name: d,
        data: hours.map((h, j) => ({ x: h, y: matrix[i][j] })),
    }));

    series = series.reverse();

    return { hours, series };
}

/**
 * Calculer les pourcentages de variation avec format complet
 * @param {number} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Object>} - { today: { current, previous, percent, trend }, ... }
 */
export async function getInboxPercentagesDetailed(userId, userRole) {
    const now = dayjs();

    // Aujourd'hui vs Hier
    const todayStart = now.startOf('day');
    const todayEnd = now.endOf('day');
    const yesterdayStart = now.subtract(1, 'day').startOf('day');
    const yesterdayEnd = now.subtract(1, 'day').endOf('day');

    const [todayCount, yesterdayCount] = await Promise.all([
        countSubmissionsInRange(userId, userRole, todayStart.toDate(), todayEnd.toDate()),
        countSubmissionsInRange(userId, userRole, yesterdayStart.toDate(), yesterdayEnd.toDate()),
    ]);

    // 7 derniers jours vs 7 jours précédents
    const last7Start = now.subtract(6, 'day').startOf('day');
    const last7End = now.endOf('day');
    const prev7Start = now.subtract(13, 'day').startOf('day');
    const prev7End = now.subtract(7, 'day').endOf('day');

    const [last7Count, prev7Count] = await Promise.all([
        countSubmissionsInRange(userId, userRole, last7Start.toDate(), last7End.toDate()),
        countSubmissionsInRange(userId, userRole, prev7Start.toDate(), prev7End.toDate()),
    ]);

    // 30 derniers jours vs 30 jours précédents
    const last30Start = now.subtract(29, 'day').startOf('day');
    const last30End = now.endOf('day');
    const prev30Start = now.subtract(59, 'day').startOf('day');
    const prev30End = now.subtract(30, 'day').endOf('day');

    const [last30Count, prev30Count] = await Promise.all([
        countSubmissionsInRange(userId, userRole, last30Start.toDate(), last30End.toDate()),
        countSubmissionsInRange(userId, userRole, prev30Start.toDate(), prev30End.toDate()),
    ]);

    const computePercent = (current, previous) => {
        if (previous === 0) {
            if (current === 0) {
                return { percent: 0, trend: 'neutral' };
            }
            return { percent: 100, trend: 'up' };
        }
        const change = Math.round(((current - previous) / previous) * 100);
        if (change > 0) {
            return { percent: Math.abs(change), trend: 'up' };
        }
        if (change < 0) {
            return { percent: Math.abs(change), trend: 'down' };
        }
        return { percent: 0, trend: 'neutral' };
    };

    const today = { current: todayCount, previous: yesterdayCount, ...computePercent(todayCount, yesterdayCount) };
    const last7 = { current: last7Count, previous: prev7Count, ...computePercent(last7Count, prev7Count) };
    const last30 = { current: last30Count, previous: prev30Count, ...computePercent(last30Count, prev30Count) };

    return { today, last7, last30 };
}
