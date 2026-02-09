# TODO - Puna

Liste des tâches à réaliser pour améliorer le projet.

---

## 📝 Documentation

- [ ] Enrichir README.md avec :
    - [ ] Description claire du projet
    - [ ] Screenshots/GIF de démonstration
    - [ ] Guide de démarrage rapide
    - [ ] Instructions d'installation complètes
    - [ ] Liste des variables d'environnement
- [ ] Créer CONTRIBUTING.md (guide contributeurs)
- [ ] Créer CHANGELOG.md (historique des versions)

### 📚 Documentation VuePress

- [ ] **Mettre en place VuePress pour documentation complète**
    - [ ] Installer VuePress dans dossier `docs/`
    - [ ] Configurer `.vuepress/config.js`
    - [ ] Créer 3 sections principales :

        **1. Guide Utilisateur**
        - [ ] Introduction & Présentation
        - [ ] Premiers pas
        - [ ] Gestion des sites
        - [ ] Gestion des formulaires
        - [ ] Consultation des soumissions (inbox)
        - [ ] Exports (Excel, ZIP, CSV)
        - [ ] Gestion des permissions & rôles
        - [ ] FAQ utilisateur

        **2. Guide Développeur**
        - [ ] Architecture de l'application
        - [ ] Structure des dossiers
        - [ ] Models Sequelize
        - [ ] Controllers & Services
        - [ ] Système ACL / Permissions
        - [ ] Helpers Handlebars
        - [ ] API Routes
        - [ ] Hooks & Middlewares
        - [ ] Configuration Pino/Logs
        - [ ] Tests (quand implémentés)
        - [ ] Contribution guidelines

        **3. Guide Auto-hébergement**
        - [ ] Prérequis système (Node.js, MariaDB, ClamAV)
        - [ ] Installation pas à pas
        - [ ] Configuration `.env`
        - [ ] Migrations base de données
        - [ ] Configuration serveur web (Nginx/Apache)
        - [ ] SSL/HTTPS avec Let's Encrypt
        - [ ] Déploiement avec Docker
        - [ ] Maintenance & Backups
        - [ ] Mise à jour de version
        - [ ] Troubleshooting courant

    - [ ] Déployer documentation sur GitHub Pages ou Netlify
    - [ ] Ajouter recherche dans la documentation
    - [ ] Versioning de la documentation (par version app)

---

## 🏗️ Structure & Refactoring

- [x] **Diviser `default.controller.js` en controllers séparés**
    - [x] `dashboard.controller.js` (dashboard, stats, graphiques)
    - [x] `site.controller.js` (CRUD sites, tokens)
    - [x] `form.controller.js` (CRUD formulaires)
    - [x] `inbox.controller.js` (gestion inbox, téléchargements)
    - [x] `export.controller.js` (exports Excel/ZIP)
    - [x] `admin.controller.js` (administration utilisateurs)

