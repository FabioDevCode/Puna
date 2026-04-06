import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import pino from 'pino';
import * as tar from 'tar';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const logDir = path.join(projectRoot, 'logs');
const archiveDir = path.join(logDir, 'archives');

// Configuration selon environnement
const config = {
    development: {
        level: 'debug',
        appRetention: 7,
        apiRetention: 14,
        errorRetention: 30,
        auditRetention: 90,
    },
    production: {
        level: 'info',
        appRetention: parseInt(process.env.LOG_RETENTION_APP, 10) || 7,
        apiRetention: parseInt(process.env.LOG_RETENTION_API, 10) || 14,
        errorRetention: parseInt(process.env.LOG_RETENTION_ERROR, 10) || 30,
        auditRetention: parseInt(process.env.LOG_RETENTION_AUDIT, 10) || 90,
    },
    test: {
        level: 'warn',
        appRetention: 1,
        apiRetention: 1,
        errorRetention: 1,
        auditRetention: 1,
    },
};

const env = process.env.NODE_ENV || 'development';
const { level, appRetention, apiRetention, errorRetention, auditRetention } = config[env];

// ============================================
// UTILITAIRES DE ROTATION
// ============================================

const LOG_FILES = ['app.log', 'api.log', 'error.log', 'audit.log'];

/**
 * Formatte les bytes en unités lisibles
 */
export function formatBytes(bytes) {
    if (bytes === 0) {
        return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Logique commune d'archivage des fichiers de log.
 * Crée une archive tar.gz contenant les fichiers non vides puis les vide.
 *
 * @param {string} dateStr  - Date à utiliser dans le nom (YYYY-MM-DD)
 * @param {string} suffix   - Suffixe du nom d'archive ('archive', 'startup', 'manual')
 * @param {Function} logFn  - Fonction de log ({ info, debug, error } ou console)
 * @returns {Promise<boolean>} true si une archive a été créée
 */
export async function archiveLogs(dateStr, suffix = 'archive', logFn = console) {
    // Créer le dossier archives s'il n'existe pas
    try {
        await fs.access(archiveDir);
    } catch {
        await fs.mkdir(archiveDir, { recursive: true });
    }

    const filesToArchive = [];

    // Vérifier quels fichiers existent et ne sont pas vides
    for (const logFile of LOG_FILES) {
        const logPath = path.join(logDir, logFile);
        try {
            const stats = await fs.stat(logPath);
            if (stats.size > 0) {
                filesToArchive.push(logFile);
            }
        } catch {
            // Fichier n'existe pas, on ignore
        }
    }

    if (filesToArchive.length === 0) {
        logFn.debug?.('Rotation : aucun fichier à archiver') ?? logFn.info?.('[logger] Rotation : aucun fichier à archiver');
        return false;
    }

    // Générer un nom d'archive unique (éviter les collisions en cas de redémarrages multiples)
    let archiveName = `${dateStr}-${suffix}-log.tar.gz`;
    let archivePath = path.join(archiveDir, archiveName);
    let counter = 1;
    while (true) {
        try {
            await fs.access(archivePath);
            // Le fichier existe déjà, incrémenter le compteur
            counter++;
            archiveName = `${dateStr}-${suffix}-${counter}-log.tar.gz`;
            archivePath = path.join(archiveDir, archiveName);
        } catch {
            break; // Le fichier n'existe pas, on peut l'utiliser
        }
    }

    // Créer l'archive tar.gz
    await tar.create(
        {
            gzip: true,
            file: archivePath,
            cwd: logDir,
        },
        filesToArchive
    );

    // SÉCURITÉ : vérifier que l'archive a bien été créée avant de vider les fichiers
    let archiveStats;
    try {
        archiveStats = await fs.stat(archivePath);
    } catch {
        const errMsg = `Échec de la rotation : l'archive ${archiveName} n'a pas été créée — les fichiers de log sont conservés intacts`;
        logFn.error?.(errMsg) ?? console.error(`[logger] ${errMsg}`);
        return false;
    }

    // Vider les fichiers archivés (seulement si l'archive existe)
    await Promise.all(
        filesToArchive.map((logFile) => {
            const logPath = path.join(logDir, logFile);
            return fs.writeFile(logPath, '');
        })
    );

    const msg = `Rotation effectuée : ${archiveName} (${formatBytes(archiveStats.size)})`;
    logFn.info?.(msg) ?? console.info(`[logger] ${msg}`);
    return true;
}

// ============================================
// ROTATION QUOTIDIENNE (CRON MINUIT)
// ============================================

/**
 * Effectue la rotation des logs : archive les 4 fichiers dans une seule archive tar.gz
 * Appelée par le cron à minuit — utilise la date de la veille comme nom d'archive.
 */
export async function rotateAllLogs() {
    try {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];

        await archiveLogs(dateStr, 'archive', logger);
    } catch (error) {
        logger.error({ err: error }, 'Erreur lors de la rotation des logs');
    }
}

// ============================================
// ROTATION AU DÉMARRAGE
// ============================================

/**
 * Lit la dernière ligne d'un fichier de log et extrait la date (YYYY-MM-DD).
 * Fallback sur la date de modification du fichier (mtime) si le contenu n'est pas parsable.
 *
 * @param {string} filePath - Chemin absolu vers le fichier log
 * @returns {Promise<string|null>} Date au format 'YYYY-MM-DD' ou null si le fichier est absent/vide
 */
export async function getLastLogDate(filePath) {
    try {
        const stats = await fs.stat(filePath);
        if (stats.size === 0) return null;

        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter((l) => l.trim().length > 0);
        if (lines.length === 0) return null;

        const lastLine = lines[lines.length - 1];
        try {
            const parsed = JSON.parse(lastLine);
            if (parsed.time) {
                // pino isoTime : "2025-12-23T15:30:00.000Z"
                return parsed.time.split('T')[0];
            }
        } catch {
            // JSON invalide — fallback mtime
        }

        // Fallback : date de dernière modification du fichier
        return stats.mtime.toISOString().split('T')[0];
    } catch {
        // Fichier absent
        return null;
    }
}

/**
 * Vérifie si les logs en cours datent d'un jour précédent.
 * Si oui, archive les fichiers puis les vide pour repartir proprement.
 * Appelée AVANT la création des streams Pino (utilise console pour le logging).
 */
export async function checkAndRotateOnStartup() {
    const today = new Date().toISOString().split('T')[0];
    let mostRecentLogDate = null;
    let needsRotation = false;

    for (const logFile of LOG_FILES) {
        const filePath = path.join(logDir, logFile);
        const logDate = await getLastLogDate(filePath);

        if (logDate && logDate !== today) {
            needsRotation = true;
        }

        // Garder la date la plus récente pour nommer l'archive
        if (logDate && (!mostRecentLogDate || logDate > mostRecentLogDate)) {
            mostRecentLogDate = logDate;
        }
    }

    if (!needsRotation) {
        console.info('[logger] Logs à jour, pas de rotation nécessaire au démarrage');
        return false;
    }

    const archiveDate = mostRecentLogDate || today;
    console.info(`[logger] Logs datés du ${archiveDate} détectés — rotation au démarrage...`);

    try {
        return await archiveLogs(archiveDate, 'startup', console);
    } catch (error) {
        console.error('[logger] Erreur lors de la rotation au démarrage :', error.message);
        return false;
    }
}

// ============================================
// ROTATION AU DÉMARRAGE (exécution synchrone avant streams)
// Ne pas exécuter en environnement de test (Vitest mock tar → pas de vraie archive)
// ============================================
if (!process.env.VITEST) {
    await checkAndRotateOnStartup();
}

// ============================================
// STREAMS (destinations des logs avec rotation)
// ============================================

// En développement, créer aussi un stream vers la console
const streams = [];

// 1. app.log - Logs applicatifs généraux
const appStream = pino.destination({
    dest: path.join(logDir, 'app.log'),
    mkdir: true,
    sync: false,
});

streams.push({ level, stream: appStream });

// Ajouter la console avec formatage lisible si LOG_TO_CONSOLE=true (défaut: true en dev, false en prod)
const logToConsole = process.env.LOG_TO_CONSOLE !== 'false';
if (logToConsole) {
    try {
        streams.push({
            level,
            stream: pino.transport({
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'yyyy-mm-dd HH:MM:ss.l',
                    ignore: 'pid,hostname,req,res,responseTime',
                    messageFormat: '{req.url} - {msg} - {res.statusCode}',
                    singleLine: true,
                },
            }),
        });
    } catch {
        // pino-pretty absent (container Docker sans devDependencies) — on continue sans console
        console.warn('[logger] pino-pretty unavailable, console stream disabled.');
    }
}

