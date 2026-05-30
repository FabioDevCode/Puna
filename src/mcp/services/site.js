import { Op } from 'sequelize';
import models from '../../models/index.js';
import { getSiteWhereCondition } from '../../services/access.service.js';

export async function getMcpSites(userId, userRole) {
    const where = await getSiteWhereCondition(userId, userRole);

    const sites = await models.Site.findAll({
        where: where ?? {},
        attributes: ['id', 'domain', 'createdAt'],
        order: [['createdAt', 'DESC']],
    });

    return sites.map((s) => s.toJSON());
}

export async function getMcpSiteDetails(siteId) {
    const [site, forms] = await Promise.all([
        models.Site.findByPk(siteId, {
            attributes: ['id', 'domain', 'createdAt'],
        }),
        models.Form.findAll({
            where: { fk_id_site: siteId },
            attributes: ['id', 'name', 'createdAt'],
            order: [['createdAt', 'DESC']],
        }),
    ]);

    if (!site) return null;

    const formIds = forms.map((f) => f.id);
    let countMap = {};
    if (formIds.length > 0) {
        const counts = await models.Inbox.findAll({
            where: { fk_id_form: { [Op.in]: formIds } },
            attributes: ['fk_id_form', [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'total']],
            group: ['fk_id_form'],
            raw: true,
        });
        countMap = Object.fromEntries(counts.map((c) => [c.fk_id_form, Number(c.total) || 0]));
    }

    return {
        site: site.toJSON(),
        forms: forms.map((f) => ({ ...f.toJSON(), total_submissions: countMap[f.id] ?? 0 })),
    };
}
