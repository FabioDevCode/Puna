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

- [ ] **Réorganiser structure JavaScript front-end (`src/public/js/`)**
    - [ ] Créer structure modulaire :
        ```
        src/public/js/
        ├── core/           # Fonctions utilitaires globales
        │   ├── api.js      # Appels API centralisés
        │   ├── utils.js    # Helpers JS
        │   └── events.js   # Event bus/dispatcher
        ├── components/     # Composants réutilisables
        │   ├── modal.js
        │   ├── toast.js
        │   └── datepicker.js
        ├── pages/          # Scripts spécifiques par page
        │   ├── dashboard/
        │   │   ├── index.js
        │   │   └── charts.js
        │   ├── sites/
        │   │   ├── list.js
        │   │   └── show.js
        │   ├── inbox/
        │   │   └── show.js
        │   └── admin/
        │       ├── users.js
        │       └── settings.js
        └── vendors/        # Librairies tierces locales
        ```
    - [ ] Migrer les fichiers existants vers nouvelle structure
    - [ ] Créer système de build/bundle (Webpack ou Vite)
    - [ ] Minification pour production
    - [ ] Source maps pour développement

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
    - [ ] `errorHandler.middleware.js`
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
- [ ] Ajouter rate limiting sur les routes API
- [ ] Configurer CORS proprement
- [ ] Ajouter validation/sanitization des entrées utilisateur

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
- [ ] **Créer site vitrine pour Puna avec Nuxt.js**
    - [ ] Setup projet Nuxt 3 (SSR)
    - [ ] Structure du site :
        - [ ] **Page d'accueil**
            - [ ] Hero section avec accroche
            - [ ] Présentation du produit (problème/solution)
            - [ ] Features principales avec icônes
            - [ ] Screenshots/démos de l'application
            - [ ] Témoignages (quand disponibles)
            - [ ] CTA "Rejoindre la Beta"
        - [ ] **Page Features**
            - [ ] Liste détaillée des fonctionnalités
            - [ ] Comparaison avec solutions existantes
            - [ ] Cas d'usage
        - [ ] **Page Pricing** (pour future version SaaS)
            - [ ] Plans gratuit/pro/entreprise
            - [ ] Tableau comparatif
        - [ ] **Page Documentation**
            - [ ] Lien vers docs VuePress
            - [ ] Guide de démarrage rapide
        - [ ] **Page À propos**
            - [ ] Vision du projet
            - [ ] Open source commitment
        - [ ] **Page Beta**
            - [ ] Formulaire d'inscription beta
            - [ ] Avantages beta testeurs
            - [ ] Roadmap publique

    - [ ] **Formulaire Beta avec intégration Puna**
        - [ ] Créer formulaire Nuxt (nom, email, entreprise, use case)
        - [ ] Validation côté serveur
        - [ ] API route dans Nuxt : `/api/beta-signup`
        - [ ] Envoyer données vers instance Puna en production
        - [ ] Utiliser API Puna ou créer endpoint dédié
        - [ ] Email de confirmation automatique
        - [ ] Page de remerciement après soumission
        - [ ] Stocker dans formulaire "Beta Signups" sur Puna

    - [ ] Design & UX
        - [ ] Design moderne et responsive
        - [ ] Dark mode
        - [ ] Animations Nuxt (transitions, scroll)
        - [ ] SEO optimisé (meta tags, sitemap, schema.org)
        - [ ] Performance (Lighthouse 90+)

    - [ ] Déploiement
        - [ ] Héberger sur Vercel/Netlify
        - [ ] Domaine personnalisé (puna.app ?)
        - [ ] Analytics (Plausible ou similar)
        - [ ] Monitoring erreurs

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

