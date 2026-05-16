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

    return {
        site: site.toJSON(),
        forms: forms.map((f) => f.toJSON()),
    };
}
