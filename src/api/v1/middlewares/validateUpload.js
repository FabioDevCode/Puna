import path from 'path';
import fs from 'fs/promises';
import { fileTypeFromFile } from 'file-type';

const ALLOWED = (process.env.ALLOWED_EXTENSIONS || '.png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.odt,.txt,.xls,.xlsx,.csv')
  .split(',')
  .map((s) => s.trim().toLowerCase());

function extFromName(name) {
  return path.extname(name || '').toLowerCase();
}

export default async function validateUpload(req, res, next) {
  try {
    const files = req.files || [];

    // enforce one file per field
    const seen = {};
    for (const f of files) {
      seen[f.fieldname] = (seen[f.fieldname] || 0) + 1;
      if (seen[f.fieldname] > 1) {
        // remove all uploaded files
        for (const toDel of files) {
          try { await fs.unlink(toDel.path); } catch (e) {}
        }
        return res.status(400).json({ error: 'One file per field allowed' });
      }

      const nameExt = extFromName(f.originalname);
      if (!ALLOWED.includes(nameExt)) {
        await fs.unlink(f.path).catch(() => {});
        return res.status(400).json({ error: `Extension not allowed: ${nameExt}` });
      }

      // check magic bytes
      const ft = await fileTypeFromFile(f.path);
      if (ft && ft.ext) {
        const detectedExt = `.${ft.ext.toLowerCase()}`;
        // allow some flexibility for certain types (e.g., csv may be text)
        if (detectedExt !== nameExt) {
          // treat mismatch as rejection
          await fs.unlink(f.path).catch(() => {});
          return res.status(400).json({ error: `File content does not match extension for ${f.fieldname}` });
        }
      }
    }

    return next();
  } catch (err) {
    // try cleanup
    const files = req.files || [];
    for (const toDel of files) {
      try { await fs.unlink(toDel.path); } catch (e) {}
    }
    return res.status(500).json({ error: 'Upload validation failed' });
  }
}
