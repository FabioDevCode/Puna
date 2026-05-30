import models from '../../models/index.js';

export async function getMcpForms(siteId) {
    const forms = await models.Form.findAll({
        where: { fk_id_site: siteId },
        attributes: ['id', 'name', 'createdAt'],
        order: [['createdAt', 'DESC']],
    });

    return forms.map((f) => f.toJSON());
}

export async function getMcpFormDetails(formId) {
    const [form, total_submissions] = await Promise.all([
        models.Form.findByPk(formId, {
            attributes: ['id', 'name', 'columns', 'template', 'file_keys', 'createdAt'],
        }),
        models.Inbox.count({ where: { fk_id_form: formId } }),
    ]);

    if (!form) return null;

    const formData = form.toJSON();
    let columns = null;
    let columns_labels = null;
    let file_keys = null;

    if (formData.columns) {
        try {
            columns = typeof formData.columns === 'string' ? JSON.parse(formData.columns) : formData.columns;
        } catch {
            // columns reste null
        }
    }

    if (formData.template) {
        try {
            columns_labels = typeof formData.template === 'string' ? JSON.parse(formData.template) : formData.template;
        } catch {
            // columns_labels reste null
        }
    }

    if (formData.file_keys) {
        try {
            file_keys = typeof formData.file_keys === 'string' ? JSON.parse(formData.file_keys) : formData.file_keys;
        } catch {
            // file_keys reste null
        }
    }

    const has_files = file_keys !== null && file_keys.length > 0;

    const { columns: _rawColumns, template: _rawTemplate, file_keys: _rawFileKeys, code: _code, ...rest } = formData;
    return { ...rest, columns, columns_labels, file_keys, total_submissions, has_files };
}
