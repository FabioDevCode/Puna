/**
 * ================================================================
 * MATRICE DES PERMISSIONS - RBAC (Role-Based Access Control)
 * ================================================================
 * Définit ce que chaque rôle peut faire sur chaque entité
 *
 * Format: permissions[role][entity][action] = boolean
 *
 * ================================================================
 */

/**
 * Matrice des permissions par rôle et entité
 * @type {Object.<string, Object.<string, Object.<string, boolean>>>}
 */
export const permissions = {
    // ============================================================
    // SUPER_ADMIN - Administrateur système (accès total)
    // ============================================================
    super_admin: {
        user: {
            read: true,
            create: true,
            update: true,
            delete: true,
        },
        site: {
            read: true,
            create: true,
            update: true,
            delete: true,
        },
        form: {
            read: true,
            create: true,
            update: true,
            delete: true,
        },
        inbox: {
            read: true,
            delete: true,
        },
    },

    // ============================================================
    // OWNER - Propriétaire de sites
    // ============================================================
    // Peut gérer complètement SES sites (vérification ownership requise)
    // Note: Les règles d'ownership spécifiques seront implémentées plus tard
    // ============================================================
    owner: {
        user: {
            read: true,
            create: true,
            update: true,
            delete: true,
        },
        site: {
            read: true,
            create: true,
            update: true,
            delete: true,
        },
        form: {
            read: true,
            create: true,
            update: true,
            delete: true,
        },
        inbox: {
            read: true,
            delete: true,
        },
    },

    // ============================================================
    // EDITOR - Éditeur
    // ============================================================
    // Peut modifier formulaires et gérer inbox sur sites assignés
    // Assigné à des sites spécifiques via SiteUser
    // ============================================================
    editor: {
        user: {
            read: false,
            create: false,
            update: false,
            delete: false,
        },
        site: {
            read: true,
            create: false,
            update: false,
            delete: false,
        },
        form: {
            read: true,
            create: true,
            update: true,
            delete: true,
        },
        inbox: {
            read: true,
            delete: true,
        },
    },

    // ============================================================
    // VIEWER - Lecteur seul
    // ============================================================
    // Lecture seule sur les sites assignés
    // ============================================================
    viewer: {
        user: {
            read: false,
            create: false,
            update: false,
            delete: false,
        },
        site: {
            read: true,
            create: false,
            update: false,
            delete: false,
        },
        form: {
            read: true,
            create: false,
            update: false,
            delete: false,
        },
        inbox: {
            read: true,
            delete: false,
        },
    },

    // ============================================================
    // BETA - Testeur beta
    // ============================================================
    // Utilisateur en phase de test avec droits complets mais limités en volume
    // Rate limiting: 4 sites max, 2 forms/site, 200 inbox/form
    // ============================================================
    beta: {
        user: {
            read: false,
            create: false,
            update: false,
            delete: false,
        },
        site: {
            read: true,
            create: true,
            update: true,
            delete: true,
        },
        form: {
            read: true,
            create: true,
            update: true,
            delete: true,
        },
        inbox: {
            read: true,
            delete: true,
        },
    },
};

/**
 * Limites de rate limiting pour le rôle beta
 * @type {Object}
 */
export const rateLimits = {
    beta: {
        site: { max: 4, info: '4 sites maximum' },
        form: { max: 2, info: '2 formulaires par site maximum' },
        inbox: { max: 200, info: '200 entrées par formulaire maximum' },
    },
};

/**
 * Vérifier si un rôle a une permission spécifique
 *
 * @param {string} role - Rôle de l'utilisateur (super_admin, owner, editor, viewer, beta)
 * @param {string} entity - Entité concernée (user, site, form, inbox)
 * @param {string} action - Action demandée (read, create, update, delete)
 * @returns {boolean} true si la permission est accordée, false sinon
 *
 * @example
 * can('owner', 'site', 'create') // true
 * can('viewer', 'form', 'delete') // false
 * can('editor', 'inbox', 'read') // true
 */
