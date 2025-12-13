# TODO - Intégration Pino Logger

Guide d'implémentation complet pour intégrer Pino comme système de logging professionnel dans Puna.

---

## 📋 Vue d'ensemble

**Objectif** : Remplacer `console.log` et Morgan par Pino pour des logs structurés, performants et analysables.

**Stratégie** :
- 4 fichiers de logs avec formats spécifiques
- Rotation quotidienne avec compression
- Helpers pour logging cohérent
- Interface admin pour consultation
- Migration progressive

**Durée estimée** : 2-3 heures

---

## 📦 Phase 1 : Installation des dépendances

### 1.1 Installer les packages

```bash
npm install pino pino-http pino-roll
```

**Packages** :
- `pino` (^8.16.2) - Logger principal
- `pino-http` (^8.5.1) - Middleware HTTP automatique
- `pino-roll` (^1.1.0) - Rotation et compression des logs

### 1.2 Créer le dossier logs

```bash
mkdir -p logs/archives
```

### 1.3 Ajouter au .gitignore

```bash
# .gitignore
logs/
*.log
*.log.*
*.gz
```

---

## 🔧 Phase 2 : Configuration Pino

### 2.1 Créer `src/config/logger.js`

**Fichier** : `src/config/logger.js`

```javascript
import pino from 'pino';
import pinoRoll from 'pino-roll';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const logDir = path.join(projectRoot, 'logs');
const archiveDir = path.join(logDir, 'archives');

// Configuration selon environnement
const config = {
    development: {
        level: 'debug',
        retention: 7,
    },
    production: {
        level: 'info',
        retention: 30,
    }
};

const env = process.env.NODE_ENV || 'development';
const { level, retention } = config[env];

// ============================================
// STREAMS (destinations des logs)
// ============================================

// 1. app.log - Logs applicatifs généraux
const appStream = pinoRoll({
    file: path.join(logDir, 'app.log'),
    frequency: 'daily',
    size: '100M',
    extension: '.gz',
    mkdir: true,
    archiveFolder: archiveDir,
    retention: retention
});

// 2. api.log - Logs API uniquement
const apiStream = pinoRoll({
    file: path.join(logDir, 'api.log'),
    frequency: 'daily',
    size: '100M',
    extension: '.gz',
    mkdir: true,
    archiveFolder: archiveDir,
    retention: 60  // Garder plus longtemps pour analytics
});

// 3. error.log - Erreurs uniquement
const errorStream = pinoRoll({
    file: path.join(logDir, 'error.log'),
    frequency: 'daily',
    size: '50M',
    extension: '.gz',
    mkdir: true,
    archiveFolder: archiveDir,
    retention: 90  // Garder longtemps pour debugging
});

// 4. audit.log - Événements de sécurité
const auditStream = pinoRoll({
    file: path.join(logDir, 'audit.log'),
    frequency: 'daily',
    size: '50M',
    extension: '.gz',
    mkdir: true,
    archiveFolder: archiveDir,
    retention: 365  // 1 an pour conformité
});

// ============================================
// LOGGERS
// ============================================

// Logger principal (app.log)
export const logger = pino(
    {
        level: level,
        timestamp: pino.stdTimeFunctions.isoTime
    },
    appStream
);

// Logger API (api.log)
export const apiLogger = pino(
    {
        level: 'info',
        timestamp: pino.stdTimeFunctions.isoTime
    },
    apiStream
);

// Logger erreurs (error.log)
export const errorLogger = pino(
    {
        level: 'error',
        timestamp: pino.stdTimeFunctions.isoTime
    },
    errorStream
);

// Logger audit (audit.log)
export const auditLogger = pino(
    {
        level: 'info',
        timestamp: pino.stdTimeFunctions.isoTime
    },
    auditStream
);

// Log de démarrage
logger.info({
    env,
    logLevel: level,
    retention: `${retention} days`,
    logDir
}, 'Logger Pino configuré');
```

### 2.2 Ajouter variables d'environnement

**Fichier** : `.env`

