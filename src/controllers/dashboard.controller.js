import { errorLogger } from '../config/logger.js';
import models from '../models/index.js';
import {
    getSitesWithCounts,
    getGlobalStatsFromSites,
    getTopForms,
    getInboxCountsByDay,
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

        const show2FABannerBase = process.env.TOTP_ENABLED === 'true' && req.session.user;

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
        errorLogger.error(err);
        res.render('dashboard', {});
    }
};

/**
 * Top 5 des formulaires par nombre d'entrées
 */
export const getTopFroms = async (req, res) => {
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';
    const daysRaw = parseInt(req.query.days, 10) || 7;
    const days = [7, 30].includes(daysRaw) ? daysRaw : 7;

    try {
        const items = await getTopForms(userId, userRole, days);
        return res.json({ days, items });
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'getTopFroms error');
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Comptage des inbox par jour
 */
export const getInboxCounts = async (req, res) => {
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';
    const daysRaw = parseInt(req.query.days, 10) || 7;
    const days = [7, 30].includes(daysRaw) ? daysRaw : 7;

    try {
        const result = await getInboxCountsByDay(userId, userRole, days);
        return res.json({ ...result, days });
    } catch (err) {
        errorLogger.error({ err, userId: req.session?.user?.id }, 'getInboxCounts error');
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Comptage des inbox par site
 */
export const getInboxCountsBySite = async (req, res) => {
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';

    try {
        const result = await getInboxCountsBySiteService(userId, userRole);
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
    const days = [7, 30].includes(daysRaw) ? daysRaw : 7;

    try {
        const locale = req.session.user?.locale || 'fr';
        const result = await getInboxHeatmapService(userId, userRole, days, locale);
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
