/**
 * Classes d'erreurs personnalisées
 *
 * Usage dans un controller :
 *   throw new NotFoundError('Formulaire introuvable');
 *   throw new ForbiddenError();
 *
 * L'errorHandler central intercepte ces erreurs, log via Pino
 * et renvoie la réponse adaptée (JSON pour /api/*, redirect pour les routes web).
 */

/**
 * Erreur de base — toutes les erreurs héritent de celle-ci
 */
export class AppError extends Error {
    /**
     * @param {string} message - Message lisible
     * @param {number} statusCode - Code HTTP (400, 401, 403, 404, 500…)
     */
    constructor(message, statusCode = 500) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        Error.captureStackTrace(this, this.constructor);
    }
}

/** 404 — Ressource introuvable */
export class NotFoundError extends AppError {
    constructor(message = 'Ressource introuvable') {
        super(message, 404);
    }
}

/** 403 — Accès refusé */
export class ForbiddenError extends AppError {
    constructor(message = 'Accès refusé') {
        super(message, 403);
    }
}

/** 400 — Données invalides / validation échouée */
export class ValidationError extends AppError {
    constructor(message = 'Données invalides') {
        super(message, 400);
    }
}

/** 401 — Authentification requise */
export class UnauthorizedError extends AppError {
    constructor(message = 'Authentification requise') {
        super(message, 401);
    }
}