```env
# Logs
LOG_LEVEL=info                      # trace, debug, info, warn, error, fatal
LOG_RETENTION_DAYS=30               # Durée conservation logs généraux
LOG_ERROR_RETENTION_DAYS=90         # Durée conservation erreurs
LOG_AUDIT_RETENTION_DAYS=365        # Durée conservation audit
LOG_MAX_SIZE=100M                   # Taille max avant rotation
```

**Fichier** : `.env.example`

```env
# Logs
LOG_LEVEL=info
LOG_RETENTION_DAYS=30
LOG_ERROR_RETENTION_DAYS=90
LOG_AUDIT_RETENTION_DAYS=365
LOG_MAX_SIZE=100M
```

---

## 🎯 Phase 3 : Helpers de logging

### 3.1 Créer `src/helpers/logging.helpers.js`

**Fichier** : `src/helpers/logging.helpers.js`

```javascript
import { logger, apiLogger, errorLogger, auditLogger } from '../config/logger.js';

// ============================================
// HELPERS POUR ACTIONS APP
// ============================================

/**
 * Logger une action métier dans app.log
 */
export function logAction(action, data, message) {
    logger.info({
        action,
        ...data
    }, message);
}

/**
 * Logger une erreur d'action dans app.log + error.log
 */
export function logActionError(action, error, data, message) {
    // 1. Log dans app.log (format action)
    logger.error({
        action,
        err: {
            type: error.name,
            message: error.message
        },
        ...data
    }, message);

    // 2. Log dans error.log (format erreur avec stack)
    errorLogger.error({
        err: error,
        context: action,
        ...data
    }, message);
}

// ============================================
// HELPERS POUR API
// ============================================

/**
 * Logger un succès API dans api.log
 */
export function logApiSuccess(req, additionalData, message) {
    apiLogger.info({
        method: req.method,
        url: req.url,
        statusCode: 200,
        ip: req.ip,
        ...additionalData
    }, message);
}

/**
 * Logger une erreur API dans api.log + error.log
 */
export function logApiError(req, error, additionalData, message) {
    const baseData = {
        method: req.method,
        url: req.url,
        ip: req.ip,
        ...additionalData
    };

    // 1. Log dans api.log (format API)
    apiLogger.error({
        ...baseData,
        statusCode: error.statusCode || 500,
        errorMessage: error.message
    }, message);

    // 2. Log dans error.log (format erreur)
    errorLogger.error({
        err: error,
        context: 'api_request',
        url: req.url,
        method: req.method,
        ...additionalData
    }, message);
}

/**
 * Logger une erreur d'authentification API dans api.log + audit.log
 */
export function logApiAuthFailure(req, reason, additionalData = {}) {
    const baseData = {
        ip: req.ip,
        url: req.url,
        method: req.method,
        reason,
        ...additionalData
    };

    // 1. Log dans api.log (format API)
    apiLogger.warn({
        ...baseData,
        statusCode: 401
    }, 'API authentication failed');

    // 2. Log dans audit.log (format sécurité)
    auditLogger.warn({
        event: 'API_AUTH_FAILED',
        ip: req.ip,
        url: req.url,
        reason,
        ...additionalData
    }, 'Tentative accès API non autorisée');
}

/**
 * Logger un fichier rejeté dans api.log + error.log
 */
export function logFileRejected(req, fileName, fileType, reason, additionalData = {}) {
    const baseData = {
        fileName,
        fileType,
        reason,
        ip: req.ip,
        ...additionalData
    };

    // 1. Log dans api.log (format API)
    apiLogger.error({
        method: req.method,
        url: req.url,
        statusCode: 400,
        ...baseData
    }, 'Fichier rejeté');

    // 2. Log dans error.log (format erreur)
    errorLogger.error({
        context: 'file_validation',
        ...baseData
    }, 'Fichier rejeté');
}

// ============================================
// HELPERS POUR AUDIT
// ============================================

/**
 * Logger une connexion réussie dans audit.log
 */
export function logAuthSuccess(userId, email, req) {
    auditLogger.info({
        event: 'AUTH_LOGIN_SUCCESS',
        userId,
        email,
        ip: req.ip,
        userAgent: req.headers['user-agent']
    }, 'Connexion réussie');
}

/**
 * Logger une tentative de connexion échouée dans audit.log
 */
export function logAuthFailure(email, reason, req, attemptCount = 1) {
    auditLogger.warn({
        event: 'AUTH_LOGIN_FAILED',
        email,
        reason,
        ip: req.ip,
        attemptCount,
        userAgent: req.headers['user-agent']
    }, 'Tentative connexion échouée');
}

/**
 * Logger un changement de mot de passe dans audit.log
 */
export function logPasswordChanged(userId, req) {
    auditLogger.info({
        event: 'AUTH_PASSWORD_CHANGED',
        userId,
        ip: req.ip
    }, 'Mot de passe modifié');
}

/**
 * Logger une suppression de données dans app.log + audit.log
 */
export function logDataDeletion(entity, entityId, userId, additionalData = {}) {
    // 1. Log dans app.log (action métier)
    logger.warn({
        action: `${entity}_deleted`,
        userId,
        [`${entity}Id`]: entityId,
        ...additionalData
    }, `${entity} supprimé`);

    // 2. Log dans audit.log (sécurité)
    auditLogger.warn({
        event: 'DATA_DELETED',
        entity,
        entityId,
        userId,
        ...additionalData
    }, `Suppression de ${entity}`);
}

/**
 * Logger un accès refusé dans app.log + audit.log
 */
export function logAccessDenied(userId, userRole, resource, requiredRole, additionalData = {}) {
    // 1. Log dans app.log
    logger.warn({
        action: 'access_denied',
        userId,
        userRole,
        resource,
        requiredRole,
        ...additionalData
    }, 'Accès refusé');

    // 2. Log dans audit.log
    auditLogger.warn({
        event: 'ACCESS_DENIED',
        userId,
        userRole,
        resource,
        requiredRole,
        ...additionalData
    }, 'Accès refusé');
}

/**
 * Logger une création d'utilisateur dans app.log + audit.log
 */
export function logUserCreated(createdUserId, createdUserEmail, createdUserRole, byUserId, byUserEmail) {
    // 1. Log dans app.log
    logger.info({
        action: 'user_created',
        userId: byUserId,
        createdUserId,
        createdUserEmail,
        createdUserRole
    }, 'Utilisateur créé');

    // 2. Log dans audit.log
    auditLogger.info({
        event: 'USER_CREATED',
        createdUserId,
        createdUserEmail,
        createdUserRole,
        byUserId,
        byUserEmail
    }, 'Création utilisateur');
}

/**
 * Logger une modification de rôle dans app.log + audit.log
 */
export function logRoleChanged(targetUserId, oldRole, newRole, byUserId) {
    // 1. Log dans app.log
    logger.info({
        action: 'role_changed',
        userId: byUserId,
        targetUserId,
        oldRole,
        newRole
    }, 'Rôle utilisateur modifié');

    // 2. Log dans audit.log
    auditLogger.info({
        event: 'ROLE_CHANGED',
        targetUserId,
        oldRole,
        newRole,
        byUserId
    }, 'Modification de rôle');
}
```

