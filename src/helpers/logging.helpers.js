import { logger, apiLogger, errorLogger, auditLogger } from '../config/logger.js';

// ============================================
// HELPERS POUR ACTIONS APP
// ============================================

/**
 * Logger une action métier dans app.log
 * @param {string} action - Nom de l'action (ex: 'site_created', 'form_deleted')
 * @param {Object} data - Données contextuelles (userId, siteId, etc.)
 * @param {string} message - Message descriptif
 */
export function logAction(action, data, message) {
    logger.info(
        {
            action,
            ...data,
        },
        message
    );
}

/**
 * Logger une erreur d'action dans app.log + error.log
 * @param {string} action - Nom de l'action qui a échoué
 * @param {Error} error - Objet Error
 * @param {Object} data - Données contextuelles
 * @param {string} message - Message descriptif
 */
export function logActionError(action, error, data, message) {
    // 1. Log dans app.log (format action)
    logger.error(
        {
            action,
            err: {
                type: error.name,
                message: error.message,
            },
            ...data,
        },
        message
    );

    // 2. Log dans error.log (format erreur avec stack)
    errorLogger.error(
        {
            err: error,
            context: action,
            ...data,
        },
        message
    );
}

// ============================================
// HELPERS POUR API
// ============================================

/**
 * Logger un succès API dans api.log
 * @param {Object} req - Objet Request Express
 * @param {Object} additionalData - Données supplémentaires
 * @param {string} message - Message descriptif
 */
export function logApiSuccess(req, additionalData, message) {
    apiLogger.info(
        {
            method: req.method,
            url: req.url,
            statusCode: 200,
            ip: req.ip,
            ...additionalData,
        },
        message
    );
}

/**
 * Logger une erreur API dans api.log + error.log
 * @param {Object} req - Objet Request Express
 * @param {Error} error - Objet Error
 * @param {Object} additionalData - Données supplémentaires
 * @param {string} message - Message descriptif
 */
export function logApiError(req, error, additionalData, message) {
    const baseData = {
        method: req.method,
        url: req.url,
        ip: req.ip,
        ...additionalData,
    };

    // 1. Log dans api.log (format API)
    apiLogger.error(
        {
            ...baseData,
            statusCode: error.statusCode || 500,
            errorMessage: error.message,
        },
        message
    );

    // 2. Log dans error.log (format erreur)
    errorLogger.error(
        {
            err: error,
            context: 'api_request',
            url: req.url,
            method: req.method,
            ...additionalData,
        },
        message
    );
}

/**
 * Logger une erreur d'authentification API dans api.log + audit.log
 * @param {Object} req - Objet Request Express
 * @param {string} reason - Raison de l'échec
 * @param {Object} additionalData - Données supplémentaires
 */
export function logApiAuthFailure(req, reason, additionalData = {}) {
    const baseData = {
        ip: req.ip,
        url: req.url,
        method: req.method,
        reason,
        ...additionalData,
    };

    // 1. Log dans api.log (format API)
    apiLogger.warn(
        {
            ...baseData,
            statusCode: 401,
        },
        'API authentication failed'
    );

    // 2. Log dans audit.log (format sécurité)
    auditLogger.warn(
        {
            event: 'API_AUTH_FAILED',
            ip: req.ip,
            url: req.url,
            reason,
            ...additionalData,
        },
        'Tentative accès API non autorisée'
    );
}

/**
 * Logger un fichier rejeté dans api.log + error.log
 * @param {Object} req - Objet Request Express
 * @param {string} fileName - Nom du fichier
 * @param {string} fileType - Type MIME
 * @param {string} reason - Raison du rejet
 * @param {Object} additionalData - Données supplémentaires
 */
export function logFileRejected(req, fileName, fileType, reason, additionalData = {}) {
    const baseData = {
        fileName,
        fileType,
        reason,
        ip: req.ip,
        ...additionalData,
    };

    // 1. Log dans api.log (format API)
    apiLogger.error(
        {
            method: req.method,
            url: req.url,
            statusCode: 400,
            ...baseData,
        },
        'Fichier rejeté'
    );

    // 2. Log dans error.log (format erreur)
    errorLogger.error(
        {
            context: 'file_validation',
            ...baseData,
        },
        'Fichier rejeté'
    );
}

// ============================================
// HELPERS POUR AUDIT
// ============================================

/**
 * Logger une connexion réussie dans audit.log
 * @param {number} userId - ID de l'utilisateur
 * @param {string} email - Email de l'utilisateur
 * @param {Object} req - Objet Request Express
 */
