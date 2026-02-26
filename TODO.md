# TODO Puna — Feuille de route

> Mis à jour le 23 février 2026

---

## Phase 1 — Tests & CI/CD (pré-beta, priorité haute)

| #   | Tâche                              | Statut | Détail                                                        |
| --- | ---------------------------------- | ------ | ------------------------------------------------------------- |
| 1   | **Installer Vitest + supertest**   | ⬜     | Framework de test natif ESM + tests HTTP Express              |
| 2   | **Tests unitaires**                | ⬜     | `utils/`, `helpers/`, `config/permissions.js`                 |
| 3   | **Tests d'intégration API**        | ⬜     | Pipeline `POST /api/v1/send/:code` (auth, upload, validation) |
| 4   | **Tests d'intégration routes web** | ⬜     | Auth (login/logout), RBAC (403/401), dashboard                |
| 5   | **Tests middlewares**              | ⬜     | sanitize, checkAccess, loginRateLimiter                       |
| 6   | **CI GitHub Actions**              | ⬜     | Workflow : lint → test + couverture + badges sur push/PR      |
| 7   | **Stratégie de branches**          | ⬜     | `main` (protégée) + `develop` + `feature/*` + `release/*`     |

### Détail #1 — Setup Vitest + supertest

```bash
npm install -D vitest supertest @vitest/coverage-v8
```

Ajouter dans `package.json` :

```json
{
    "scripts": {
        "test": "vitest run",
        "test:watch": "vitest",
        "test:coverage": "vitest run --coverage"
    }
}
```

Créer `vitest.config.js` à la racine :

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json-summary', 'json'],
            reportsDirectory: './coverage',
        },
    },
});
```

Structure des tests :

```
tests/
  ├── unit/
  │     ├── utils/
  │     │     ├── crypto.test.js
  │     │     ├── string.test.js
  │     │     └── errors.test.js
  │     ├── config/
  │     │     └── permissions.test.js
  │     └── helpers/
  │           └── hbs_fn.test.js
  ├── integration/
  │     ├── services/
  │     │     └── auth.service.test.js
  │     ├── api/
  │     │     └── send.test.js
  │     └── routes/
  │           ├── auth.test.js
  │           └── rbac.test.js
  └── middlewares/
        ├── sanitize.test.js
        ├── checkAccess.test.js
        └── loginRateLimiter.test.js
```

### Détail #6 — CI GitHub Actions (lint + test + badges)

Créer `.github/workflows/ci.yml` :

```yaml
name: CI

on:
    push:
        branches: [main, develop]
    pull_request:
        branches: [main, develop]

jobs:
    lint:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with:
                  node-version: 22
                  cache: npm
            - run: npm ci
            - run: npm run lint

    test:
        runs-on: ubuntu-latest
        services:
            mariadb:
                image: mariadb:11
                env:
                    MARIADB_ROOT_PASSWORD: testpwd
                    MARIADB_DATABASE: puna_test
                    MARIADB_USER: puna_test
                    MARIADB_PASSWORD: testpwd
                ports:
                    - 3306:3306
                options: >-
                    --health-cmd="healthcheck.sh --connect --innodb_initialized"
                    --health-interval=10s
                    --health-timeout=5s
                    --health-retries=10
                    --health-start-period=60s
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with:
                  node-version: 22
                  cache: npm
            - run: npm ci
            - name: Run tests with coverage
              run: npm run test:coverage
              env:
                  NODE_ENV: test
                  DB_IP: 127.0.0.1
                  DB_PORT: 3306
                  DB_USER: puna_test
                  DB_PWD: testpwd
                  DB_NAME: puna_test
                  DB_DIALECT: mariadb
                  PORT: 3022
                  KEY_TK: test-jwt-secret-key-ci
                  KEV: test-encryption-key-ci
                  KIV: test-encryption-iv-ci
                  SESSION_SECRET: test-session-secret-ci
                  CSRF_SECRET: test-csrf-secret-ci
                  API_KEY: test-api-key-ci

            # Badge couverture — génère un badge JSON dans coverage/
            - name: Generate coverage badge
              uses: jaywcjlove/coverage-badges-cli@main
              with:
                  source: coverage/coverage-summary.json
                  output: coverage/badge.svg

            # Publie le badge sur GitHub Pages (branche gh-pages)
            - name: Deploy badge to GitHub Pages
              if: github.ref == 'refs/heads/main'
              uses: peaceiris/actions-gh-pages@v4
              with:
                  github_token: ${{ secrets.GITHUB_TOKEN }}
                  publish_dir: ./coverage
                  destination_dir: badges