---

## 🔄 Phase 4 : Intégration dans l'application

### 4.1 Intégrer dans app.js (middleware HTTP)

**Fichier** : `src/app.js`

**Modifier** :

```javascript
// Remplacer Morgan par Pino HTTP
import pinoHttp from 'pino-http';
import { apiLogger, logger } from './config/logger.js';

// ... autres imports

// Supprimer ou commenter Morgan
// app.use(morgan('combined', { skip: ... }));

// Ajouter Pino HTTP (après express.json/urlencoded)
app.use((req, res, next) => {
    const isApi = req.url.startsWith('/api/') || req.url.startsWith('/send/');

    // Utiliser le bon logger selon le type de requête
    const httpLogger = pinoHttp({
        logger: isApi ? apiLogger : logger,
        autoLogging: true,
        customLogLevel: (req, res, err) => {
            if (res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
        }
    });

    httpLogger(req, res);
    next();
});
```

### 4.2 Intégrer dans auth.controller.js

**Fichier** : `src/controllers/auth.controller.js`

**Ajouter au début** :
```javascript
import { logAuthSuccess, logAuthFailure, logPasswordChanged } from '../helpers/logging.helpers.js';
```

**Dans `dpConnect`** :
```javascript
export async function dpConnect(req, res) {
    const { email, password } = req.body;

    try {
        const user = await authenticateUser(email, password);

        // ✅ Logger connexion réussie
        logAuthSuccess(user.id, user.email, req);

        req.session.userId = user.id;
        res.redirect('/dashboard');

    } catch (error) {
        // ✅ Logger tentative échouée
        logAuthFailure(email, error.message, req);

        res.render('pages/auth/login', { error: 'Identifiants invalides' });
    }
}
```

