<p align="center">
  <img src="src/public/img/puna.svg" alt="Puna Logo" width="200" />
</p>

<h1 align="center">Puna</h1>

<p align="center">
  Panel d'administration auto-hébergé pour centraliser tous vos formulaires et gérer leurs soumissions.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/licence-AGPLv3-blue.svg" alt="Licence AGPLv3" />
  <img src="https://img.shields.io/badge/node-%3E%3D24-brightgreen.svg" alt="Node >= 24" />
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
- [Sécurité](#sécurité)
- [Tests](#tests)
- [Contribution](#contribution)
- [Licence](#licence)
- [Auteur](#auteur)

---

## Présentation

**Puna** est un panel d'administration auto-hébergé pour centraliser tous vos formulaires au même endroit. Branchez vos formulaires HTML existants sur Puna via une API REST - les soumissions arrivent directement dans la boîte de réception, sans avoir à définir de nouvelle base de données, gérer les champs ou maintenir les types de données vous-même.

**Stack technique** : Node.js (ESM), Express 5, Sequelize (MariaDB/MySQL), Handlebars, TailwindCSS + daisyUI.

---

## Fonctionnalités

- **Sites & Formulaires** - Créez des sites, attachez-y des formulaires HTML personnalisés avec champs libres, upload de fichiers et code unique de soumission.
- **Boîte de réception** - Les soumissions arrivent automatiquement, consultables, filtrables et exportables en Excel/CSV.
- **API publique** - Un seul endpoint `POST /api/v1/send/:code` avec authentification 3 couches (clé API, JWT, code formulaire).
- **Authentification** - Login local, sessions persistantes, 2FA TOTP optionnel et réinitialisation par email.
- **RBAC** - 5 rôles (`super_admin`, `owner`, `beta`, `editor`, `viewer`) avec une matrice de permissions granulaire.
- **Admin & monitoring** - Gestion des utilisateurs, visualiseur de logs, tableau de bord avec graphiques (ApexCharts) et antivirus ClamAV optionnel sur chaque upload.

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
| `DB_DIALECT`     | Dialecte : `mariadb`                                        |
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

<p>
  <img src="https://img.shields.io/badge/statements-84.68%25-yellow.svg?style=flat" alt="Statements" />
  <img src="https://img.shields.io/badge/branches-76.79%25-red.svg?style=flat" alt="Branches" />
  <img src="https://img.shields.io/badge/functions-87.63%25-yellow.svg?style=flat" alt="Functions" />
  <img src="https://img.shields.io/badge/lines-84.55%25-yellow.svg?style=flat" alt="Lines" />
</p>

### Stack de tests

| Outil      | Type               | Configuration          |
| ---------- | ------------------ | ---------------------- |
| Vitest     | Unit / Integration | `vitest.config.js`     |
| Playwright | End-to-end         | `playwright.config.js` |

### Couverture actuelle

| Statements | Branches | Functions | Lines   |
| ---------- | -------- | --------- | ------- |
| 84.68 %    | 76.79 %  | 87.63 %   | 84.55 % |

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