- [x] **Réorganiser structure JavaScript front-end (`src/public/js/`)** ✅ (27 décembre 2025)
    - [x] Créer `core/utils.js` avec fonctions utilitaires partagées :
        - [x] `pad2(n)` - Padding 2 chiffres
        - [x] `escapeHtml(str)` - Protection XSS
        - [x] `formatDateTime(value)` - Format HTML date+heure
        - [x] `formatDateYYYYMMDD(value)` - Format ISO pour inputs
        - [x] `formatTime(timestamp)` - Format HH:MM:SS
    - [x] Regrouper scripts admin dans `admin/` :
        - [x] `admin/logs.js` (anciennement admin_logs.js)
        - [x] `admin/users.js` (anciennement admin_users.js)
        - [x] `admin/user-edit.js` (anciennement admin_user_edit.js)
        - [x] `admin/sidebar.js` (anciennement admin_sidebar.js)
    - [x] Regrouper scripts graphiques dans `charts/` :
        - [x] `charts/inbox-counts.js`
        - [x] `charts/inbox-heatmap.js`
        - [x] `charts/inbox-percentages.js`
        - [x] `charts/repartition-site.js`
        - [x] `charts/top-forms.js`
        - [x] `charts/top-site-radial.js`
    - [x] Mettre à jour fichiers pour utiliser `window.PunaUtils` :
        - [x] `tabs.js` → utilise `formatDateTime`, `formatDateYYYYMMDD`
        - [x] `admin/logs.js` → utilise `formatTime`, `escapeHtml`
        - [x] `search.js` → utilise `escapeHtml`
    - [x] Mettre à jour 11 templates Handlebars avec nouveaux chemins
    - [x] Structure finale implémentée :
        ```
        src/public/js/
        ├── core/                # Utilitaires partagés
        │   └── utils.js         # 5 fonctions mutualisées (PunaUtils)
        ├── admin/               # Scripts administration
        │   ├── logs.js
        │   ├── users.js
        │   ├── user-edit.js
        │   └── sidebar.js
        ├── charts/              # Scripts graphiques/statistiques
        │   ├── inbox-counts.js
        │   ├── inbox-heatmap.js
        │   ├── inbox-percentages.js
        │   ├── repartition-site.js
        │   ├── top-forms.js
        │   └── top-site-radial.js
        ├── download_zip.js      # Téléchargement ZIP
        ├── export_csv.js        # Export CSV
        ├── export_excel.js      # Export Excel
        ├── left_menu.js         # Menu latéral
        ├── mobile_menu.js       # Menu mobile
        ├── modal-handlers.js    # Gestion modales (CSP-safe)
        ├── puna.js              # Wrapper Toast()
        ├── revoke_tokens.js     # Révocation tokens
        ├── search.js            # Recherche dashboard
        ├── tabs.js              # Onglets inbox (~1000 lignes)
        ├── toast-flash.js       # Flash messages
        └── token.js             # Copie token
        ```
    - [ ] **🔮 Améliorations futures** (optionnel, si le projet grandit) :
        - [ ] Refactorer `tabs.js` (1000+ lignes) en modules plus petits
        - [ ] Ajouter `core/api.js` pour centraliser les appels fetch
        - [ ] Build system (Webpack/Vite) si besoin de bundling
        - [ ] Note : Pas nécessaire actuellement, architecture suffisante

- [x] **Créer couche `services/` pour la logique base de données**
    - [x] Déplacer toute logique DB depuis controllers vers services
    - [x] Structure implémentée :
        ```
        src/services/
        ├── access.service.js      # Vérification accès sites/formulaires
        ├── auth.service.js        # Login, JWT, sessions
        ├── user.service.js        # CRUD users, roles
        ├── site.service.js        # CRUD sites, tokens, JWT
        ├── form.service.js        # CRUD formulaires, validation
        ├── inbox.service.js       # CRUD inbox, fichiers, affichage
        ├── export.service.js      # Excel, ZIP, collecte fichiers
        ├── siteUser.service.js    # Gestion assignations utilisateurs-sites
        ├── stats.service.js       # Statistiques, graphiques
        └── csv.service.js         # Exports CSV (à implémenter)
        ```
    - [x] Pattern : Services retournent des données, Controllers gèrent HTTP
    - [x] Migration complète des controllers :
        - [x] `export.controller.js` → `export.service.js` (2 fonctions)
        - [x] `form.controller.js` → `form.service.js` (5 fonctions)
        - [x] `inbox.controller.js` → `inbox.service.js` (3 fonctions)
        - [x] `site.controller.js` → `site.service.js` (5 fonctions)
    - [x] Services créés avec gestion d'erreurs
    - [x] Réutilisabilité : Services indépendants du contexte HTTP

- [ ] Peupler dossier `middlewares/`
    - [x] `checkAccess.js` (vérification des permissions)
    - [x] `injectUserRole.js` (injection du rôle utilisateur)
    - [x] `csrf.js` (protection CSRF Double Submit Cookie)
    - [x] `flashMessages.js` (messages flash en session)
    - [x] `loginRateLimiter.js` (rate limiting login/first-login)
    - [x] `sanitize.js` (sanitisation XSS globale)
    - [ ] **`errorHandler.middleware.js`** - Gestion centralisée des erreurs
        - [ ] Créer classes d'erreur personnalisées (`src/utils/errors.js`)
            - [ ] `NotFoundError` (404)
            - [ ] `ForbiddenError` (403)
            - [ ] `ValidationError` (400)
            - [ ] `UnauthorizedError` (401)
        - [ ] Middleware errorHandler avec :
            - [ ] Logs automatiques avec errorLogger (Pino)
            - [ ] Distinction routes API (JSON) vs routes web (HTML)
            - [ ] StatusCode personnalisé selon type d'erreur
            - [ ] Context (userId, url, method, IP)
        - [ ] Intégration dans app.js (en dernier middleware)
        - [ ] Supprimer try/catch des controllers (simplification)
        - [ ] Bénéfices : -50% code, cohérence, logs centralisés
    - [ ] `validation.middleware.js`
    - [ ] `rateLimiter.middleware.js`

