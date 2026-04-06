# Plan d'implémentation — Puna

> Préparation à la mise en public du projet — 6 avril 2026

---

## Vue d'ensemble

| #   | Tâche                                      | Effort | Priorité |
| --- | ------------------------------------------ | ------ | -------- |
| 1   | Script d'installation (`scripts/setup.js`) | Moyen  | Haute    |
| 2   | Documents de contribution open-source      | Moyen  | Haute    |
| 3   | CI GitHub Actions (lint + tests)           | Faible | Haute    |
| 4   | Enrichir le README.md                      | Moyen  | Haute    |

Les tâches 1 et 2 sont indépendantes. La tâche 3 doit être en place avant la première PR externe. La tâche 4 finalise la présentation publique du projet.

---

## 1. Script d'installation (`scripts/setup.js`)

### Objectif

Un seul script interactif CLI qui génère le fichier `.env` complet. Pas de `setup-admin.js` séparé : le login/email admin est demandé directement dans `setup.js`, et `init_admin_user.js` gère le fallback au démarrage.

### Contraintes techniques

- **Modules natifs uniquement** (`readline`, `crypto`, `fs`, `path`) — exécutable avant `npm install`
- **Détection Docker** : si `/.dockerenv` existe, les valeurs par défaut s'adaptent automatiquement :
    - `DB_IP` → `db` (nom du service Docker Compose)
    - `CLAMAV_SOCKET` → vide
    - `CLAMAV_HOST` → `clamav`
- **Questions en anglais** (projet open-source)
- **Pas de Makefile** — les scripts npm suffisent

### Sections du script (dans l'ordre)

| #   | Section         | Variables                                                                             | Comportement                                              |
| --- | --------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | Application     | `NODE_ENV`, `PORT`                                                                    | Valeurs par défaut : `development`, `3022`                |
| 2   | Base de données | `DB_IP`, `DB_PORT`, `DB_USER`, `DB_PWD`, `DB_NAME`, `DB_DIALECT`                      | Docker : `DB_IP=db`. Natif : `127.0.0.1`                  |
| 3   | Sécurité (auto) | `KEY_TK`, `KEV`, `KIV`, `SESSION_SECRET`, `SESSION_MAX_AGE`, `CSRF_SECRET`, `API_KEY` | Générées via `crypto.randomBytes()`, **sans interaction** |
| 4   | Helmet          | `HELMET_STRICT_TRANSPORT`                                                             | Défaut : `false`                                          |
| 5   | Logs            | `LOG_RETENTION_APP/API/ERROR/AUDIT`, `LOG_TO_CONSOLE`                                 | Valeurs par défaut raisonnables                           |
| 6   | Rate Limiting   | `RATE_LIMIT_FORM_MAX`, `RATE_LIMIT_FORM_WINDOW_MS`, `MAX_FAILED_LOGIN_ATTEMPTS`       | Défauts : `30`, `60000`, `10`                             |
| 7   | Upload          | `API_MAX_FILE_SIZE`, `API_MAX_TOTAL_SIZE`, `API_MAX_FILES`, `API_MAX_FIELDS`, etc.    | Défauts du `.env.example`                                 |
| 8   | ClamAV (opt.)   | `CLAMAV_ENABLED`, `CLAMAV_SOCKET`, `CLAMAV_HOST`, `CLAMAV_PORT`                       | Question oui/non. Si non → `CLAMAV_ENABLED=false`, skip   |
| 9   | SMTP (opt.)     | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `APP_URL`            | Question oui/non. Si non → section omise du `.env`        |
| 10  | TOTP (opt.)     | `TOTP_ENABLED`, `TOTP_ISSUER`                                                         | Question oui/non. Défaut : `false`                        |
| 11  | Admin           | `ADMIN_LOGIN`, `ADMIN_EMAIL`                                                          | Login obligatoire, email optionnel                        |

### Comportement UX