## 🚀 Améliorations Fonctionnelles

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
- [ ] **Migration progressive des controllers** (15 routes identifiées)
    - [x] Phase 0: Test et validation (route `/test-flash`)
    - [ ] Phase 1: auth.controller.js (3 routes - Priorité haute)
    - [ ] Phase 2: site.controller.js + form.controller.js (5 routes - Priorité haute)
    - [ ] Phase 3: inbox.controller.js (1 route - Priorité moyenne)
    - [ ] Phase 4: admin.controller.js (6 routes - Priorité moyenne)
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
- [ ] **Rotation automatique des logs** (À faire)
    - [ ] Option 1 : Configurer logrotate système (Linux/macOS)
    - [ ] Option 2 : Créer script cron avec rotation personnalisée
    - [ ] Option 3 : Ré-évaluer alternatives pino-roll compatibles ESM
    - [ ] Actuellement : Nettoyage manuel avec `npm run logs:clean`
- [ ] **Interface admin pour visualiser les logs** (Futur)
    - [ ] Route `/admin/logs` (super_admin uniquement)
    - [ ] Liste des fichiers de logs avec taille/date
    - [ ] Viewer de logs avec pagination et coloration syntaxique
    - [ ] Filtres : niveau, date, recherche texte, utilisateur
    - [ ] Télécharger un fichier de log
    - [ ] Supprimer manuellement des logs anciens
    - [ ] Graphiques de statistiques (erreurs par jour, etc.)

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
- [ ] Implémenter recherche avancée
- [ ] Système de backup automatique

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
    - [ ] `toastify-js` (notifications front-end)
    - [ ] `pino-roll` ou `pino-rotating-file` (rotation logs)
    - [ ] `clamscan` (scanner antivirus ClamAV)
    - [ ] `express-flash` ou créer système custom
    - [ ] `vuepress` (documentation)
    - [ ] `webpack` ou `vite` (bundler JS front-end)
- [ ] Documenter tous les scripts npm
- [ ] Projet Nuxt séparé pour site vitrine :
    - [ ] Setup git submodule ou repo séparé
    - [ ] Configuration déploiement Vercel/Netlify

---

## 🎯 Priorités

### 🔥 Urgent (À faire maintenant)

1. **Enrichir README.md** - Le projet mérite une vraie documentation
2. ~~**Ajouter validation des variables d'env**~~ ✅ **TERMINÉ**
3. ~~**Implémenter helmet.js**~~ ✅ **TERMINÉ**

### ⚡ Important (Court terme)

1. ~~**Créer couche services**~~ ✅ **TERMINÉ** - 4 controllers migrés (export, form, inbox, site)
2. **Restructurer JS front-end** - Architecture modulaire pour travail en équipe
3. **Système de Toasts (Toastify)** - Notifications utilisateur + flash messages
4. **Logger Pino** - Logs structurés + interface admin + rotation
5. **Export CSV** - Compléter les exports (Excel déjà fait)
6. **ClamAV** - Scanner antivirus pour fichiers uploadés
7. **Rate limiting** - Protection contre les abus API
8. **Pagination** - Améliorer performance sur grandes listes

### 💡 À planifier (Moyen/Long terme)

1. **Documentation VuePress** - Guides utilisateur, dev, auto-hébergement
2. **Site web vitrine Nuxt** - Landing page + formulaire beta
3. **Tests automatisés** - Garantir la qualité du code
4. **Docker support** - Faciliter le déploiement
5. **CI/CD** - Automatiser les workflows
6. **Internationalisation FR/EN** - À faire en dernier

### ✅ Récemment complété

- ✅ **Système de notifications Toastify** (14 décembre 2025)
    - ✅ Plugin Toastify.js intégré (CSS + JS)
    - ✅ Fonction `Toast()` wrapper pour usage simplifié
    - ✅ Middleware `flashMessages.js` pour messages de session
    - ✅ Helper Handlebars `json` pour sérialisation
    - ✅ Script client `toast-flash.js` pour affichage automatique
    - ✅ Support 5 types : puna, info, success, warning, error
    - ✅ Persistance entre redirections via session
    - ✅ Guides complets créés (FLASH_MESSAGES_GUIDE.md + MIGRATION.md)
    - ✅ Route de test `/test-flash` fonctionnelle
    - ⏳ Migration controllers en cours (1/15 routes, dpConnect déjà fait)
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

**Dernière mise à jour :** 13 décembre 2025
