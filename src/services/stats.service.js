/**
 * Service de statistiques
 * Gère les calculs de statistiques pour le dashboard
 */

import dayjs from 'dayjs';
import { Op } from 'sequelize';
import { Inbox, Form, Site, sequelize, Sequelize } from '../models/index.js';

/**
 * Récupérer les statistiques globales d'un utilisateur
 * @param {number} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Object>} - Statistiques (sites, forms, submissions, etc.)
 */
export async function getGlobalStats(userId, userRole) {
    const siteWhere = userRole === 'super_admin' ? {} : { fk_id_user: userId };

    const [sitesCount, formsCount, submissionsCount] = await Promise.all([
        Site.count({ where: siteWhere }),
        Form.count({
            include: [
                {
                    model: Site,
                    as: 'site',
                    where: siteWhere,
                    attributes: [],
                },
            ],
        }),
        Inbox.count({
            include: [
                {
                    model: Form,
                    as: 'form',
                    include: [
                        {
                            model: Site,
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

    const rows = await sequelize.query(sql, {
        replacements: {
            userId,
            start: start.toDate(),
            end: end.toDate(),
        },
        type: Sequelize.QueryTypes.SELECT,
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

    const topSiteRows = await sequelize.query(sqlTopSite, {
        replacements: { userId, start: start.toDate(), end: end.toDate() },
        type: Sequelize.QueryTypes.SELECT,
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

    const perFormRows = await sequelize.query(sqlPerForm, {
        replacements: { siteId, start: start.toDate(), end: end.toDate() },
        type: Sequelize.QueryTypes.SELECT,
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

    const rows = await sequelize.query(sql, {
        replacements: {
            userId,
            start: start.toDate(),
            end: end.toDate(),
        },
        type: Sequelize.QueryTypes.SELECT,
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

    return await Inbox.count({
        where: {
            createdAt: {
                [Op.gte]: startDate,
                [Op.lte]: endDate,
            },
        },
        include: [
            {
                model: Form,
                as: 'form',
                include: [
                    {
                        model: Site,
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

    const sites = await Site.findAll({
        where: siteWhere,
        attributes: ['id', 'name', 'domain'],
        include: [
            {
                model: Form,
                as: 'forms',
                attributes: ['id'],
                include: [
                    {
                        model: Inbox,
                        as: 'inboxes',
                        attributes: ['id'],
                    },
                ],
            },
        ],
    });

    return sites.map((site) => {
        const siteData = site.toJSON();
        const formsCount = siteData.forms?.length || 0;
        const submissionsCount = siteData.forms?.reduce((sum, form) => sum + (form.inboxes?.length || 0), 0) || 0;

        return {
            id: siteData.id,
            name: siteData.name,
            domain: siteData.domain,
            formsCount,
            submissionsCount,
        };
    });
}
