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
        await models.Site.create({ domain, fk_id_user: userId });
        return res.redirect('/dashboard');
    } catch (err) {
        return res.redirect('/error');
    }
};