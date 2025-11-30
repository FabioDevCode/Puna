# Système de gestion des droits d'accès (ACL)

**Date :** 30 novembre 2025
**Auteur :** Analyse automatique
**Objectif :** Implémenter un système de contrôle d'accès basé sur les rôles (RBAC)

---

## 📊 Analyse de l'existant

### Rôles identifiés dans le système

D'après `src/models/attributes/user.attributes.json`, 5 rôles sont définis :

| Rôle          | Description probable  | Niveau  |
| ------------- | --------------------- | ------- |
| `super_admin` | Accès total système   | 5 (max) |
| `owner`       | Propriétaire de sites | 4       |
| `editor`      | Peut modifier données | 3       |
| `viewer`      | Lecture seule         | 2       |
| `beta`        | Testeur beta          | 1       |

### Entités principales identifiées

D'après les modèles et routes :

1. **User** - Utilisateurs du système
2. **Site** - Sites web (domaines)
3. **Form** - Formulaires liés à un site
4. **Inbox** - Entrées de formulaires (données reçues)
5. **SiteUser** - Association utilisateur ↔ site

### Actions CRUD par entité

D'après `src/routes/default.routes.js` :

#### **Dashboard & Stats**

- `GET /dashboard` - Vue dashboard
- `GET /stats/*` - Statistiques (7 endpoints)

#### **Site**

- `GET /site/all` - Liste sites
- `GET /site/:id/view` - Voir détails site
- `GET /site/:id/token` - Obtenir token JWT
- `POST /create-site` - Créer site
- `POST /delete-site/:id` - Supprimer site
- `PUT /site/:id/revoke-tokens` - Révoquer tokens

#### **Form**

- `POST /create-form` - Créer formulaire
- `POST /delete-form` - Supprimer formulaire
- `GET /form/:id/inbox` - Voir données formulaire
- `POST /form/:id/columns` - Mettre à jour colonnes
- `POST /form/:id/template` - Mettre à jour template
- `GET /form/:id/export-excel` - Exporter Excel

#### **Inbox**

- `GET /inbox/:id/view` - Voir entrée
- `POST /inbox/:id/delete` - Supprimer entrée
- `GET /inbox/:inboxId/download/:filename` - Télécharger fichier
- `GET /inbox/:inboxId/download-zip` - Télécharger ZIP

#### **Admin** (10 routes)

- `GET /admin` - Panel admin
- `GET /admin/users` - Liste utilisateurs
- `GET /admin/users/list` - API liste utilisateurs
- `GET /admin/users/export-excel` - Export Excel
- `POST /admin/users/create` - Créer utilisateur
- `POST /admin/users/delete` - Supprimer utilisateur
- `GET /admin/users/:id/view` - Voir utilisateur
- `GET /admin/users/:id/edit` - Éditer utilisateur
- `POST /admin/users/:id/update` - Mettre à jour utilisateur
- `GET /admin/settings` - Paramètres

### Système actuel de vérification

#### Dans `authHelper.js`

```javascript
export function isConnected(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    return res.redirect('/dp-login');
}
```

**Problème :** Vérifie uniquement si connecté, **pas de vérification de rôle**.

#### Dans les contrôleurs (ex: `site.controller.js`)

```javascript
if (site.fk_id_user !== userId) {
    return res.redirect('/error');
}
```

**Problème :** Vérification de propriété **manuelle** dans chaque contrôleur, **pas de système centralisé**.

---

## 🎯 Architecture proposée

### Vue d'ensemble

```
Requête HTTP
    ↓
1. isConnected         ← Vérifie authentification
    ↓
2. checkAccess()       ← 🆕 Middleware ACL (vérifie rôle + action)
    ↓
3. Controller          ← Logique métier
    ↓
4. View (Handlebars)   ← 🆕 Helper {{can}} pour conditionner UI
```

---

## 📁 Fichiers à créer/modifier

### 1. `src/config/permissions.js` - Matrice des permissions

#### Structure proposée