export function can(role, entity, action) {
    // Validation des paramètres
    if (!role || !entity || !action) {
        return false;
    }

    // Vérifier que le rôle existe
    const rolePerms = permissions[role];
    if (!rolePerms) {
        return false;
    }

    // Vérifier que l'entité existe pour ce rôle
    const entityPerms = rolePerms[entity];
    if (!entityPerms) {
        // console.warn(`[ACL] Unknown entity "${entity}" for role "${role}"`);
        return false;
    }

    // Retourner la permission (false par défaut si l'action n'existe pas)
    const hasPermission = !!entityPerms[action];

    // Log pour debug (à retirer en production si nécessaire)
    if (!hasPermission) {
        // console.debug(`[ACL] Permission denied: ${role} cannot ${action} ${entity}`);
    }

    return hasPermission;
}

/**
 * Vérifier si un rôle fait partie d'une liste de rôles autorisés
 *
 * @param {string} role - Rôle de l'utilisateur
 * @param {string[]} allowedRoles - Liste des rôles autorisés
 * @returns {boolean} true si le rôle est dans la liste, false sinon
 *
 * @example
 * hasRole('super_admin', ['super_admin', 'owner']) // true
 * hasRole('viewer', ['super_admin', 'owner']) // false
 */
export function hasRole(role, allowedRoles) {
    if (!role || !Array.isArray(allowedRoles)) {
        return false;
    }

    return allowedRoles.includes(role);
}

/**
 * Obtenir toutes les permissions d'un rôle
 *
 * @param {string} role - Rôle de l'utilisateur
 * @returns {Object|null} Objet contenant toutes les permissions du rôle, ou null si le rôle n'existe pas
 *
 * @example
 * getPermissions('viewer')
 * // Returns: { user: { read: false, ... }, site: { read: true, ... }, ... }
 */
export function getPermissions(role) {
    return permissions[role] || null;
}

/**
 * Vérifier si un utilisateur beta a atteint sa limite pour une entité
 *
 * @param {string} role - Rôle de l'utilisateur
 * @param {string} entity - Entité concernée (site, form, inbox)
 * @param {number} currentCount - Nombre actuel d'entités créées
 * @returns {boolean} true si la limite est atteinte, false sinon
 *
 * @example
 * isRateLimitReached('beta', 'site', 4) // true (limite atteinte)
 * isRateLimitReached('beta', 'site', 3) // false (peut encore créer)
 */
export function isRateLimitReached(role, entity, currentCount) {
    if (role !== 'beta') {
        return false; // Pas de limite pour les autres rôles
    }

    const limits = rateLimits[role];
    if (!limits || !limits[entity]) {
        return false;
    }

    return currentCount >= limits[entity].max;
}

/**
 * Obtenir la limite de rate limiting pour une entité
 *
 * @param {string} role - Rôle de l'utilisateur
 * @param {string} entity - Entité concernée
 * @returns {Object|null} { max: number, info: string } ou null si pas de limite
 */
export function getRateLimit(role, entity) {
    if (role !== 'beta') {
        return null;
    }

    const limits = rateLimits[role];
    return limits?.[entity] || null;
}

/**
 * Liste des rôles disponibles
 * @type {string[]}
 */
export const ROLES = ['super_admin', 'owner', 'editor', 'viewer', 'beta'];

/**
 * Liste des entités gérées par l'ACL
 * @type {string[]}
 */
export const ENTITIES = ['user', 'site', 'form', 'inbox'];

/**
 * Liste des actions possibles
 * @type {string[]}
 */
export const ACTIONS = ['read', 'create', 'update', 'delete'];

export default {
    permissions,
    rateLimits,
    can,
    hasRole,
    getPermissions,
    isRateLimitReached,
    getRateLimit,
    ROLES,
    ENTITIES,
    ACTIONS,
};
