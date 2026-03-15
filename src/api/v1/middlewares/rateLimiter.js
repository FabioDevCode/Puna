import rateLimit from 'express-rate-limit';
import { apiLogger } from '../../../config/logger.js';

// Configuration depuis les variables d'environnement
const RATE_LIMIT_FORM_MAX = parseInt(process.env.RATE_LIMIT_FORM_MAX, 10) || 30;
const RATE_LIMIT_FORM_WINDOW_MS = parseInt(process.env.RATE_LIMIT_FORM_WINDOW_MS, 10) || 60 * 1000; // 1 minute par défaut

/**
 * Rate limiter par formulaire
 * Limite le nombre de soumissions par code de formulaire
 *
 * Configuration par défaut: 30 requêtes par minute par formulaire
 * Configurable via:
 * - RATE_LIMIT_FORM_MAX: nombre max de requêtes (défaut: 30)
 * - RATE_LIMIT_FORM_WINDOW_MS: fenêtre en ms (défaut: 60000 = 1 minute)
 */
export const formRateLimiter = rateLimit({
    windowMs: RATE_LIMIT_FORM_WINDOW_MS,
    max: RATE_LIMIT_FORM_MAX,
    keyGenerator: (req) => {
        // Clé unique basée sur le code du formulaire
        // Si le site est disponible (après authApiKeyAccess), on l'inclut pour plus de précision
        const siteId = req.site?.id || 'unknown';
        const formCode = req.params.code || 'unknown';
        return `form:${siteId}:${formCode}`;
    },
    message: {
        success: false,
        error: 'Too many requests',
        message: 'Trop de soumissions pour ce formulaire. Veuillez réessayer dans quelques instants.',
        retryAfter: Math.ceil(RATE_LIMIT_FORM_WINDOW_MS / 1000),
    },
    standardHeaders: true, // Retourne les headers `RateLimit-*`
    legacyHeaders: false, // Désactive les headers `X-RateLimit-*` obsolètes
    skipSuccessfulRequests: false, // Compte toutes les requêtes (succès et échecs)
    skipFailedRequests: false,
    handler: (req, res, next, options) => {
        // Log pour monitoring
        apiLogger.warn({ formCode: req.params.code, max: RATE_LIMIT_FORM_MAX, windowMs: RATE_LIMIT_FORM_WINDOW_MS }, 'Rate limit atteint');

        res.status(429).json(options.message);
    },
});

export default formRateLimiter;
