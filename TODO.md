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
- [ ] Peupler dossier `middlewares/`
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
- [ ] Documenter conventions de code

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

- [ ] Ajouter système de notifications
- [ ] Améliorer gestion des permissions
- [ ] Ajouter pagination sur toutes les listes
- [ ] Implémenter recherche avancée
- [ ] Ajouter exports CSV en plus d'Excel
- [ ] Système de backup automatique

---

## 📦 Configuration & Dépendances

- [ ] Vérifier et mettre à jour les dépendances
- [ ] Ajouter scripts npm utiles :
    - [ ] `npm run dev` (développement avec hot-reload)
    - [ ] `npm run build` (production)
    - [ ] `npm run lint:fix`
    - [ ] `npm run format`
- [ ] Documenter tous les scripts npm

---

## 🎯 Priorités

### 🔥 Urgent (À faire maintenant)

- [x] Créer `.env.example`
- [x] Déplacer secrets vers `.env`
- [ ] Enrichir README.md

### ⚡ Important (Court terme)

- [ ] Créer couche services
- [ ] Ajouter validation des variables d'env
- [ ] Configurer Prettier/ESLint

### 💡 À planifier (Moyen/Long terme)

- [ ] Tests automatisés
- [ ] Docker support
- [ ] CI/CD
- [ ] Documentation complète

---

**Dernière mise à jour :** 28 novembre 2025