```
╔══════════════════════════════════════╗
║     Puna — Environment Setup        ║
╚══════════════════════════════════════╝

🐳 Docker environment detected — defaults adjusted.

── 1/11 Application ──────────────────
? NODE_ENV [development] :
? PORT [3022] :

── 2/11 Database ─────────────────────
? DB_IP [db] :
? DB_PORT [3306] :
? DB_USER [root] :
? DB_PWD : ********
? DB_NAME [puna] :
? DB_DIALECT [mariadb] :

── 3/11 Security Keys ───────────────
✔ All security keys generated automatically.
  KEY_TK .......... 64 chars
  KEV ............. 64 hex chars (32 bytes AES-256)
  KIV ............. 32 hex chars (16 bytes AES IV)
  SESSION_SECRET .. 64 chars
  CSRF_SECRET ..... 64 chars
  API_KEY ......... 64 hex chars

[...]

── 8/11 ClamAV ──────────────────────
? Enable ClamAV (antivirus scan)? (y/N) : N
  → Skipped. Set CLAMAV_ENABLED=true in .env to enable later.

[...]

── 11/11 Admin ──────────────────────
? Admin login [admin] : fabio
? Admin email (optional) [] : fabio@example.com

✔ .env file created successfully.
  → Start the app: npm run dev (native) or docker compose up -d (Docker)
  → First login: the admin account is in "pending" status.
    Set your password at /dp-first-connexion
```

### Gestion du `.env` existant

```
⚠  An existing .env file was found.
? Overwrite and create .env.backup? (y/N) :
```

- Si oui → copie `.env` → `.env.backup`, puis génère le nouveau
- Si non → quitte proprement

### Script npm

```json
"setup": "node scripts/setup.js"
```

### Fichiers impactés

| Fichier            | Action                           |
| ------------------ | -------------------------------- |
| `scripts/setup.js` | Nouveau — script principal       |
| `package.json`     | Ajout script `"setup"`           |
| `SETUP_SCRIPT.md`  | Supprimer (remplacé par ce plan) |

---

## 2. Documents de contribution open-source

### Liste des documents à créer

| #   | Document                       | Emplacement                                  | Rôle                                                |
| --- | ------------------------------ | -------------------------------------------- | --------------------------------------------------- |
| 2a  | **CONTRIBUTING.md**            | Racine                                       | Guide complet pour les contributeurs                |
| 2b  | **CODE_OF_CONDUCT.md**         | Racine                                       | Code de conduite (Contributor Covenant v2.1 FR)     |
| 2c  | **Template — Bug report**      | `.github/ISSUE_TEMPLATE/bug_report.yml`      | Formulaire structuré de signalement de bug (YAML)   |
| 2d  | **Template — Feature request** | `.github/ISSUE_TEMPLATE/feature_request.yml` | Formulaire de demande de fonctionnalité (YAML)      |
| 2e  | **Config issues**              | `.github/ISSUE_TEMPLATE/config.yml`          | Liens vers discussions/doc + désactive issues vides |
| 2f  | **Template — Pull Request**    | `.github/PULL_REQUEST_TEMPLATE.md`           | Checklist pour chaque PR                            |
| 2g  | **CHANGELOG.md**               | Racine                                       | Historique des versions (Keep a Changelog FR)       |

Tous les documents sont rédigés **en français**.

---

### 2a. CONTRIBUTING.md — Structure détaillée

```markdown
# Contribuer à Puna

## Bienvenue

[Ton d'accueil, lien vers le Code de Conduite]

## Prérequis

- Node.js 22+
- MariaDB 11+ (ou Docker)
- npm 10+
- Git

## Installation pour le développement

1. Forker et cloner le dépôt
2. `npm run setup` (génère le `.env` interactif)
3. `npm install`
4. `npm run dev`

## Architecture du projet

[Résumé : surfaces web/API, auto-loading conventions, controller → service]
[Lien vers copilot-instructions.md pour les détails]

## Conventions de code

- ESM (`import`/`export`), pas de CommonJS
- ESLint 9 flat config (`npm run lint:fix`)
- Prettier (`npm run format`)
- Pas de `dotenv` — utiliser `node --env-file=.env`
- Services retournent du JSON (`model.toJSON()`), jamais des instances Sequelize

## Workflow Git

### Branches

- `main` — branche stable, protégée (merge via PR uniquement)
- `develop` — branche de travail quotidien
- `feature/<nom>` — nouvelles fonctionnalités (depuis `develop`)
- `fix/<nom>` — corrections de bugs (depuis `develop`)
- `docs/<nom>` — documentation (depuis `develop`)

### Processus

1. Créer une branche depuis `develop`
2. Développer + commiter (voir conventions de commits)
3. Pousser et ouvrir une PR vers `develop`
4. Review + CI verte → merge

### Conventions de commits (Conventional Commits)

Format : `<type>(<scope>): <description>`

| Type     | Usage                                   |
| -------- | --------------------------------------- |
| feat     | Nouvelle fonctionnalité                 |
| fix      | Correction de bug                       |
| docs     | Documentation uniquement                |
| test     | Ajout ou modification de tests          |
| chore    | Maintenance (dépendances, CI, config)   |
| refactor | Refactoring sans changement fonctionnel |
| style    | Formatage, espaces, points-virgules     |

Exemples :

- `feat(auth): ajouter validation mot de passe fort`
- `fix(site): corriger la vérification d'unicité du domaine`
- `docs: mettre à jour le guide d'installation`
- `test(service): ajouter tests unitaires twoFactor`