```javascript
/**
 * Matrice des permissions
 * Format: permissions[role][entity][action] = boolean
 */

const permissions = {
    super_admin: {
        // Accès total
        user: { read: true, create: true, update: true, delete: true, list: true, export: true },
        site: { read: true, create: true, update: true, delete: true, list: true, manage_tokens: true },
        form: { read: true, create: true, update: true, delete: true, export: true },
        inbox: { read: true, create: true, update: true, delete: true, download: true, export: true },
        dashboard: { read: true, stats: true },
        admin: { access: true, settings: true },
    },

    owner: {
        // Propriétaire : gestion complète de SES sites
        user: { read: false, create: false, update: false, delete: false, list: false, export: false },
        site: { read: true, create: true, update: true, delete: true, list: true, manage_tokens: true },
        form: { read: true, create: true, update: true, delete: true, export: true },
        inbox: { read: true, create: false, update: false, delete: true, download: true, export: true },
        dashboard: { read: true, stats: true },
        admin: { access: false, settings: false },
    },

    editor: {
        // Éditeur : peut modifier mais pas supprimer
        user: { read: false, create: false, update: false, delete: false, list: false, export: false },
        site: { read: true, create: false, update: false, delete: false, list: true, manage_tokens: false },
        form: { read: true, create: false, update: true, delete: false, export: true },
        inbox: { read: true, create: false, update: false, delete: false, download: true, export: true },
        dashboard: { read: true, stats: true },
        admin: { access: false, settings: false },
    },

    viewer: {
        // Viewer : lecture seule
        user: { read: false, create: false, update: false, delete: false, list: false, export: false },
        site: { read: true, create: false, update: false, delete: false, list: true, manage_tokens: false },
        form: { read: true, create: false, update: false, delete: false, export: false },
        inbox: { read: true, create: false, update: false, delete: false, download: true, export: false },
        dashboard: { read: true, stats: true },
        admin: { access: false, settings: false },
    },

    beta: {
        // Beta tester : accès restreint pour tests
        user: { read: false, create: false, update: false, delete: false, list: false, export: false },
        site: { read: true, create: true, update: false, delete: false, list: true, manage_tokens: false },
        form: { read: true, create: false, update: false, delete: false, export: false },
        inbox: { read: true, create: false, update: false, delete: false, download: false, export: false },
        dashboard: { read: true, stats: false },
        admin: { access: false, settings: false },
    },
};

/**
 * Vérifier si un rôle a une permission
 * @param {string} role - Rôle de l'utilisateur
 * @param {string} entity - Entité (user, site, form, inbox, dashboard, admin)
 * @param {string} action - Action (read, create, update, delete, etc.)
 * @returns {boolean}
 */
export function can(role, entity, action) {
    if (!role || !entity || !action) {
        return false;
    }

    const rolePerms = permissions[role];
    if (!rolePerms) {
        return false;
    }

    const entityPerms = rolePerms[entity];
    if (!entityPerms) {
        return false;
    }

    return !!entityPerms[action];
}

/**
 * Vérifier si un utilisateur possède un site (ownership)
 * @param {string} userId - ID de l'utilisateur
 * @param {string} siteId - ID du site
 * @param {object} models - Models Sequelize
 * @returns {Promise<boolean>}
 */
export async function userOwnsSite(userId, siteId, models) {
    try {
        // Vérifier si l'utilisateur est propriétaire direct du site
        const site = await models.Site.findOne({
            where: { id: siteId, fk_id_user: userId },
        });

        if (site) {
            return true;
        }

        // Vérifier si l'utilisateur est assigné au site via SiteUser
        const assignment = await models.SiteUser.findOne({
            where: { fk_id_site: siteId, fk_id_user: userId },
        });

        return !!assignment;
    } catch (err) {
        console.error('Error checking site ownership:', err);
        return false;
    }
}

/**
 * Vérifier si un utilisateur a accès à une ressource via son site parent
 * @param {string} userId - ID de l'utilisateur
 * @param {string} resourceId - ID de la ressource (form, inbox)
 * @param {string} resourceType - Type de ressource ('form' ou 'inbox')
 * @param {object} models - Models Sequelize
 * @returns {Promise<boolean>}
 */
export async function userOwnsResource(userId, resourceId, resourceType, models) {
    try {
        let siteId;

        if (resourceType === 'form') {
            const form = await models.Form.findByPk(resourceId, {
                attributes: ['fk_id_site'],
            });
            siteId = form?.fk_id_site;
        } else if (resourceType === 'inbox') {
            const inbox = await models.Inbox.findByPk(resourceId, {
                include: [
                    {
                        model: models.Form,
                        as: 'form',
                        attributes: ['fk_id_site'],
                    },
                ],
            });
            siteId = inbox?.form?.fk_id_site;
        } else {
            return false;
        }

        if (!siteId) {
            return false;
        }

        return await userOwnsSite(userId, siteId, models);
    } catch (err) {
        console.error('Error checking resource ownership:', err);
        return false;
    }
}

export default permissions;
```

