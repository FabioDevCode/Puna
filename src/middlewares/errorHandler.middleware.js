import { errorLogger } from '../config/logger.js';

/**
 * Middleware de gestion centralisée des erreurs
 *
 * Doit être enregistré EN DERNIER dans app.js (après toutes les routes).
 * Intercepte tout ce qui est passé à next(err).
 *
 * Comportement :
 * - Routes /api/*  → réponse JSON
 * - Routes web 5xx → render errors/500
 * - Routes web 404 → render errors/404
 * - Routes web 4xx → flash message + redirect /dashboard
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
        const message = statusCode >= 500 ? req.__('flash.server_error') : err.message || req.__('flash.unexpected_error');
        return res.status(statusCode).json({ error: message });
    }

    // ── Réponse pour les routes web ─────────────────────────────────────────
    // 5xx : page d’erreur dédiée
    if (statusCode >= 500) {
        return res.status(statusCode).render('errors/500', { layout: false });
    }

    // 404 : page not found dédiée
    if (statusCode === 404) {
        return res.status(404).render('errors/404', { layout: false });
    }

    // Autres 4xx (400/401/403) : flash message + redirect
    const flashMessage = err.message || req.__('flash.generic_error');
    if (typeof res.flash === 'function') {
        res.flash('error', flashMessage);
    }
    return res.redirect('/dashboard');
}
