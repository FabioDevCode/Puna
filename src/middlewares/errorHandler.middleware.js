import { errorLogger } from '../config/logger.js';

/**
 * Middleware de gestion centralisée des erreurs
 *
 * Doit être enregistré EN DERNIER dans app.js (après toutes les routes).
 * Intercepte tout ce qui est passé à next(err).
 *
 * Comportement :
 * - Routes /api/* → réponse JSON
 * - Routes web    → flash message + redirect /dashboard
 */
export function errorHandler(err, req, res, _next) {
    // Si les headers sont déjà envoyés (ex: streaming), on ne peut plus rien faire
    if (res.headersSent) {
        return;
    }

    const statusCode = err.statusCode || err.status || 500;
    const isApiRoute = req.originalUrl.startsWith('/api/');

    // Log structuré Pino — toujours tracé dans error.log
    errorLogger.error(
        {
            err,
            statusCode,
            method: req.method,
            url: req.originalUrl,
            userId: req.session?.user?.id ?? null,
            ip: req.ip,
        },
        err.message || 'Erreur inattendue'
    );

    // ── Réponse pour les routes API ─────────────────────────────────────────
    if (isApiRoute) {
        // Ne jamais exposer les détails d'une erreur 5xx vers l'extérieur
        const message = statusCode >= 500 ? 'Erreur serveur' : err.message || 'Erreur';
        return res.status(statusCode).json({ error: message });
    }

    // ── Réponse pour les routes web ─────────────────────────────────────────
    const flashMessage =
        statusCode >= 500 ? 'Une erreur inattendue est survenue.' : err.message || 'Une erreur est survenue.';

    if (typeof res.flash === 'function') {
        res.flash('error', flashMessage);
    }

    // Redirection contextuelle : revenir en arrière si possible, sinon dashboard
    const fallback = '/dashboard';
    return res.redirect(fallback);
}
