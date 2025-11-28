import dayjs from 'dayjs';
import { Op } from 'sequelize';
import { getSitesWithCounts, getGlobalStats } from '../helpers/site.helpers.js';
import models from '../models/index.js';

/**
 * Redirection root vers dashboard
 */
export const rootRedirect = (req, res) => {
    return res.redirect('/dashboard');
};

/**
 * Dashboard principal
 */
export const dashboard = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const sitesWithCounts = await getSitesWithCounts(userId);

        res.render('dashboard', {
            stats: getGlobalStats(sitesWithCounts)
        });
    } catch (err) {
        res.render('dashboard', {});
    }
};

/**
 * Top 5 des formulaires par nombre d'entrées
 */
export const getTopFroms = async (req, res) => {
    const userId = req.session.user?.id;
    const daysRaw = parseInt(req.query.days, 10) || 7;
    const days = [7, 30].includes(daysRaw) ? daysRaw : 7;

    try {
        const end = dayjs().endOf('day');
        const start = dayjs().startOf('day').subtract(days - 1, 'day');

        // Raw SQL for stable grouping and joins
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

        const replacements = {
            userId,
            start: start.toDate(),
            end: end.toDate()
        };

        const rows = await models.sequelize.query(sql, {
            replacements,
            type: models.Sequelize.QueryTypes.SELECT
        });

        // Ensure result has exactly up to 3 entries with rank
        const result = (rows || []).map((r, idx) => ({
            rank: idx + 1,
            form_name: r.form_name || null,
            site_domain: r.site_domain || null,
            count: Number(r.cnt) || 0
        }));

        return res.json({ days, items: result });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Top site avec répartition des formulaires (90 jours)
 */
export const getTopSiteForms = async (req, res) => {
    const userId = req.session.user?.id;
    // Fixed to 90 days per request
    const days = 90;

    try {
        const end = dayjs().endOf('day');
        const start = dayjs().startOf('day').subtract(days - 1, 'day');

        // Find the site with most inbox rows in the period
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
            type: models.Sequelize.QueryTypes.SELECT
        });

        if (!topSiteRows || !topSiteRows.length) {
            return res.json({ site: null, labels: [], series: [] });
        }

        const topSite = topSiteRows[0];
        const siteId = topSite.site_id;

        // For that site, compute counts per form
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
            type: models.Sequelize.QueryTypes.SELECT
        });

        const labels = (perFormRows || []).map(r => r.form_name || `form-${r.form_id}`);
        const series = (perFormRows || []).map(r => Number(r.cnt) || 0);

        return res.json({
            site: {
                id: siteId,
                domain: topSite.site_domain,
                total: Number(topSite.total) || 0
            },
            labels,
            series
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Comptage des inbox par jour
 */
export const getInboxCounts = async (req, res) => {
    const userId = req.session.user?.id;
    const daysRaw = parseInt(req.query.days, 10) || 7;
    const days = [7, 30].includes(daysRaw) ? daysRaw : 7;

    try {
        const end = dayjs().endOf('day');
        const start = dayjs().startOf('day').subtract(days - 1, 'day');

        // Build day labels from start to end
        const labels = [];
        for (let i = 0; i < days; i++) {
            const dt = dayjs(start).add(i, 'day');
            labels.push(dt.format('YYYY-MM-DD'));
        }

        // Aggregated raw SQL for counts per day
        const sql = `
			SELECT DATE(i.createdAt) AS day_str, COUNT(i.id) AS cnt
			FROM inbox i
			JOIN form f ON f.id = i.fk_id_form
			JOIN site s ON s.id = f.fk_id_site
			WHERE s.fk_id_user = :userId
			  AND i.createdAt BETWEEN :start AND :end
			GROUP BY DATE(i.createdAt)
		`;

        const replacements = {
            userId,
            start: start.toDate(),
            end: end.toDate()
        };

        const rows = await models.sequelize.query(sql, {
            replacements,
            type: models.Sequelize.QueryTypes.SELECT
        });

        // Map into a dict for quick access
        const countMap = {};
        rows.forEach(r => {
            const dayStr = dayjs(r.day_str).format('YYYY-MM-DD');
            countMap[dayStr] = Number(r.cnt) || 0;
        });

        // Fill data
        const data = labels.map(label => countMap[label] || 0);

        return res.json({ labels, data, days });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Pourcentages des inbox (today vs yesterday, 7 jours, 30 jours)
 */
export const getInboxPercentages = async (req, res) => {
    const userId = req.session.user?.id;

    try {
        // Helper to count inbox items in a date range filtered by user's sites
        const countInRange = async (start, end) => {
            return await models.Inbox.count({
                where: {
                    createdAt: {
                        [Op.gte]: start.toDate(),
                        [Op.lte]: end.toDate()
                    }
                },
                include: [{
                    model: models.Form,
                    as: 'form',
                    include: [{
                        model: models.Site,
                        as: 'site',
                        where: { fk_id_user: userId }
                    }]
                }]
            });
        };

        // Today vs Yesterday
        const todayStart = dayjs().startOf('day');
        const todayEnd = dayjs().endOf('day');
        const yesterdayStart = dayjs().subtract(1, 'day').startOf('day');
        const yesterdayEnd = dayjs().subtract(1, 'day').endOf('day');

        const todayCount = await countInRange(todayStart, todayEnd);
        const yesterdayCount = await countInRange(yesterdayStart, yesterdayEnd);

        // Last 7 days vs previous 7 days
        const end7 = dayjs().endOf('day');
        const start7 = dayjs().startOf('day').subtract(6, 'day');
        const prev7Start = start7.subtract(7, 'day');
        const prev7End = start7.subtract(1, 'day').endOf('day');

        const last7Count = await countInRange(start7, end7);
        const prev7Count = await countInRange(prev7Start, prev7End);

        // Last 30 days vs previous 30 days
        const end30 = dayjs().endOf('day');
        const start30 = dayjs().startOf('day').subtract(29, 'day');
        const prev30Start = start30.subtract(30, 'day');
        const prev30End = start30.subtract(1, 'day').endOf('day');

        const last30Count = await countInRange(start30, end30);
        const prev30Count = await countInRange(prev30Start, prev30End);

        const computePercent = (current, previous) => {
            if (previous === 0) {
                if (current === 0) { return { percent: 0, trend: 'neutral' }; }
                return { percent: 100, trend: 'up' };
            }
            const change = Math.round(((current - previous) / previous) * 100);
            if (change > 0) { return { percent: Math.abs(change), trend: 'up' }; }
            if (change < 0) { return { percent: Math.abs(change), trend: 'down' }; }
            return { percent: 0, trend: 'neutral' };
        };

        const today = { current: todayCount, previous: yesterdayCount, ...computePercent(todayCount, yesterdayCount) };
        const last7 = { current: last7Count, previous: prev7Count, ...computePercent(last7Count, prev7Count) };
        const last30 = { current: last30Count, previous: prev30Count, ...computePercent(last30Count, prev30Count) };

        return res.json({ today, last7, last30 });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Comptage des inbox par site
 */
export const getInboxCountsBySite = async (req, res) => {
    const userId = req.session.user?.id;

    try {
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
            type: models.Sequelize.QueryTypes.SELECT
        });

        const labels = (rows || []).map(r => r.site_domain);
        const data = (rows || []).map(r => Number(r.cnt) || 0);

        return res.json({ labels, data });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Heatmap des inbox
 */
export const getInboxHeatmap = async (req, res) => {
    const userId = req.session.user?.id;
    const daysRaw = parseInt(req.query.days, 10) || 7;
    const days = [7, 30, 90, 180].includes(daysRaw) ? daysRaw : 7;

    try {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - (days - 1));

        const inboxRows = await models.Inbox.findAll({
            where: {
                createdAt: {
                    [Op.gte]: start,
                    [Op.lte]: end
                }
            },
            include: [{
                model: models.Form,
                as: 'form',
                include: [{
                    model: models.Site,
                    as: 'site',
                    where: { fk_id_user: userId }
                }]
            }]
        });

        // Prepare a 7x24 matrix (Monday..Sunday, hours 00..23)
        const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
        // Hours labels: '00', '1', '2', ..., '23' so midnight is clearly represented as '00'
        const hours = Array.from({ length: 24 }, (_, i) => (i === 0 ? '00' : String(i)));
        const matrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));

        (inboxRows || []).forEach((r) => {
            const created = dayjs(r.createdAt);
            // day() -> 0 (Sunday) .. 6 (Saturday); we want Monday=0 .. Sunday=6
            const dow = created.day();
            const mondayIndex = (dow + 6) % 7;
            const h = created.hour(); // 0..23
            const idx = h; // column index matches hour (00->0, 23->23)
            if (matrix[mondayIndex] && typeof matrix[mondayIndex][idx] !== 'undefined') {
                matrix[mondayIndex][idx]++;
            }
        });

        let series = daysOfWeek.map((d, i) => ({
            name: d,
            data: hours.map((h, j) => ({ x: h, y: matrix[i][j] }))
        }));

        series = series.reverse();

        return res.json({ hours, series });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Dernière entrée inbox
 */
export const getLastInboxEntry = async (req, res) => {
    const userId = req.session.user?.id;

    try {
        const lastRow = await models.Inbox.findOne({
            include: [{
                model: models.Form,
                as: 'form',
                include: [{
                    model: models.Site,
                    as: 'site',
                    where: { fk_id_user: userId }
                }]
            }],
            order: [['createdAt', 'DESC']]
        });

        if (!lastRow) {
            return res.json({ date: null, time: null });
        }

        const dt = dayjs(lastRow.createdAt);
        const date = dt.format('YYYY-MM-DD');
        const time = dt.format('HH:mm');

        return res.json({ date, time });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Page d'erreur
 */
export const error = async (req, res) => {
    res.render('errors/generic', {
        layout: false,
    });
};

/**
 * Page de login
 */
export const dpLogin = (req, res) => {
    res.render('auth/login', {
        layout: 'auth'
    });
};

/**
 * Page de première connexion
 */
export const dpFirstCo = (req, res) => {
    res.render('auth/first-login', {
        layout: 'auth'
    });
};

/**
 * Liste de tous les sites (page)
 */
export const allSite = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const sitesWithCounts = await getSitesWithCounts(userId);

        res.render('sites/list', {
            sites: sitesWithCounts
        });
    } catch (err) {
        res.render('sites/list', {});
    }
};