---

### 2. `src/middlewares/checkAccess.js` - Middleware de contrôle d'accès

```javascript
import { can } from '../config/permissions.js';

/**
 * Middleware factory pour vérifier les permissions
 * @param {string} entity - Entité à protéger (user, site, form, inbox, dashboard, admin)
 * @param {string} action - Action requise (read, create, update, delete, etc.)
 * @returns {Function} Middleware Express
 */
export function checkAccess(entity, action) {
    return (req, res, next) => {
        const user = req.session?.user;

        if (!user) {
            return res.redirect('/dp-login');
        }

        const userRole = user.role;

        // Vérifier la permission de base
        if (!can(userRole, entity, action)) {
            console.warn(`Access denied: ${userRole} cannot ${action} ${entity}`);
            return res.status(403).render('pages/errors/403', {
                layout: 'error',
                message: "Vous n'avez pas la permission d'accéder à cette ressource.",
            });
        }

        // Permission accordée
        return next();
    };
}

/**
 * Middleware pour vérifier l'accès admin
 * Seulement super_admin peut accéder aux routes /admin/*
 */
export function requireAdmin(req, res, next) {
    const user = req.session?.user;

    if (!user) {
        return res.redirect('/dp-login');
    }

    if (!can(user.role, 'admin', 'access')) {
        console.warn(`Admin access denied: ${user.role} tried to access admin panel`);
        return res.status(403).render('pages/errors/403', {
            layout: 'error',
            message: 'Accès réservé aux administrateurs.',
        });
    }

    return next();
}

/**
 * Middleware pour vérifier la propriété d'un site
 * À utiliser après checkAccess pour les actions sur un site spécifique
 */
export function checkSiteOwnership(req, res, next) {
    return async function (req, res, next) {
        const user = req.session?.user;
        const siteId = req.params.id || req.body.fk_id_site;

        if (!user || !siteId) {
            return res.status(400).json({ error: 'Missing user or site ID' });
        }

        // Super admin bypass ownership check
        if (user.role === 'super_admin') {
            return next();
        }

        try {
            const { userOwnsSite } = await import('../config/permissions.js');
            const models = (await import('../models/index.js')).default;

            const owns = await userOwnsSite(user.id, siteId, models);

            if (!owns) {
                console.warn(`Ownership denied: User ${user.id} does not own site ${siteId}`);
                return res.status(403).json({ error: 'You do not own this site' });
            }

            return next();
        } catch (err) {
            console.error('Error checking site ownership:', err);
            return res.status(500).json({ error: 'Server error' });
        }
    };
}

/**
 * Middleware pour vérifier la propriété d'une ressource (form, inbox)
 * @param {string} resourceType - 'form' ou 'inbox'
 */
export function checkResourceOwnership(resourceType) {
    return async function (req, res, next) {
        const user = req.session?.user;
        const resourceId = req.params.id || req.params.inboxId;

        if (!user || !resourceId) {
            return res.status(400).json({ error: 'Missing user or resource ID' });
        }

        // Super admin bypass ownership check
        if (user.role === 'super_admin') {
            return next();
        }

        try {
            const { userOwnsResource } = await import('../config/permissions.js');
            const models = (await import('../models/index.js')).default;

            const owns = await userOwnsResource(user.id, resourceId, resourceType, models);

            if (!owns) {
                console.warn(`Ownership denied: User ${user.id} does not own ${resourceType} ${resourceId}`);
                return res.status(403).json({ error: `You do not have access to this ${resourceType}` });
            }

            return next();
        } catch (err) {
            console.error(`Error checking ${resourceType} ownership:`, err);
            return res.status(500).json({ error: 'Server error' });
        }
    };
}

export default checkAccess;
```

---

### 3. Helper Handlebars dans `src/helpers/hbs_fn.js`

