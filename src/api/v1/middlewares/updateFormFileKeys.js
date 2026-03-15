import { errorLogger } from '../../../config/logger.js';
import models from '../../../models/index.js';

export async function updateFormFileKeys(req, res, next) {
    try {
        const formObj = req.form;
        if (!formObj || !formObj.id) {
            return next();
        }

        // If no files were uploaded, nothing to do
        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
            return next();
        }

        // Collect unique field names from uploaded files
        const fieldNames = Array.from(
            new Set(
                req.files
                    .map((f) => f && f.fieldname)
                    .filter(Boolean)
                    .map(String)
            )
        );

        if (fieldNames.length === 0) {
            return next();
        }

        // Load Form instance
        const form = await models.Form.findByPk(formObj.id);
        if (!form) {
            return next();
        }

        // Parse existing file_keys (should be a JSON array)
        let fileKeys = [];
        if (form.file_keys) {
            try {
                const parsed = JSON.parse(form.file_keys);
                if (Array.isArray(parsed)) {
                    fileKeys = parsed;
                }
            } catch (_err) {
                // invalid JSON, start fresh
                fileKeys = [];
            }
        }

        // Merge new field names without duplicates
        const existing = new Set(fileKeys);
        let changed = false;
        for (const name of fieldNames) {
            if (!existing.has(name)) {
                existing.add(name);
                changed = true;
            }
        }

        if (changed) {
            const merged = Array.from(existing);
            await form.update({ file_keys: JSON.stringify(merged) });
        }

        // Inject file basenames into req.body for the handler to consume
        try {
            if (!req.body) {
                req.body = {};
            }
            // group by fieldname
            const byField = {};
            for (const f of req.files) {
                if (!f || !f.fieldname) {
                    continue;
                }
                const name = f.fieldname;
                const base = f.basename || (f.originalname ? f.originalname : null) || null;
                if (!base) {
                    continue;
                }
                if (!byField[name]) {
                    byField[name] = [];
                }
                byField[name].push(base);
            }

            for (const [field, arr] of Object.entries(byField)) {
                if (arr.length === 1) {
                    req.body[field] = arr[0];
                } else {
                    req.body[field] = arr;
                }
            }
        } catch (e) {
            // do not block on best-effort injection
            errorLogger.error({ err: e }, 'updateFormFileKeys inject error');
        }

        return next();
    } catch (err) {
        // Do not block the request on bookkeeping errors
        errorLogger.error({ err }, 'updateFormFileKeys error');
        return next();
    }
}

export default updateFormFileKeys;
