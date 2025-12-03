import jwt from 'jsonwebtoken';
import { getSiteWhereCondition } from '../helpers/site.helpers.js';
import models from '../models/index.js';
import { encryptObject } from '../utils/crypto.js';
import stringUtils from '../utils/string.js';

/**
 * Créer un site
 */
export const createSite = async (req, res) => {
    const { domain } = req.body;
    const userId = req.session.user?.id;
    try {
        const site = await models.Site.create({
            domain,
            fk_id_user: userId,
            control_code: stringUtils.generateCode(16),
        });
        return res.redirect(`/site/${site.id}/view`);
    } catch (err) {
        return res.redirect('/error');
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
        const site = await models.Site.findByPk(siteId, { raw: true });

        if (!site) {
            throw new Error('error');
        }

        // Vérifier que l'utilisateur a accès à ce site selon son rôle
        const siteWhereCondition = await getSiteWhereCondition(userId, userRole);

        // Si pas super_admin, vérifier l'accès au site
        if (siteWhereCondition) {
            // Vérifier si le site correspond aux conditions d'accès
            const accessibleSite = await models.Site.findOne({
                where: {
                    id: siteId,
                    ...siteWhereCondition,
                },
            });

            if (!accessibleSite) {
                return res.redirect('/dashboard');
            }
        }

        const formsRaw = await models.Form.findAll({
            where: { fk_id_site: siteId },
            raw: true,
            order: [['createdAt', 'ASC']],
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
                template_entries,
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
        res.render('sites/show', {
            site,
            forms,
            activeForm,
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
        const site = await models.Site.findByPk(siteId);

        if (!site) {
            throw new Error('error');
        }

        // Vérifier que l'utilisateur a accès à ce site selon son rôle
        const siteWhereCondition = await getSiteWhereCondition(userId, userRole);
        if (siteWhereCondition) {
            const accessibleSite = await models.Site.findOne({
                where: { id: siteId, ...siteWhereCondition },
            });
            if (!accessibleSite) {
                return res.redirect('/dashboard');
            }
        }

        if (site.domain === confirm_domain.trim()) {
            await models.Form.destroy({ where: { fk_id_site: siteId } });
            await site.destroy();
            return res.redirect('/site/all');
        } else {
            return res.redirect(`/site/${siteId}/view`);
        }
    } catch (err) {
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
        const site = await models.Site.findByPk(siteId);
        if (!site) {
            return res.status(404).json({ error: 'Site not found' });
        }

        // Vérifier l'accès au site selon le rôle
        const siteWhereCondition = await getSiteWhereCondition(userId, userRole);
        if (siteWhereCondition) {
            const accessibleSite = await models.Site.findOne({
                where: { id: siteId, ...siteWhereCondition },
            });
            if (!accessibleSite) {
                return res.status(403).json({ error: 'Forbidden' });
            }
        }

        const secret = process.env.KEY_TK;
        if (!secret) {
            return res.status(500).json({ error: 'KEY_TK not configured in environment variables' });
        }

        const payload = {
            data: encryptObject({
                id: site.id,
                control_code: site.control_code,
            }),
        };

        const token = jwt.sign(payload, secret);

        return res.json({ token });
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
        const site = await models.Site.findByPk(siteId);
        if (!site) {
            return res.status(404).json({ error: 'Site not found' });
        }

        // Vérifier l'accès au site selon le rôle
        const siteWhereCondition = await getSiteWhereCondition(userId, userRole);
        if (siteWhereCondition) {
            const accessibleSite = await models.Site.findOne({
                where: { id: siteId, ...siteWhereCondition },
            });
            if (!accessibleSite) {
                return res.status(403).json({ error: 'Forbidden' });
            }
        }

        const newCode = stringUtils.generateCode(16);
        site.control_code = newCode;
        await site.save();

        return res.json({ success: true, control_code: newCode });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
};