**Dans `dpPasswordUpdate` (changement mot de passe)** :
```javascript
export async function dpPasswordUpdate(req, res) {
    try {
        // ... logique changement mot de passe

        // ✅ Logger changement mot de passe
        logPasswordChanged(req.session.userId, req);

        res.redirect('/dashboard');
    } catch (error) {
        // ...
    }
}
```

### 4.3 Intégrer dans les services

**Exemples dans les fichiers services** :

**`src/services/site.service.js`** :
```javascript
import { logAction, logActionError } from '../helpers/logging.helpers.js';

export async function createSite(siteData, userId) {
    try {
        logAction('site_creation_started', { userId, siteName: siteData.name }, 'Création d\'un site');

        const site = await models.Site.create(siteData);

        logAction('site_created', {
            userId,
            siteId: site.id,
            siteName: site.name
        }, 'Site créé avec succès');

        return site;

    } catch (error) {
        logActionError('site_creation', error, { userId, siteName: siteData.name }, 'Échec création site');
        throw error;
    }
}

export async function deleteSite(siteId, userId) {
    const site = await models.Site.findByPk(siteId);
    await site.destroy();

    logDataDeletion('site', siteId, userId, { siteName: site.name });

    return true;
}
```

**`src/services/form.service.js`** :
```javascript
import { logAction, logActionError } from '../helpers/logging.helpers.js';

export async function createForm(formData, userId) {
    try {
        logAction('form_creation_started', { userId, formName: formData.name }, 'Création formulaire');

        const form = await models.Form.create(formData);

        logAction('form_created', {
            userId,
            formId: form.id,
            siteId: form.site_id
        }, 'Formulaire créé');

        return form;
    } catch (error) {
        logActionError('form_creation', error, { userId }, 'Échec création formulaire');
        throw error;
    }
}
```

### 4.4 Intégrer dans API handlers

**Fichier** : `src/api/v1/handlers/send.handler.js`

```javascript
import { logApiSuccess, logApiError } from '../../../helpers/logging.helpers.js';

export async function handleSend(req, res) {
    const decoded = req.jwtDecoded;

    try {
        const result = await saveInbox(req.body, req.files);

        // ✅ Logger succès API
        logApiSuccess(req, {
            siteId: decoded.siteId,
            formId: decoded.formId,
            submissionId: result.id,
            fileCount: req.files?.length || 0
        }, 'Soumission API réussie');

        res.json({ success: true, id: result.id });

    } catch (error) {
        // ✅ Logger erreur API
        logApiError(req, error, {
            siteId: decoded.siteId,
            formId: decoded.formId,
            fileCount: req.files?.length || 0
        }, 'Erreur soumission API');

        res.status(500).json({ success: false, error: error.message });
    }
}
```

### 4.5 Intégrer dans middlewares

**Fichier** : `src/api/v1/middlewares/authApiKeyAccess.js`

```javascript
import { logApiAuthFailure } from '../../../helpers/logging.helpers.js';

export function authApiKeyAccess(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        // ✅ Logger échec auth API
        logApiAuthFailure(req, 'Missing token');
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, process.env.KEY_TK);
        req.jwtDecoded = decoded;
        next();
    } catch (error) {
        // ✅ Logger token invalide
        logApiAuthFailure(req, 'Invalid token', {
            tokenPrefix: token.substring(0, 10) + '...'
        });
        return res.status(401).json({ success: false, error: 'Invalid token' });
    }
}
```

**Fichier** : `src/api/v1/middlewares/validateUpload.js`