## Signaler un bug

Utiliser le template d'issue « Bug report » sur GitHub.
Inclure : étapes de reproduction, comportement attendu vs observé, environnement.

## Proposer une fonctionnalité

Utiliser le template d'issue « Demande de fonctionnalité ».
Décrire le besoin, la solution envisagée, et les alternatives considérées.

## Soumettre une Pull Request

Checklist :

- [ ] La PR pointe vers `develop` (pas `main`)
- [ ] Les tests passent (`npm test`)
- [ ] Le linter est satisfait (`npm run lint`)
- [ ] La PR est liée à une issue (si applicable)
- [ ] La description explique le changement
- [ ] Les nouveaux strings utilisent i18n (`req.__('clé')`)

## Tests

- Framework : Vitest (`npm test`, `npm run test:watch`)
- Tests unitaires : `tests/unit/`
- Tests d'intégration : `tests/integration/`
- Tests middleware : `tests/middlewares/`
- Tests E2E : `tests/e2e/` (Playwright)
- Référence de mocking : `tests/unit/services/twoFactor.service.test.js`

## Licence

En contribuant, vous acceptez que vos contributions soient publiées
sous la licence AGPLv3 du projet.
```

---

### 2b. CODE_OF_CONDUCT.md

Utiliser le **Contributor Covenant v2.1** traduit en français. C'est le standard de facto pour les projets open-source.

Source officielle FR : https://www.contributor-covenant.org/fr/version/2/1/code_of_conduct/

Contenu clé :

- Engagement envers un environnement accueillant
- Comportements acceptables et inacceptables
- Responsabilités des mainteneurs
- Portée (espaces du projet + représentation publique)
- Application (email de contact pour signalement)
- Attribution au Contributor Covenant

---

### 2c. Template — Bug report (`.github/ISSUE_TEMPLATE/bug_report.yml`)

Format YAML (formulaire GitHub structuré, plus guidant qu'un template Markdown) :

```yaml
name: '🐛 Signaler un bug'
description: 'Signaler un comportement inattendu ou une erreur'
labels: ['bug']
body:
    - type: markdown
      attributes:
          value: |
              Merci de prendre le temps de signaler ce bug.
              Remplissez les champs ci-dessous pour nous aider à reproduire le problème.

    - type: textarea
      id: description
      attributes:
          label: 'Description du bug'
          description: 'Décrivez clairement le problème rencontré.'
      validations:
          required: true

    - type: textarea
      id: steps
      attributes:
          label: 'Étapes de reproduction'
          description: 'Listez les étapes pour reproduire le bug.'
          placeholder: |
              1. Aller sur '...'
              2. Cliquer sur '...'
              3. Observer l'erreur
      validations:
          required: true

    - type: textarea
      id: expected
      attributes:
          label: 'Comportement attendu'
          description: 'Que devrait-il se passer normalement ?'
      validations:
          required: true

    - type: textarea
      id: actual
      attributes:
          label: 'Comportement observé'
          description: 'Que se passe-t-il en réalité ?'
      validations:
          required: true

    - type: dropdown
      id: installation
      attributes:
          label: "Mode d'installation"
          options:
              - Docker (docker compose)
              - Natif (Node.js)
      validations:
          required: true

    - type: input
      id: node-version
      attributes:
          label: 'Version de Node.js'
          placeholder: 'ex: 22.12.0'

    - type: input
      id: os
      attributes:
          label: "Système d'exploitation"
          placeholder: 'ex: Ubuntu 24.04, macOS 15, Windows 11'

    - type: textarea
      id: logs
      attributes:
          label: "Logs / Messages d'erreur"
          description: 'Collez ici les logs pertinents (console, navigateur, etc.).'
          render: shell

    - type: textarea
      id: screenshots
      attributes:
          label: "Captures d'écran"
          description: "Si applicable, ajoutez des captures d'écran."

    - type: checkboxes
      id: checklist
      attributes:
          label: 'Vérifications'
          options:
              - label: "J'ai vérifié qu'aucune issue similaire n'existe déjà."
                required: true
