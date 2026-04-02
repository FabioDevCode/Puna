import i18n from 'i18n';
import { can, hasRole } from '../config/permissions.js';

export default {
    __: function () {
        return i18n.__.apply(this, arguments);
    },
    __n: function () {
        return i18n.__n.apply(this, arguments);
    },
    _capitalize: (str) => {
        if (typeof str !== 'string') {
            return '';
        }
        return str.charAt(0).toUpperCase() + str.slice(1);
    },
    _uppercase: (str) => {
        typeof str === 'string' ? str.toUpperCase() : '';
    },
    _lowercase: (str) => {
        typeof str === 'string' ? str.toLowerCase() : '';
    },

    // Helper Handlebars debug — log dans la console (développement uniquement)
    log: (context) => {
        if (process.env.NODE_ENV !== 'production') {
            console.log('[HBS_DEBUG]', context);
        }
        return;
    },

    slot: function (name, options) {
        if (!this._slots) {
            this._slots = {};
        }
        this._slots[name] = options.fn(this);
    },
    renderSlot: function (name) {
        return this._slots?.[name] || '';
    },

    fallback: (a, b) => {
        return a !== undefined && a !== null && a !== '' ? a : b;
    },

    concat: (...args) => {
        args.pop();
        return args.join('');
    },

    json: function (context) {
        return JSON.stringify(context);
    },

    eq: function (a, b) {
        return a === b;
    },

    ifEquals: function (a, b, options) {
        return a === b ? options.fn(this) : options.inverse(this);
    },

    /**
     * Helper pour vérifier si l'utilisateur peut faire une action
     * Usage: {{#actionCan entity="site" action="create"}}...{{/actionCan}}
     *
     * @example
     * {{#actionCan entity="site" action="create"}}
     *     <button class="btn btn-primary">Créer un site</button>
     * {{else}}
     *     <span class="text-muted">Vous ne pouvez pas créer de site</span>
     * {{/actionCan}}
     */
    actionCan: function (options) {
        // Récupérer l'utilisateur depuis res.locals (injecté par injectUserRole middleware)
        const user = this.connectedUser || options.data?.root?.connectedUser;
        const entity = options.hash.entity;
        const action = options.hash.action;

        // Si pas d'utilisateur ou paramètres manquants, ne pas afficher le bloc
        if (!user || !user.role || !entity || !action) {
            return options.inverse(this);
        }

        // Vérifier la permission
        if (can(user.role, entity, action)) {
            return options.fn(this); // Afficher le contenu du bloc
        } else {
            return options.inverse(this); // Afficher le bloc {{else}} si présent
        }
    },

    /**
     * Helper pour vérifier si l'utilisateur a un des rôles spécifiés
     * Usage: {{#roleIs roles="super_admin,owner"}}...{{/roleIs}}
     *
     * @example
     * {{#roleIs roles="super_admin,owner"}}
     *     <a href="/admin" class="btn btn-secondary">Administration</a>
     * {{/roleIs}}
     */
    roleIs: function (options) {
        const user = this.connectedUser || options.data?.root?.connectedUser;
        const rolesStr = options.hash.roles;

        if (!user || !user.role || !rolesStr) {
            return options.inverse(this);
        }

        // Convertir la chaîne "super_admin,owner" en tableau
        const allowedRoles = rolesStr.split(',').map((r) => r.trim());

        if (hasRole(user.role, allowedRoles)) {
            return options.fn(this);
        } else {
            return options.inverse(this);
        }
    },

    /**
     * Helper pour vérifier un rôle exact
     * Usage: {{#isRole role="super_admin"}}...{{/isRole}}
     *
     * @example
     * {{#isRole role="super_admin"}}
     *     <span class="badge badge-danger">ADMIN</span>
     * {{/isRole}}
     */
    isRole: function (options) {
        const user = this.connectedUser || options.data?.root?.connectedUser;
        const role = options.hash.role;

        if (!user || !user.role || !role) {
            return options.inverse(this);
        }

        if (user.role === role) {
            return options.fn(this);
        } else {
            return options.inverse(this);
        }
    },

    /**
     * Helper pour vérifier si l'utilisateur est admin
     * Usage: {{#isAdmin}}...{{/isAdmin}}
     *
     * @example
     * {{#isAdmin}}
     *     <li><a href="/admin/users">Gestion utilisateurs</a></li>
     * {{/isAdmin}}
     */
    isAdmin: function (options) {
        const user = this.connectedUser || options.data?.root?.connectedUser;

        if (!user || !user.role) {
            return options.inverse(this);
        }

        if (user.role === 'super_admin') {
            return options.fn(this);
        } else {
            return options.inverse(this);
        }
    },
};
