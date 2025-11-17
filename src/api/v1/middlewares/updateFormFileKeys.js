import models from '../../../models/index.js';

/**
 * Middleware to merge uploaded file field names into the Form.file_keys JSON array.
 * - Reads `req.files` (multer `upload.any()` produces an array).
 * - Extracts unique `fieldname` values.
 * - Loads the Form by `req.form.id` and merges these field names into `form.file_keys`
 *   (stored as a JSON array in the DB).
 * - If anything goes wrong, logs the error and calls `next()` (doesn't throw to client).
 */
export async function updateFormFileKeys(req, res, next) {
  try {
    const formObj = req.form;
    if (!formObj || !formObj.id) return next();

    // If no files were uploaded, nothing to do
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) return next();

    // Collect unique field names from uploaded files
    const fieldNames = Array.from(new Set(
      req.files
        .map((f) => f && f.fieldname)
        .filter(Boolean)
        .map(String)
    ));

    if (fieldNames.length === 0) return next();

    // Load Form instance
    const form = await models.Form.findByPk(formObj.id);
    if (!form) return next();

    // Parse existing file_keys (should be a JSON array)
    let fileKeys = [];
    if (form.file_keys) {
      try {
        const parsed = JSON.parse(form.file_keys);
        if (Array.isArray(parsed)) fileKeys = parsed;
      } catch (err) {
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

    return next();
  } catch (err) {
    // Do not block the request on bookkeeping errors
    console.error('updateFormFileKeys error:', err);
    return next();
  }
}

export default updateFormFileKeys;
