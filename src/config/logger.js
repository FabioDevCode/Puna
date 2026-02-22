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
};

const env = process.env.NODE_ENV || 'development';
const { level, appRetention, apiRetention, errorRetention, auditRetention } = config[env];

// ============================================
// ROTATION QUOTIDIENNE PERSONNALISÉE
// ============================================

/**
 * Effectue la rotation des logs : archive les 4 fichiers dans une seule archive tar.gz
 * 100% asynchrone pour ne pas bloquer le thread principal
 */
export async function rotateAllLogs() {
    try {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        const dateStr = yesterday.toISOString().split('T')[0]; // Format: 2025-12-24
        const archiveName = `${dateStr}-archive-log.tar.gz`;
        const archivePath = path.join(archiveDir, archiveName);

        // Créer le dossier archives s'il n'existe pas (async)
        try {
            await fs.access(archiveDir);
        } catch {
            await fs.mkdir(archiveDir, { recursive: true });
        }

        const logFiles = ['app.log', 'api.log', 'error.log', 'audit.log'];
        const filesToArchive = [];

        // Vérifier quels fichiers existent et ne sont pas vides (async)
        for (const logFile of logFiles) {
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
            logger.debug('Rotation quotidienne : aucun fichier à archiver');
            return;
        }

        // Créer l'archive tar.gz (async via tar.create qui retourne une Promise)
        await tar.create(
            {
                gzip: true,
                file: archivePath,
                cwd: logDir,
            },
            filesToArchive
        );

        // Vider les fichiers archivés (async)
        await Promise.all(
            filesToArchive.map((logFile) => {
                const logPath = path.join(logDir, logFile);
                return fs.writeFile(logPath, '');
            })
        );

        const archiveStats = await fs.stat(archivePath);
        logger.info(`Rotation quotidienne effectuée : ${archiveName} (${formatBytes(archiveStats.size)})`);
    } catch (error) {
        logger.error({ err: error }, 'Erreur lors de la rotation des logs');
    }
}

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

// Planifier la rotation quotidienne à minuit (00:00)
cron.schedule('0 0 * * *', () => {
    logger.info('Déclenchement de la rotation quotidienne des logs');
    rotateAllLogs();
});

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
logger.info('  Rotation: quotidienne à minuit (archive unique)');
