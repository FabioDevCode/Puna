import models from '../../../models/index.js';
import path from 'path';
import { moveFile, sanitizeFileName, finalPathFor } from '../../../helpers/upload_utils.js';
import fs from 'fs/promises';

export async function uploadHandler(req, res) {
  const { site, form } = req;

  try {
    const payload = {};

    // copy body fields
    if (req.body) {
      for (const k of Object.keys(req.body)) {
        try {
          // try to parse JSON fields if possible
          payload[k] = JSON.parse(req.body[k]);
        } catch (e) {
          payload[k] = req.body[k];
        }
      }
    }

    const files = req.files || [];
    for (const f of files) {
      const safe = `${Date.now()}_${sanitizeFileName(f.originalname || 'file')}`;
      const { dir, path: destPath } = finalPathFor(site, form, safe);
      await moveFile(f.path, destPath);
      // store relative path
      const rel = path.relative(process.cwd(), destPath);
      // if key exists, convert to array
      if (payload[f.fieldname]) {
        if (Array.isArray(payload[f.fieldname])) payload[f.fieldname].push(rel);
        else payload[f.fieldname] = [payload[f.fieldname], rel];
      } else {
        payload[f.fieldname] = rel;
      }
    }

    const fk_id_form = form && form.id ? form.id : null;
    if (!fk_id_form) return res.status(400).json({ success: false, error: 'Form id missing' });

    await models.Inbox.create({
      content: JSON.stringify(payload),
      fk_id_form
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    // cleanup temp files if any
    const files = req.files || [];
    for (const f of files) {
      try { await fs.unlink(f.path); } catch (e) {}
    }
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default uploadHandler;
