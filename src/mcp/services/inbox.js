import models from '../../models/index.js';

const parseContent = (raw) => {
    if (!raw) return null;
    try {
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
        return raw;
    }
};

export async function getMcpSubmissions(formId, page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    const { rows: submissions, count: total } = await models.Inbox.findAndCountAll({
        where: { fk_id_form: formId },
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
