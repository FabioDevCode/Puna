import fs from 'fs/promises';
import path from 'path';
import { fileTypeFromFile } from 'file-type';
import { errorLogger } from '../../../config/logger.js';

const ALLOWED = (process.env.ALLOWED_EXTENSIONS || '.png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.odt,.txt,.xls,.xlsx,.csv')
    .split(',')
    .map((s) => s.trim().toLowerCase());

function extFromName(name) {
    return path.extname(name || '').toLowerCase();
}

async function hasPdfHeader(filePath) {
    try {
        const buf = await fs.readFile(filePath).catch(() => null);
        if (!buf || buf.length < 4) {
            return false;
        }
        // check for '%PDF' at start
        return buf.slice(0, 4).toString() === '%PDF';
    } catch (e) {
        return false;
    }
}

async function hasPngHeader(filePath) {
    try {
        const buf = await fs.readFile(filePath).catch(() => null);
        if (!buf || buf.length < 8) {
            return false;
        }
        // PNG signature: 89 50 4E 47 0D 0A 1A 0A
        return (
            buf[0] === 0x89 &&
            buf[1] === 0x50 &&
            buf[2] === 0x4e &&
            buf[3] === 0x47 &&
            buf[4] === 0x0d &&
            buf[5] === 0x0a &&
            buf[6] === 0x1a &&
            buf[7] === 0x0a
        );
    } catch (e) {
        return false;
    }
}

async function hasJpegHeader(filePath) {
    try {
        const buf = await fs.readFile(filePath).catch(() => null);
        if (!buf || buf.length < 3) {
            return false;
        }
        // JPEG signature: FF D8 FF
        return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    } catch (e) {
        return false;
    }
}

async function hasGifHeader(filePath) {
    try {
        const buf = await fs.readFile(filePath).catch(() => null);
        if (!buf || buf.length < 6) {
            return false;
        }
        // GIF signature: GIF87a or GIF89a
        const header = buf.slice(0, 6).toString();
        return header === 'GIF87a' || header === 'GIF89a';
    } catch (e) {
        return false;
    }
}

async function hasWebpHeader(filePath) {
    try {
        const buf = await fs.readFile(filePath).catch(() => null);
        if (!buf || buf.length < 12) {
            return false;
        }
        // WEBP signature: RIFF....WEBP (at offsets 0-3 and 8-11)
        const riff = buf.slice(0, 4).toString();
        const webp = buf.slice(8, 12).toString();
        return riff === 'RIFF' && webp === 'WEBP';
    } catch (e) {
        return false;
    }
}

export default async function validateUpload(req, res, next) {
    try {
        // Guard : rien à inspecter si pas d'upload
        if (!req.files || req.files.length === 0) {
            return next();
        }

        const files = req.files || [];

        // enforce one file per field
        const seen = {};
        for (const f of files) {
            seen[f.fieldname] = (seen[f.fieldname] || 0) + 1;
            if (seen[f.fieldname] > 1) {
                // remove all uploaded files
                for (const toDel of files) {
                    try {
                        await fs.unlink(toDel.path);
                    } catch (e) {
                        errorLogger.error({ err: e, path: toDel.path }, 'Failed to cleanup uploaded file');
                    }
                }
                return res.status(400).json({ error: 'One file per field allowed' });
            }

            const nameExt = extFromName(f.originalname);
            if (!ALLOWED.includes(nameExt)) {
                await fs.unlink(f.path).catch((e) => {
                    errorLogger.error({ err: e, path: f.path }, 'Failed to cleanup uploaded file');
                });
                return res.status(400).json({ error: `Extension not allowed: ${nameExt}` });
            }

            // check magic bytes
            const ft = await fileTypeFromFile(f.path);
            if (ft && ft.ext) {
                const detectedExt = `.${ft.ext.toLowerCase()}`;
                // detected type must match declared extension
                if (detectedExt !== nameExt) {
                    await fs.unlink(f.path).catch((e) => {
                        errorLogger.error({ err: e, path: f.path }, 'Failed to cleanup uploaded file');
                    });
                    return res.status(400).json({ error: `File content does not match extension for ${f.fieldname}` });
                }
            } else {
                // file-type couldn't detect the type. Be strict for binary formats that have signatures.
                const allowTextIfUndefined = ['.txt', '.csv'];
                let headerValid = false;

                if (nameExt === '.pdf') {
                    headerValid = await hasPdfHeader(f.path);
                } else if (nameExt === '.png') {
                    headerValid = await hasPngHeader(f.path);
                } else if (nameExt === '.jpg' || nameExt === '.jpeg') {
                    headerValid = await hasJpegHeader(f.path);
                } else if (nameExt === '.gif') {
                    headerValid = await hasGifHeader(f.path);
                } else if (nameExt === '.webp') {
                    headerValid = await hasWebpHeader(f.path);
                } else if (allowTextIfUndefined.includes(nameExt)) {
                    // allow plain text-like files even if file-type couldn't detect them
                    headerValid = true;
                } else {
                    // Unknown/undetectable content for this extension -> reject
                    await fs.unlink(f.path).catch((e) => {
                        errorLogger.error({ err: e, path: f.path }, 'Failed to cleanup uploaded file');
                    });
                    return res.status(400).json({ error: `Unable to verify file content for ${f.fieldname}` });
                }

                if (!headerValid) {
                    await fs.unlink(f.path).catch((e) => {
                        errorLogger.error({ err: e, path: f.path }, 'Failed to cleanup uploaded file');
                    });
                    return res.status(400).json({ error: `File content does not match extension for ${f.fieldname}` });
                }
            }
        }

        return next();
    } catch (err) {
        // try cleanup
        const files = req.files || [];
        for (const toDel of files) {
            try {
                await fs.unlink(toDel.path);
            } catch (e) {
                errorLogger.error({ err: e, path: toDel.path }, 'Failed to cleanup uploaded file');
            }
        }
        return res.status(500).json({ error: 'Upload validation failed' });
    }
}
