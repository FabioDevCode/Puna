import models from '../models/index.js';
import {
    getSitesWithCounts,
    getGlobalStats
} from '../helpers/site.helpers.js';

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

        res.render('show_site', {
            site
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