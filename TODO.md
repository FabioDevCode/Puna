# TODO Puna — Feuille de route

> Mis à jour le 27 février 2026

---

## Phase 1 — Tests & CI/CD (pré-beta, priorité haute)

| #   | Tâche                              | Statut | Détail                                                        |
| --- | ---------------------------------- | ------ | ------------------------------------------------------------- |
| 1   | **Installer Vitest + supertest**   | ✅     | Framework de test natif ESM + tests HTTP Express              |
| 2   | **Tests unitaires**                | ✅     | `utils/`, `helpers/`, `config/permissions.js`                 |
| 3   | **Tests d'intégration API**        | ✅     | Pipeline `POST /api/v1/send/:code` (auth, upload, validation) |
| 4   | **Tests d'intégration routes web** | ✅     | Auth (login/logout), RBAC (403/401), dashboard                |
| 5   | **Tests middlewares**              | ✅     | sanitize, checkAccess, loginRateLimiter                       |
| 6   | **CI GitHub Actions**              | ⬜     | Workflow : lint → test + couverture + badges sur push/PR      |
| 7   | **Stratégie de branches**          | ⬜     | `main` (protégée) + `develop` + `feature/*` + `release/*`     |

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

| #   | Tâche                             | Statut | Détail                                              |
| --- | --------------------------------- | ------ | --------------------------------------------------- |
| 8   | **Reset mot de passe**            | ⬜     | Avec `nodemailer` (déjà dans les deps)              |
| 9   | **Splitter admin.controller.js**  | ✅     | 3 sous-controllers : admin, adminUsers, adminLogs   |
| 10  | **ESLint 9 flat config**          | ✅     | Migrer `.eslintrc` → `eslint.config.js`             |
| 11  | **Migrer CryptoJS → node:crypto** | ✅     | Remplacer la dépendance externe par le module natif |
| 12  | **Version 1.0.0-beta.1**          | ⬜     | Changer `0.0.1` dans package.json                   |

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
| 18  | **2FA / MFA**                    | ✅     | Authentification à deux facteurs (TOTP + codes de récupération) |
| 19  | **Migrer ESLint 9 → 10**         | ⬜     | Quand l'écosystème de plugins sera stable sur v10                                                                                                                      |

---

## Points écartés (non-sujets)

| Point initial                         | Raison                                                  |
| ------------------------------------- | ------------------------------------------------------- |
| Documentation API Swagger/OpenAPI     | Documentation dans un projet VuePress séparé            |
| Validation input structurée (Joi/Zod) | Voulu : stockage JSON brut du body dans `Inbox.content` |
