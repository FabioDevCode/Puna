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
- [ ] Créer dossier `docs/` avec :
    - [ ] Architecture détaillée
    - [ ] Guide d'API
    - [ ] Schéma de base de données

---

## 🏗️ Structure & Refactoring

- [x] **Diviser `default.controller.js` en controllers séparés**
    - [x] `dashboard.controller.js` (dashboard, stats, graphiques)
    - [x] `site.controller.js` (CRUD sites, tokens)
    - [x] `form.controller.js` (CRUD formulaires)
    - [x] `inbox.controller.js` (gestion inbox, téléchargements)
    - [x] `export.controller.js` (exports Excel/ZIP)
    - [x] `admin.controller.js` (administration utilisateurs)
- [ ] Créer couche `services/` pour la logique métier
    - [ ] `auth.service.js`
    - [ ] `site.service.js`
    - [ ] `form.service.js`
    - [ ] `inbox.service.js`
    - [ ] `csv.service.js` (exports CSV)
    - [ ] `antivirus.service.js` (scan ClamAV)
    - [ ] `logger.service.js` (gestion logs)
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

## 🌐 Open Source

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
- [ ] Documenter tous les scripts npm

---

## 🎯 Priorités

### 🔥 Urgent (À faire maintenant)

1. **Enrichir README.md** - Le projet mérite une vraie documentation
2. **Ajouter validation des variables d'env** - Sécurité essentielle au démarrage
3. **Implémenter helmet.js** - Headers de sécurité HTTP

### ⚡ Important (Court terme)

1. **Système de Toasts (Toastify)** - Notifications utilisateur + flash messages
2. **Logger Pino** - Logs structurés + interface admin + rotation
3. **Export CSV** - Compléter les exports (Excel déjà fait)
4. **ClamAV** - Scanner antivirus pour fichiers uploadés
5. **Créer couche services** - Séparer la logique métier des controllers
6. **Rate limiting** - Protection contre les abus API
7. **Pagination** - Améliorer performance sur grandes listes

### 💡 À planifier (Moyen/Long terme)

1. **Tests automatisés** - Garantir la qualité du code
2. **Docker support** - Faciliter le déploiement
3. **CI/CD** - Automatiser les workflows
4. **Documentation API complète** - docs/ avec architecture

### ✅ Récemment complété

- ✅ Système ACL complet avec 5 rôles
- ✅ Protection de toutes les routes
- ✅ Helpers Handlebars pour permissions
- ✅ Script formatage HBS personnalisé
- ✅ Pre-commit hooks avec Husky
- ✅ Guide des commits (COMMIT_FORMAT.md)

---

**Dernière mise à jour :** 8 décembre 2025