---

## 🔐 Sécurité

- [x] Déplacer tous les secrets vers `.env`
    - [x] Clés de chiffrement (KEV, KIV)
    - [x] Clés JWT (KEY_TK)
    - [x] Identifiants DB
    - [x] Secret de session
- [x] Créer `.env.example` complet
- [x] Supprimer fichier `keys.json` (utiliser uniquement `.env`)
- [x] Ajouter validation des variables d'environnement au démarrage
- [x] Implémenter `helmet.js` pour sécuriser les headers
- [x] **Rate limiting sur API** ✅ (24 décembre 2025)
    - [x] Installer express-rate-limit
    - [x] Créer middleware `formRateLimiter` avec limite par formulaire
    - [x] Configuration : 30 requêtes/minute par défaut (configurable via env)
    - [x] KeyGenerator basé sur siteId + formCode pour limites granulaires
    - [x] Variables d'env : RATE_LIMIT_FORM_MAX, RATE_LIMIT_FORM_WINDOW_MS
    - [x] Headers RateLimit-\* standards dans les réponses
    - [x] Log d'avertissement quand limite atteinte
    - [x] Documentation complète (API_RATE_LIMITING_STRATEGIES.md)
- [x] **Validation des limites de payload API** ✅ (24 décembre 2025)
    - [x] MAX_FILE_SIZE : 10 Mo par fichier
    - [x] MAX_TOTAL_SIZE : 50 Mo total (tous fichiers)
    - [x] MAX_FILES : 10 fichiers max par requête
    - [x] MAX_FIELDS : 40 champs JSON max
    - [x] MAX_FIELD_SIZE : 10000 caractères par champ
    - [x] Middleware validateTotalSize pour taille totale fichiers
    - [x] Middleware validateFieldSizes pour longueur champs texte
    - [x] HTTP 413 avec messages détaillés si limites dépassées
    - [x] Nettoyage auto des fichiers temporaires en cas d'échec
    - [x] Variables d'env : API_MAX_FILE_SIZE, API_MAX_TOTAL_SIZE, API_MAX_FILES, API_MAX_FIELDS, API_MAX_FIELD_SIZE
- [ ] **Configurer CORS avec stratégie hybride**
    - [ ] Installer package `cors` : `npm install cors`
    - [ ] Créer fichier `src/config/cors.config.js`
    - [ ] **CORS permissif pour API publiques** (`/api/*`, `/send/*`)
        - [ ] origin: true (accepter tous les domaines)
        - [ ] methods: ['POST', 'OPTIONS']
        - [ ] credentials: false (pas de cookies)
        - [ ] Objectif : Permettre appels depuis sites clients externes
    - [ ] **CORS restrictif pour routes authentifiées** (`/dashboard`, `/admin`)
        - [ ] origin: process.env.APP_URL
        - [ ] credentials: true (cookies de session)
        - [ ] methods: ['GET', 'POST', 'PUT', 'DELETE']
        - [ ] Objectif : Protéger contre CSRF cross-origin
    - [ ] Appliquer middleware CORS dans app.js selon routes
    - [ ] Tester avec formulaires clients sur domaines externes
    - [ ] Documenter configuration dans SECURITY.md
- [ ] Ajouter validation/sanitization des entrées utilisateur
- [x] **Protection CSRF (Double Submit Cookie)** ✅ (9 février 2026)
    - [x] Installer `csrf-csrf` (v4.0.3)
    - [x] Créer middleware `src/middlewares/csrf.js`
    - [x] Pattern Double Submit Cookie avec HMAC + session ID
    - [x] Cookie `__csrf` (httpOnly, sameSite lax, secure en prod)
    - [x] Injection `{{csrfToken}}` dans tous les templates Handlebars
    - [x] Champ hidden `_csrf` dans les 12 formulaires POST
    - [x] Meta tag `csrf-token` dans `head.hbs` pour AJAX
    - [x] Header `x-csrf-token` dans `revoke_tokens.js` et `tabs.js`
    - [x] Gestionnaire d'erreur CSRF avec flash message + redirect
    - [x] Exclusion des routes API/send (auth par Bearer token)
    - [x] Variable d'environnement `CSRF_SECRET` ajoutée à `env.validator.js`
