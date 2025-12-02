# 🚀 Guide d'intégration du système ACL

Ce guide explique comment intégrer le système de contrôle d'accès (ACL) dans ton application Puna.

## 📦 Fichiers créés

✅ **Configuration**

- `src/config/permissions.js` - Matrice des permissions

✅ **Middlewares**

- `src/middlewares/checkAccess.js` - `actionAccess()`, `roleAccess()`, `requireAdmin()`, etc.
- `src/middlewares/injectUserRole.js` - Injection de `req.userRole`, `req.userId`

✅ **Helpers Handlebars**

- `src/helpers/hbs_fn.js` - Ajout de `actionCan`, `roleIs`, `isRole`, `isAdmin`, `roleLabel`, `roleBadge`

✅ **Template**

- `src/views/pages/errors/403.hbs` - Page d'erreur 403 stylisée

---

## ⚙️ Étape 1 : Activer le middleware global

Dans `src/app.js`, **AVANT** les routes, ajoute le middleware `injectUserRole` :

```javascript
// Imports
import { injectUserRole } from './middlewares/injectUserRole.js';

// APRÈS session et AVANT les routes
app.use(injectUserRole); // 🆕 Injection user dans req et res.locals

// Routes
import routes from './routes/index.js';
app.use(routes);
```

✅ **Résultat** : Dans tous les controllers et templates, tu as maintenant accès à :

- `req.userRole` → Rôle de l'utilisateur
- `req.userId` → ID de l'utilisateur
- `res.locals.user` → Objet user complet (templates Handlebars)
- `res.locals.userRole` → Rôle (templates)

---

## 🛡️ Étape 2 : Protéger les routes (à faire manuellement)

Tu as demandé de **NE PAS** automatiser l'intégration dans les routes. Voici des exemples :

### Exemple 1 : `actionAccess(entity, action)`

```javascript
import { actionAccess } from '../middlewares/checkAccess.js';

// Protéger la création de site
router.post('/create-site', isConnected, actionAccess('site', 'create'), siteCtl.createSite);

// Protéger la suppression de formulaire
router.post('/delete-form', isConnected, actionAccess('form', 'delete'), formCtl.deleteForm);

// Protéger la lecture d'inbox
router.get('/inbox/:id/view', isConnected, actionAccess('inbox', 'read'), inboxCtl.showInbox);
```

### Exemple 2 : `roleAccess(['role1', 'role2'])`

```javascript
import { roleAccess, requireAdmin } from '../middlewares/checkAccess.js';

// Seulement super_admin
router.get('/admin', isConnected, requireAdmin(), adminCtl.admin);

// Super_admin et owner
router.post('/create-site', isConnected, roleAccess(['super_admin', 'owner', 'beta']), siteCtl.createSite);

// Super_admin, owner, editor
router.get('/stats', isConnected, roleAccess(['super_admin', 'owner', 'editor']), dashboardCtl.getStats);
```

### Exemple 3 : Combinaison (rôle + permission)

```javascript
import { requireRoleAndPermission } from '../middlewares/checkAccess.js';

// Vérifier rôle ET permission (double sécurité)
router.delete(
    '/site/:id',
    isConnected,
    requireRoleAndPermission(['super_admin', 'owner'], 'site', 'delete'),
    siteCtl.deleteSite
);
```

---

## 🎨 Étape 3 : Utiliser dans les templates Handlebars

### Helper `actionCan` - Vérifier permission

```handlebars
{{! Afficher bouton seulement si l'utilisateur peut créer des sites }}
{{#actionCan entity='site' action='create'}}
    <button class='btn btn-primary' onclick='openCreateSiteModal()'>
        <i class='fa fa-plus'></i>
        Créer un site
    </button>
{{else}}
    <span class='text-muted'>Vous ne pouvez pas créer de site</span>
{{/actionCan}}

{{! Bouton supprimer conditionnel }}
{{#actionCan entity='form' action='delete'}}
    <button class='btn btn-danger' onclick="deleteForm('{{this.id}}')">
        <i class='fa fa-trash'></i>
        Supprimer
    </button>
{{/actionCan}}
```

### Helper `roleIs` - Vérifier rôle(s)

```handlebars
{{! Menu admin visible pour super_admin et owner }}
{{#roleIs roles='super_admin,owner'}}
    <li>
        <a href='/admin'><i class='fa fa-cog'></i> Administration</a>
    </li>
{{/roleIs}}

{{! Badge beta pour testeurs }}
{{#roleIs roles='beta'}}
    <div class='alert alert-warning'>
        Vous êtes en mode test. Limites : 4 sites, 2 forms/site.
    </div>
{{/roleIs}}
```

### Helper `isRole` - Vérifier rôle exact

```handlebars
{{! Badge admin }}
{{#isRole role='super_admin'}}
    <span class='badge badge-danger'>ADMIN</span>
{{/isRole}}

{{! Message pour viewer }}
{{#isRole role='viewer'}}
    <p class='text-muted'>Vous êtes en lecture seule.</p>
{{/isRole}}
```

### Helper `isAdmin` - Raccourci super_admin

```handlebars
{{! Panneau admin }}
{{#isAdmin}}
    <div class='admin-panel'>
        <h3>Outils administrateur</h3>
        <ul>
            <li><a href='/admin/users'>Gestion utilisateurs</a></li>
            <li><a href='/admin/settings'>Paramètres</a></li>
        </ul>
    </div>
{{/isAdmin}}
```

