/**
 * ================================================================
 * MIDDLEWARE INJECTION USER ROLE
 * ================================================================
 * Middleware global pour exposer les informations utilisateur
 * dans les controllers (req.userRole, req.userId) et templates (res.locals.user)
 *
 * À installer AVANT les routes dans app.js:
 * import { injectUserRole } from './middlewares/injectUserRole.js';
 * app.use(injectUserRole);
 *
 * Date: 2 décembre 2025
 * ================================================================
 */

/**
 * Middleware pour injecter les informations utilisateur dans req et res.locals
 *
 * Ajoute:
 * - req.userRole → Rôle de l'utilisateur (string)
 * - req.userId → ID de l'utilisateur (UUID)
 * - res.locals.connectedUser → Objet user connecté (accessible dans les templates Handlebars)
 * - res.locals.userRole → Rôle (accessible dans les templates)
 * - res.locals.userId → ID (accessible dans les templates)
 *
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Callback next
 *
 * @example
 * // Dans un controller
 * export async function createSite(req, res) {
 *     const userRole = req.userRole; // ✅ Directement accessible
 *     const userId = req.userId;
 *
 *     if (userRole === 'beta') {
 *         // Vérifier rate limiting...
 *     }
 * }
 *
 * @example
 * // Dans un template Handlebars
 * <p>Bonjour {{connectedUser.login}} !</p>
 * <p>Votre rôle : {{userRole}}</p>
 * {{#if connectedUser}}
 *     <a href="/dashboard">Tableau de bord</a>
 * {{/if}}
 *
 * ⚠️ IMPORTANT: Dans les pages admin où tu affiches un autre utilisateur,
 * utilise un nom différent (viewedUser, user) pour éviter le conflit avec res.locals.connectedUser
 * Exemple: res.render('admin/users/edit', { user: userData })
 */
export function injectUserRole(req, res, next) {
    // Vérifier si un utilisateur est connecté
    if (req.session && req.session.user) {
        const user = req.session.user;

        // Injection dans req (accessible dans les controllers)
        req.userRole = user.role || null;
        req.userId = user.id || null;

        // Injection dans res.locals (accessible dans les templates Handlebars)
        res.locals.connectedUser = user;
        res.locals.userRole = user.role || null;
        res.locals.userId = user.id || null;

        // Helper pour vérifier si l'utilisateur est connecté (dans les templates)
        res.locals.isAuthenticated = true;
    } else {
        // Aucun utilisateur connecté
        req.userRole = null;
        req.userId = null;
        res.locals.connectedUser = null;
        res.locals.userRole = null;
        res.locals.userId = null;
        res.locals.isAuthenticated = false;
    }

    next();
}

/**
 * Helper pour obtenir le rôle de l'utilisateur depuis req
 * (Alternative si injectUserRole n'est pas utilisé)
 *
 * @param {Object} req - Requête Express
 * @returns {string|null} Rôle de l'utilisateur ou null
 *
 * @example
 * import { getUserRole } from '../middlewares/injectUserRole.js';
 *
 * export async function createSite(req, res) {
 *     const userRole = getUserRole(req);
 *     if (!userRole) {
 *         return res.redirect('/dp-login');
 *     }
 * }
 */
export function getUserRole(req) {
    return req.session?.user?.role || null;
}

/**
 * Helper pour obtenir l'ID de l'utilisateur depuis req
 *
 * @param {Object} req - Requête Express
 * @returns {string|null} ID de l'utilisateur ou null
 */
export function getUserId(req) {
    return req.session?.user?.id || null;
}

/**
 * Helper pour obtenir l'objet user complet depuis req
 *
 * @param {Object} req - Requête Express
 * @returns {Object|null} Objet user ou null
 */
export function getUser(req) {
    return req.session?.user || null;
}

/**
 * Middleware pour vérifier qu'un utilisateur est connecté
 * Alternative à authHelper.isConnected avec meilleur logging
 *
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Callback next
 */
export function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        console.warn('[requireAuth] User not authenticated', {
            path: req.path,
            method: req.method,
            ip: req.ip,
        });
        return res.redirect('/dp-login');
    }

    next();
}

export default {
    injectUserRole,
    getUserRole,
    getUserId,
    getUser,
    requireAuth,
};
