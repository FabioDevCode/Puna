import { Op } from 'sequelize';
import models from '../../models/index.js';

const parseContent = (raw) => {
    if (!raw) return null;
    try {
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
        return raw;
    }
};

export async function getMcpSubmissions(formId, page = 1, limit = 50, dateFrom = null, dateTo = null) {
    const offset = (page - 1) * limit;
    const where = { fk_id_form: formId };

    if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
        if (dateTo) {
            const end = new Date(dateTo);
            end.setHours(23, 59, 59, 999);
            where.createdAt[Op.lte] = end;
        }
    }

    const { rows: submissions, count: total } = await models.Inbox.findAndCountAll({
        where,
        attributes: ['id', 'content', 'createdAt'],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
    });

    return {
        submissions: submissions.map((s) => {
            const data = s.toJSON();
            return { ...data, content: parseContent(data.content) };
        }),
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
    };
}

export async function getMcpSubmission(submissionId) {
    const submission = await models.Inbox.findByPk(submissionId, {
        attributes: ['id', 'content', 'createdAt'],
        include: [
            {
                model: models.Form,
                as: 'form',
                attributes: ['id', 'name'],
                include: [
                    {
                        model: models.Site,
                        as: 'site',
                        attributes: ['id', 'domain'],
                    },
                ],
            },
        ],
    });

    if (!submission) return null;

    const data = submission.toJSON();
    return { ...data, content: parseContent(data.content) };
}

export async function getMcpRecentSubmissions(userId, userRole, limit = 10) {
    const siteFilter = userRole === 'super_admin' ? '' : 'AND s.fk_id_user = :userId';

    const sql = `
        SELECT i.id, i.content, i.createdAt, f.id AS form_id, f.name AS form_name, s.id AS site_id, s.domain AS site_domain
        FROM inbox i
        JOIN form f ON f.id = i.fk_id_form
        JOIN site s ON s.id = f.fk_id_site
        WHERE 1=1 ${siteFilter}
        ORDER BY i.createdAt DESC
        LIMIT :limit
    `;

    const rows = await models.sequelize.query(sql, {
        replacements: { userId, limit },
        type: models.Sequelize.QueryTypes.SELECT,
    });

    return (rows || []).map((r) => ({
        id: r.id,
        content: parseContent(r.content),
        createdAt: r.createdAt,
        form: { id: r.form_id, name: r.form_name },
        site: { id: r.site_id, domain: r.site_domain },
    }));
}

export async function getMcpSearchSubmissions(userId, userRole, query, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const siteFilter = userRole === 'super_admin' ? '' : 'AND s.fk_id_user = :userId';

    const baseSql = `
        FROM inbox i
        JOIN form f ON f.id = i.fk_id_form
        JOIN site s ON s.id = f.fk_id_site
        WHERE i.content LIKE :search ${siteFilter}
    `;

    const [countRows, dataRows] = await Promise.all([
        models.sequelize.query(`SELECT COUNT(i.id) AS cnt ${baseSql}`, {
            replacements: { userId, search: `%${query}%` },
            type: models.Sequelize.QueryTypes.SELECT,
        }),
        models.sequelize.query(
            `SELECT i.id, i.content, i.createdAt, f.id AS form_id, f.name AS form_name, s.id AS site_id, s.domain AS site_domain ${baseSql} ORDER BY i.createdAt DESC LIMIT :limit OFFSET :offset`,
            { replacements: { userId, search: `%${query}%`, limit, offset }, type: models.Sequelize.QueryTypes.SELECT }
        ),
    ]);

    const total = Number(countRows[0]?.cnt) || 0;

    return {
        submissions: (dataRows || []).map((r) => ({
            id: r.id,
            content: parseContent(r.content),
            createdAt: r.createdAt,
            form: { id: r.form_id, name: r.form_name },
            site: { id: r.site_id, domain: r.site_domain },
        })),
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
    };
}