```javascript
import { logFileRejected } from '../../../helpers/logging.helpers.js';

export function validateUpload(req, res, next) {
    const files = req.files;

    for (const file of files) {
        if (!isAllowedExtension(file.originalname)) {
            // ✅ Logger fichier rejeté
            logFileRejected(
                req,
                file.originalname,
                file.mimetype,
                'File type not allowed',
                {
                    formId: req.jwtDecoded?.formId,
                    fileSize: file.size
                }
            );

            return res.status(400).json({
                success: false,
                error: 'File type not allowed'
            });
        }
    }

    next();
}
```

**Fichier** : `src/middlewares/checkAccess.js`

```javascript
import { logAccessDenied } from '../helpers/logging.helpers.js';

export function actionAccess(entity, action) {
    return async (req, res, next) => {
        const userRole = req.session.userRole;
        const permissions = getPermissions(userRole);

        if (!permissions[entity]?.[action]) {
            // ✅ Logger accès refusé
            logAccessDenied(
                req.session.userId,
                userRole,
                entity,
                'required_permission',
                { action, resourceId: req.params.id }
            );

            return res.status(403).render('errors/403');
        }

        next();
    };
}
```

---

## 🧹 Phase 5 : Scripts de maintenance

### 5.1 Créer script de nettoyage

**Fichier** : `scripts/clean-logs.js`

```javascript
import fs from 'fs/promises';
import path from 'path';

const archiveDir = path.resolve('./logs/archives');
const retentionDays = {
    app: 30,
    api: 60,
    error: 90,
    audit: 365
};

async function cleanOldLogs() {
    console.log('🧹 Nettoyage des logs anciens...');

    try {
        const files = await fs.readdir(archiveDir);
        const now = Date.now();
        let deletedCount = 0;

        for (const file of files) {
            const filePath = path.join(archiveDir, file);
            const stats = await fs.stat(filePath);
            const ageInDays = (now - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

            // Déterminer le type de log
            let maxAge = 30;
            if (file.startsWith('error-')) maxAge = retentionDays.error;
            else if (file.startsWith('api-')) maxAge = retentionDays.api;
            else if (file.startsWith('audit-')) maxAge = retentionDays.audit;
            else if (file.startsWith('app-')) maxAge = retentionDays.app;

            // Supprimer si trop vieux
            if (ageInDays > maxAge) {
                await fs.unlink(filePath);
                console.log(`🗑️  Supprimé: ${file} (${Math.floor(ageInDays)} jours)`);
                deletedCount++;
            }
        }

        console.log(`✅ Nettoyage terminé: ${deletedCount} fichier(s) supprimé(s)`);

    } catch (error) {
        console.error('❌ Erreur lors du nettoyage:', error);
        process.exit(1);
    }
}

cleanOldLogs();
```

### 5.2 Créer script de statistiques

**Fichier** : `scripts/logs-stats.js`

```javascript
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const logDir = path.resolve('./logs');

console.log('📊 Statistiques des logs\n');

// Taille des logs
try {
    const totalSize = execSync(`du -sh ${logDir}`).toString().split('\t')[0];
    console.log(`📁 Taille totale: ${totalSize}`);

    const files = ['app.log', 'api.log', 'error.log', 'audit.log'];
    files.forEach(file => {
        const filePath = path.join(logDir, file);
        if (fs.existsSync(filePath)) {
            const size = execSync(`du -sh ${filePath}`).toString().split('\t')[0];
            console.log(`   - ${file}: ${size}`);
        }
    });

    console.log('');
} catch (error) {
    console.error('Erreur:', error.message);
}

// Nombre de lignes
console.log('📝 Nombre de lignes:');
['app.log', 'api.log', 'error.log', 'audit.log'].forEach(file => {
    const filePath = path.join(logDir, file);
    if (fs.existsSync(filePath)) {
        try {
            const lines = execSync(`wc -l < ${filePath}`).toString().trim();
            console.log(`   - ${file}: ${lines} lignes`);
        } catch (error) {
            console.log(`   - ${file}: 0 lignes`);
        }
    }
});
```

### 5.3 Ajouter scripts npm

**Fichier** : `package.json`

