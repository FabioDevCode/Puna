import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';

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
// STREAMS (destinations des logs)
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

// En développement, ajouter la console avec formatage lisible (sauf si LOG_TO_CONSOLE=false)
const logToConsole = process.env.LOG_TO_CONSOLE !== 'false';
if (env === 'development' && logToConsole) {
    streams.push({
        level,
        stream: pino.transport({
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'yyyy-mm-dd HH:MM:ss.l',
                ignore: 'pid,hostname,req,res,responseTime',
                messageFormat: '{msg} - {req.url}',
                singleLine: true,
            },
        }),
    });
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

// Logger principal (app.log) - avec console en dev
export const logger = pino(
    {
        level: level,
        timestamp: pino.stdTimeFunctions.isoTime,
    },
    env === 'development' ? pino.multistream(streams) : appStream
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
logger.info(
    {
        env,
        logLevel: level,
        retention: {
            app: `${appRetention} days`,
            api: `${apiRetention} days`,
            error: `${errorRetention} days`,
            audit: `${auditRetention} days`,
        },
        logDir,
    },
    'Logger Pino configuré'
);
