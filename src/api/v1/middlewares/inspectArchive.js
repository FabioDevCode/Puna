import fs from 'fs/promises';
import path from 'path';
import StreamZip from 'node-stream-zip';
import { errorLogger } from '../../../config/logger.js';

const EXECUTABLE_EXTS = ['.exe', '.dll', '.scr', '.bat', '.com', '.cmd', '.js', '.sh'];

// Limites de sécurité pour les archives
const MAX_ENTRIES = 1000; // Nombre maximum d'entrées dans une archive
const MAX_NAME_LENGTH = 255; // Longueur maximum d'un nom de fichier
const MAX_UNCOMPRESSED_SIZE = 250 * 1024 * 1024; // 250 MB décompressé
const MAX_COMPRESSION_RATIO = 100; // Ratio de compression maximum (protection zip bomb)

function looksLikeZipByExt(name) {
    const ext = path.extname(name || '').toLowerCase();
    return ['.zip', '.docx', '.xlsx', '.pptx', '.odt'].includes(ext);
}

export default async function inspectArchive(req, res, next) {
    try {
        if (!req.files || req.files.length === 0) {
            return next();
        }

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
                    const entryNames = Object.keys(entries);

                    // PROTECTION 1: Limite du nombre d'entrées (protection contre archives massives)
                    if (entryNames.length > MAX_ENTRIES) {
                        await zip.close();
                        await fs.unlink(f.path).catch(() => {});
                        return res.status(400).json({
                            error: `Archive contains too many files (max ${MAX_ENTRIES})`,
                        });
                    }

                    // PROTECTION 2: Vérifier taille décompressée totale et ratio compression
                    let totalUncompressedSize = 0;
                    const fileStats = await fs.stat(f.path);
                    const compressedSize = fileStats.size;

                    for (const name of entryNames) {
                        const entry = entries[name];

                        // PROTECTION 3: Vérifier longueur du nom de fichier
                        if (name.length > MAX_NAME_LENGTH) {
                            await zip.close();
                            await fs.unlink(f.path).catch(() => {});
                            return res.status(400).json({
                                error: `Archive contains file with name too long (max ${MAX_NAME_LENGTH} chars)`,
                            });
                        }

                        // PROTECTION 4: Détecter path traversal
                        if (name.includes('..') || name.startsWith('/') || name.includes('\\..')) {
                            await zip.close();
                            await fs.unlink(f.path).catch(() => {});
                            return res.status(400).json({
                                error: 'Archive contains suspicious file paths',
                            });
                        }

                        // Calculer taille totale décompressée
                        totalUncompressedSize += entry.size || 0;

                        // PROTECTION 5: Vérifier taille totale décompressée
                        if (totalUncompressedSize > MAX_UNCOMPRESSED_SIZE) {
                            await zip.close();
                            await fs.unlink(f.path).catch(() => {});
                            return res.status(400).json({
                                error: `Archive uncompressed size too large (max ${Math.round(MAX_UNCOMPRESSED_SIZE / (1024 * 1024))} MB)`,
                            });
                        }

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
                                await fs.unlink(f.path).catch((e) => {
                                    errorLogger.error({ err: e, path: f.path }, 'Failed to cleanup archive file');
                                });
                                return res.status(400).json({ error: 'Archive contains executable files and is rejected' });
                            }
                        }
                    }

                    // PROTECTION 6: Vérifier ratio de compression (zip bomb)
                    if (compressedSize > 0) {
                        const compressionRatio = totalUncompressedSize / compressedSize;
                        if (compressionRatio > MAX_COMPRESSION_RATIO) {
                            await zip.close();
                            await fs.unlink(f.path).catch(() => {});
                            return res.status(400).json({
                                error: `Archive compression ratio too high (possible zip bomb)`,
                            });
                        }
                    }

                    await zip.close();
                } catch (err) {
                    try {
                        await zip.close();
                    } catch (e) {
                        errorLogger.error({ err: e }, 'Failed to close zip stream');
                    }
                    // if zip cannot be read safely, reject
                    await fs.unlink(f.path).catch((e) => {
                        errorLogger.error({ err: e, path: f.path }, 'Failed to cleanup archive file');
                    });
                    return res.status(400).json({ error: 'Archive could not be inspected and is rejected' });
                }
            }
        }

        return next();
    } catch (err) {
        const files = req.files || [];
        for (const toDel of files) {
            try {
                await fs.unlink(toDel.path);
            } catch (e) {
                errorLogger.error({ err: e, path: toDel.path }, 'Failed to cleanup archive file');
            }
        }
        return res.status(500).json({ error: 'Archive inspection failed' });
    }
}