```

Ensuite dans le `README.md`, ajouter le badge :

```md
![Coverage](https://<ton-user>.github.io/Puna/badges/badge.svg)
```

### Détail #7 — Stratégie de branches

```
main (protégée — PR only)
  │
  ├── develop (travail quotidien)
  │     ├── feature/tests-setup
  │     ├── feature/ci-cd
  │     ├── feature/password-reset
  │     ├── fix/crypto-iv
  │     └── ...
  │
  └── release/v1.0.0-beta (préparation release)
```

- `main` : protégée, merge uniquement via PR depuis `develop` ou `release/*`
- `develop` : branche de travail courante
- `feature/*` / `fix/*` : branches éphémères, merge dans `develop` via PR
- `release/*` : quand prêt pour la beta, merge dans `main` + tag

## Phase 2 — Production readiness (pré-beta)

| #   | Tâche                             | Statut | Détail                                                                     |
| --- | --------------------------------- | ------ | -------------------------------------------------------------------------- |
| 8   | **Reset mot de passe**            | ⬜     | Avec `nodemailer` (déjà dans les deps)                                     |
| 9   | **Splitter admin.controller.js**  | ✅     | 3 sous-controllers : admin, adminUsers, adminLogs (voir plan ci-dessous)   |
| 10  | **ESLint 9 flat config**          | ✅     | Migrer `.eslintrc` → `eslint.config.js` (voir plan ci-dessous)             |
| 11  | **Migrer CryptoJS → node:crypto** | ✅     | Remplacer la dépendance externe par le module natif (voir plan ci-dessous) |
| 12  | **Version 1.0.0-beta.1**          | ⬜     | Changer `0.0.1` dans package.json                                          |

### Détail #9 — Plan de découpage admin.controller.js (839 lignes → 3 fichiers)

**Étape 1 — Créer le dossier et les fichiers**

```
src/controllers/admin/
  ├── index.js                      → ré-exporte tout
  ├── admin.controller.js           → dashboard admin + settings
  ├── adminUsers.controller.js      → gestion des utilisateurs
  └── adminLogs.controller.js       → visualisation des logs
```

**Étape 2 — Répartition des fonctions**

`admin.controller.js` (dashboard + settings) :

- `admin()` — page admin principale + statistiques
- `adminSettings()` — page des paramètres

`adminUsers.controller.js` (gestion utilisateurs) :

- `adminUsers()` — page liste users
- `adminUsersList()` — fetch JSON users filtrés
- `adminUsersExportExcel()` — export Excel
- `adminUsersExportCSV()` — export CSV
- `adminCreateUser()` — création user
- `adminDeleteUser()` — suppression user
- `adminViewUser()` — vue détail user
- `adminEditUser()` — formulaire édition
- `adminUpdateUser()` — sauvegarde édition

`adminLogs.controller.js` (logs) :

- `logsViewer()` — page viewer
- `readLogs()` — lecture fichiers log
- `getArchives()` — listing archives
- Fonctions privées `countFileLines()` et `countFilesRecursive()` déplacées ici

**Étape 3 — Le fichier index.js**

```js
export * from './admin.controller.js';
export * from './adminUsers.controller.js';
export * from './adminLogs.controller.js';
```

**Étape 4 — Mettre à jour l'import dans les routes**

```diff
// src/routes/default.routes.js
- import * as adminCtl from '../controllers/admin.controller.js';
+ import * as adminCtl from '../controllers/admin/index.js';
```

Aucune autre modification nécessaire : les noms de fonctions restent identiques.

### Détail #10 — Plan de migration ESLint 8 → ESLint 9.39.3

**Étape 1 — Mettre à jour les packages**

```bash
# Désinstaller les anciens
npm uninstall eslint eslint-plugin-import

# Installer ESLint 9 + nouveaux plugins
npm install -D eslint@9.39.3 @eslint/js globals eslint-plugin-import-x eslint-config-prettier eslint-plugin-prettier eslint-plugin-jsonc jsonc-eslint-parser
```

**Étape 2 — Créer `eslint.config.js` (flat config)**

Recréer ta config actuelle `.eslintrc` en format flat config :

```js
import js from '@eslint/js';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import-x';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import jsoncPlugin from 'eslint-plugin-jsonc';
import jsoncParser from 'jsonc-eslint-parser';

export default [
    // Config recommandée de base
    js.configs.recommended,

    // Config globale Node.js
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.es2022,
            },
        },
        plugins: {
            'import-x': importPlugin,
            prettier: prettierPlugin,
        },
        rules: {
            'prettier/prettier': 'error',
            indent: 'off',
            'linebreak-style': ['error', 'unix'],
            quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
            semi: ['error', 'always'],
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-console': 'off',
            'no-empty': 'warn',
            'comma-dangle': ['error', 'only-multiline'],
            'no-trailing-spaces': 'error',
            'eol-last': ['error', 'always'],
            'object-curly-spacing': ['error', 'always'],
            'array-bracket-spacing': ['error', 'never'],
            'space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
            'keyword-spacing': ['error', { before: true, after: true }],
            'space-infix-ops': 'error',
            'comma-spacing': ['error', { before: false, after: true }],
            'brace-style': ['error', '1tbs', { allowSingleLine: true }],
            curly: ['error', 'all'],
            'no-multi-spaces': 'error',
            'import-x/order': [
                'error',
                {
                    groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
                    pathGroups: [{ pattern: 'node:**', group: 'builtin', position: 'before' }],
                    pathGroupsExcludedImportTypes: ['builtin'],
                    'newlines-between': 'never',
                    alphabetize: { order: 'asc', caseInsensitive: true },
                },
            ],
            'import-x/newline-after-import': ['error', { count: 1 }],
            'import-x/no-duplicates': 'error',
        },
    },

    // Override pour les fichiers JS côté navigateur (src/public/js/)
    {
        files: ['src/public/js/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ApexCharts: 'readonly',
                Toastify: 'readonly',
                Toast: 'readonly',
            },
        },
        rules: {
            'import-x/order': 'off',
            'import-x/newline-after-import': 'off',
            'no-inner-declarations': 'off',
        },
    },

    // Override pour les fichiers JSON (package.json)
    {
        files: ['package.json', 'package-lock.json'],
        plugins: { jsonc: jsoncPlugin },
        languageOptions: { parser: jsoncParser },
        rules: {
            'jsonc/sort-keys': 'off',
            'jsonc/indent': ['error', 'tab'],
        },
    },

    // Override pour les autres JSON
    {
        files: ['*.json', '**/*.json'],
        ignores: ['package.json', 'package-lock.json'],
        plugins: { jsonc: jsoncPlugin },
        languageOptions: { parser: jsoncParser },
        rules: {
            'jsonc/sort-keys': ['error', 'asc', { caseSensitive: false, natural: true }],
            'jsonc/indent': ['error', 4],
        },
    },

    // Prettier en dernier (désactive les règles de formatage conflictuelles)
    prettierConfig,

    // Ignorer les fichiers (remplace .eslintignore)
    {
        ignores: ['node_modules/', 'coverage/', 'logs/', 'storage/', 'Puna/'],
    },
];
```

**Étape 3 — Supprimer les anciens fichiers**

```bash
rm .eslintrc .eslintignore
```

**Étape 4 — Vérifier**

```bash
npm run lint
```

**Étape 5 — Mettre à jour lint-staged si nécessaire**

Rien à changer dans `lint-staged` du `package.json` : la commande `eslint --fix` reste identique. Husky continue de fonctionner normalement.

### Détail #11 — Plan de migration CryptoJS → node:crypto

**Contexte :** Remplacer `crypto-js` (dépendance externe) par le module natif `node:crypto`. Garder l'IV fixe pour le moment (migration IV aléatoire en post-beta).

**Étape 1 — Réécrire `src/utils/crypto.js`**

```js
import { createCipheriv, createDecipheriv } from 'node:crypto';

