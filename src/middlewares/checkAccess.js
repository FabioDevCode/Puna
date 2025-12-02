/**
 * ================================================================
 * MIDDLEWARES DE CONTRÔLE D'ACCÈS (ACL)
 * ================================================================
 * Middlewares Express pour vérifier les permissions des utilisateurs
 * basés sur le système RBAC (Role-Based Access Control)
 *
 * Usage dans les routes:
 * - actionAccess('entity', 'action') → Vérifie permission spécifique
 * - roleAccess(['role1', 'role2']) → Vérifie si rôle dans liste
 *
 * Date: 2 décembre 2025
 * ================================================================
 */

import { can, hasRole } from '../config/permissions.js';

/**
 * Middleware pour vérifier si l'utilisateur a la permission de faire une action
 *
 * @param {string} entity - Entité concernée (user, site, form, inbox)
 * @param {string} action - Action demandée (read, create, update, delete)
 * @returns {Function} Middleware Express
 *
 * @example
 * // Dans les routes
 * router.post('/create-site', isConnected, actionAccess('site', 'create'), siteCtl.createSite);
 * router.delete('/delete-form', isConnected, actionAccess('form', 'delete'), formCtl.deleteForm);
 * router.get('/inbox/:id/view', isConnected, actionAccess('inbox', 'read'), inboxCtl.showInbox);
 */
export function actionAccess(entity, action) {
    return (req, res, next) => {
        // Vérifier que l'utilisateur est connecté
        const user = req.session?.user;
        if (!user) {
            console.warn('[actionAccess] No user in session');
            return res.redirect('/dp-login');
        }

        const userRole = user.role;
        if (!userRole) {
            console.warn(`[actionAccess] User ${user.id} has no role`);
            return res.redirect('/dp-login');
        }

        // Vérifier la permission
        if (!can(userRole, entity, action)) {
            console.warn(`[actionAccess] Permission denied: ${userRole} cannot ${action} ${entity}`, {
                userId: user.id,
                userLogin: user.login,
                path: req.path,
                method: req.method,
            });

            // Retourner 403 Forbidden
            return res.status(403).render('pages/errors/403', {
                layout: 'error',
                message: `Vous n'avez pas la permission de ${action === 'read' ? 'consulter' : action === 'create' ? 'créer' : action === 'update' ? 'modifier' : 'supprimer'} cette ressource.`,
                entity,
                action,
                userRole,
            });
        }

        // Permission accordée, continuer
        next();
    };
}

/**
 * Middleware pour vérifier si l'utilisateur a un des rôles autorisés
 *
 * @param {string[]} allowedRoles - Liste des rôles autorisés
 * @returns {Function} Middleware Express
 *
 * @example
 * // Dans les routes
 * router.get('/admin', isConnected, roleAccess(['super_admin']), adminCtl.admin);
 * router.post('/create-site', isConnected, roleAccess(['super_admin', 'owner', 'beta']), siteCtl.createSite);
 * router.get('/stats', isConnected, roleAccess(['super_admin', 'owner', 'editor']), dashboardCtl.getStats);
 */
export function roleAccess(allowedRoles) {
    return (req, res, next) => {
        // Vérifier que l'utilisateur est connecté
        const user = req.session?.user;
        if (!user) {
            console.warn('[roleAccess] No user in session');
            return res.redirect('/dp-login');
        }

        const userRole = user.role;
        if (!userRole) {
            console.warn(`[roleAccess] User ${user.id} has no role`);
            return res.redirect('/dp-login');
        }

        // Vérifier que le rôle est dans la liste autorisée
        if (!hasRole(userRole, allowedRoles)) {
            console.warn(`[roleAccess] Role not allowed: ${userRole} not in [${allowedRoles.join(', ')}]`, {
                userId: user.id,
                userLogin: user.login,
                path: req.path,
                method: req.method,
            });

            // Retourner 403 Forbidden
            return res.status(403).render('pages/errors/403', {
                layout: 'error',
                message: "Votre rôle ne permet pas d'accéder à cette ressource.",
                allowedRoles,
                userRole,
            });
        }

        // Rôle autorisé, continuer
        next();
    };
}

/**
 * Middleware pour vérifier l'accès admin (seulement super_admin)
 * Raccourci pour roleAccess(['super_admin'])
 *
 * @returns {Function} Middleware Express
 *
 * @example
 * router.get('/admin', isConnected, requireAdmin(), adminCtl.admin);
 * router.post('/admin/users/create', isConnected, requireAdmin(), adminCtl.createUser);
 */
export function requireAdmin() {
    return roleAccess(['super_admin']);
}

/**
 * Middleware pour vérifier l'accès aux routes privilégiées (super_admin, owner)
 * Raccourci pour roleAccess(['super_admin', 'owner'])
 *
 * @returns {Function} Middleware Express
 *
 * @example
 * router.get('/site/:id/token', isConnected, requireOwner(), siteCtl.getSiteToken);
 * router.delete('/site/:id', isConnected, requireOwner(), siteCtl.deleteSite);
 */
export function requireOwner() {
    return roleAccess(['super_admin', 'owner']);
}

/**
 * Middleware combiné : vérifier rôle ET permission
 * Utile pour ajouter une couche de sécurité supplémentaire
 *
 * @param {string[]} allowedRoles - Liste des rôles autorisés
 * @param {string} entity - Entité concernée
 * @param {string} action - Action demandée
 * @returns {Function} Middleware Express
 *
 * @example
 * // Seulement super_admin et owner peuvent créer des sites
 * router.post('/create-site', isConnected, requireRoleAndPermission(['super_admin', 'owner'], 'site', 'create'), siteCtl.createSite);
 */
export function requireRoleAndPermission(allowedRoles, entity, action) {
    return (req, res, next) => {
        // D'abord vérifier le rôle
        const roleMiddleware = roleAccess(allowedRoles);
        roleMiddleware(req, res, (err) => {
            if (err) {
                return next(err);
            }

            // Ensuite vérifier la permission
            const permissionMiddleware = actionAccess(entity, action);
            permissionMiddleware(req, res, next);
        });
    };
}

/**
 * Middleware pour logger les accès (audit trail)
 * À utiliser avant les autres middlewares ACL
 *
 * @param {string} resourceType - Type de ressource (optionnel)
 * @returns {Function} Middleware Express
 *
 * @example
 * router.delete('/inbox/:id', isConnected, logAccess('inbox'), actionAccess('inbox', 'delete'), inboxCtl.deleteInbox);
 */
export function logAccess(resourceType = null) {
    return (req, res, next) => {
        const user = req.session?.user;
        if (!user) {
            return next();
        }

        const logData = {
            timestamp: new Date().toISOString(),
            userId: user.id,
            userLogin: user.login,
            userRole: user.role,
            method: req.method,
            path: req.path,
            params: req.params,
            query: req.query,
            ip: req.ip,
            userAgent: req.get('user-agent'),
        };

        if (resourceType) {
            logData.resourceType = resourceType;
        }

        // Log en format structuré (JSON) pour faciliter l'analyse
        console.log('[ACCESS_LOG]', JSON.stringify(logData));

        // TODO: Stocker en BDD pour audit trail permanent
        // await models.AccessLog.create(logData);

        next();
    };
}

export default {
    actionAccess,
    roleAccess,
    requireAdmin,
    requireOwner,
    requireRoleAndPermission,
    logAccess,
};