```

---

### 2d. Template — Feature request (`.github/ISSUE_TEMPLATE/feature_request.yml`)

```yaml
name: '✨ Demande de fonctionnalité'
description: 'Proposer une nouvelle fonctionnalité ou une amélioration'
labels: ['feature']
body:
    - type: markdown
      attributes:
          value: |
              Merci de proposer une amélioration pour Puna !

    - type: textarea
      id: problem
      attributes:
          label: 'Problème ou besoin'
          description: 'Décrivez le problème ou le manque que cette fonctionnalité résoudrait.'
          placeholder: 'Je suis souvent frustré quand...'
      validations:
          required: true

    - type: textarea
      id: solution
      attributes:
          label: 'Solution proposée'
          description: 'Décrivez la solution que vous aimeriez voir.'
      validations:
          required: true

    - type: textarea
      id: alternatives
      attributes:
          label: 'Alternatives envisagées'
          description: "Avez-vous envisagé d'autres solutions ? Lesquelles et pourquoi les écarter ?"

    - type: textarea
      id: context
      attributes:
          label: 'Contexte supplémentaire'
          description: "Informations complémentaires, captures d'écran, liens, etc."

    - type: checkboxes
      id: checklist
      attributes:
          label: 'Vérifications'
          options:
              - label: "J'ai vérifié qu'aucune issue similaire n'existe déjà."
                required: true
```

---

### 2e. Config issues (`.github/ISSUE_TEMPLATE/config.yml`)

```yaml
blank_issues_enabled: false
contact_links:
    - name: '📖 Documentation'
      url: https://github.com/FabioDevCode/Puna#readme
      about: "Consultez la documentation avant d'ouvrir une issue."
    - name: '🔒 Signaler une faille de sécurité'
      url: https://github.com/FabioDevCode/Puna/blob/main/SECURITY.md
      about: 'Les failles de sécurité ne doivent PAS être signalées via une issue publique.'
```

---

### 2f. Template — Pull Request (`.github/PULL_REQUEST_TEMPLATE.md`)

```markdown
## Description

<!-- Décrivez les changements apportés par cette PR. -->

## Issue liée

<!-- Lien vers l'issue : Closes #123 -->

## Type de changement

- [ ] 🐛 Correction de bug (`fix`)
- [ ] ✨ Nouvelle fonctionnalité (`feat`)
- [ ] 📖 Documentation (`docs`)
- [ ] ♻️ Refactoring (`refactor`)
- [ ] 🧪 Tests (`test`)
- [ ] 🔧 Maintenance (`chore`)

## Checklist

- [ ] Ma PR pointe vers `develop` (pas `main`)
- [ ] J'ai testé mes changements localement
- [ ] Les tests passent (`npm test`)
- [ ] Le linter est satisfait (`npm run lint`)
- [ ] J'ai ajouté des tests pour les nouvelles fonctionnalités (si applicable)
- [ ] Les nouveaux messages utilisent i18n (si applicable)

## Captures d'écran (si applicable)

<!-- Ajoutez des captures si le changement est visuel -->
```

---

### 2g. CHANGELOG.md

Format **Keep a Changelog** (https://keepachangelog.com/fr/1.1.0/) :

```markdown
# Changelog

Tous les changements notables de ce projet sont documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Versionnage Sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

- Script d'installation interactif (`npm run setup`)
- Guide de contribution (CONTRIBUTING.md)
- Code de conduite (CODE_OF_CONDUCT.md)
- Templates d'issues et de PR GitHub

## [1.0.0] — YYYY-MM-DD

### Ajouté