Ajouter ces fonctions au fichier existant :

```javascript
import { can as canCheck } from '../config/permissions.js';

export default {
    // ... helpers existants ...

    /**
     * Helper Handlebars pour vérifier les permissions
     * Usage: {{#can role="owner" entity="site" action="create"}}...{{/can}}
     */
    can: function (options) {
        const role = options.hash.role;
        const entity = options.hash.entity;
        const action = options.hash.action;

        if (!role || !entity || !action) {
            return options.inverse(this);
        }

        if (canCheck(role, entity, action)) {
            return options.fn(this);
        } else {
            return options.inverse(this);
        }
    },

    /**
     * Helper pour vérifier les permissions de l'utilisateur en session
     * Usage: {{#userCan entity="site" action="create"}}...{{/userCan}}
     */
    userCan: function (options) {
        const user = this.user || this.session?.user;
        const entity = options.hash.entity;
        const action = options.hash.action;

        if (!user || !user.role || !entity || !action) {
            return options.inverse(this);
        }

        if (canCheck(user.role, entity, action)) {
            return options.fn(this);
        } else {
            return options.inverse(this);
        }
    },

    /**
     * Helper pour vérifier si l'utilisateur a un des rôles spécifiés
     * Usage: {{#hasRole roles="super_admin,owner"}}...{{/hasRole}}
     */
    hasRole: function (options) {
        const user = this.user || this.session?.user;
        const rolesStr = options.hash.roles;

        if (!user || !user.role || !rolesStr) {
            return options.inverse(this);
        }

        const allowedRoles = rolesStr.split(',').map((r) => r.trim());

        if (allowedRoles.includes(user.role)) {
            return options.fn(this);
        } else {
            return options.inverse(this);
        }
    },

    /**
     * Helper pour vérifier si l'utilisateur est admin
     * Usage: {{#isAdmin}}...{{/isAdmin}}
     */
    isAdmin: function (options) {
        const user = this.user || this.session?.user;

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
```

---

## 🔧 Intégration dans les routes

### Exemple de modification de `src/routes/default.routes.js`