const ALGORITHM = 'aes-256-cbc';

// KEV doit être une clé de 32 bytes (hex = 64 chars)
// KIV doit être un IV de 16 bytes (hex = 32 chars)
const KEY = Buffer.from(process.env.KEV, 'hex');
const IV = Buffer.from(process.env.KIV, 'hex');

if (KEY.length !== 32) {
    throw new Error('KEV must be a 64-char hex string (32 bytes for AES-256)');
}
if (IV.length !== 16) {
    throw new Error('KIV must be a 32-char hex string (16 bytes for AES IV)');
}

export function encryptObject(object) {
    const data = JSON.stringify(object);
    const cipher = createCipheriv(ALGORITHM, KEY, IV);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

export function decryptObject(encryptedHex) {
    const decipher = createDecipheriv(ALGORITHM, KEY, IV);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
}

export function encryptString(string) {
    const cipher = createCipheriv(ALGORITHM, KEY, IV);
    let encrypted = cipher.update(string, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

export function decryptString(encryptedHex) {
    const decipher = createDecipheriv(ALGORITHM, KEY, IV);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
```

**Étape 2 — Régénérer KEV et KIV en format hex dans `.env`**

```bash
# Générer une clé AES-256 (32 bytes = 64 hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Générer un IV (16 bytes = 32 hex)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

Mettre à jour le `.env` :

```
KEV=<64 caractères hex>
KIV=<32 caractères hex>
```

**Étape 3 — Révoquer et régénérer tous les tokens existants**

Les tokens JWT générés avec l'ancien CryptoJS ne seront **plus déchiffrables** avec la nouvelle implémentation (algorithme et format différents). Il faut :

1. Révoquer tous les tokens de sites existants (régénérer les `control_code`)
2. Les utilisateurs devront re-générer leurs tokens

**Étape 4 — Supprimer la dépendance**

```bash
npm uninstall crypto-js
```

**Étape 5 — Tester**

Vérifier que les fonctions `encryptObject` / `decryptObject` produisent bien un cycle encrypt→decrypt cohérent (ajouter un test unitaire dans `tests/unit/utils/crypto.test.js`).

## Phase 3 — Préparation open source (beta)

| #   | Tâche                  | Statut | Détail                                            |
| --- | ---------------------- | ------ | ------------------------------------------------- |
| 13  | **Enrichir README.md** | ⬜     | Install, usage, screenshots, badges CI/couverture |
| 14  | **CONTRIBUTING.md**    | ⬜     | Guide de contribution pour l'open source          |
| 15  | **Templates GitHub**   | ⬜     | Issue templates + PR template dans `.github/`     |

## Phase 4 — Post-beta (améliorations futures)

| #   | Tâche                            | Statut | Détail                                                                                                                                                                 |
| --- | -------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16  | **Migrations Sequelize (umzug)** | ⬜     | Remplacer `sync()` par des migrations versionnées (voir [ANALYSIS-MIGRATIONS.md](ANALYSIS-MIGRATIONS.md)). À étudier quand un outil de génération auto sera disponible |
| 17  | **IV aléatoire (node:crypto)**   | ⬜     | Implémenter le pattern IV préfixé au chiffré                                                                                                                           |
| 18  | **2FA / MFA**                    | ⬜     | Authentification à deux facteurs                                                                                                                                       |
| 19  | **Migrer ESLint 9 → 10**         | ⬜     | Quand l'écosystème de plugins sera stable sur v10                                                                                                                      |

---

## Points écartés (non-sujets)

| Point initial                         | Raison                                                  |
| ------------------------------------- | ------------------------------------------------------- |
| Documentation API Swagger/OpenAPI     | Documentation dans un projet VuePress séparé            |
| Validation input structurée (Joi/Zod) | Voulu : stockage JSON brut du body dans `Inbox.content` |