- [x] **Audit de sécurité beta readiness** ✅ (9 février 2026)
    - [x] Désactivation `multipleStatements: true` dans Sequelize (`src/models/index.js`)
    - [x] Validation regex clés de filtre JSON dans `inbox.service.js` (anti SQL injection)
    - [x] Protection path traversal renforcée (`path.resolve` + `startsWith`) dans `inbox.service.js`
    - [x] Masquage `err.message` dans réponses API (message générique + log Pino)
    - [x] Graceful shutdown dans `server.js` (uncaughtException/unhandledRejection)
    - [x] Rapport d'audit créé (`AUDIT_BETA_READINESS.md`)
    - [ ] Externaliser clé API (`authApiKeyAccess.js` → `process.env.API_KEY`)

---

## 🧪 Tests

- [ ] Créer structure `src/tests/`
    - [ ] Dossier `unit/`
    - [ ] Dossier `integration/`
    - [ ] Dossier `fixtures/`
- [ ] Configurer framework de test (Mocha/Chai)
- [ ] Ajouter scripts npm pour tests
- [ ] Écrire tests unitaires pour services
- [ ] Écrire tests d'intégration pour API
- [ ] Configurer coverage avec c8

---

## 🐳 Docker & DevOps

- [ ] Créer `Dockerfile`
- [ ] Créer `docker-compose.yml`
- [ ] Créer `.dockerignore`
- [ ] Configurer CI/CD avec GitHub Actions
    - [ ] Tests automatiques
    - [ ] Linting
    - [ ] Build validation

---

## 📊 Logging & Monitoring

- [ ] Améliorer système de logs
    - [ ] Remplacer `console.log` par un logger (pino/winston)
    - [ ] Logs structurés
    - [ ] Niveaux de logs configurables
- [ ] Ajouter monitoring des erreurs

---

## 🎨 Qualité de Code

- [x] Configurer Prettier
- [x] Améliorer configuration ESLint
- [x] Créer `.editorconfig` complet
- [x] Ajouter pre-commit hooks (husky)
- [x] Créer script de formatage Handlebars personnalisé
- [x] Documenter conventions de code (COMMIT_FORMAT.md)

---

## 🌐 Marketing & Communication

### 🌐 Site Web de Présentation (Landing Page)

- [x] **Créer site vitrine pour Puna avec Nuxt.js**
    - [x] Setup projet Nuxt 4 (SSR)

    - [ ] **Formulaire Beta avec intégration Puna**
        - [ ] Créer formulaire Nuxt (nom, email, entreprise, use case)
        - [ ] Validation côté serveur
        - [ ] API route dans Nuxt : `/api/beta-signup`
        - [ ] Envoyer données vers instance Puna en production
        - [ ] Utiliser API Puna ou créer endpoint dédié
        - [ ] Email de confirmation automatique
        - [ ] Page de remerciement après soumission
        - [ ] Stocker dans formulaire "Beta Signups" sur Puna

    - [x] Design & UX
        - [x] Design moderne et responsive
        - [ ] Dark mode
        - [ ] Animations Nuxt (transitions, scroll)
        - [ ] SEO optimisé (meta tags, sitemap, schema.org)
        - [ ] Performance (Lighthouse 90+)

### 🌐 Open Source

- [ ] Créer templates GitHub
    - [ ] Issue template (bug report)
    - [ ] Issue template (feature request)
    - [ ] Pull Request template
- [ ] Créer CODE_OF_CONDUCT.md
- [ ] Ajouter labels aux issues (bug, enhancement, good first issue)
- [ ] Publier une roadmap
- [ ] Configurer GitHub Discussions
- [ ] Ajouter badges au README (licence, version, build status)

---

### 🚀 Améliorations Fonctionnelles

### 🔔 Système de Notifications (Toastify)

- [x] Intégrer Toastify JS pour notifications toast
    - [x] Ajouter plugin dans public/ (toastify.js + toastify.css)
    - [x] Créer fonction `Toast()` dans puna.js pour usage simplifié
    - [x] Implémenter middleware `res.flash()` pour messages session
    - [x] Créer middleware `src/middlewares/flashMessages.js`
    - [x] Créer script client `toast-flash.js` pour affichage automatique
    - [x] Ajouter helper Handlebars `json` pour sérialisation
    - [x] Types de messages : puna, success, error, warning, info
    - [x] Support messages multiples dans une session
    - [x] Auto-dismiss configurable (3 secondes par défaut)
    - [x] Persister les messages entre redirections
    - [x] Créer guides : `FLASH_MESSAGES_GUIDE.md` et `FLASH_MESSAGES_MIGRATION.md`
    - [x] Route de test `/test-flash` pour valider le système
