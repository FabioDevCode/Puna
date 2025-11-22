import fs from 'node:fs';
import path from 'node:path';
import dayjs from 'dayjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { getSitesWithCounts, getGlobalStats } from '../helpers/site.helpers.js';
import models from '../models/index.js';
import { encryptObject } from '../utils/crypto.js';
import stringUtils from '../utils/string.js';


export const rootRedirect = (req, res) => {
    return res.redirect('/dashboard');
};

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

        return res.json({ site: { id: siteId, domain: topSite.site_domain, total: Number(topSite.total) || 0 }, labels, series });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
};

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

export const error = async (req, res) => {
    res.render('error', {
        layout: false,
    });
};

export const dpLogin = (req, res) => {
    res.render('login', {
        layout: 'login'
    });
};

export const dpFirstCo = (req, res) => {
    res.render('first_co', {
        layout: 'login'
    });
};

export const createSite = async (req, res) => {
    const { domain } = req.body;
    const userId = req.session.user?.id;
    try {
        const site = await models.Site.create({
            domain,
            fk_id_user: userId,
            control_code: stringUtils.generateCode(16)
        });
        return res.redirect(`/site/${site.id}`);
    } catch (err) {
        return res.redirect('/error');
    }
};

export const showSite = async (req, res) => {
    const siteId = req.params.id;
    try {
        const site = await models.Site.findByPk(siteId, { raw: true });

        if (!site) {
            throw new Error('error');
        }

        const userId = req.session.user?.id;
        if (site.fk_id_user !== userId) {
            return res.redirect('/dashboard');
        }

        const formsRaw = await models.Form.findAll({
            where: { fk_id_site: siteId },
            raw: true,
            order: [['createdAt', 'ASC']]
        });

        const forms = (formsRaw || []).map((f) => {
            let templateObj = {};
            try {
                if (f.template) {
                    templateObj = typeof f.template === 'string' ? JSON.parse(f.template) : f.template;
                }
            } catch (e) {
                templateObj = {};
            }

            const template_entries = Object.keys(templateObj || {}).map((k) => ({ key: k, value: templateObj[k] }));

            return {
                ...f,
                templateObj,
                template_entries
            };
        });

        // Determine which form should be active: allow override via query param `f` (form name)
        // or fallback to `active_form` (form id)
        const activeFormQueryId = req.query && req.query.active_form ? String(req.query.active_form) : null;
        const activeFormQueryName = req.query && req.query.f ? String(req.query.f) : null;
        let activeForm = null;
        if (forms && forms.length) {
            // mark each form with is_active based on query param or default to first
            let found = false;
            forms.forEach((f, _) => {
                // Priority: query by name `f` if provided, then by id `active_form`
                if (activeFormQueryName && String(f.name) === activeFormQueryName) {
                    f.is_active = true;
                    activeForm = f;
                    found = true;
                } else if (!found && activeFormQueryId && String(f.id) === activeFormQueryId) {
                    f.is_active = true;
                    activeForm = f;
                    found = true;
                } else {
                    f.is_active = false;
                }
            });
            if (!found) {
                forms[0].is_active = true;
                activeForm = forms[0];
            }
        }
        res.render('site_show', {
            site,
            forms,
            activeForm
        });
    } catch (err) {
        res.redirect('/dashboard');
    }
};

export const deleteSite = async (req, res) => {
    const siteId = req.params.id;
    const { confirm_domain } = req.body;
    try {
        const site = await models.Site.findByPk(siteId);

        if (!site) {
            throw new Error('error');
        }

        if (site.domain === confirm_domain.trim()) {
            await models.Form.destroy({ where: { fk_id_site: siteId } });
            await site.destroy();
            return res.redirect('/all-site');
        } else {
            return res.redirect(`/site/${siteId}`);
        }
    } catch (err) {
        return res.redirect('/dashboard');
    }
};

export const createForm = async (req, res) => {
    const { name, fk_id_site } = req.body;
    const userId = req.session.user?.id;

    try {
        // Verify site exists and belongs to current user
        const site = await models.Site.findByPk(fk_id_site);
        if (!site || site.fk_id_user !== userId) {
            return res.redirect('/dashboard');
        }

        const code = stringUtils.generateCode(10);

        await models.Form.create({ name, fk_id_site, code });

        return res.redirect(`/site/${fk_id_site}`);
    } catch (err) {
        return res.redirect('/error');
    }
};

export const deleteForm = async (req, res) => {
    const { form_id } = req.body;
    const userId = req.session.user?.id;

    try {
        const form = await models.Form.findByPk(form_id);
        if (!form) {return res.redirect('/dashboard');}

        // get site id and verify ownership
        const site = await models.Site.findByPk(form.fk_id_site);
        if (!site || site.fk_id_user !== userId) {return res.redirect('/dashboard');}

        const siteId = site.id;
        await form.destroy();

        return res.redirect(`/site/${siteId}`);
    } catch (err) {
        return res.redirect('/error');
    }
};

