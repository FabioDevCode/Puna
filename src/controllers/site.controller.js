import {
    createSite as createSiteService,
    getSiteWithForms,
    deleteSiteWithForms,
    generateSiteToken,
    revokeSiteTokens as revokeSiteTokensService,
} from '../services/site.service.js';
import stringUtils from '../utils/string.js';

/**
 * Créer un site
 */
export const createSite = async (req, res) => {
    const { domain } = req.body;
    const userId = req.session.user?.id;
    try {
        const site = await createSiteService(
            {
                domain,
                control_code: stringUtils.generateCode(16),
            },
            userId
        );
        res.flash('success', 'Site créé avec succès.');
        return res.redirect(`/site/${site.id}/view`);
    } catch (err) {
        res.flash('error', 'Erreur lors de la création du site.');
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
    } catch (err) {
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
            res.flash('success', 'Site supprimé avec succès.');
            return res.redirect('/site/all');
        } else {
            res.flash('warning', result.error || 'Le nom de domaine ne correspond pas.');
            return res.redirect(`/site/${siteId}/view`);
        }
    } catch (err) {
        res.flash('error', 'Erreur lors de la suppression du site.');
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
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
};