- [x] **Migration progressive des controllers** ✅ **TERMINÉ** (29 décembre 2025)
    - [x] Phase 0: Test et validation (route `/test-flash`)
    - [x] Phase 1: auth.controller.js (dpFirstCoPost avec flash success)
    - [x] Phase 2: site.controller.js (createSite, deleteSite) + form.controller.js (createForm, deleteForm)
    - [x] Phase 3: inbox.controller.js (deleteInbox avec flash success/error)
    - [x] Phase 4: admin.controller.js (adminCreateUser, adminDeleteUser, adminUpdateUser avec flash)
    - [x] **Bonus JS client** : token.js, revoke_tokens.js, admin/users.js, tabs.js (copie code)
    - [x] **Total : 8 méthodes serveur + 4 scripts client migrés**
    - ℹ️ Note : dpLogout non implémenté (session détruite avant flash)
- [ ] **Support i18n pour les messages flash** (À faire lors de la migration)
    - [ ] Utiliser `req.__()` pour traduire les messages
    - [ ] Créer clés de traduction dans `src/locales/fr.json` et `en.json`
    - [ ] Exemples d'implémentation :

        ```javascript
        // ✅ Avec traduction i18n
        res.flash('success', req.__('site.created.success', domain));
        res.flash('error', req.__('site.deleted.error'));

        // Dans src/locales/fr.json :
        {
            "site": {
                "created": { "success": "Site \"%s\" créé avec succès" },
                "deleted": { "error": "Erreur lors de la suppression" }
            }
        }

        // Dans src/locales/en.json :
        {
            "site": {
                "created": { "success": "Site \"%s\" created successfully" },
                "deleted": { "error": "Error deleting site" }
            }
        }
        ```

    - [ ] Créer fichier `FLASH_MESSAGES_I18N.md` avec guide de traduction
    - [ ] Documenter structure des clés i18n par entité (site, form, user, inbox)

### 📊 Amélioration des Logs (Pino)

- [x] **Infrastructure Pino complète** ✅ (14 décembre 2025)
    - [x] Créer `src/config/logger.js` avec 4 loggers (app, api, error, audit)
    - [x] Niveaux de logs : trace, debug, info, warn, error, fatal
    - [x] Format JSON structuré pour fichiers
    - [x] Créer dossier `logs/` avec 4 fichiers séparés
        - [x] `logs/app.log` - logs application
        - [x] `logs/api.log` - logs API publiques uniquement
        - [x] `logs/error.log` - logs erreurs uniquement
        - [x] `logs/audit.log` - logs sécurité/audit
    - [x] Remplacer Morgan par pino-http dans app.js
    - [x] Console logs avec pino-pretty en développement
    - [x] Variable LOG_TO_CONSOLE pour activer/désactiver console
    - [x] Format console personnalisable (date, type, url)
    - [x] Créer `src/helpers/logging.helpers.js` avec 15 fonctions
    - [x] Scripts npm : `logs:clean` et `logs:stats`
    - [x] Configuration rétention via variables d'environnement
    - [x] Périodes de rétention : app=7j, api=14j, error=30j, audit=90j
- [ ] **Migration des controllers vers Pino** (En cours)
    - [ ] Remplacer tous les `console.log()` par `logger.info()`
    - [ ] Remplacer tous les `console.error()` par `errorLogger.error()`
    - [ ] Utiliser helpers de logging dans controllers :
        - [ ] `logAction()` pour actions utilisateur
        - [ ] `logAuthSuccess()` / `logAuthFailure()` dans auth.controller.js
        - [ ] `logApiError()` dans API handlers
        - [ ] `logDataDeletion()` pour suppressions
        - [ ] `logAccessDenied()` pour erreurs 403
        - [ ] `logUserCreated()` / `logRoleChanged()` dans admin.controller.js
    - [ ] Ajouter contexte aux logs (userId, siteId, formId, IP, etc.)
    - [ ] Tester et valider les logs générés