export function logAuthSuccess(userId, email, req) {
    auditLogger.info(
        {
            event: 'AUTH_LOGIN_SUCCESS',
            userId,
            email,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        },
        'Connexion réussie'
    );
}

/**
 * Logger une tentative de connexion échouée dans audit.log
 * @param {string} email - Email de la tentative
 * @param {string} reason - Raison de l'échec
 * @param {Object} req - Objet Request Express
 * @param {number} attemptCount - Nombre de tentatives
 */
export function logAuthFailure(email, reason, req, attemptCount = 1) {
    auditLogger.warn(
        {
            event: 'AUTH_LOGIN_FAILED',
            email,
            reason,
            ip: req.ip,
            attemptCount,
            userAgent: req.headers['user-agent'],
        },
        'Tentative connexion échouée'
    );
}

/**
 * Logger un changement de mot de passe dans audit.log
 * @param {number} userId - ID de l'utilisateur
 * @param {Object} req - Objet Request Express
 */
export function logPasswordChanged(userId, req) {
    auditLogger.info(
        {
            event: 'AUTH_PASSWORD_CHANGED',
            userId,
            ip: req.ip,
        },
        'Mot de passe modifié'
    );
}

/**
 * Logger une suppression de données dans app.log + audit.log
 * @param {string} entity - Type d'entité (site, form, user, inbox)
 * @param {number} entityId - ID de l'entité
 * @param {number} userId - ID de l'utilisateur qui supprime
 * @param {Object} additionalData - Données supplémentaires
 */
export function logDataDeletion(entity, entityId, userId, additionalData = {}) {
    // 1. Log dans app.log (action métier)
    logger.warn(
        {
            action: `${entity}_deleted`,
            userId,
            [`${entity}Id`]: entityId,
            ...additionalData,
        },
        `${entity} supprimé`
    );

    // 2. Log dans audit.log (sécurité)
    auditLogger.warn(
        {
            event: 'DATA_DELETED',
            entity,
            entityId,
            userId,
            ...additionalData,
        },
        `Suppression de ${entity}`
    );
}

/**
 * Logger un accès refusé dans app.log + audit.log
 * @param {number} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @param {string} resource - Ressource demandée
 * @param {string} requiredRole - Rôle requis
 * @param {Object} additionalData - Données supplémentaires
 */
export function logAccessDenied(userId, userRole, resource, requiredRole, additionalData = {}) {
    // 1. Log dans app.log
    logger.warn(
        {
            action: 'access_denied',
            userId,
            userRole,
            resource,
            requiredRole,
            ...additionalData,
        },
        'Accès refusé'
    );

    // 2. Log dans audit.log
    auditLogger.warn(
        {
            event: 'ACCESS_DENIED',
            userId,
            userRole,
            resource,
            requiredRole,
            ...additionalData,
        },
        'Accès refusé'
    );
}

/**
 * Logger une création d'utilisateur dans app.log + audit.log
 * @param {number} createdUserId - ID de l'utilisateur créé
 * @param {string} createdUserEmail - Email de l'utilisateur créé
 * @param {string} createdUserRole - Rôle de l'utilisateur créé
 * @param {number} byUserId - ID de l'utilisateur créateur
 * @param {string} byUserEmail - Email de l'utilisateur créateur
 */
export function logUserCreated(createdUserId, createdUserEmail, createdUserRole, byUserId, byUserEmail) {
    // 1. Log dans app.log
    logger.info(
        {
            action: 'user_created',
            userId: byUserId,
            createdUserId,
            createdUserEmail,
            createdUserRole,
        },
        'Utilisateur créé'
    );

    // 2. Log dans audit.log
    auditLogger.info(
        {
            event: 'USER_CREATED',
            createdUserId,
            createdUserEmail,
            createdUserRole,
            byUserId,
            byUserEmail,
        },
        'Création utilisateur'
    );
}

/**
 * Logger une modification de rôle dans app.log + audit.log
 * @param {number} targetUserId - ID de l'utilisateur modifié
 * @param {string} oldRole - Ancien rôle
 * @param {string} newRole - Nouveau rôle
 * @param {number} byUserId - ID de l'utilisateur qui modifie
 */
export function logRoleChanged(targetUserId, oldRole, newRole, byUserId) {
    // 1. Log dans app.log
    logger.info(
        {
            action: 'role_changed',
            userId: byUserId,
            targetUserId,
            oldRole,
            newRole,
        },
        'Rôle utilisateur modifié'
    );

    // 2. Log dans audit.log
    auditLogger.info(
        {
            event: 'ROLE_CHANGED',
            targetUserId,
            oldRole,
            newRole,
            byUserId,
        },
        'Modification de rôle'
    );
}
