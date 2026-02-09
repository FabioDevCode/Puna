/**
 * ================================================================
 * PROTECTION CSRF — Double Submit Cookie Pattern
 * ================================================================
 * Utilise csrf-csrf pour protéger les routes web (POST/PUT/DELETE)
 * contre les attaques Cross-Site Request Forgery.
 *
 * Les routes API (/api/*, /send/*) sont EXCLUES car elles utilisent
 * l'authentification par token Bearer (pas de cookie de session).
 *
 * Date: 9 février 2026
 * ================================================================
 */

import { doubleCsrf } from 'csrf-csrf';

const isProduction = process.env.NODE_ENV === 'production';

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET,
    getSessionIdentifier: (req) => req.session?.id ?? '',
    cookieName: '__csrf',
    cookieOptions: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
        path: '/',
    },
    getCsrfTokenFromRequest: (req) => {
        // Chercher le token dans le body (formulaires) ou le header (AJAX)
        return req.body?._csrf || req.headers['x-csrf-token'];
    },
});

/**
 * Middleware CSRF conditionnel
 * - Exclut les routes API et /send (authentification par token Bearer)
 * - Protège toutes les routes web avec session
 */
export const csrfProtection = (req, res, next) => {
    // Exclure les routes API et les soumissions de formulaires publics
    if (req.path.startsWith('/api') || req.path.startsWith('/send')) {
        return next();
    }

    return doubleCsrfProtection(req, res, next);
};

/**
 * Middleware pour injecter le token CSRF dans res.locals
 * Rend {{ csrfToken }} disponible dans tous les templates Handlebars
 */
export const csrfTokenInjector = (req, res, next) => {
    // Ne pas générer de token pour les routes API/send
    if (req.path.startsWith('/api') || req.path.startsWith('/send')) {
        return next();
    }

    try {
        const token = generateCsrfToken(req, res);
        res.locals.csrfToken = token;
    } catch {
        // En cas d'erreur, ne pas bloquer la requête GET
        // Le token sera regénéré au prochain appel
        res.locals.csrfToken = '';
    }

    next();
};
