import models from '../models/index.js';
import stringUtils from "../utils/string.js";
import { getSitesWithCounts, getGlobalStats } from '../helpers/site.helpers.js';


export const dashboard = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const sitesWithCounts = await getSitesWithCounts(userId);

        res.render('dashboard', {
            sites: sitesWithCounts,
            stats: getGlobalStats(sitesWithCounts)
        });
    } catch (err) {
        res.render('dashboard', {});
    }
};

export const error = async(req, res) => {
    res.render('error', {
        layout: false,
    })
};

export const dpLogin = (req, res) => {
    res.render('login', {
        layout: "login"
    })
};

export const dpFirstCo = (req, res) => {
    res.render('first_co', {
        layout: "login"
    })
};

export const createSite = async (req, res) => {
    const { domain } = req.body;
    const userId = req.session.user?.id;
    try {
        const site = await models.Site.create({ domain, fk_id_user: userId });
        return res.redirect(`/site/${site.id}`);
    } catch (err) {
        return res.redirect('/error');
    }
};

export const showSite = async (req, res) => {
    const siteId = req.params.id;
    try {
        const site = await models.Site.findByPk(siteId, {raw: true});

        if (!site) {
            throw new Error('error');
        }

        // Ensure the current user owns the site
        const userId = req.session.user?.id;
        if (site.fk_id_user !== userId) {
            return res.redirect('/dashboard');
        }

        // Fetch all forms attached to this site
        const forms = await models.Form.findAll({
            where: { fk_id_site: siteId },
            raw: true,
            order: [['createdAt', 'ASC']]
        });

        const activeForm = forms && forms.length ? forms[0] : null;

        res.render('show_site', {
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
            await site.destroy();
            throw new Error('error');
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
        if (!form) return res.redirect('/dashboard');

        // get site id and verify ownership
        const site = await models.Site.findByPk(form.fk_id_site);
        if (!site || site.fk_id_user !== userId) return res.redirect('/dashboard');

        const siteId = site.id;
        await form.destroy();

        return res.redirect(`/site/${siteId}`);
    } catch (err) {
        return res.redirect('/error');
    }
};