```javascript
import express from 'express';
import * as adminCtl from '../controllers/admin.controller.js';
import * as authCtl from '../controllers/auth.controller.js';
import * as dashboardCtl from '../controllers/dashboard.controller.js';
import * as exportCtl from '../controllers/export.controller.js';
import * as formCtl from '../controllers/form.controller.js';
import * as inboxCtl from '../controllers/inbox.controller.js';
import * as siteCtl from '../controllers/site.controller.js';
import { isConnected, isConnectDash } from '../helpers/authHelper.js';
// 🆕 Import middlewares ACL
import { checkAccess, requireAdmin, checkSiteOwnership, checkResourceOwnership } from '../middlewares/checkAccess.js';

const router = express.Router();

// Routes publiques
router.get('/error', dashboardCtl.error);
router.get('/', isConnected, dashboardCtl.rootRedirect);

router.get('/dp-login', isConnectDash, dashboardCtl.dpLogin);
router.get('/dp-first-connexion', isConnectDash, dashboardCtl.dpFirstCo);

router.get('/dp-logout', authCtl.dpLogout);
router.post('/dp-first-co', authCtl.dpFirstCoPost);
router.post('/dp-connect', authCtl.dpConnect);

// DASHBOARD - Tous les utilisateurs connectés
router.get('/dashboard', isConnected, checkAccess('dashboard', 'read'), dashboardCtl.dashboard);

// STATS - Accessible selon permissions
router.get('/stats/inbox-counts', isConnected, checkAccess('dashboard', 'stats'), dashboardCtl.getInboxCounts);
router.get(
    '/stats/inbox-percentages',
    isConnected,
    checkAccess('dashboard', 'stats'),
    dashboardCtl.getInboxPercentages
);
router.get('/stats/inbox-heatmap', isConnected, checkAccess('dashboard', 'stats'), dashboardCtl.getInboxHeatmap);
router.get('/stats/top-froms', isConnected, checkAccess('dashboard', 'stats'), dashboardCtl.getTopFroms);
router.get('/stats/top-site-forms', isConnected, checkAccess('dashboard', 'stats'), dashboardCtl.getTopSiteForms);
router.get('/stats/inbox-by-site', isConnected, checkAccess('dashboard', 'stats'), dashboardCtl.getInboxCountsBySite);
router.get('/stats/last-inbox', isConnected, checkAccess('dashboard', 'stats'), dashboardCtl.getLastInboxEntry);

// ADMIN - Réservé aux super_admin
router.get('/admin', isConnected, requireAdmin, adminCtl.admin);
router.get('/admin/users', isConnected, requireAdmin, adminCtl.adminUsers);
router.get('/admin/users/list', isConnected, requireAdmin, adminCtl.adminUsersList);
router.get(
    '/admin/users/export-excel',
    isConnected,
    requireAdmin,
    checkAccess('user', 'export'),
    adminCtl.adminUsersExportExcel
);
router.post('/admin/users/create', isConnected, requireAdmin, checkAccess('user', 'create'), adminCtl.adminCreateUser);
router.post('/admin/users/delete', isConnected, requireAdmin, checkAccess('user', 'delete'), adminCtl.adminDeleteUser);
router.get('/admin/users/:id/view', isConnected, requireAdmin, checkAccess('user', 'read'), adminCtl.adminViewUser);
router.get('/admin/users/:id/edit', isConnected, requireAdmin, checkAccess('user', 'update'), adminCtl.adminEditUser);
router.post(
    '/admin/users/:id/update',
    isConnected,
    requireAdmin,
    checkAccess('user', 'update'),
    adminCtl.adminUpdateUser
);
router.get('/admin/settings', isConnected, requireAdmin, checkAccess('admin', 'settings'), adminCtl.adminSettings);

// SITES
router.get('/site/all', isConnected, checkAccess('site', 'list'), dashboardCtl.allSite);
router.get('/site/:id/view', isConnected, checkAccess('site', 'read'), checkSiteOwnership(), siteCtl.showSite);
router.get(
    '/site/:id/token',
    isConnected,
    checkAccess('site', 'manage_tokens'),
    checkSiteOwnership(),
    siteCtl.getSiteToken
);
router.put(
    '/site/:id/revoke-tokens',
    isConnected,
    checkAccess('site', 'manage_tokens'),
    checkSiteOwnership(),
    siteCtl.revokeSiteTokens
);
router.post('/create-site', isConnected, checkAccess('site', 'create'), siteCtl.createSite);
router.post('/delete-site/:id', isConnected, checkAccess('site', 'delete'), checkSiteOwnership(), siteCtl.deleteSite);

// FORMS
router.post('/create-form', isConnected, checkAccess('form', 'create'), formCtl.createForm);
router.post('/delete-form', isConnected, checkAccess('form', 'delete'), formCtl.deleteForm);
router.get(
    '/form/:id/inbox',
    isConnected,
    checkAccess('form', 'read'),
    checkResourceOwnership('form'),
    formCtl.getFormInbox
);
router.post(
    '/form/:id/columns',
    isConnected,
    checkAccess('form', 'update'),
    checkResourceOwnership('form'),
    formCtl.updateFormColumns
);
router.post(
    '/form/:id/template',
    isConnected,
    checkAccess('form', 'update'),
    checkResourceOwnership('form'),
    formCtl.updateFormTemplateSave
);
router.get(
    '/form/:id/export-excel',
    isConnected,
    checkAccess('form', 'export'),
    checkResourceOwnership('form'),
    exportCtl.exportFormToExcel
);

// INBOX
router.get(
    '/inbox/:id/view',
    isConnected,
    checkAccess('inbox', 'read'),
    checkResourceOwnership('inbox'),
    inboxCtl.showInbox
);
router.post(
    '/inbox/:id/delete',
    isConnected,
    checkAccess('inbox', 'delete'),
    checkResourceOwnership('inbox'),
    inboxCtl.deleteInbox
);
router.get(
    '/inbox/:inboxId/download/:filename',
    isConnected,
    checkAccess('inbox', 'download'),
    checkResourceOwnership('inbox'),
    inboxCtl.downloadFile
);
router.get(
    '/inbox/:inboxId/download-zip',
    isConnected,
    checkAccess('inbox', 'export'),
    checkResourceOwnership('inbox'),
    exportCtl.downloadInboxZip
);

export default router;
```

---

## 🎨 Utilisation dans les templates Handlebars