- [x] **Rotation automatique des logs** (À faire)
    - [x] Créer script cron avec rotation personnalisée
    - [x] Actuellement : Nettoyage manuel avec `npm run logs:clean`
- [x] **Interface admin pour visualiser les logs** (Futur)
    - [x] Route `/admin/logs` (super_admin uniquement)
    - [x] Liste des fichiers de logs avec taille/date
    - [x] Filtres : recherche texte, etc
    - [ ] Télécharger un fichier de log
    - [ ] Supprimer manuellement des logs anciens
    - [ ] Graphiques de statistiques (erreurs par jour, etc.)

### 🧹 Nettoyage automatique des fichiers

- [x] **Suppression auto des uploads lors de suppression Form/Site** ✅ (24 décembre 2025)
    - [x] Supprimer dossier `uploads/{site.domain}/{form.name}/` quand Form supprimé
    - [x] Supprimer dossier `uploads/{site.domain}/` quand Site supprimé
    - [x] Utiliser fs.rm() avec options recursive et force
    - [x] Gestion d'erreurs et logs pour traçabilité
    - [x] Import fs/promises et path dans services
    - [x] Implémenté dans form.service.js et site.service.js

### 📊 Statistiques et Dashboard

- [x] **Statistiques d'activité dans panel admin** ✅ (24 décembre 2025)
    - [x] Carte "Utilisateurs connectés" (comptage sessions actives)
    - [x] Carte "Erreurs" (comptage lignes error.log)
    - [x] Carte "Créés aujourd'hui" (Sites + Forms du jour)
    - [x] Carte "Fichiers uploadés" (comptage récursif storage/uploads)
    - [x] Fonction countFileLines() pour compter lignes de fichier
    - [x] Fonction countFilesRecursive() pour compter fichiers
    - [x] Parsing sessions pour extraire users connectés
    - [x] Visible pour roles super_admin et owner
    - [x] Mise à jour layout admin overview (8 cartes au lieu de 4)

### 📤 Export CSV

- [x] Implémenter exports CSV avec fast-csv
    - [x] Ajouter bouton "Export CSV" sur toutes les listes
    - [x] Route `/export/csv/:entity` (sites, forms, inbox, users)
    - [x] Créer service `src/services/csv.service.js`
    - [x] Support des filtres existants (dates, recherche)
    - [x] Headers personnalisés selon l'entité
    - [x] Encoding UTF-8 avec BOM pour Excel
    - [x] Nom de fichier : `entity_YYYY-MM-DD_HHmmss.csv`
    - [x] Streaming pour grandes quantités de données
    - [x] Respect des permissions (viewer peut exporter ses données)

### 🛡️ Sécurité des fichiers (ClamAV)

- [ ] Intégrer ClamAV pour scan antivirus
    - [ ] Installer `clamscan` npm package
    - [ ] Variable d'env `CLAMAV_ENABLED=true/false`
    - [ ] Variables ClamAV : socket path, host, port
    - [ ] Créer service `src/services/antivirus.service.js`
    - [ ] Scanner les fichiers avant stockage
    - [ ] Quarantaine pour fichiers suspects
        - [ ] Dossier `storage/quarantine/`
        - [ ] Table `quarantined_files` avec raison
    - [ ] Notification admin si virus détecté
    - [ ] Log détaillé des scans
    - [ ] Bypass pour environnement dev (si ClamAV non installé)
    - [ ] Interface admin : vue fichiers en quarantaine
    - [ ] Options : restaurer, supprimer définitivement
    - [ ] Statistiques : scans effectués, menaces détectées

### 🌍 Internationalisation (i18n)

- [ ] **Ajouter support multilingue FR/EN**
    - [ ] Utiliser package `i18n` déjà installé
    - [ ] Créer fichiers de traduction :
        - [ ] `src/locales/fr.json` (déjà existant, à compléter)
        - [ ] `src/locales/en.json` (nouveau)
    - [ ] Traduire tous les textes de l'interface
        - [ ] Layouts (navbar, sidebar, footer)
        - [ ] Pages (dashboard, sites, forms, inbox, admin)
        - [ ] Messages d'erreur et validation
        - [ ] Emails (si applicable)
        - [ ] Flash messages / Toasts
    - [ ] Ajouter sélecteur de langue dans navbar
    - [ ] Persister la langue choisie (cookie/session)
    - [ ] Middleware pour détecter langue navigateur
    - [ ] Variables i18n dans Handlebars : `{{t 'key'}}`
    - [ ] Documentation multilingue avec VuePress
    - [ ] **À faire en dernier** (priorité basse)

