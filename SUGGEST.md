# Suggestions d'Amélioration - Puna

Ce document présente des suggestions pour améliorer la structure du projet Puna afin de le rendre plus accessible, compréhensible et facile à utiliser pour la communauté open source.

---

## 📁 Structure du Projet

### ✅ Points Positifs Actuels

- Organisation MVC claire (`models`, `views`, `controllers`)
- Séparation API/Routes distincte
- Gestion des migrations SQL
- Configuration centralisée
- Utilisation de helpers pour réutilisabilité

### 🔧 Améliorations Recommandées

#### 1. Documentation du Projet

> [!IMPORTANT]
> La documentation est essentielle pour un projet open source réussi.

**À Ajouter :**

- **README.md enrichi** avec :
  - Description claire du projet et de son objectif
  - Badges (licence, version, build status)
  - Screenshots ou GIF de démonstration
  - Guide de démarrage rapide (Quick Start)
  - Prérequis système détaillés
  - Instructions d'installation pas à pas
  - Variables d'environnement documentées
  - Architecture du projet (diagramme)

- **CONTRIBUTING.md** :
  - Guide pour les contributeurs
  - Processus de soumission de PR
  - Standards de code
  - Comment reporter des bugs
  - Roadmap des fonctionnalités

- **CHANGELOG.md** :
  - Historique des versions
  - Changements notables par version
  - Breaking changes documentés

- **docs/** directory :
  - Architecture détaillée
  - Guide d'API
  - Guide utilisateur
  - Guide développeur
  - Schéma de base de données

#### 2. Structure des Dossiers

**Actuel :**
```
src/
├── api/
├── config/
├── controllers/
├── helpers/
├── models/
├── routes/
├── views/
└── utils/
```

**Suggestions :**

```
src/
├── api/
│   └── v1/
│       ├── handlers/
│       ├── middlewares/
│       └── validators/
├── config/
│   ├── database.js
│   ├── permissions.js
│   └── app.config.js        # ← Nouveau: centraliser toute la config
├── controllers/
│   ├── auth/                # ← Séparer par domaine
│   ├── sites/
│   ├── forms/
│   ├── inbox/
│   └── admin/
├── middlewares/             # ← Dossier vide actuellement
│   ├── auth.middleware.js
│   ├── validation.middleware.js
│   ├── errorHandler.middleware.js
│   └── rateLimiter.middleware.js
├── models/
│   ├── attributes/
│   ├── relations/
│   └── index.js
├── services/                # ← Nouveau: logique métier
│   ├── auth.service.js
│   ├── site.service.js
│   ├── form.service.js
│   └── inbox.service.js
├── helpers/
│   ├── auth/
│   ├── models/
│   └── upload/
├── utils/
│   ├── crypto.js
│   ├── string.js
│   └── validators.js       # ← Nouveau: validation réutilisable
├── routes/
│   ├── api.routes.js
│   ├── auth.routes.js
│   └── web.routes.js
├── views/
│   ├── layouts/
│   ├── pages/
│   └── partials/
├── public/
│   ├── css/
│   ├── js/
│   └── img/
└── tests/                   # ← Nouveau: tests unitaires/intégration
    ├── unit/
    ├── integration/
    └── e2e/
```

#### 3. Fichier Controller Monolithique

> [!WARNING]
> Le fichier `default.controller.js` contient **1869 lignes** et **42 fonctions** - c'est trop !

**Problème :**
- Difficile à maintenir
- Difficile à tester
- Difficile à comprendre pour les nouveaux contributeurs

**Solution : Diviser par domaine**

```
src/controllers/
├── auth.controller.js       ✅ (Déjà existant)
├── dashboard.controller.js  # → dashboard, stats, charts
├── site.controller.js       # → createSite, showSite, deleteSite, getSiteToken
├── form.controller.js       # → createForm, deleteForm, updateForm
├── inbox.controller.js      # → getFormInbox, showInbox, deleteInbox
├── export.controller.js     # → exportFormToExcel, downloadInboxZip
├── admin/
│   ├── users.controller.js  # → adminUsers, adminCreateUser, etc.
│   └── settings.controller.js
└── index.js                 # Export tous les controllers
```

#### 4. Service Layer (Nouvelle Couche)

> [!TIP]
> Séparer la logique métier des controllers améliore la testabilité et la réutilisabilité.

**Créer une couche service :**

```javascript
// src/services/site.service.js
class SiteService {
    async createSite(userId, siteData) {
        // Logique métier
    }

    async getSiteWithStats(siteId, userId) {
        // Logique métier
    }

    async deleteSite(siteId, userId) {
        // Vérifications + suppression
    }
}

export default new SiteService();
```

**Utilisation dans le controller :**

```javascript
// src/controllers/site.controller.js
import siteService from '../services/site.service.js';

export async function createSite(req, res) {
    try {
        const site = await siteService.createSite(req.user.id, req.body);
        res.status(201).json(site);
    } catch (error) {
        next(error);
    }
}
```

#### 5. Gestion des Erreurs

**Créer un système d'erreurs personnalisé :**

```javascript
// src/utils/errors.js
export class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
    }
}

export class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401);
    }
}
```

**Middleware de gestion d'erreurs :**

```javascript
// src/middlewares/errorHandler.middleware.js
export function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    console.error(err);

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
}
```

#### 6. Configuration et Environnement

**Problèmes Actuels :**
- Secret session en dur (`secret: 'example_secret'`)
- Configuration dispersée
- Pas de validation des variables d'environnement

**Solutions :**

**Créer `.env.example` :**
```env
# Application
NODE_ENV=development
PORT=3022

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=puna_user
DB_PASSWORD=your_password
DB_NAME=puna_db

# Session
SESSION_SECRET=your_very_long_and_secure_secret_key_here
SESSION_MAX_AGE=43200000

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=12h

# Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=.jpg,.jpeg,.png,.pdf,.doc,.docx

# Timezone
TZ=Europe/Paris
```

**Créer un validateur de config :**
```javascript
// src/config/env.validator.js
export function validateEnv() {
    const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'SESSION_SECRET'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required env variables: ${missing.join(', ')}`);
    }
}
```

#### 7. Tests

> [!CAUTION]
> Aucune structure de test n'existe actuellement !

**Ajouter dans `package.json` :**
```json
{
  "scripts": {
    "test": "NODE_ENV=test mocha",
    "test:unit": "NODE_ENV=test mocha 'src/tests/unit/**/*.test.js'",
    "test:integration": "NODE_ENV=test mocha 'src/tests/integration/**/*.test.js'",
    "test:coverage": "c8 npm test"
  },
  "devDependencies": {
    "mocha": "^10.0.0",
    "chai": "^4.3.0",
    "sinon": "^15.0.0",
    "c8": "^8.0.0",
    "supertest": "^6.3.0"
  }
}
```

**Structure de tests :**
```
src/tests/
├── fixtures/           # Données de test
├── helpers/           # Helpers pour tests
├── unit/
│   ├── models/
│   ├── services/
│   └── utils/
└── integration/
    ├── api/
    └── controllers/