// 2. api.log - Logs API uniquement
const apiStream = pino.destination({
    dest: path.join(logDir, 'api.log'),
    mkdir: true,
    sync: false,
});

// 3. error.log - Erreurs uniquement
const errorStream = pino.destination({
    dest: path.join(logDir, 'error.log'),
    mkdir: true,
    sync: false,
});

// 4. audit.log - Événements de sécurité
const auditStream = pino.destination({
    dest: path.join(logDir, 'audit.log'),
    mkdir: true,
    sync: false,
});

// ============================================
// LOGGERS
// ============================================

// Logger principal (app.log) - avec console si LOG_TO_CONSOLE=true
export const logger = pino(
    {
        level: level,
        timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.multistream(streams)
);

// Logger API (api.log)
export const apiLogger = pino(
    {
        level: 'info',
        timestamp: pino.stdTimeFunctions.isoTime,
    },
    apiStream
);

// Logger erreurs (error.log)
export const errorLogger = pino(
    {
        level: 'error',
        timestamp: pino.stdTimeFunctions.isoTime,
    },
    errorStream
);

// Logger audit (audit.log)
export const auditLogger = pino(
    {
        level: 'info',
        timestamp: pino.stdTimeFunctions.isoTime,
    },
    auditStream
);

// Planifier la rotation quotidienne à minuit (00:00)
cron.schedule('0 0 * * *', () => {
    logger.info('Déclenchement de la rotation quotidienne des logs');
    rotateAllLogs();
});

// Log de démarrage
logger.info('Logger Pino configuré');
logger.info(`  Environnement: ${env}`);
logger.info(`  Niveau de log: ${level}`);
logger.info(`  Répertoire: ${logDir}`);
logger.info('  Rétention des logs:');
logger.info(`    - app.log: ${appRetention} jours`);
logger.info(`    - api.log: ${apiRetention} jours`);
logger.info(`    - error.log: ${errorRetention} jours`);
logger.info(`    - audit.log: ${auditRetention} jours`);
logger.info('  Rotation: quotidienne à minuit + vérification au démarrage');