### Autres améliorations

- [x] Améliorer gestion des permissions
    - [x] Système ACL complet (actionCan, roleIs helpers)
    - [x] Middleware d'injection du rôle utilisateur
    - [x] Protection de toutes les routes avec droits d'accès
    - [x] Helpers Handlebars pour boutons conditionnels
    - [x] Support des rôles : super_admin, owner, beta, editor, viewer
- [x] Ajouter pagination sur toutes les listes

---

## 📦 Configuration & Dépendances

- [ ] Vérifier et mettre à jour les dépendances
- [x] Ajouter scripts npm utiles :
    - [x] `npm run dev` (développement avec hot-reload)
    - [x] `npm run format:hbs` (formatage Handlebars)
    - [x] `npm run format` (tous les fichiers)
    - [x] `npm run lint:fix` (correction ESLint)
    - [ ] `npm run build` (production)
    - [ ] `npm run logs:clean` (nettoyage logs anciens)
- [ ] Packages à installer :
    - [ ] `cors` (configuration CORS hybride)
    - [ ] `clamscan` (scanner antivirus ClamAV)
    - [ ] `vuepress` (documentation)
    - [x] `csrf-csrf` (protection CSRF Double Submit Cookie) ✅
    - [ ] 🔮 **Optionnel/Futur** : `webpack` ou `vite` (bundler JS front-end, si besoin)
- [ ] Documenter tous les scripts npm

---

## 🎯 Priorités

### 🔥 Urgent (À faire maintenant)

1. **Enrichir README.md** - Le projet mérite une vraie documentation
2. ~~**Ajouter validation des variables d'env**~~ ✅ **TERMINÉ**
3. ~~**Implémenter helmet.js**~~ ✅ **TERMINÉ**

### ⚡ Important (Court terme)

1. ~~**Créer couche services**~~ ✅ **TERMINÉ** - 4 controllers migrés (export, form, inbox, site)
2. ~~**Système de Toasts (Toastify)**~~ ✅ **TERMINÉ** - Migration flash messages complète
3. **Logger Pino** - Migration controllers vers helpers Pino
4. **CORS hybride** - Configuration API publiques vs routes authentifiées
5. ~~**Rate limiting**~~ ✅ **TERMINÉ** - Login + API protégés
6. **ClamAV** - Scanner antivirus pour fichiers uploadés
7. ~~**Protection CSRF**~~ ✅ **TERMINÉ** - Double Submit Cookie avec csrf-csrf
8. **Externaliser clé API** - Variable d'environnement + comparaison à temps constant

### 💡 À planifier (Moyen/Long terme)

1. **Documentation VuePress** - Guides utilisateur, dev, auto-hébergement
2. **Site web vitrine Nuxt** - Landing page + formulaire beta
3. **Tests automatisés** - Garantir la qualité du code
4. **Docker support** - Faciliter le déploiement
5. **CI/CD** - Automatiser les workflows
6. **Internationalisation FR/EN** - À faire en dernier

### ✅ Récemment complété

- ✅ **Audit de sécurité & corrections bloquantes** (9 février 2026)
    - ✅ Protection CSRF implémentée (csrf-csrf, Double Submit Cookie)
    - ✅ 12 formulaires + 2 scripts AJAX protégés
    - ✅ Désactivation `multipleStatements` Sequelize
    - ✅ Validation clés de filtre JSON (SAFE_KEY_REGEX anti SQL injection)
    - ✅ Path traversal renforcé (resolve + startsWith)
    - ✅ Masquage err.message dans API (message générique + log Pino)
    - ✅ Graceful shutdown (uncaughtException/unhandledRejection)
    - ✅ 6/7 corrections bloquantes terminées
    - ✅ Rapport `AUDIT_BETA_READINESS.md` créé
- ✅ **Réorganisation JavaScript front-end** (27 décembre 2025)
    - ✅ Création `core/utils.js` avec 5 fonctions mutualisées (PunaUtils)
    - ✅ Regroupement scripts admin dans `admin/` (4 fichiers)
    - ✅ Regroupement scripts charts dans `charts/` (6 fichiers)
    - ✅ Migration de `tabs.js`, `admin/logs.js`, `search.js` vers PunaUtils
    - ✅ Mise à jour 11 templates Handlebars
    - ✅ Suppression code dupliqué (escapeHtml, formatDateTime, etc.)