```

#### 8. Sécurité

**Améliorations Recommandées :**

1. **Ajouter helmet.js** pour sécuriser les headers HTTP
2. **Rate limiting** pour prévenir les attaques
3. **CORS** configuré proprement
4. **Validation des entrées** avec joi ou zod
5. **Sanitization** des données utilisateur

```javascript
// src/app.js
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.use(helmet());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limite par IP
});
app.use('/api/', limiter);
```

#### 9. Logging

**Améliorer le système de logs :**

```javascript
// src/config/logger.js
import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard'
        }
    }
});

export default logger;
```

#### 10. Docker Support

**Ajouter pour faciliter le déploiement :**

- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3022:3022"
    environment:
      - NODE_ENV=production
    depends_on:
      - db

  db:
    image: mariadb:latest
    environment:
      - MYSQL_ROOT_PASSWORD=root
      - MYSQL_DATABASE=puna_db
    volumes:
      - db_data:/var/lib/mysql

volumes:
  db_data:
```

#### 11. CI/CD

**Ajouter GitHub Actions :**

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run lint
```

#### 12. Standards de Code

**Créer `.editorconfig` amélioré :**
```ini
root = true

[*]
charset = utf-8
indent_style = tab
indent_size = 4
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.{json,yml,yaml,md}]
indent_style = space
indent_size = 2
```

**Ajouter Prettier :**
```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 4,
  "useTabs": true,
  "trailingComma": "es5"
}
```

---

## 📋 Checklist de Mise en Place

### Documentation
- [ ] Enrichir README.md
- [ ] Créer CONTRIBUTING.md
- [ ] Créer CHANGELOG.md
- [ ] Ajouter .env.example
- [ ] Documenter l'API
- [ ] Créer diagramme d'architecture

### Structure
- [ ] Diviser default.controller.js
- [ ] Créer couche services
- [ ] Organiser controllers par domaine
- [ ] Peupler dossier middlewares
- [ ] Créer structure tests

### Sécurité
- [ ] Déplacer secret session vers .env
- [ ] Ajouter helmet
- [ ] Implémenter rate limiting
- [ ] Valider variables d'environnement
- [ ] Ajouter validation des entrées

### DevOps
- [ ] Créer Dockerfile
- [ ] Créer docker-compose.yml
- [ ] Configurer CI/CD
- [ ] Ajouter scripts npm utiles
- [ ] Configurer logs production

### Qualité Code
- [ ] Configurer Prettier
- [ ] Améliorer ESLint
- [ ] Ajouter tests unitaires
- [ ] Ajouter tests d'intégration
- [ ] Configurer coverage

---

## 🎯 Priorités

### Haute Priorité (À faire en premier)
1. ✨ README.md complet avec guide Quick Start
2. ✨ .env.example avec toutes les variables
3. ✨ Diviser default.controller.js
4. ✨ Déplacer secrets vers variables d'environnement

### Priorité Moyenne
1. 📝 CONTRIBUTING.md
2. 📝 Créer couche services
3. 📝 Ajouter middlewares manquants
4. 📝 Docker support

### Priorité Basse (Nice to have)
1. 🔧 Tests automatisés
2. 🔧 CI/CD
3. 🔧 Documentation API complète
4. 🔧 Diagrammes d'architecture

---

## 💡 Conseils pour Open Source

1. **Issue Templates** : Créer des templates pour bug reports et feature requests
2. **Pull Request Template** : Faciliter les contributions
3. **Code of Conduct** : Définir les règles de la communauté
4. **Releases** : Utiliser GitHub Releases avec notes de version
5. **Discussions** : Activer GitHub Discussions pour la communauté
6. **Labels** : Organiser les issues (bug, enhancement, good first issue, etc.)
7. **Roadmap** : Publier une roadmap publique
8. **Demo/Playground** : Fournir une instance de démo si possible

---

## 📚 Ressources Utiles

- [Best Practices Node.js](https://github.com/goldbergyoni/nodebestpractices)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Sequelize Best Practices](https://sequelize.org/docs/v6/other-topics/migrations/)
- [Open Source Guide](https://opensource.guide/)

---

**Note :** Ces suggestions visent à rendre Puna plus accessible aux contributeurs potentiels tout en améliorant la maintenabilité et la scalabilité du projet. L'implémentation peut se faire de manière incrémentale, en commençant par les éléments haute priorité.