### Helper `roleLabel` - Afficher nom du rôle

```handlebars
<p>Votre rôle : <strong>{{roleLabel userRole}}</strong></p>
{{! Affiche: "Votre rôle : Administrateur" }}
```

### Helper `roleBadge` - Badge coloré

```handlebars
<div class='user-info'>
    <span>{{user.login}}</span>
    {{{roleBadge userRole}}}
</div>
{{! Affiche: <span class="badge badge-danger">ADMIN</span> }}
```

---

## 🧪 Étape 4 : Tester

### Test 1 : Créer des utilisateurs de test

```sql
-- Dans ta BDD
UPDATE users SET role = 'super_admin' WHERE login = 'admin';
UPDATE users SET role = 'owner' WHERE login = 'owner1';
UPDATE users SET role = 'editor' WHERE login = 'editor1';
UPDATE users SET role = 'viewer' WHERE login = 'viewer1';
UPDATE users SET role = 'beta' WHERE login = 'beta1';
```

### Test 2 : Vérifier les permissions

1. **Se connecter en tant que `viewer`**
    - ✅ Devrait voir les sites/forms/inbox
    - ❌ Ne devrait PAS voir boutons "Créer", "Modifier", "Supprimer"
    - ❌ Tenter `/create-site` → 403 Forbidden

2. **Se connecter en tant que `editor`**
    - ✅ Devrait pouvoir modifier formulaires
    - ✅ Devrait pouvoir supprimer inbox
    - ❌ Ne devrait PAS pouvoir créer/supprimer sites

3. **Se connecter en tant que `owner`**
    - ✅ Full CRUD sur sites/forms/inbox (les siens)

4. **Se connecter en tant que `super_admin`**
    - ✅ Full accès partout
    - ✅ Accès au panel `/admin`

---

## 📊 Étape 5 : Vérifier rate limiting pour beta (optionnel)

Dans tes controllers, ajoute des checks pour beta :

```javascript
import { isRateLimitReached, getRateLimit } from '../config/permissions.js';

export async function createSite(req, res) {
    const userRole = req.userRole;
    const userId = req.userId;

    // Vérifier rate limiting pour beta
    if (userRole === 'beta') {
        const siteCount = await models.Site.count({ where: { fk_id_user: userId } });

        if (isRateLimitReached('beta', 'site', siteCount)) {
            const limit = getRateLimit('beta', 'site');
            return res.status(403).json({
                error: `Limite atteinte : ${limit.info}`,
                max: limit.max,
                current: siteCount,
            });
        }
    }

    // Créer le site...
}
```

---

## 🔍 Vérification des erreurs ESLint

✅ **Tous les fichiers ont été formatés avec Prettier** et ne contiennent plus d'erreurs de linting.

---

## 📚 Aide-mémoire

### Middlewares disponibles

| Middleware                                        | Usage                         | Exemple                                                 |
| ------------------------------------------------- | ----------------------------- | ------------------------------------------------------- |
| `actionAccess(entity, action)`                    | Vérifie permission spécifique | `actionAccess('site', 'create')`                        |
| `roleAccess(['role1', 'role2'])`                  | Vérifie si rôle dans liste    | `roleAccess(['super_admin', 'owner'])`                  |
| `requireAdmin()`                                  | Seulement super_admin         | `requireAdmin()`                                        |
| `requireOwner()`                                  | Super_admin ou owner          | `requireOwner()`                                        |
| `requireRoleAndPermission(roles, entity, action)` | Double vérification           | `requireRoleAndPermission(['owner'], 'site', 'delete')` |
| `logAccess(resourceType)`                         | Logger les accès              | `logAccess('inbox')`                                    |

### Helpers Handlebars disponibles

| Helper                                 | Usage                   | Exemple                                                         |
| -------------------------------------- | ----------------------- | --------------------------------------------------------------- |
| `{{#actionCan entity="X" action="Y"}}` | Vérifier permission     | `{{#actionCan entity="site" action="create"}}...{{/actionCan}}` |
| `{{#roleIs roles="X,Y"}}`              | Vérifier rôle(s)        | `{{#roleIs roles="super_admin,owner"}}...{{/roleIs}}`           |
| `{{#isRole role="X"}}`                 | Vérifier rôle exact     | `{{#isRole role="super_admin"}}...{{/isRole}}`                  |
| `{{#isAdmin}}`                         | Vérifier super_admin    | `{{#isAdmin}}...{{/isAdmin}}`                                   |
| `{{roleLabel userRole}}`               | Nom du rôle en français | `{{roleLabel "owner"}}` → "Propriétaire"                        |
| `{{{roleBadge userRole}}}`             | Badge coloré            | `{{{roleBadge "super_admin"}}}` → HTML badge                    |

---

## 🎯 Prochaines étapes

1. ✅ Activer `injectUserRole` dans `app.js`
2. 🔄 Intégrer les middlewares dans tes routes (manuellement)
3. 🎨 Ajouter les helpers dans tes templates
4. 🧪 Tester avec chaque rôle
5. 📊 (Optionnel) Implémenter rate limiting pour beta

**Tout est prêt !** 🚀