- ✅ **Rate limiting API** (24 décembre 2025)
    - ✅ Middleware formRateLimiter : 30 req/min par formulaire
    - ✅ Configuration via RATE_LIMIT_FORM_MAX et RATE_LIMIT_FORM_WINDOW_MS
    - ✅ KeyGenerator avec siteId + formCode
    - ✅ Documentation complète des stratégies (7 approches détaillées)
- ✅ **Validation payload API** (24 décembre 2025)
    - ✅ Limites configurables : fichiers (10 Mo), total (50 Mo), champs (40), field size (10000 chars)
    - ✅ Middleware validateTotalSize et validateFieldSizes
    - ✅ HTTP 413 avec erreurs détaillées
- ✅ **Nettoyage automatique uploads** (24 décembre 2025)
    - ✅ Suppression dossiers forms et sites lors de deletion
    - ✅ Gestion d'erreurs et logs
- ✅ **Statistiques d'activité admin** (24 décembre 2025)
    - ✅ 4 nouvelles cartes : connectés, erreurs, créations jour, fichiers
    - ✅ Fonctions countFileLines() et countFilesRecursive()
    - ✅ Parsing sessions pour comptage utilisateurs
- ✅ **Système de notifications Toastify** (14-29 décembre 2025)
    - ✅ Plugin Toastify.js intégré (CSS + JS)
    - ✅ Fonction `Toast()` wrapper pour usage simplifié
    - ✅ Middleware `flashMessages.js` pour messages de session
    - ✅ Helper Handlebars `json` pour sérialisation
    - ✅ Script client `toast-flash.js` pour affichage automatique
    - ✅ Support 5 types : puna, info, success, warning, error
    - ✅ Persistance entre redirections via session
    - ✅ Guides complets créés (FLASH_MESSAGES_GUIDE.md + MIGRATION.md)
    - ✅ Route de test `/test-flash` fonctionnelle
    - ✅ **Migration complète** : 8 méthodes serveur + 4 scripts JS client
        - ✅ admin.controller.js (3 méthodes)
        - ✅ site.controller.js (2 méthodes)
        - ✅ form.controller.js (2 méthodes)
        - ✅ inbox.controller.js (1 méthode)
        - ✅ auth.controller.js (1 méthode : dpFirstCoPost)
        - ✅ token.js (copie token avec toast)
        - ✅ revoke_tokens.js (révocation avec toast, remplacement alert)
        - ✅ admin/users.js (erreur chargement avec toast)
        - ✅ tabs.js (copie code formulaire avec toast)
- ✅ **Validation variables d'environnement** (13 décembre 2025)
    - ✅ Helper `env.validator.js` pour vérification au démarrage
    - ✅ Validation présence, format, sécurité des clés
    - ✅ Messages d'erreur clairs si config incorrecte
    - ✅ Compatible Docker et docker-compose
- ✅ **Helmet.js intégré** (13 décembre 2025)
    - ✅ Configuration hybride API/Web
    - ✅ Headers de sécurité HTTP (CSP, HSTS, X-Frame-Options)
    - ✅ Protection adaptée selon type de route
- ✅ **Export CSV** (décembre 2025)
    - ✅ Exports CSV avec fast-csv pour forms et users
    - ✅ Encoding UTF-8 BOM pour Excel
    - ✅ Respect des permissions utilisateurs
- ✅ **Couche services complète** (décembre 2025)
    - ✅ Migration de 4 controllers vers services
    - ✅ Réduction moyenne de 60-65% du code des controllers
    - ✅ 15 fonctions migrées au total (export: 2, form: 5, inbox: 3, site: 5)
    - ✅ Services centralisés et réutilisables
    - ✅ Helper `getFileTypeInfo` pour détection type fichiers
- ✅ Système ACL complet avec 5 rôles
- ✅ Protection de toutes les routes
- ✅ Helpers Handlebars pour permissions
- ✅ Script formatage HBS personnalisé
- ✅ Pre-commit hooks avec Husky
- ✅ Guide des commits (COMMIT_FORMAT.md)
- ✅ Documentation sécurité (SECURITY.md)

---

**Dernière mise à jour :** 9 février 2026
