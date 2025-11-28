import path from 'path';
import { finalPathFor, sanitizeFileName, moveFile, removeFile } from '../../../helpers/upload_utils.js';

export default async function moveFilesToUploads(req, res, next) {
    try {
        const files = req.files || [];
        if (!Array.isArray(files) || files.length === 0) {
            return next();
        }

        const moved = [];
        for (const f of files) {
            const safe = `${Date.now()}_${sanitizeFileName(f.originalname || 'file')}`;
            const { _, path: destPath } = finalPathFor(req.site, req.form, safe);
            // move from tmp to final dest
            await moveFile(f.path, destPath);
            // annotate file object
            f.finalPath = destPath;
            f.basename = path.basename(destPath);
            f.relative = path.relative(process.cwd(), destPath);
            moved.push(destPath);
        }

        return next();
    } catch (err) {
        // try to cleanup any remaining tmp and moved files
        const files = req.files || [];
        for (const f of files) {
            try {
                await removeFile(f.path);
            } catch (e) {
                console.error(e);
            }
            if (f && f.finalPath) {
                try {
                    await removeFile(f.finalPath);
                } catch (e) {
                    console.error(e);
                }
            }
        }
        console.error('moveFilesToUploads error:', err);
        return res.status(500).json({ success: false, error: 'file move error' });
    }
}
