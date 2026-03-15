import { errorLogger } from '../config/logger.js';
import models from '../models/index.js';
import {
    getSitesWithCounts,
    getGlobalStatsFromSites,
    getTopForms,
    getTopSiteWithForms,
    getInboxCountsByDay,
    getInboxPercentagesDetailed,
    getInboxCountsBySite as getInboxCountsBySiteService,
    getInboxHeatmap as getInboxHeatmapService,
} from '../services/stats.service.js';

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
        const userRole = req.userRole || req.session.user?.role || 'viewer';
        const sitesWithCounts = await getSitesWithCounts(userId, userRole);

        const show2FABannerBase = process.env.TOTP_ENABLED === 'true' && req.session.user && !req.session.dismissed2FABanner;

        let userHas2FA = false;
        if (show2FABannerBase) {
            const dbUser = await models.User.findByPk(req.session.user.id, {
                attributes: ['totp_enabled'],
            });
            userHas2FA = dbUser?.totp_enabled || false;
        }

        res.render('dashboard', {
            stats: getGlobalStatsFromSites(sitesWithCounts),
            show2FABanner: show2FABannerBase && !userHas2FA,
        });
    } catch (err) {
        console.error(err);
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
        const items = await getTopForms(userId, days);
        return res.json({ days, items });
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'getTopFroms error');
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Top site avec répartition des formulaires (90 jours)
 */
export const getTopSiteForms = async (req, res) => {
    const userId = req.session.user?.id;
    const days = 90;

    try {
        const result = await getTopSiteWithForms(userId, days);
        return res.json(result);
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'getTopSiteForms error');
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
        const result = await getInboxCountsByDay(userId, days);
        return res.json({ ...result, days });
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'getInboxCounts error');
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Pourcentages des inbox (today vs yesterday, 7 jours, 30 jours)
 */
export const getInboxPercentages = async (req, res) => {
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';

    try {
        const result = await getInboxPercentagesDetailed(userId, userRole);
        return res.json(result);
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'getInboxPercentages error');
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Comptage des inbox par site
 */
export const getInboxCountsBySite = async (req, res) => {
    const userId = req.session.user?.id;

    try {
        const result = await getInboxCountsBySiteService(userId);
        return res.json(result);
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'getInboxCountsBySite error');
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Heatmap des inbox
 */
export const getInboxHeatmap = async (req, res) => {
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';
    const daysRaw = parseInt(req.query.days, 10) || 7;
    const days = [7, 30, 90, 180].includes(daysRaw) ? daysRaw : 7;

    try {
        const result = await getInboxHeatmapService(userId, userRole, days);
        return res.json(result);
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'getInboxHeatmap error');
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
        layout: 'auth',
    });
};

/**
 * Page de première connexion
 */
export const dpFirstCo = (req, res) => {
    res.render('auth/first-login', {
        layout: 'auth',
    });
};
