import fs from 'fs/promises';
import path from 'path';

export function ensureDir(dir) {
    return fs.mkdir(dir, { recursive: true });
}

export function sanitizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

export function finalPathFor(site, form, filename) {
    const base = process.env.UPLOADS_DIR || path.join(process.cwd(), 'storage', 'uploads');
    const domain = site && site.domain ? String(site.domain).replace(/[^a-zA-Z0-9.\-_]/g, '_') : 'unknown';
    const formName = form && form.name ? String(form.name).replace(/[^a-zA-Z0-9.\-_]/g, '_') : 'form';
    const code = form && form.code ? String(form.code) : 'nocode';
    const dir = path.join(base, domain, formName, code);
    return { dir, path: path.join(dir, filename) };
}

export async function moveFile(src, dest) {
    await ensureDir(path.dirname(dest));
    await fs.rename(src, dest);
}

export async function removeFile(p) {
    try {
        await fs.unlink(p);
    } catch (e) {
        console.error(e);
    }
}
