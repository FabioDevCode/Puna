import models from '../models/index.js';
import stringUtils from '../utils/string.js';

/**
 * Créer un formulaire
 */
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

        return res.redirect(`/site/${fk_id_site}/view`);
    } catch (err) {
        return res.redirect('/error');
    }
};

/**
 * Supprimer un formulaire
 */
export const deleteForm = async (req, res) => {
    const { form_id } = req.body;
    const userId = req.session.user?.id;

    try {
        const form = await models.Form.findByPk(form_id);
        if (!form) {
            return res.redirect('/dashboard');
        }

        // get site id and verify ownership
        const site = await models.Site.findByPk(form.fk_id_site);
        if (!site || site.fk_id_user !== userId) {
            return res.redirect('/dashboard');
        }

        const siteId = site.id;
        await form.destroy();

        return res.redirect(`/site/${siteId}/view`);
    } catch (err) {
        return res.redirect('/error');
    }
};

/**
 * Mettre à jour le template d'un formulaire
 */
export const updateFormTemplateSave = async (req, res) => {
    const formId = req.params.id;
    const userId = req.session.user?.id;

    try {
        const form = await models.Form.findByPk(formId);
        if (!form) {
            return res.redirect('/dashboard');
        }

        const site = await models.Site.findByPk(form.fk_id_site);
        if (!site || site.fk_id_user !== userId) {
            return res.redirect('/dashboard');
        }

        // Expecting nested fields in req.body.template (e.g. template[fieldName]=New label)
        const newTemplate = req.body?.template || {};

        // Ensure object
        const templateObj = typeof newTemplate === 'object' ? newTemplate : {};

        form.template = JSON.stringify(templateObj);
        await form.save();

        return res.redirect(`/site/${form.fk_id_site}/view?f=${form.name}`);
    } catch (err) {
        return res.redirect('/error');
    }
};

/**
 * Récupérer les entrées inbox d'un formulaire avec filtres
 */
export const getFormInbox = async (req, res) => {
    const formId = req.params.id;
    const userId = req.session.user?.id;

    try {
        const form = await models.Form.findByPk(formId);
        if (!form) {
            return res.status(404).json({ error: 'Form not found' });
        }

        const site = await models.Site.findByPk(form.fk_id_site);
        if (!site || site.fk_id_user !== userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

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
                        if (v === null || typeof v === 'undefined' || String(v).trim() === '') {
                            continue;
                        }
                        if (k === 'createdAt') {
                            // filter by date (YYYY-MM-DD) on createdAt using DATE(createdAt) = 'YYYY-MM-DD'
                            conditions.push(
                                Sequelize.where(Sequelize.fn('DATE', Sequelize.col('createdAt')), String(v))
                            );
                        } else {
                            // contains match on JSON stringified field
                            const Op = Sequelize.Op;
                            const expr = Sequelize.where(
                                Sequelize.fn(
                                    'JSON_UNQUOTE',
                                    Sequelize.fn(
                                        'JSON_EXTRACT',
                                        Sequelize.col('content'),
                                        Sequelize.literal(`'$.${k}'`)
                                    )
                                ),
                                { [Op.like]: `%${String(v)}%` }
                            );
                            conditions.push(expr);
                        }
                    }
                    if (conditions.length) {
                        const Op = Sequelize.Op;
                        whereClause = { [Op.and]: [{ fk_id_form: formId }, ...conditions] };
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
            raw: true,
        });

        const rows = result.rows || [];
        const total = typeof result.count === 'number' ? result.count : result.count || 0;

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
                createdAt: r.createdAt,
            };
        });

        return res.json({ items, total });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Mettre à jour les colonnes visibles d'un formulaire
 */
export const updateFormColumns = async (req, res) => {
    const formId = req.params.id;
    const userId = req.session.user?.id;
    try {
        const form = await models.Form.findByPk(formId);
        if (!form) {
            return res.status(404).json({ error: 'Form not found' });
        }

        const site = await models.Site.findByPk(form.fk_id_site);
        if (!site || site.fk_id_user !== userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Expect JSON body { columns: { key1: true, key2: false, ... } }
        let cols = req.body && req.body.columns ? req.body.columns : null;
        if (typeof cols === 'string') {
            try {
                cols = JSON.parse(cols);
            } catch (e) {
                cols = null;
            }
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
