import path from 'path';
import fs from 'fs/promises';
import StreamZip from 'node-stream-zip';

const EXECUTABLE_EXTS = ['.exe', '.dll', '.scr', '.bat', '.com', '.cmd', '.js', '.sh'];

function looksLikeZipByExt(name) {
  const ext = path.extname(name || '').toLowerCase();
  return ['.zip', '.docx', '.xlsx', '.pptx', '.odt'].includes(ext);
}

export default async function inspectArchive(req, res, next) {
  try {
    const files = req.files || [];

    for (const f of files) {
      const ext = path.extname(f.originalname || '').toLowerCase();

      // quick PDF heuristic: scan for /JavaScript token
      if (ext === '.pdf') {
        const buf = await fs.readFile(f.path, { encoding: 'utf8' }).catch(() => null);
        if (buf && buf.includes('/JavaScript')) {
          await fs.unlink(f.path).catch(() => {});
          return res.status(400).json({ error: 'PDF contains JavaScript and is rejected' });
        }
      }

      if (looksLikeZipByExt(f.originalname)) {
        // inspect zip entries
        const zip = new StreamZip.async({ file: f.path });
        try {
          const entries = await zip.entries();
          for (const name of Object.keys(entries)) {
            const lower = name.toLowerCase();
            // check for vbaProject -> macros
            if (lower.endsWith('vbaproject.bin') || lower.includes('vba')) {
              await zip.close();
              await fs.unlink(f.path).catch(() => {});
              return res.status(400).json({ error: 'Document contains macros and is rejected' });
            }
            // reject executable inside archive
            for (const ex of EXECUTABLE_EXTS) {
              if (lower.endsWith(ex)) {
                await zip.close();
                await fs.unlink(f.path).catch(() => {});
                return res.status(400).json({ error: 'Archive contains executable files and is rejected' });
              }
            }
          }
          await zip.close();
        } catch (err) {
          try { await zip.close(); } catch (e) {}
          // if zip cannot be read safely, reject
          await fs.unlink(f.path).catch(() => {});
          return res.status(400).json({ error: 'Archive could not be inspected and is rejected' });
        }
      }
    }

    return next();
  } catch (err) {
    const files = req.files || [];
    for (const toDel of files) {
      try { await fs.unlink(toDel.path); } catch (e) {}
    }
    return res.status(500).json({ error: 'Archive inspection failed' });
  }
}