### Exemple 1 : Bouton "Créer un site" (conditionnel)

```handlebars
{{! Afficher seulement si l'utilisateur peut créer des sites }}
{{#userCan entity='site' action='create'}}
    <button class='btn btn-primary' onclick='openCreateSiteModal()'>
        <i class='fa fa-plus'></i>
        Créer un site
    </button>
{{/userCan}}
```

### Exemple 2 : Bouton "Supprimer" (conditionnel)

```handlebars
<div class='flex gap-2'>
    {{! Bouton voir : tout le monde peut voir }}
    <a href='/site/{{this.id}}/view' class='btn btn-sm btn-outline'>
        <i class='fa fa-eye'></i>
    </a>

    {{! Bouton éditer : seulement si peut update }}
    {{#userCan entity='site' action='update'}}
        <a href='/site/{{this.id}}/edit' class='btn btn-sm btn-accent'>
            <i class='fa fa-edit'></i>
        </a>
    {{/userCan}}

    {{! Bouton supprimer : seulement si peut delete }}
    {{#userCan entity='site' action='delete'}}
        <button class='btn btn-sm btn-error' onclick="deleteSite('{{this.id}}')">
            <i class='fa fa-trash'></i>
        </button>
    {{/userCan}}
</div>
```

### Exemple 3 : Menu admin (réservé super_admin)

```handlebars
{{! Menu admin visible seulement pour super_admin }}
{{#isAdmin}}
    <li>
        <a href='/admin'>
            <i class='fa fa-cog'></i>
            Administration
        </a>
    </li>
{{/isAdmin}}
```

### Exemple 4 : Vérifier plusieurs rôles

```handlebars
{{! Fonctionnalité accessible pour owner et super_admin }}
{{#hasRole roles='super_admin,owner'}}
    <button class='btn btn-primary'>Gérer les tokens</button>
{{/hasRole}}
```

### Exemple 5 : Affichage alternatif (else)

```handlebars
{{#userCan entity='inbox' action='delete'}}
    <button class='btn btn-error'>Supprimer l'entrée</button>
{{else}}
    <span class='text-muted'>Vous ne pouvez pas supprimer cette entrée</span>
{{/userCan}}
```

---

## 📝 Matrice des permissions (récapitulatif)

| Rôle            | User             | Site             | Form                      | Inbox                                | Dashboard       | Admin          |
| --------------- | ---------------- | ---------------- | ------------------------- | ------------------------------------ | --------------- | -------------- |
| **super_admin** | ✅ CRUD + Export | ✅ CRUD + Tokens | ✅ CRUD + Export          | ✅ CRUD + Download + Export          | ✅ View + Stats | ✅ Full access |
| **owner**       | ❌               | ✅ CRUD + Tokens | ✅ CRUD + Export          | ✅ Read + Delete + Download + Export | ✅ View + Stats | ❌             |
| **editor**      | ❌               | ✅ Read          | ✅ Read + Update + Export | ✅ Read + Download + Export          | ✅ View + Stats | ❌             |
| **viewer**      | ❌               | ✅ Read          | ✅ Read                   | ✅ Read + Download                   | ✅ View + Stats | ❌             |
| **beta**        | ❌               | ✅ Read + Create | ✅ Read                   | ✅ Read                              | ✅ View         | ❌             |

**Légende :**

- ✅ = Autorisé
- ❌ = Interdit
- CRUD = Create, Read, Update, Delete

---

## 🚀 Plan de mise en œuvre

### Phase 1 : Créer l'infrastructure (1-2h)

1. ✅ Créer `src/config/permissions.js` avec matrice complète
2. ✅ Créer `src/middlewares/checkAccess.js` avec tous les middlewares
3. ✅ Ajouter helpers Handlebars dans `src/helpers/hbs_fn.js`
4. ✅ Créer page d'erreur `src/views/pages/errors/403.hbs`

### Phase 2 : Intégrer dans les routes (2-3h)

1. Modifier `src/routes/default.routes.js` :
    - Ajouter `checkAccess()` sur toutes les routes protégées
    - Ajouter `requireAdmin` sur les routes admin
    - Ajouter `checkSiteOwnership()` et `checkResourceOwnership()` où nécessaire
2. Tester chaque route avec différents rôles