```json
{
  "scripts": {
    "logs:clean": "node scripts/clean-logs.js",
    "logs:stats": "node scripts/logs-stats.js",
    "logs:view:app": "tail -f logs/app.log | pino-pretty",
    "logs:view:api": "tail -f logs/api.log | pino-pretty",
    "logs:view:error": "tail -f logs/error.log | pino-pretty",
    "logs:view:audit": "tail -f logs/audit.log | pino-pretty"
  }
}
```

**Note** : Installer `pino-pretty` pour lecture facile en dev :
```bash
npm install --save-dev pino-pretty
```

---

## 🖥️ Phase 6 : Interface admin pour logs

### 6.1 Créer controller admin logs

**Fichier** : `src/controllers/admin.controller.js`

**Ajouter** :

```javascript
import fs from 'fs/promises';
import path from 'path';

/**
 * Liste des fichiers de logs
 */
export async function adminLogsList(req, res) {
    try {
        const logDir = path.resolve('./logs');
        const files = await fs.readdir(logDir);

        // Filtrer uniquement les .log
        const logFiles = files.filter(f => f.endsWith('.log'));

        // Récupérer infos pour chaque fichier
        const filesWithStats = await Promise.all(
            logFiles.map(async (file) => {
                const filePath = path.join(logDir, file);
                const stats = await fs.stat(filePath);
                return {
                    name: file,
                    size: stats.size,
                    sizeFormatted: formatBytes(stats.size),
                    modified: stats.mtime
                };
            })
        );

        res.render('pages/admin/logs/list', {
            title: 'Logs - Administration',
            files: filesWithStats
        });

    } catch (error) {
        console.error('Erreur lecture logs:', error);
        res.status(500).render('errors/500');
    }
}

/**
 * Afficher un fichier de log
 */
export async function adminLogsView(req, res) {
    try {
        const { filename } = req.params;
        const logDir = path.resolve('./logs');
        const filePath = path.join(logDir, filename);

        // Sécurité: vérifier que le fichier est bien dans logs/
        if (!filePath.startsWith(logDir)) {
            return res.status(403).render('errors/403');
        }

        // Lire le fichier
        const content = await fs.readFile(filePath, 'utf-8');

        // Parser les lignes JSON
        const logs = content
            .split('\n')
            .filter(Boolean)
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    return null;
                }
            })
            .filter(Boolean)
            .reverse()  // Plus récent en premier
            .slice(0, 500);  // Limiter à 500 lignes

        res.render('pages/admin/logs/view', {
            title: `Log - ${filename}`,
            filename,
            logs
        });

    } catch (error) {
        console.error('Erreur lecture fichier log:', error);
        res.status(500).render('errors/500');
    }
}

/**
 * Télécharger un fichier de log
 */
export async function adminLogsDownload(req, res) {
    try {
        const { filename } = req.params;
        const logDir = path.resolve('./logs');
        const filePath = path.join(logDir, filename);

        // Sécurité
        if (!filePath.startsWith(logDir)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        res.download(filePath, filename);

    } catch (error) {
        console.error('Erreur téléchargement log:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Helper pour formater les bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
```

### 6.2 Ajouter routes admin logs

**Fichier** : `src/routes/default.routes.js`

**Ajouter** :

```javascript
import { adminLogsList, adminLogsView, adminLogsDownload } from '../controllers/admin.controller.js';

// Routes logs (super_admin uniquement)
router.get(
    '/admin/logs',
    isConnected,
    roleAccess(['super_admin']),
    adminLogsList
);

router.get(
    '/admin/logs/view/:filename',
    isConnected,
    roleAccess(['super_admin']),
    adminLogsView
);

router.get(
    '/admin/logs/download/:filename',
    isConnected,
    roleAccess(['super_admin']),
    adminLogsDownload
);
```

### 6.3 Créer vue liste des logs

**Fichier** : `src/views/pages/admin/logs/list.hbs`

