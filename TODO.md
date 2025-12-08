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

- [ ] **Créer couche `services/` pour la logique base de données**
    - [ ] Déplacer toute logique DB depuis controllers vers services
    - [ ] Structure recommandée :
        ```
        src/services/
        ├── auth.service.js        # Login, JWT, sessions
        ├── user.service.js        # CRUD users, roles
        ├── site.service.js        # CRUD sites, tokens
        ├── form.service.js        # CRUD formulaires
        ├── inbox.service.js       # CRUD inbox, fichiers
        ├── export.service.js      # Excel, ZIP, CSV
        ├── csv.service.js         # Exports CSV
        ├── antivirus.service.js   # Scan ClamAV
        ├── logger.service.js      # Gestion logs
        └── stats.service.js       # Statistiques, graphiques
        ```
    - [ ] Pattern : Services retournent des données, Controllers gèrent HTTP
    - [ ] Ajouter gestion d'erreurs centralisée dans services
    - [ ] Permettre réutilisation des services (API, cron, CLI)

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
    - [ ] Secret de session (actuellement en dur dans app.js)
- [x] Créer `.env.example` complet
- [x] Supprimer fichier `keys.json` (utiliser uniquement `.env`)
- [ ] Ajouter validation des variables d'environnement au démarrage
- [ ] Implémenter `helmet.js` pour sécuriser les headers
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
- [ ] Intégrer Toastify JS pour notifications toast
    - [ ] Ajouter CDN ou installer package dans public/
    - [ ] Créer helper Handlebars `{{toastMessages}}` pour afficher les toasts
    - [ ] Implémenter middleware `req.flash()` pour messages session
    - [ ] Créer helper `src/helpers/flash.js` pour gérer les messages
    - [ ] Types de messages : success, error, warning, info
    - [ ] Support messages multiples dans une session
    - [ ] Auto-dismiss configurable (3-5 secondes)
    - [ ] Persister les messages entre redirections
    - [ ] Exemples :
        ```javascript
        req.flash('success', 'Site créé avec succès');
        req.flash('error', 'Erreur lors de la suppression');
        ```

### 📊 Amélioration des Logs (Pino)
- [ ] Configurer Pino pour logging professionnel
    - [ ] Créer `src/config/logger.js` avec configuration Pino
    - [ ] Niveaux de logs : trace, debug, info, warn, error, fatal
    - [ ] Format JSON structuré pour parsing facile
    - [ ] Créer dossier `logs/` avec sous-dossiers par type
        - [ ] `logs/app/` - logs application
        - [ ] `logs/access/` - logs HTTP (Morgan + Pino)
        - [ ] `logs/error/` - logs erreurs uniquement
    - [ ] Rotation des logs avec `pino-roll` ou `pino-rotating-file`
        - [ ] Rotation quotidienne
        - [ ] Conserver 30 jours
        - [ ] Compression des logs anciens (.gz)
        - [ ] Limite de taille (100MB par fichier)
    - [ ] Remplacer tous les `console.log` par logger
    - [ ] Ajouter contexte aux logs (userId, requestId, etc.)
- [ ] Interface admin pour visualiser les logs
    - [ ] Route `/admin/logs` (super_admin uniquement)
    - [ ] Liste des fichiers de logs avec taille/date
    - [ ] Viewer de logs avec pagination
    - [ ] Filtres : niveau, date, recherche texte
    - [ ] Télécharger un fichier de log
    - [ ] Supprimer manuellement des logs anciens

### 📤 Export CSV
- [ ] Implémenter exports CSV avec fast-csv
    - [ ] Ajouter bouton "Export CSV" sur toutes les listes
    - [ ] Route `/export/csv/:entity` (sites, forms, inbox, users)
    - [ ] Créer service `src/services/csv.service.js`
    - [ ] Support des filtres existants (dates, recherche)
    - [ ] Headers personnalisés selon l'entité
    - [ ] Encoding UTF-8 avec BOM pour Excel
    - [ ] Nom de fichier : `entity_YYYY-MM-DD_HHmmss.csv`
    - [ ] Streaming pour grandes quantités de données
    - [ ] Respect des permissions (viewer peut exporter ses données)

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
- [ ] Ajouter pagination sur toutes les listes
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
2. **Ajouter validation des variables d'env** - Sécurité essentielle au démarrage
3. **Implémenter helmet.js** - Headers de sécurité HTTP

### ⚡ Important (Court terme)

1. **Créer couche services** - Déplacer logique DB des controllers vers services
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

- ✅ Système ACL complet avec 5 rôles
- ✅ Protection de toutes les routes
- ✅ Helpers Handlebars pour permissions
- ✅ Script formatage HBS personnalisé
- ✅ Pre-commit hooks avec Husky
- ✅ Guide des commits (COMMIT_FORMAT.md)

---

**Dernière mise à jour :** 8 décembre 2025