### Phase 3 : Adapter les templates (2-3h)

1. Parcourir tous les templates `.hbs`
2. Ajouter `{{#userCan}}` sur les boutons d'action (créer, éditer, supprimer)
3. Ajouter `{{#isAdmin}}` sur les menus admin
4. Tester l'UI avec chaque rôle

### Phase 4 : Tests et ajustements (1-2h)

1. Créer des utilisateurs de test pour chaque rôle
2. Tester toutes les routes et actions
3. Ajuster la matrice si besoin
4. Documenter les permissions

---

## 🔒 Considérations de sécurité

### 1. **Défense en profondeur**

- ✅ Middleware vérifie les permissions (backend)
- ✅ Helper Handlebars cache les boutons (frontend)
- ⚠️ **Ne JAMAIS se fier uniquement au frontend**

### 2. **Super admin bypass**

Le `super_admin` peut tout faire, mais il faut logger ses actions :

```javascript
if (user.role === 'super_admin') {
    console.log(`[AUDIT] Super admin ${user.id} accessed ${entity}:${action}`);
    return next();
}
```

### 3. **Ownership checks**

Les rôles `owner`, `editor`, `viewer` doivent être vérifiés **en plus** des permissions :

- Un `owner` ne peut modifier QUE ses sites
- Middleware `checkSiteOwnership()` vérifie via `fk_id_user` ou `SiteUser`

### 4. **Logs d'audit**

Ajouter logs pour :

- Tentatives d'accès refusées
- Actions sensibles (delete user, revoke tokens)
- Changements de rôles

---

## 📊 Exemple de logs d'audit

```javascript
// Dans checkAccess.js
if (!can(userRole, entity, action)) {
    console.warn({
        event: 'ACCESS_DENIED',
        userId: user.id,
        role: userRole,
        entity,
        action,
        ip: req.ip,
        timestamp: new Date().toISOString(),
    });
    return res.status(403).render('pages/errors/403');
}
```

---

## 🎯 Checklist de migration

- [ ] Créer `src/config/permissions.js`
- [ ] Créer `src/middlewares/checkAccess.js`
- [ ] Ajouter helpers dans `src/helpers/hbs_fn.js`
- [ ] Créer page `src/views/pages/errors/403.hbs`
- [ ] Modifier `src/routes/default.routes.js` (ajouter middlewares)
- [ ] Parcourir tous les templates `.hbs` (ajouter conditionnels)
- [ ] Créer utilisateurs de test (5 rôles)
- [ ] Tester toutes les routes avec chaque rôle
- [ ] Tester UI (boutons visibles/cachés selon rôle)
- [ ] Ajouter logs d'audit
- [ ] Documenter permissions dans README

---

## 💡 Améliorations futures

### 1. **Permissions granulaires par site**

Actuellement, un `editor` peut modifier TOUS les sites auxquels il a accès. On pourrait avoir :

```javascript
// Table site_user_permissions
{
    fk_id_site: UUID,
    fk_id_user: UUID,
    permissions: JSON // { "form": { "update": true, "delete": false } }
}
```

### 2. **Historique des permissions**

Logger tous les changements de rôles :

```sql
CREATE TABLE permission_audit (
    id INT PRIMARY KEY,
    user_id UUID,
    changed_by UUID,
    old_role VARCHAR(50),
    new_role VARCHAR(50),
    created_at TIMESTAMP
);
```

### 3. **API permissions endpoint**

Créer une route `/api/permissions` pour que le frontend sache dynamiquement ce que l'utilisateur peut faire :

```javascript
router.get('/api/permissions', isConnected, (req, res) => {
    const userRole = req.session.user.role;
    const perms = permissions[userRole];
    res.json(perms);
});
```

---

## 📚 Ressources

- [OWASP Access Control](https://owasp.org/www-project-top-ten/2017/A5_2017-Broken_Access_Control)
- [RBAC (Role-Based Access Control) Wikipedia](https://en.wikipedia.org/wiki/Role-based_access_control)
- [Express.js Middleware Guide](https://expressjs.com/en/guide/using-middleware.html)

---

**Prêt à implémenter ?** Je peux créer tous les fichiers nécessaires et intégrer le système dans vos routes existantes. Dites-moi quand vous voulez que je commence !
