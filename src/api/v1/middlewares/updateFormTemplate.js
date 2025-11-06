import models from '../../../models/index.js';

/**
 * Middleware to ensure a 'template' JSON exists on the Form record.
 * - If no template: create one where each received key maps to its own name.
 * - If template exists: add any newly received keys (do not remove existing keys).
 * Expects req.form to be present (object with id) and req.sanitizedBody (or req.body) to contain received JSON.
 */
export async function updateFormTemplate(req, res, next) {
    try {
        const formObj = req.form; // set by authApiKeyAccess middleware (raw: true)
        if (!formObj || !formObj.id) return next();

        const formId = formObj.id;

        // obtain a model instance so we can update
        const form = await models.Form.findByPk(formId);
        if (!form) return next();

        const payload = req.sanitizedBody !== undefined ? req.sanitizedBody : req.body;

        // Only operate on plain objects
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return next();

        // Extract top-level keys from received payload
        const receivedKeys = Object.keys(payload);
        if (receivedKeys.length === 0) return next();

        let templateObj = {};
        if (form.template) {
            try {
                templateObj = JSON.parse(form.template);
                if (!templateObj || typeof templateObj !== 'object') templateObj = {};
            } catch (err) {
                // invalid JSON stored previously -> start fresh but keep as safe object
                templateObj = {};
            }
        }

        let changed = false;

        // Ensure every received key exists in template; if not, add key: key
        for (const k of receivedKeys) {
            if (!Object.prototype.hasOwnProperty.call(templateObj, k)) {
                const capitalized = str => str.charAt(0).toUpperCase() + str.slice(1);
                templateObj[k] = capitalized(String(k))
                changed = true;
            }
        }

        // If changed, persist back to DB (do NOT remove existing keys)
        if (changed) {
            await form.update({ template: JSON.stringify(templateObj) });
        }

        return next();
    } catch (err) {
        // don't block the API on template bookkeeping - log and continue
        console.error('updateFormTemplate error:', err);
        return next();
    }
}

export default updateFormTemplate;
