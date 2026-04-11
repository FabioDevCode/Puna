<p align="center">
  <img src="src/public/img/puna.svg" alt="Puna Logo" width="200" />
</p>

<h1 align="center">Puna</h1>

<p align="center">
  Application de gestion de formulaires de feedback - auto-hébergée, sécurisée, open source.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/licence-AGPLv3-blue.svg" alt="Licence AGPLv3" />
  <img src="https://img.shields.io/badge/node-%3E%3D24-brightgreen.svg" alt="Node >= 24" />
  <img src="https://img.shields.io/badge/statements-84.68%25-yellow.svg?style=flat" alt="Statements" />
  <img src="https://img.shields.io/badge/branches-76.79%25-red.svg?style=flat" alt="Branches" />
  <img src="https://img.shields.io/badge/functions-87.63%25-yellow.svg?style=flat" alt="Functions" />
  <img src="https://img.shields.io/badge/lines-84.55%25-yellow.svg?style=flat" alt="Lines" />
</p>

---

## Table des matières

- [Présentation](#présentation)
- [Fonctionnalités](#fonctionnalités)
- [Captures d'écran](#captures-décran)
- [Prérequis](#prérequis)
- [Installation rapide (sans Docker)](#installation-rapide-sans-docker)
- [Installation avec Docker](#installation-avec-docker)
- [Configuration](#configuration)
- [API publique](#api-publique)
- [Architecture](#architecture)
- [Sécurité](#sécurité)
- [Tests](#tests)
- [Scripts utilitaires](#scripts-utilitaires)
- [Contribution](#contribution)
- [Licence](#licence)
- [Auteur](#auteur)

---

## Présentation

**Puna** est une application web auto-hébergée permettant de :

1. **Créer des sites** et y associer des formulaires HTML personnalisés.
2. **Collecter les soumissions** (boîte de réception) via une API REST publique sécurisée.
3. **Exporter les données** au format Excel (.xlsx) ou CSV.

Elle expose deux surfaces distinctes partageant le même serveur Express :

| Surface      | Préfixe     | Authentification          | CSRF |
| ------------ | ----------- | ------------------------- | ---- |
| Web (SSR)    | `/`         | Session + Passport        | Oui  |
| API publique | `/api/v1/…` | `X-KEY-PUNA` + Bearer JWT | Non  |

**Stack technique** : Node.js (ESM), Express 5, Sequelize (MariaDB/MySQL), Handlebars, TailwindCSS + daisyUI.

---

## Fonctionnalités

### Gestion des sites

- CRUD complet (création, modification, suppression)
- Génération de tokens API par site
- Régénération / révocation des codes de contrôle
- Assignation d'utilisateurs à un site (multi-rôles)

### Formulaires

- CRUD complet avec templates HTML (Handlebars)
- Définition de champs personnalisés
- Support de l'upload de fichiers (images, archives)
- Code unique par formulaire pour la soumission API

### Boîte de réception (Inbox)

- Collecte automatique des soumissions
- Filtrage et pagination
- Consultation détaillée du contenu (JSON)
- Suppression en masse

### Export de données

- Export Excel (.xlsx) et CSV
- Export par formulaire ou global (toutes les soumissions)

### Authentification & Sécurité

- Login local avec rate limiting (10 tentatives / 15 min)
- Sessions persistantes (MySQL store, 12 h par défaut)
- 2FA TOTP optionnel (avec codes de secours)
- Réinitialisation de mot de passe par email (SMTP)

### RBAC (Contrôle d'accès par rôles)

5 rôles avec une matrice de permissions granulaire :

| Rôle          | Portée                                        |
| ------------- | --------------------------------------------- |
| `super_admin` | Accès total, suppression utilisateurs, logs   |
| `owner`       | Administration, gestion de tous les sites     |
| `beta`        | Accès étendu (fonctionnalités en test)        |
| `editor`      | Création et modification de sites/formulaires |
| `viewer`      | Consultation seule                            |

### Panneau d'administration

- Gestion des utilisateurs (création, ban, désactivation, export)
- Visualiseur de logs (filtrage par niveau, mot-clé, période)
- Audit trail complet

### API publique

- Endpoint unique : `POST /api/v1/send/:code`
- Authentification 3 couches (clé API, JWT, code formulaire)
- Pipeline d'upload sécurisé (9 étapes)
- Rate limiting : 10 requêtes / minute par formulaire

### Antivirus ClamAV (optionnel)

- Scan automatique des fichiers uploadés
- Connexion Unix socket ou TCP
- Vérification de connectivité au démarrage

### Dashboard & Statistiques

- Tableau de bord avec graphiques interactifs (ApexCharts)
- Heatmap des soumissions
- Compteurs par site et par formulaire

### Logs & Monitoring

- Logs structurés JSON (Pino)
- Loggers séparés (app, API, erreurs)
- Rotation automatique (cron) et manuelle
- Interface d'exploration dans le panneau admin

---

## Captures d'écran

### Application

<table>
  <tr>
    <td width="33%" valign="top">
      <strong>Dashboard</strong><br/>
      Vue d'ensemble avec graphiques interactifs, heatmap des soumissions et compteurs par site.
    </td>
    <td width="67%">
      <img src="docs/screenshots/screenshot-dashboard.png" alt="Dashboard" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <strong>Liste des sites</strong><br/>
      Gestion des sites avec accès rapide aux formulaires, tokens API et assignations utilisateurs.
    </td>
    <td width="67%">
      <img src="docs/screenshots/screenshot-site.png" alt="Liste des sites" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <strong>Détail d'un site</strong><br/>
      Fiche complète du site : formulaires rattachés, token API, code de contrôle et paramètres.
    </td>
    <td width="67%">
      <img src="docs/screenshots/screenshot-site-view.png" alt="Détail d'un site" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <strong>Boîte de réception</strong><br/>
      Consultation des soumissions collectées avec filtrage, pagination et suppression en masse.
    </td>
    <td width="67%">
      <img src="docs/screenshots/screenshot-inbox.png" alt="Boîte de réception" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <strong>Compte utilisateur</strong><br/>
      Profil, préférences, configuration 2FA TOTP et gestion des codes de secours.
    </td>
    <td width="67%">
      <img src="docs/screenshots/screenshot-account.png" alt="Compte utilisateur" width="100%" />
    </td>
  </tr>
</table>

### Administration

<table>
  <tr>
    <td width="33%" valign="top">
      <strong>Panneau d'administration</strong><br/>
      Vue d'ensemble de l'administration : statistiques globales et accès rapide aux fonctionnalités.
    </td>
    <td width="67%">
      <img src="docs/screenshots/screenshot-admin.png" alt="Panneau d'administration" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <strong>Gestion des utilisateurs</strong><br/>
      Création, modification, ban, désactivation et export des comptes utilisateurs.
    </td>
    <td width="67%">
      <img src="docs/screenshots/screenshot-admin-users.png" alt="Gestion des utilisateurs" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <strong>Visualiseur de logs</strong><br/>
      Exploration des logs applicatifs avec filtrage par niveau, mot-clé et période.
    </td>
    <td width="67%">
      <img src="docs/screenshots/screenshot-admin-logs.png" alt="Visualiseur de logs" width="100%" />
    </td>
  </tr>
</table>

---

## Prérequis

| Outil            | Version | Obligatoire |
| ---------------- | ------- | ----------- |
| Node.js          | ≥ 24    | Oui         |
| npm              | ≥ 10    | Oui         |
| MariaDB          | 11+.    | Oui         |
| Git              | -       | Oui         |
| Docker & Compose | -       | Non         |
| ClamAV           | -       | Non         |
| Serveur SMTP     | -       | Non         |

---

## Installation rapide (sans Docker)

```bash
# 1. Cloner le dépôt
git clone https://github.com/FabioDevCode/Puna.git
cd Puna

# 2. Générer le fichier .env (assistant interactif)
node scripts/setup.js

# 3. Installer les dépendances
npm install

# 4. Lancer en développement (rechargement automatique)
npm run dev
```

Au premier démarrage, si `ADMIN_LOGIN` est défini dans le `.env`, un compte administrateur est créé automatiquement avec le rôle `super_admin`.

---

## Installation avec Docker

```bash
# 1. Cloner le dépôt
git clone https://github.com/FabioDevCode/Puna.git
cd Puna

# 2. Générer le fichier .env
node scripts/setup.js

# 3. Adapter le .env pour Docker :
#    - DB_IP=db  (nom du service Docker, pas localhost)
#    - CLAMAV_HOST=clamav / CLAMAV_PORT=3310  (si ClamAV activé)

# 4. Lancer les conteneurs
docker compose up -d
```

### Services Docker

| Service  | Image               | Conteneur     | Description                          |
| -------- | ------------------- | ------------- | ------------------------------------ |
| `app`    | Dockerfile local    | `puna_app`    | Application Node.js (port 3022)      |
| `db`     | `mariadb:11`        | `puna_db`     | Base de données (réseau interne)     |
| `clamav` | `clamav/clamav:1.4` | `puna_clamav` | Antivirus optionnel (réseau interne) |

**Volumes persistants** : `./storage` (fichiers uploadés), `./logs` (logs applicatifs), `puna_db_data` (données MariaDB), `puna_clamav_data` (signatures ClamAV).

**Commandes utiles** :

```bash
docker compose logs -f app      # Suivre les logs de l'application
docker compose down              # Arrêter les conteneurs
docker compose up -d --build     # Reconstruire et relancer
```

---

## Configuration

Le fichier `.env` est généré interactivement via `node scripts/setup.js`. Voici la référence complète des variables.

### Variables obligatoires

| Variable         | Description                                                 |
| ---------------- | ----------------------------------------------------------- |
| `DB_IP`          | Hôte de la base de données                                  |
| `DB_PORT`        | Port de la base de données                                  |
| `DB_USER`        | Nom d'utilisateur BDD                                       |
| `DB_PWD`         | Mot de passe BDD                                            |
| `DB_NAME`        | Nom de la base de données                                   |
| `DB_DIALECT`     | Dialecte : `mariadb`, `mysql`, `postgres` ou `sqlite`       |
| `KEY_TK`         | Clé de signature JWT (tokens API)                           |
| `KEV`            | Clé de chiffrement AES (64 caractères hex, 32 octets)       |
| `KIV`            | Vecteur d'initialisation AES (32 caractères hex, 16 octets) |
| `SESSION_SECRET` | Secret des sessions Express (min. 32 caractères)            |
| `CSRF_SECRET`    | Secret de protection CSRF (min. 32 caractères)              |
| `API_KEY`        | Clé API globale pour l'en-tête `X-KEY-PUNA` (min. 32 car.)  |
| `PORT`           | Port du serveur (1-65535)                                   |
| `NODE_ENV`       | Environnement : `development`, `production` ou `test`       |

### Variables optionnelles

| Variable                  | Défaut                  | Description                                         |
| ------------------------- | ----------------------- | --------------------------------------------------- |
| `SESSION_MAX_AGE`         | `43200000`              | Durée de session en ms (12 h par défaut)            |
| `HELMET_STRICT_TRANSPORT` | `false`                 | Activer HSTS (requiert HTTPS)                       |
| `APP_URL`                 | `http://localhost:3000` | URL de l'application (liens dans les mails)         |
| `TOTP_ENABLED`            | `false`                 | Activer la 2FA TOTP globalement                     |
| `TOTP_ISSUER`             | `Puna`                  | Nom affiché dans l'app d'authentification           |
| `ADMIN_LOGIN`             | -                       | Login du premier administrateur (premier démarrage) |
| `ADMIN_EMAIL`             | -                       | Email du premier administrateur (optionnel)         |

### Configuration SMTP (optionnelle)

Toutes les variables doivent être présentes pour activer la fonctionnalité mail (réinitialisation de mot de passe). Si une seule manque, la fonctionnalité est désactivée silencieusement.

| Variable    | Description          |
| ----------- | -------------------- |
| `SMTP_HOST` | Hôte du serveur SMTP |
| `SMTP_PORT` | Port SMTP            |
| `SMTP_USER` | Identifiant SMTP     |
| `SMTP_PASS` | Mot de passe SMTP    |
| `SMTP_FROM` | Adresse d'expéditeur |

### Configuration ClamAV (optionnelle)

Activer avec `CLAMAV_ENABLED=true`. Deux modes de connexion (mutuellement exclusifs) :

| Mode        | Variables                                 | Usage typique               |
| ----------- | ----------------------------------------- | --------------------------- |
| Socket Unix | `CLAMAV_SOCKET=/tmp/clamd.socket`         | macOS Homebrew, Linux natif |
| TCP         | `CLAMAV_HOST=clamav` + `CLAMAV_PORT=3310` | Docker                      |

Au démarrage, un test `PING → PONG` vérifie la connectivité. Le serveur ne démarre pas si ClamAV est activé mais injoignable.

### Exemple de fichier `.env`

```env
# Base de données
DB_IP=localhost
DB_PORT=3306
DB_USER=puna_user
DB_PWD=mon_mot_de_passe_securise
DB_NAME=puna
DB_DIALECT=mariadb

# Sécurité
KEY_TK=une_cle_jwt_longue_et_aleatoire_32_chars_min
KEV=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
KIV=0123456789abcdef0123456789abcdef
SESSION_SECRET=un_secret_de_session_aleatoire_32_chars_min
CSRF_SECRET=un_secret_csrf_aleatoire_32_chars_min
API_KEY=une_cle_api_aleatoire_32_chars_min

# Application
PORT=3022
NODE_ENV=production
APP_URL=https://mon-domaine.fr

# Premier administrateur
ADMIN_LOGIN=admin
ADMIN_EMAIL=admin@mon-domaine.fr

# 2FA (optionnel)
TOTP_ENABLED=false

# SMTP (optionnel - toutes les variables ou aucune)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=user@example.com
# SMTP_PASS=smtp_password
# SMTP_FROM=noreply@example.com

# ClamAV (optionnel)
# CLAMAV_ENABLED=true
# CLAMAV_HOST=clamav
# CLAMAV_PORT=3310
```

> La validation complète est effectuée au démarrage par [`src/config/env.validator.js`](src/config/env.validator.js). Le processus est bloqué si la configuration est invalide.

---

## API publique

### Endpoint

```
POST /api/v1/send/:code
```

### Authentification (3 couches)

Chaque requête doit passer les 3 vérifications dans l'ordre :

1. **`X-KEY-PUNA`** - En-tête contenant la clé API globale (variable `API_KEY`). Comparaison à temps constant pour prévenir les attaques par timing.
2. **`Authorization: Bearer <token>`** - Token JWT signé avec `KEY_TK`, dont le payload contient l'identifiant du site et son `control_code` chiffré. Le token est généré depuis l'interface web (page du site).
3. **`:code`** - Paramètre d'URL correspondant au code unique d'un formulaire rattaché au site authentifié.

### Pipeline d'upload

Après authentification, les requêtes multipart traversent ce pipeline :

```
multipartUpload → validateUpload → inspectArchive → scanUpload → moveFilesToUploads
→ updateFormFileKeys → sanitizeRequestBody → updateFormTemplate → sendHandler
```

Le contenu sanitisé est stocké en JSON dans la table `Inbox`.

### Rate limiting

10 requêtes par minute par formulaire.

### Exemple d'appel

```bash
curl -X POST https://mon-domaine.fr/api/v1/send/MON_CODE_FORM \
  -H "X-KEY-PUNA: ma_cle_api" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{"nom": "Jean Dupont", "message": "Mon feedback"}'
```

Avec upload de fichier :

```bash
curl -X POST https://mon-domaine.fr/api/v1/send/MON_CODE_FORM \
  -H "X-KEY-PUNA: ma_cle_api" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -F "nom=Jean Dupont" \
  -F "message=Mon feedback" \
  -F "fichier=@photo.jpg"
```

### Réponses

| Code | Description                       |
| ---- | --------------------------------- |
| 200  | Soumission enregistrée            |
| 400  | Données invalides / code manquant |
| 401  | Clé API ou token invalide         |
| 403  | Site non trouvé / accès refusé    |
| 404  | Formulaire non trouvé             |
| 429  | Rate limit dépassé                |
| 500  | Erreur interne                    |

---

## Architecture

### Vue d'ensemble

```mermaid
graph TB
    subgraph Client
        Browser[Navigateur Web]
        ExtApp[Application Externe]
    end

    subgraph Puna
        direction TB
        subgraph Web["Surface Web - SSR"]
            Routes["Routes auto-chargées<br/>src/routes/*.routes.js"]
            Controllers[Controllers]
            Views[Vues Handlebars]
        end

        subgraph API["Surface API REST"]
            ApiRoutes["Routes API auto-chargées<br/>src/api/v1/*.api.js"]
            ApiMiddlewares["Pipeline Upload<br/>+ Auth 3 couches"]
        end

        Services["Services<br/>Logique métier"]
        Models["Modèles Sequelize<br/>Déclaratifs JSON"]
    end

    subgraph Infra
        DB[(MariaDB / MySQL)]
        Storage["storage/uploads/"]
        ClamAV["ClamAV - Optionnel"]
        SMTP["Serveur SMTP - Optionnel"]
    end

    Browser -->|Session + CSRF| Web
    ExtApp -->|"X-KEY-PUNA + JWT"| API
    Web --> Services
    API --> Services
    Services --> Models
    Models --> DB
    Services --> Storage
    ApiMiddlewares --> ClamAV
    Services --> SMTP
```

### Middleware Stack (ordre strict)

```
helmet → cors(/api) → session → passport → flash → injectUserRole → csrfProtection → sanitize
```

### Conventions d'auto-chargement

| Fichier                  | Montage automatique                 |
| ------------------------ | ----------------------------------- |
| `src/routes/*.routes.js` | `/` (ex : `foo.routes.js` → `/foo`) |
| `src/api/v1/*.api.js`    | `/api/v1/<name>`                    |
| `src/models/*.models.js` | Chargé par `models/index.js`        |

### Pattern Controller → Service

- Les **controllers** gèrent le HTTP (`req`, `res`) : lecture des paramètres, appel aux services, flash messages, redirections ou rendu de vues.
- Les **services** contiennent toute la logique métier et les requêtes Sequelize. Ils retournent du JSON pur (`.toJSON()`), jamais d'instances Sequelize brutes.

### Modèles déclaratifs

Les modèles sont définis en JSON, pas en code Sequelize :

```
src/models/attributes/<model>.attributes.json   ← Définition des colonnes
src/models/relations/<model>.relations.json     ← Associations
src/models/<model>.models.js                    ← Appelle le builder
src/helpers/models_hlps.js                      ← Builder (JSON → DataTypes)
```

---

## Sécurité

Puna applique une approche **défense en profondeur** alignée sur l'OWASP Top 10 :

| Mesure                    | Implémentation                                 |
| ------------------------- | ---------------------------------------------- |
| En-têtes HTTP sécurisés   | Helmet (HSTS, X-Frame-Options, CSP…)           |
| Protection CSRF           | Double submit cookie (`csrf-csrf`)             |
| Hachage des mots de passe | bcrypt (10 rounds)                             |
| Tokens API                | JWT (HS256) + chiffrement AES-CBC du payload   |
| Protection XSS            | Sanitisation avec la librairie `xss`           |
| Prévention injection SQL  | ORM Sequelize + requêtes préparées             |
| Rate limiting             | Login (10/15 min), API (10/min par formulaire) |
| Scan antivirus            | ClamAV (optionnel) sur chaque upload           |
| Validation des uploads    | Type MIME, extension, taille, archives         |
| Chiffrement               | AES-CBC pour les codes de contrôle             |
| Arrêt gracieux            | Fermeture propre des connexions, timeout 5 s   |
| Validation des secrets    | Vérification longueur et force au démarrage    |

Pour le détail complet, voir [SECURITY.md](SECURITY.md).

---

## Tests

### Commandes

```bash
npm test              # Vitest - exécution unique (unit + integration)
npm run test:watch    # Vitest - mode interactif
npm run test:coverage # Vitest - avec rapport de couverture
npm run test:e2e      # Playwright - tests end-to-end
npm run test:e2e:ui   # Playwright - mode UI interactif
```

### Stack de tests

| Outil      | Type               | Configuration          |
| ---------- | ------------------ | ---------------------- |
| Vitest     | Unit / Integration | `vitest.config.js`     |
| Playwright | End-to-end         | `playwright.config.js` |

### Couverture actuelle

| Statements | Branches | Functions | Lines   |
| ---------- | -------- | --------- | ------- |
| 84.68 %    | 76.79 %  | 87.63 %   | 84.55 % |

### Conventions

Dans les tests unitaires, toujours mocker ces trois modules :

```js
vi.mock('../../../src/config/logger.js', () => ({ logger: { info: vi.fn(), … } }));
vi.mock('../../../src/models/index.js', () => ({ default: { ModelName: { findByPk: vi.fn() } } }));
vi.mock('../../../src/utils/crypto.js', () => ({ encryptString: vi.fn(s => `enc:${s}`) }));
```

Voir [`tests/unit/services/twoFactor.service.test.js`](tests/unit/services/twoFactor.service.test.js) comme référence.

---

## Scripts utilitaires

### Développement

| Commande          | Description                                         |
| ----------------- | --------------------------------------------------- |
| `npm run dev`     | Démarrage avec rechargement automatique (`--watch`) |
| `npm start`       | Démarrage en production                             |
| `npm run setup`   | Génération interactive du fichier `.env`            |
| `npm run prepare` | Installation des hooks Husky (git hooks)            |

### Qualité de code

| Commande               | Description                         |
| ---------------------- | ----------------------------------- |
| `npm run lint`         | Vérification ESLint                 |
| `npm run lint:fix`     | Correction automatique ESLint       |
| `npm run format`       | Formatage Prettier (JS, JSON) + HBS |
| `npm run format:check` | Vérification du formatage (CI)      |

### Logs

| Commande              | Description                      |
| --------------------- | -------------------------------- |
| `npm run logs:rotate` | Rotation manuelle des logs       |
| `npm run logs:clean`  | Nettoyage des archives de logs   |
| `npm run logs:stats`  | Statistiques et analyse des logs |

### Données

| Commande                | Description                          |
| ----------------------- | ------------------------------------ |
| `npm run test:e2e:seed` | Seed de la base de test (Playwright) |
| `npm run seed:demo`     | Seed de données de démonstration     |

---

## Contribution

Les contributions sont les bienvenues ! Consultez le guide complet dans [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Licence

Ce projet est distribué sous licence **GNU Affero General Public License v3 (AGPLv3)**.

Vous êtes libre de l'utiliser, le modifier et le redistribuer, à condition que tout code dérivé soit également publié sous la même licence. Si vous déployez une version modifiée sur un serveur accessible au public, vous devez en fournir le code source.

Voir le texte complet dans [License.md](License.md).

---

## Auteur

**Fabio RAMOS LOPES** - [GitHub](https://github.com/FabioDevCode)
