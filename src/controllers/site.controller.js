import {
    createSite as createSiteService,
    getSiteWithForms,
    deleteSiteWithForms,
    generateSiteToken,
    revokeSiteTokens as revokeSiteTokensService,
    domainExists,
} from '../services/site.service.js';
import { getSitesWithCounts } from '../services/stats.service.js';
import stringUtils from '../utils/string.js';
import { isValidDomain } from '../utils/validators.js';

/**
 * Liste de tous les sites (page)
 */
export const allSite = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const userRole = req.userRole || req.session.user?.role || 'viewer';
        const sitesWithCounts = await getSitesWithCounts(userId, userRole);

        res.render('sites/list', {
            sites: sitesWithCounts,
        });
    } catch (err) {
        console.error(err);
        res.render('sites/list', {});
    }
};

/**
 * Créer un site
 */
export const createSite = async (req, res) => {
    const { domain } = req.body;
    const userId = req.session.user?.id;

    // 1. Validation du format
    const domainCheck = isValidDomain(domain);
    if (!domainCheck.valid) {
        res.flash('error', res.__(domainCheck.error));
        return res.redirect('/site/all');
    }

    // 2. Vérification d'unicité
    try {
        const exists = await domainExists(domain.trim());
        if (exists) {
            res.flash('error', res.__('site.exists_error'));
            return res.redirect('/site/all');
        }

        const site = await createSiteService(
            {
                domain: domain.trim(),
                control_code: stringUtils.generateCode(16),
            },
            userId
        );
        res.flash('success', req.__('flash.site_created'));
        return res.redirect(`/site/${site.id}/view`);
    } catch (_err) {
        res.flash('error', req.__('flash.site_create_error'));
        return res.redirect('/site/all');
    }
};

/**
 * Afficher un site avec ses formulaires
 */
export const showSite = async (req, res) => {
    const siteId = req.params.id;
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';

    try {
        const activeFormQueryId = req.query && req.query.active_form ? String(req.query.active_form) : null;
        const activeFormQueryName = req.query && req.query.f ? String(req.query.f) : null;

        const data = await getSiteWithForms(siteId, userId, userRole, activeFormQueryId, activeFormQueryName);

        if (!data) {
            return res.redirect('/dashboard');
        }

        res.render('sites/show', {
            site: data.site,
            forms: data.forms,
            activeForm: data.activeForm,
        });
    } catch (_err) {
        res.redirect('/dashboard');
    }
};

/**
 * Supprimer un site
 */
export const deleteSite = async (req, res) => {
    const siteId = req.params.id;
    const { confirm_domain } = req.body;
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';

    try {
        const result = await deleteSiteWithForms(siteId, userId, userRole, confirm_domain);

        if (result.success) {
            res.flash('success', req.__('flash.site_deleted'));
            return res.redirect('/site/all');
        } else {
            res.flash('warning', result.error || req.__('flash.site_domain_mismatch'));
            return res.redirect(`/site/${siteId}/view`);
        }
    } catch (_err) {
        res.flash('error', req.__('flash.site_delete_error'));
        return res.redirect('/dashboard');
    }
};

/**
 * Obtenir le token d'un site
 */
export const getSiteToken = async (req, res) => {
    const siteId = req.params.id;
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';

    try {
        const result = await generateSiteToken(siteId, userId, userRole);

        if (result.success) {
            return res.json({ token: result.token });
        } else {
            const statusCode = result.error.includes('introuvable') ? 404 : result.error.includes('refusé') ? 403 : 500;
            return res.status(statusCode).json({ error: result.error });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

/**
 * Révoquer tous les tokens d'un site
 */
export const revokeSiteTokens = async (req, res) => {
    const siteId = req.params.id;
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';

    try {
        const result = await revokeSiteTokensService(siteId, userId, userRole);

        if (result.success) {
            return res.json({ success: true, control_code: result.control_code });
        } else {
            const statusCode = result.error.includes('introuvable') ? 404 : result.error.includes('refusé') ? 403 : 500;
            return res.status(statusCode).json({ error: result.error });
        }
    } catch (_err) {
        return res.status(500).json({ error: 'Server error' });
    }
};