```handlebars
<div class="container mx-auto px-4 py-8">
    <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold">Logs Système</h1>
    </div>

    <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fichier
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Taille
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Dernière modification
                    </th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Actions
                    </th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                {{#each files}}
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <i class="fas fa-file-alt text-gray-400 mr-2"></i>
                            <span class="font-medium">{{this.name}}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {{this.sizeFormatted}}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {{formatDate this.modified}}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <a href="/admin/logs/view/{{this.name}}" class="text-blue-600 hover:text-blue-900 mr-4">
                            <i class="fas fa-eye"></i> Voir
                        </a>
                        <a href="/admin/logs/download/{{this.name}}" class="text-green-600 hover:text-green-900">
                            <i class="fas fa-download"></i> Télécharger
                        </a>
                    </td>
                </tr>
                {{/each}}
            </tbody>
        </table>
    </div>
</div>
```

### 6.4 Créer vue détail d'un log

**Fichier** : `src/views/pages/admin/logs/view.hbs`

```handlebars
<div class="container mx-auto px-4 py-8">
    <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">{{filename}}</h1>
        <div>
            <a href="/admin/logs/download/{{filename}}" class="btn btn-primary">
                <i class="fas fa-download"></i> Télécharger
            </a>
            <a href="/admin/logs" class="btn btn-secondary ml-2">
                <i class="fas fa-arrow-left"></i> Retour
            </a>
        </div>
    </div>

    <div class="bg-gray-900 rounded-lg p-4 overflow-x-auto">
        <div class="text-sm font-mono text-gray-300 space-y-1">
            {{#each logs}}
            <div class="border-b border-gray-700 pb-2 mb-2">
                <div class="flex items-start">
                    <span class="text-gray-500 mr-2">{{formatDate this.time}}</span>
                    <span class="px-2 py-1 rounded text-xs mr-2
                        {{#if (eq this.level 'error')}}bg-red-600{{/if}}
                        {{#if (eq this.level 'warn')}}bg-yellow-600{{/if}}
                        {{#if (eq this.level 'info')}}bg-blue-600{{/if}}">
                        {{this.level}}
                    </span>
                    <span class="flex-1">{{this.msg}}</span>
                </div>
                {{#if this.err}}
                <div class="mt-2 ml-8 text-red-400 text-xs">
                    <strong>Error:</strong> {{this.err.message}}
                </div>
                {{/if}}
            </div>
            {{/each}}
        </div>
    </div>
</div>
```

### 6.5 Ajouter lien dans sidebar admin

**Fichier** : `src/views/partials/admin_sidebar.hbs`

**Ajouter** :

```handlebars
{{#roleIs role='super_admin'}}
<li>
    <a href="/admin/logs" class="{{#if (eq currentPage 'admin_logs')}}active{{/if}}">
        <i class="fas fa-file-alt"></i>
        <span>Logs</span>
    </a>
</li>
{{/roleIs}}
```

---

## 🧪 Phase 7 : Tests

### 7.1 Vérifier création des fichiers

```bash
# Démarrer l'app
npm run dev

# Vérifier que les fichiers sont créés
ls -lh logs/
# Devrait afficher: app.log, api.log, error.log, audit.log
```

### 7.2 Tester les logs

```bash
# En parallèle, dans un autre terminal
npm run logs:view:app

# Faire des actions dans l'app et vérifier les logs
```

### 7.3 Tester la rotation

```bash
# Forcer une rotation (attendre minuit ou modifier manually la date)
# Vérifier que les archives sont créées dans logs/archives/
ls -lh logs/archives/
```

### 7.4 Tester l'interface admin

1. Se connecter en tant que `super_admin`
2. Aller sur `/admin/logs`
3. Vérifier la liste des fichiers
4. Cliquer sur "Voir" pour un fichier
5. Télécharger un fichier

---

## 📋 Phase 8 : Nettoyage et migration

### 8.1 Supprimer/Commenter Morgan

**Fichier** : `src/app.js`

```javascript
// ❌ À supprimer ou commenter
// import morgan from 'morgan';
// app.use(morgan('combined', { ... }));
```

### 8.2 Remplacer progressivement console.log

**Stratégie** : Remplacer au fur et à mesure les `console.log` par les helpers Pino.

**Rechercher dans le projet** :
```bash
grep -r "console.log" src/
grep -r "console.error" src/
grep -r "console.warn" src/
```

**Remplacer par** :
```javascript
// ❌ Avant
console.log('Site créé:', siteId);

// ✅ Après
logAction('site_created', { siteId }, 'Site créé');
```