- Gestion de sites et formulaires de feedback
- Collecte de soumissions (inbox) via API REST publique
- Export des données (JSON, CSV)
- Authentification par session (Passport.js)
- Authentification API (X-KEY-PUNA + JWT)
- RBAC (super_admin, owner, beta, editor, viewer)
- Authentification à deux facteurs (TOTP)
- Réinitialisation de mot de passe par email
- Validation de mot de passe fort (16 car. min)
- Scan antivirus des uploads (ClamAV, optionnel)
- Protection CSRF, Helmet, rate limiting
- Logs structurés (Pino) avec rotation automatique
- Panneau d'administration
- Support Docker (Compose avec MariaDB + ClamAV)
```

---

## 3. CI GitHub Actions

### Workflow `.github/workflows/ci.yml`

Déclenché sur push/PR vers `main` et `develop`. Deux jobs :

1. **lint** — `npm ci` + `npm run lint`
2. **test** — Service MariaDB, `npm ci` + `npm run test:coverage` + badge de couverture

> Le détail complet du workflow est déjà documenté dans `TODO.md` (tâche #6). L'implémenter tel quel.

### Protection de branches (à configurer sur GitHub)

| Branche   | Règle                                                       |
| --------- | ----------------------------------------------------------- |
| `main`    | PR obligatoire, CI verte requise, aucun push direct         |
| `develop` | PR obligatoire depuis `feature/*`/`fix/*`, CI verte requise |

---

## 4. Enrichir le README.md

Le README actuel est minimal (~15 lignes). Pour la mise en public, il doit inclure :

1. **En-tête** — logo/nom, description courte, badges (licence, CI, couverture)
2. **Fonctionnalités** — liste des features clés
3. **Prérequis** — Node 22+, MariaDB 11+ (ou Docker)
4. **Installation rapide** (Docker) — 3 commandes : clone, `npm run setup`, `docker compose up -d`
5. **Installation native** — clone, `npm run setup`, `npm install`, configurer MariaDB, `npm run dev`
6. **Configuration** — renvoi vers `.env.example`, explication des sections optionnelles (ClamAV, SMTP, TOTP)
7. **Utilisation** — premier login, créer un site, générer un token API, envoyer un formulaire
8. **API publique** — résumé de `POST /api/v1/send/:code` + authentification
9. **Développement** — commandes (`dev`, `test`, `lint`, `format`), structure du projet
10. **Contribuer** — renvoi vers `CONTRIBUTING.md`
11. **Sécurité** — renvoi vers `SECURITY.md`
12. **Licence** — AGPLv3

---

## Labels GitHub recommandés

À créer manuellement sur le dépôt (Settings → Labels) :

| Label              | Couleur   | Usage                                 |
| ------------------ | --------- | ------------------------------------- |
| `bug`              | `#d73a4a` | Signalement de bug                    |
| `feature`          | `#a2eeef` | Demande de fonctionnalité             |
| `documentation`    | `#0075ca` | Amélioration de la documentation      |
| `good first issue` | `#7057ff` | Accessible aux nouveaux contributeurs |
| `help wanted`      | `#008672` | Contribution bienvenue                |
| `duplicate`        | `#cfd3d7` | Issue doublon                         |
| `wontfix`          | `#ffffff` | Ne sera pas traité                    |
| `question`         | `#d876e3` | Question / discussion                 |
| `security`         | `#e11d48` | Lié à la sécurité                     |
| `performance`      | `#f59e0b` | Lié aux performances                  |

---

## Stratégie de branches

```
main (protégée — merge via PR uniquement, CI obligatoire)
  │
  ├── develop (travail quotidien, base de toutes les features)
  │     ├── feature/setup-script
  │     ├── feature/contributing-docs
  │     ├── fix/domain-validation
  │     ├── docs/readme
  │     └── ...
  │
  └── release/v1.0.0 (préparation release → merge dans main + tag)
```

### Conventions

- `main` : **jamais** de push direct. Merge depuis `develop` ou `release/*` via PR.
- `develop` : branche de travail. Les features et fixes sont mergées ici.
- `feature/*`, `fix/*`, `docs/*` : branches éphémères, supprimées après merge.
- `release/*` : créée depuis `develop` quand prêt. Merge dans `main` + tag semver.
- Les commits suivent **Conventional Commits** : `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`, `style:`

---

## Ordre d'exécution recommandé

```
1. scripts/setup.js ──────────────────────┐
                                           ├──→ 4. README.md (documente le setup + contribution)
2. Documents de contribution ─────────────┤
   ├── CONTRIBUTING.md                     │
   ├── CODE_OF_CONDUCT.md                 │
   ├── .github/ISSUE_TEMPLATE/*.yml       │
   ├── .github/PULL_REQUEST_TEMPLATE.md   │
   └── CHANGELOG.md                       │
                                           │
3. CI GitHub Actions ─────────────────────┘
```

Les tâches 1 et 2 sont **indépendantes** et peuvent être faites en parallèle. La tâche 3 (CI) peut être faite à tout moment mais doit être en place avant d'accepter des PRs externes. La tâche 4 (README) arrive en dernier car elle référence tout le reste.

---

## Fichiers à supprimer après implémentation

| Fichier                  | Raison                                      |
| ------------------------ | ------------------------------------------- |
| `SETUP_SCRIPT.md`        | Remplacé par ce plan + le script lui-même   |
| `IMPLEMENTATION_PLAN.md` | Ce fichier — à supprimer une fois tout fait |