export const updateFormTemplateSave = async (req, res) => {
    const formId = req.params.id;
    const userId = req.session.user?.id;

    try {
        const form = await models.Form.findByPk(formId);
        if (!form) {return res.redirect('/dashboard');}

        const site = await models.Site.findByPk(form.fk_id_site);
        if (!site || site.fk_id_user !== userId) {return res.redirect('/dashboard');}

        // Expecting nested fields in req.body.template (e.g. template[fieldName]=New label)
        const newTemplate = req.body?.template || {};

        // Ensure object
        const templateObj = typeof newTemplate === 'object' ? newTemplate : {};

        form.template = JSON.stringify(templateObj);
        await form.save();

        return res.redirect(`/site/${form.fk_id_site}?f=${form.name}`);
    } catch (err) {
        return res.redirect('/error');
    }
};

export const getFormInbox = async (req, res) => {
    const formId = req.params.id;
    const userId = req.session.user?.id;

    try {
        const form = await models.Form.findByPk(formId);
        if (!form) {return res.status(404).json({ error: 'Form not found' });}

        const site = await models.Site.findByPk(form.fk_id_site);
        if (!site || site.fk_id_user !== userId) {return res.status(403).json({ error: 'Forbidden' });}

        // Server-side pagination: accept ?limit=..&offset=..
        const limitRaw = parseInt(req.query.limit, 10);
        const offsetRaw = parseInt(req.query.offset, 10);
        const allowedLimits = [10, 25, 50, 100];
        const limit = allowedLimits.includes(limitRaw) ? limitRaw : 10;
        const offset = !Number.isNaN(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

        // support JSON filters passed as query param 'filters' (JSON encoded object)
        let whereClause = { fk_id_form: formId };
        try {
            if (req.query && req.query.filters) {
                const parsed = JSON.parse(req.query.filters);
                if (parsed && typeof parsed === 'object' && Object.keys(parsed).length) {
                    const conditions = [];
                    const Sequelize = models.Sequelize;
                    for (const [k, v] of Object.entries(parsed)) {
                        if (v === null || typeof v === 'undefined' || String(v).trim() === '') {continue;}
                        if (k === 'createdAt') {
                            // filter by date (YYYY-MM-DD) on createdAt using DATE(createdAt) = 'YYYY-MM-DD'
                            conditions.push(Sequelize.where(Sequelize.fn('DATE', Sequelize.col('createdAt')), String(v)));
                        } else {
                            // contains match on JSON stringified field
                            const Op = Sequelize.Op;
                            const expr = Sequelize.where(
                                Sequelize.fn('JSON_UNQUOTE', Sequelize.fn('JSON_EXTRACT', Sequelize.col('content'), Sequelize.literal(`'$.${k}'`))),
                                { [Op.like]: `%${String(v)}%` }
                            );
                            conditions.push(expr);
                        }
                    }
                    if (conditions.length) {
                        const Op = Sequelize.Op;
                        whereClause = { [Op.and]: [ { fk_id_form: formId }, ...conditions ] };
                    }
                }
            }
        } catch (e) {
            // ignore malformed filters and fallback to no filter
            whereClause = { fk_id_form: formId };
        }

        const result = await models.Inbox.findAndCountAll({
            where: whereClause,
            order: [['createdAt', 'DESC']],
            limit,
            offset,
            raw: true
        });

        const rows = result.rows || [];
        const total = typeof result.count === 'number' ? result.count : (result.count || 0);

        const items = (rows || []).map((r) => {
            let parsed = null;
            try {
                parsed = typeof r.content === 'string' ? JSON.parse(r.content) : r.content;
            } catch (e) {
                parsed = null;
            }
            return {
                id: r.id,
                content: parsed,
                createdAt: r.createdAt
            };
        });

        return res.json({ items, total });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
};

export const updateFormColumns = async (req, res) => {
    const formId = req.params.id;
    const userId = req.session.user?.id;
    try {
        const form = await models.Form.findByPk(formId);
        if (!form) {return res.status(404).json({ error: 'Form not found' });}

        const site = await models.Site.findByPk(form.fk_id_site);
        if (!site || site.fk_id_user !== userId) {return res.status(403).json({ error: 'Forbidden' });}

        // Expect JSON body { columns: { key1: true, key2: false, ... } }
        let cols = req.body && req.body.columns ? req.body.columns : null;
        if (typeof cols === 'string') {
            try { cols = JSON.parse(cols); } catch (e) { cols = null; }
        }

        // If cols is not an object, reject
        if (!cols || typeof cols !== 'object') {
            return res.status(400).json({ error: 'Invalid columns payload' });
        }

        form.columns = JSON.stringify(cols);
        await form.save();

        return res.json({ success: true, columns: cols });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const getInboxCounts = async (req, res) => {
    const userId = req.session.user?.id;
    const daysRaw = parseInt(req.query.days, 10) || 7;
    const days = [7, 30].includes(daysRaw) ? daysRaw : 7;

    try {
        // Use dayjs to compute start/end (local day boundaries) and labels
        const end = dayjs().endOf('day');
        const start = dayjs().startOf('day').subtract(days - 1, 'day');

        // fetch Inbox rows linked to forms/sites owned by the user
        const inboxRows = await models.Inbox.findAll({
            where: {
                createdAt: {
                    [Op.gte]: start.toDate(),
                    [Op.lte]: end.toDate()
                }
            },
            attributes: ['id', 'createdAt'],
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

        // prepare labels (dates) and initialize counts to 0 using dayjs local dates
        const labels = [];
        const countsMap = {};

        for (let i = 0; i < days; i++) {
            const d = start.add(i, 'day');
            const key = d.format('YYYY-MM-DD');
            labels.push(key);
            countsMap[key] = 0;
        }

        // aggregate counts per day from fetched rows (use same local format)
        (inboxRows || []).forEach((r) => {
            const key = dayjs(r.createdAt).format('YYYY-MM-DD');
            if (countsMap[key] !== undefined) {countsMap[key]++;}
        });

        const data = labels.map((l) => countsMap[l] || 0);

        return res.json({ labels, data });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
};

export const getInboxPercentages = async (req, res) => {
    const userId = req.session.user?.id;

    try {
        // helper to count inbox items in a date range filtered by user's sites
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
        const start7 = dayjs().startOf('day').subtract(6, 'day'); // inclusive 7 days window
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
                if (current === 0) {return { percent: 0, trend: 'neutral' };}
                return { percent: 100, trend: 'up' };
            }
            const change = Math.round(((current - previous) / previous) * 100);
            if (change > 0) {return { percent: Math.abs(change), trend: 'up' };}
            if (change < 0) {return { percent: Math.abs(change), trend: 'down' };}
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

export const getInboxCountsBySite = async (req, res) => {
    const userId = req.session.user?.id;

    try {
        // fetch Inbox rows linked to forms/sites owned by the user
        const inboxRows = await models.Inbox.findAll({
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

        // aggregate counts per site
        const countsMap = {};
        const labelsMap = {};

        (inboxRows || []).forEach((r) => {
            const site = r.form && r.form.site ? r.form.site : null;
            if (!site) {return;}
            const key = String(site.id);
            countsMap[key] = (countsMap[key] || 0) + 1;
            // Use domain if available, otherwise a fallback label
            labelsMap[key] = site.domain || `site-${site.id}`;
        });

        // prepare arrays for labels and data (preserve stable order: descending by count)
        const entries = Object.keys(countsMap).map((k) => ({ id: k, label: labelsMap[k], count: countsMap[k] }));
        entries.sort((a, b) => b.count - a.count);

        const labels = entries.map((e) => e.label);
        const data = entries.map((e) => e.count);

        return res.json({ labels, data });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
};

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
        const hours = Array.from({ length:24 }, (_, i) => (i === 0 ? '00' : String(i)));
        const matrix = Array.from({ length:7 }, () => Array.from({ length:24 }, () => 0));

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

export const getSiteToken = async (req, res) => {
    const siteId = req.params.id;
    const userId = req.session.user?.id;

    try {
        const site = await models.Site.findByPk(siteId);
        if (!site) {return res.status(404).json({ error: 'Site not found' });}
        if (site.fk_id_user !== userId) {return res.status(403).json({ error: 'Forbidden' });}

        // load key from env or config file
        let secret = process.env.KEY_TK;
        if (!secret) {
            const keysPath = path.resolve('src/config/keys.json');
            if (fs.existsSync(keysPath)) {
                const raw = fs.readFileSync(keysPath, 'utf8');
                const cfg = JSON.parse(raw);
                secret = cfg.KEY_TK;
            }
        }

        if (!secret) {return res.status(500).json({ error: 'Server key not configured' });}

        const payload = {
            data: encryptObject({
                id: site.id,
                control_code: site.control_code
            })
        };

        const token = jwt.sign(payload, secret);

        return res.json({ token });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

export const revokeSiteTokens = async (req, res) => {
    const siteId = req.params.id;
    const userId = req.session.user?.id;

    try {
        const site = await models.Site.findByPk(siteId);
        if (!site) {return res.status(404).json({ error: 'Site not found' });}
        if (site.fk_id_user !== userId) {return res.status(403).json({ error: 'Forbidden' });}

        const newCode = stringUtils.generateCode(16);
        site.control_code = newCode;
        await site.save();

        return res.json({ success: true, control_code: newCode });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
};

export const allSite = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const sitesWithCounts = await getSitesWithCounts(userId);

        res.render('site_list', {
            sites: sitesWithCounts
        });
    } catch (err) {
        res.render('site_list', {});
    }
};

