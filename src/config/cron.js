import fs from 'node:fs/promises';
import path from 'node:path';
import cron from 'node-cron';
import { logger, errorLogger } from './logger.js';

const TMP_DIR = path.resolve('storage/tmp');
const MAX_AGE_MS = 60 * 60 * 1000; // 1 heure

/**
 * Nettoie les fichiers temporaires de plus de MAX_AGE_MS.
 * Multer y dépose les fichiers avant déplacement vers uploads/.
 * Si une requête échoue (timeout, crash, validation), le fichier reste.
 * Ce job tourne toutes les heures pour éviter le remplissage disque.
 */
async function cleanTmp() {
    try {
        const entries = await fs.readdir(TMP_DIR);

        if (entries.length === 0) {
            return;
        }

        let removed = 0;
        const now = Date.now();

        for (const entry of entries) {
            // ignorer .gitkeep
            if (entry === '.gitkeep') {
                continue;
            }

            const filePath = path.join(TMP_DIR, entry);

            try {
                const stat = await fs.stat(filePath);

                if (now - stat.mtimeMs > MAX_AGE_MS) {
                    await fs.unlink(filePath);
                    removed++;
                }
            } catch (err) {
                // fichier supprimé entre readdir et stat — ignorer
                if (err.code !== 'ENOENT') {
                    errorLogger.error({ err, path: filePath }, 'Cron tmp cleanup: failed to process file');
                }
            }
        }

        if (removed > 0) {
            logger.info({ removed, dir: TMP_DIR }, 'Cron tmp cleanup: stale files removed');
        }
    } catch (err) {
        errorLogger.error({ err, dir: TMP_DIR }, 'Cron tmp cleanup: failed to read tmp directory');
    }
}

/**
 * Enregistre les tâches cron de l'application.
 */
export function registerCronJobs() {
    // Toutes les heures (minute 0), nettoyer storage/tmp
    cron.schedule('0 * * * *', cleanTmp);

    logger.info('Cron jobs registered (tmp cleanup every hour)');
}
