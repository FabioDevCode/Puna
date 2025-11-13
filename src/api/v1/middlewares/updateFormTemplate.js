import models from '../../../models/index.js';

/**
 * Middleware to ensure a 'template' JSON exists on the Form record and to maintain a 'columns' JSON.
 * Behavior:
 * - If no template: create entries for received keys (key -> capitalized key).
 * - If template exists: add any newly received keys (do not remove existing keys).
 * - Columns handling:
 *   - If no columns saved: initialize columns object with all template keys -> true.
 *   - If columns exist and payload contains new keys: add those keys with value true, keep existing booleans.
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

        // Load existing template
        let templateObj = {};
        if (form.template) {
            try {
                templateObj = JSON.parse(form.template);
                if (!templateObj || typeof templateObj !== 'object') templateObj = {};
            } catch (err) {
                templateObj = {};
            }
        }

        // Load existing columns
        let columnsObj = {};
        if (form.columns) {
            try {
                columnsObj = JSON.parse(form.columns);
                if (!columnsObj || typeof columnsObj !== 'object') columnsObj = {};
            } catch (err) {
                columnsObj = {};
            }
        }

        let templateChanged = false;
        let columnsChanged = false;

        // Ensure every received key exists in template; if not, add key: Capitalized(key)
        const capitalized = (str) => str.charAt(0).toUpperCase() + str.slice(1);
        for (const k of receivedKeys) {
            if (!Object.prototype.hasOwnProperty.call(templateObj, k)) {
                templateObj[k] = capitalized(String(k));
                templateChanged = true;
            }
        }

        // If no columns saved yet, initialize columns with all template keys -> true
        const templateKeys = Object.keys(templateObj || {});
        if (!form.columns || Object.keys(columnsObj).length === 0) {
            // initialize with all keys true
            templateKeys.forEach((k) => { columnsObj[k] = true; });
            columnsChanged = true;
        } else {
            // Ensure newly added template keys exist in columns (set to true) without changing existing values
            for (const k of templateKeys) {
                if (!Object.prototype.hasOwnProperty.call(columnsObj, k)) {
                    columnsObj[k] = true;
                    columnsChanged = true;
                }
            }
        }

        // If something changed, perform a single update to persist both template and columns
        if (templateChanged || columnsChanged) {
            await form.update({
                template: JSON.stringify(templateObj),
                columns: JSON.stringify(columnsObj)
            });
        }

        return next();
    } catch (err) {
        // don't block the API on template bookkeeping - log and continue
        console.error('updateFormTemplate error:', err);
        return next();
    }
}

export default updateFormTemplate;