### 8.3 Mettre à jour SECURITY.md

**Fichier** : `SECURITY.md`

**Ajouter une section** :

```markdown
## 📊 Logs & Audit

Puna utilise **Pino** pour un logging structuré et performant.

### Fichiers de logs

| Fichier | Contenu | Rétention |
|---------|---------|-----------|
| `logs/app.log` | Activité générale de l'application | 30 jours |
| `logs/api.log` | Appels API publiques | 60 jours |
| `logs/error.log` | Toutes les erreurs | 90 jours |
| `logs/audit.log` | Événements de sécurité | 1 an |

### Événements loggés

- ✅ Connexions/déconnexions (audit.log)
- ✅ Créations/modifications/suppressions (app.log + audit.log)
- ✅ Appels API (api.log)
- ✅ Erreurs applicatives (error.log)
- ✅ Accès refusés (audit.log)
- ✅ Fichiers rejetés (api.log + error.log)

### Consultation des logs

Les logs sont consultables par les `super_admin` via `/admin/logs`.
```

---

## ✅ Checklist finale

### Configuration
- [ ] Packages installés (pino, pino-http, pino-roll)
- [ ] Dossier `logs/` créé et dans `.gitignore`
- [ ] `src/config/logger.js` créé avec 4 loggers
- [ ] Variables d'environnement ajoutées (.env, .env.example)

### Helpers
- [ ] `src/helpers/logging.helpers.js` créé
- [ ] Helpers pour actions app
- [ ] Helpers pour API
- [ ] Helpers pour audit

### Intégration
- [ ] Middleware pino-http dans app.js
- [ ] Logs dans auth.controller.js (login, password)
- [ ] Logs dans services (site, form, inbox, user)
- [ ] Logs dans API handlers
- [ ] Logs dans middlewares (auth, validation, access)

### Interface admin
- [ ] Routes `/admin/logs/*` créées
- [ ] Controller `adminLogsList`, `adminLogsView`, `adminLogsDownload`
- [ ] Vues `list.hbs` et `view.hbs` créées
- [ ] Lien dans sidebar admin

### Scripts
- [ ] `scripts/clean-logs.js` créé
- [ ] `scripts/logs-stats.js` créé
- [ ] Scripts npm ajoutés (logs:clean, logs:stats, logs:view:*)

### Tests
- [ ] Fichiers de logs créés au démarrage
- [ ] Logs apparaissent lors d'actions
- [ ] Rotation fonctionne (tester après minuit ou manuellement)
- [ ] Interface admin accessible et fonctionnelle
- [ ] Téléchargement de logs fonctionne

### Nettoyage
- [ ] Morgan supprimé/commenté
- [ ] console.log remplacés progressivement
- [ ] SECURITY.md mis à jour
- [ ] Documentation ajoutée

---

## 📚 Ressources

- [Documentation Pino](https://getpino.io/)
- [pino-http](https://github.com/pinojs/pino-http)
- [pino-roll](https://github.com/feugy/pino-roll)
- [Best practices logging Node.js](https://betterstack.com/community/guides/logging/how-to-install-setup-and-use-pino-to-log-node-js-applications/)

---

## 🎯 Résultat attendu

Après implémentation complète :

```
logs/
├── app.log              # Logs généraux (30 jours)
├── api.log              # Logs API (60 jours)
├── error.log            # Erreurs (90 jours)
├── audit.log            # Sécurité (365 jours)
└── archives/
    ├── app-2025-12-12.log.gz
    ├── api-2025-12-12.log.gz
    ├── error-2025-12-12.log.gz
    └── audit-2025-12-12.log.gz
```

**Interface admin** : `/admin/logs` (accessible super_admin uniquement)

**Logs structurés JSON** : Facilement analysables avec `jq`, ELK, Datadog, etc.

**Performance** : Pino est 5-6x plus rapide que Winston ou Bunyan.

---

**Durée estimée** : 2-3 heures pour implémentation complète

**Priorité** : Moyenne-Haute (améliore considérablement le debugging et la sécurité)

**Dernière mise à jour** : 13 décembre 2025
