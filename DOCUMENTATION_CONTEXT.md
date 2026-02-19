# Puna — Contexte complet pour la documentation VuePress (Beta)

> **Ce fichier est destiné à être fourni comme contexte à une IA pour générer les pages de documentation VuePress 1.5.3 pour le lancement en Beta Test de Puna.**
> Les utilisateurs inscrits auront tous le rôle **"beta"**.

---

## 1. Présentation générale

### Qu'est-ce que Puna ?

**Puna** est une application web self-hosted de **collecte et gestion de feedbacks** (soumissions de formulaires). Elle permet aux utilisateurs de :

1. **Créer des sites** correspondant à leurs domaines web (ex: `monsite.fr`)
2. **Créer des formulaires** rattachés à chaque site
3. **Recevoir des soumissions** (inbox) via une API REST sécurisée
4. **Consulter, filtrer et exporter** les données collectées (Excel, CSV, ZIP)
5. **Gérer les fichiers joints** uploadés avec les soumissions

### Cas d'usage typique

Un développeur ou une agence web intègre Puna sur ses sites clients pour centraliser la collecte de formulaires de contact, de demandes de devis, de candidatures, etc. — le tout dans un **dashboard unique et sécurisé**.

### Informations techniques

| Propriété          | Valeur                   |
| ------------------ | ------------------------ |
| **Version**        | 0.0.1 (Beta)             |
| **Auteur**         | Fabio RAMOS LOPES        |
| **Licence**        | GNU AGPLv3               |
| **Node.js**        | >= 20                    |
| **Type de module** | ESM (`"type": "module"`) |
| **Point d'entrée** | `server.js`              |

---

## 2. Stack technique

### Backend

| Technologie                                     | Usage                                                                 |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| **Express 5**                                   | Framework HTTP                                                        |
| **Sequelize 6**                                 | ORM pour la base de données                                           |
| **MariaDB** (via driver `mariadb`)              | Base de données par défaut (supporte aussi MySQL, PostgreSQL, SQLite) |
| **Passport.js** (stratégie `local`)             | Authentification par login/password                                   |
| **express-session** + **express-mysql-session** | Gestion des sessions (stockées en BDD)                                |
| **bcrypt**                                      | Hashage des mots de passe                                             |
| **jsonwebtoken (JWT)**                          | Tokens d'authentification API                                         |
| **crypto-js (AES)**                             | Chiffrement des payloads JWT                                          |
| **Handlebars (express-handlebars)**             | Moteur de templates côté serveur                                      |
| **Pino** + **pino-http**                        | Logging structuré (4 loggers spécialisés)                             |
| **Helmet.js**                                   | Headers de sécurité HTTP (CSP, HSTS, etc.)                            |
| **csrf-csrf**                                   | Protection CSRF (Double Submit Cookie)                                |
| **xss**                                         | Sanitization XSS                                                      |
| **multer**                                      | Upload de fichiers multipart                                          |
| **node-cron**                                   | Rotation quotidienne des logs                                         |
| **ExcelJS**                                     | Export Excel (.xlsx)                                                  |
| **fast-csv**                                    | Export CSV                                                            |
| **archiver**                                    | Export ZIP                                                            |
| **nodemailer**                                  | Envoi d'emails (prévu)                                                |
| **i18n**                                        | Internationalisation (français)                                       |
| **dayjs**                                       | Manipulation des dates                                                |

### Frontend

| Technologie              | Usage                                     |
| ------------------------ | ----------------------------------------- |
| **TailwindCSS**          | Framework CSS utilitaire                  |
| **DaisyUI v4**           | Composants UI pour Tailwind               |
| **Font Awesome v6 Free** | Icônes                                    |
| **ApexCharts**           | Graphiques et visualisations du dashboard |

### Outils de développement

| Outil                       | Usage                               |
| --------------------------- | ----------------------------------- |
| **ESLint** + **Prettier**   | Linting et formatage du code        |
| **Husky** + **lint-staged** | Hooks Git pre-commit                |
| **pino-pretty**             | Formatage des logs en développement |

---

## 3. Architecture du projet

```
server.js                    ← Point d'entrée HTTP + graceful shutdown
src/
├── app.js                   ← Configuration Express (middlewares, session, etc.)
├── api/                     ← API REST versionnée
│   ├── index.js             ← Chargement automatique des versions
│   └── v1/
│       ├── default.api.js   ← Route POST /api/v1/send/:code
│       ├── handlers/        ← Handler final (sendHandler)
│       ├── middlewares/      ← Pipeline de traitement API
│       └── validators/      ← Sanitization des requêtes
├── config/
│   ├── database.js          ← Configuration BDD (depuis .env)
│   ├── env.validator.js     ← Validation des variables d'environnement
│   ├── helmet.config.js     ← Configuration Helmet/CSP
│   ├── logger.js            ← 4 loggers Pino + rotation
│   └── permissions.js       ← Matrice RBAC complète
├── controllers/             ← Logique des routes web
│   ├── admin.controller.js
│   ├── auth.controller.js
│   ├── dashboard.controller.js
│   ├── export.controller.js
│   ├── form.controller.js
│   ├── inbox.controller.js
│   └── site.controller.js
├── helpers/
│   ├── authHelper.js        ← Passport config + guards (isConnected)
│   ├── file.helpers.js      ← Métadonnées d'affichage de fichiers
│   ├── hbs_fn.js            ← Helpers Handlebars (permissions, i18n, slots)
│   ├── init_admin_user.js   ← Création du premier admin
│   ├── logging.helpers.js   ← Fonctions de logging métier (audit, API, auth)
│   ├── models_hlps.js       ← Constructeur de modèles depuis JSON
│   ├── upload_utils.js      ← Utilitaires d'upload (move, sanitize, path)
│   └── site.helpers.js
├── locales/
│   └── fr.json              ← Traductions françaises
├── middlewares/
│   ├── checkAccess.js       ← Middlewares RBAC (actionAccess, roleAccess)
│   ├── csrf.js              ← Protection CSRF Double Submit Cookie
│   ├── flashMessages.js     ← Flash messages via session
│   ├── injectUserRole.js    ← Injection du rôle dans req/res.locals
│   ├── loginRateLimiter.js  ← Rate limiting login (5 essais/15min)
│   └── sanitize.js          ← Sanitization XSS globale
├── models/                  ← Modèles Sequelize (JSON-driven)
│   ├── index.js             ← Chargement auto + associations
│   ├── user.models.js
│   ├── site.models.js
│   ├── form.models.js
│   ├── inbox.models.js
│   ├── site_user.models.js
│   ├── attributes/          ← Définition des champs (JSON)
│   └── relations/           ← Définition des relations (JSON)
├── routes/
│   ├── index.js             ← Chargement auto des fichiers *.routes.js
│   └── default.routes.js    ← Toutes les routes web
├── services/                ← Logique métier
│   ├── access.service.js    ← Contrôle d'accès centralisé
│   ├── auth.service.js      ← Authentification (bcrypt, session)
│   ├── export.service.js    ← Génération Excel/CSV/ZIP
│   ├── form.service.js      ← CRUD formulaires
│   ├── inbox.service.js     ← CRUD soumissions + fichiers
│   ├── site.service.js      ← CRUD sites + tokens JWT
│   ├── siteUser.service.js  ← Assignations user↔site
│   ├── stats.service.js     ← Statistiques dashboard
│   └── user.service.js      ← CRUD utilisateurs
├── utils/
│   ├── crypto.js            ← Chiffrement/déchiffrement AES
│   └── string.js            ← Utilitaires de chaînes
├── public/                  ← Fichiers statiques
│   ├── css/puna.css
│   ├── img/
│   ├── js/                  ← Scripts frontend (charts, modals, etc.)
│   └── plugins/             ← Librairies tierces
└── views/                   ← Templates Handlebars
    ├── layouts/             ← main.hbs, admin.hbs, auth.hbs
    ├── pages/               ← Pages complètes
    └── partials/            ← Composants réutilisables
storage/
├── tmp/                     ← Fichiers temporaires d'upload
└── uploads/                 ← Fichiers définitifs (par domaine/form)
    ├── monsite.fr/
    └── autresite.com/
logs/
├── app.log                  ← Logs applicatifs
├── api.log                  ← Logs API
├── error.log                ← Erreurs
├── audit.log                ← Événements de sécurité
├── archives/                ← Archives quotidiennes (.tar.gz)
└── test/
```

---

## 4. Modèle de données

### Entités et attributs

#### User (utilisateur)

| Champ             | Type        | Contraintes                | Description                                                                |
| ----------------- | ----------- | -------------------------- | -------------------------------------------------------------------------- |
| `id`              | UUID        | PK, unique, NOT NULL       | Identifiant unique                                                         |
| `login`           | STRING(100) | unique, NOT NULL           | Identifiant de connexion                                                   |
| `email`           | STRING      | nullable                   | Adresse email                                                              |
| `password`        | STRING      | nullable                   | Mot de passe hashé (bcrypt)                                                |
| `role`            | ENUM        | NOT NULL, défaut `viewer`  | Rôle : `super_admin`, `owner`, `editor`, `viewer`, `beta`                  |
| `status`          | ENUM        | NOT NULL, défaut `pending` | Statut : `pending`, `active`, `inactive`, `suspended`, `banned`, `deleted` |
| `last_connection` | DATE        | nullable                   | Date de dernière connexion                                                 |
| `created_by`      | UUID        | nullable                   | ID de l'utilisateur créateur                                               |
| `createdAt`       | DATE        | auto                       | Date de création                                                           |
| `updatedAt`       | DATE        | auto                       | Date de mise à jour                                                        |

#### Site

| Champ          | Type        | Contraintes          | Description                                           |
| -------------- | ----------- | -------------------- | ----------------------------------------------------- |
| `id`           | UUID        | PK, unique, NOT NULL | Identifiant unique                                    |
| `domain`       | STRING      | NOT NULL             | Nom de domaine (ex: `monsite.fr`)                     |
| `control_code` | STRING(100) | NOT NULL             | Code secret pour les tokens JWT (16 chars aléatoires) |
| `fk_id_user`   | UUID        | FK → User            | Propriétaire du site                                  |
| `createdAt`    | DATE        | auto                 | Date de création                                      |
| `updatedAt`    | DATE        | auto                 | Date de mise à jour                                   |

#### Form (formulaire)

| Champ        | Type        | Contraintes          | Description                                                   |
| ------------ | ----------- | -------------------- | ------------------------------------------------------------- |
| `id`         | UUID        | PK, unique, NOT NULL | Identifiant unique                                            |
| `name`       | STRING(100) | NOT NULL             | Nom du formulaire                                             |
| `code`       | STRING(100) | NOT NULL             | Code unique (endpoint API)                                    |
| `columns`    | LONGTEXT    | nullable             | Configuration des colonnes visibles (JSON stringifié)         |
| `template`   | LONGTEXT    | nullable             | Mapping des champs avec labels (JSON stringifié, auto-appris) |
| `file_keys`  | LONGTEXT    | nullable             | Liste des champs fichiers détectés (JSON stringifié)          |
| `fk_id_site` | UUID        | FK → Site            | Site parent                                                   |
| `createdAt`  | DATE        | auto                 | Date de création                                              |
| `updatedAt`  | DATE        | auto                 | Date de mise à jour                                           |

#### Inbox (soumission)

| Champ        | Type     | Contraintes          | Description                                |
| ------------ | -------- | -------------------- | ------------------------------------------ |
| `id`         | UUID     | PK, unique, NOT NULL | Identifiant unique                         |
| `content`    | LONGTEXT | NOT NULL             | Données de la soumission (JSON stringifié) |
| `fk_id_form` | UUID     | FK → Form            | Formulaire parent                          |
| `createdAt`  | DATE     | auto                 | Date de réception                          |
| `updatedAt`  | DATE     | auto                 | Date de mise à jour                        |

#### SiteUser (table de liaison)

| Champ        | Type    | Contraintes         | Description         |
| ------------ | ------- | ------------------- | ------------------- |
| `id`         | INTEGER | PK, auto-increment  | Identifiant         |
| `fk_id_site` | UUID    | FK → Site, NOT NULL | Site assigné        |
| `fk_id_user` | UUID    | FK → User, NOT NULL | Utilisateur assigné |
| `createdAt`  | DATE    | auto                | Date d'assignation  |
| `updatedAt`  | DATE    | auto                | Date de mise à jour |

### Relations entre entités

```
User ─────┬──── 1:N ────→ Site           (propriétaire : fk_id_user)
          ├──── 1:N ────→ User           (créateur : created_by)
          └──── 1:N ────→ SiteUser       (assignations)

Site ─────┬──── N:1 ────→ User           (propriétaire)
          ├──── 1:N ────→ Form           (formulaires du site)
          └──── 1:N ────→ SiteUser       (utilisateurs assignés)

Form ─────┬──── N:1 ────→ Site           (site parent)
          └──── 1:N ────→ Inbox          (soumissions reçues)

Inbox ────┴──── N:1 ────→ Form           (formulaire parent)

SiteUser ──┬── N:1 ────→ Site
           └── N:1 ────→ User
```

### Diagramme du cycle de vie des données

```
[Utilisateur externe] ──→ POST /api/v1/send/:code ──→ [Pipeline de validation]
                                                           │
                                                           ▼
                                                    ┌─────────────┐
                                                    │  Inbox (BDD) │
                                                    │  + fichiers   │
                                                    │  (storage/)   │
                                                    └──────┬──────┘
                                                           │
                                        ┌──────────────────┼──────────────────┐
                                        ▼                  ▼                  ▼
                                  [Consultation]    [Export Excel/CSV]   [Téléchargement]
                                  via Dashboard      du formulaire       fichiers / ZIP
```

---

## 5. Système d'authentification

### Flux de connexion

Le système utilise **Passport.js** avec une stratégie **locale** (login + mot de passe).

#### Première connexion (activation du compte)

1. Un administrateur crée un compte utilisateur (statut `pending`, sans mot de passe)
2. L'utilisateur accède à `/dp-first-connexion`
3. Il saisit son **login** et définit son **mot de passe** (confirmation requise)
4. Le compte passe en statut `active`
5. Redirection vers la page de login

#### Connexion classique

1. L'utilisateur accède à `/dp-login`
2. Saisie du **login** et du **mot de passe**
3. Authentification via Passport (bcrypt compare)
4. Seuls les comptes `active` peuvent se connecter
5. Données stockées en session : `id`, `login`, `email`, `role`, `status`
6. `last_connection` mis à jour
7. Redirection vers `/dashboard`

#### Déconnexion

1. Destruction de la session
2. Suppression du cookie `puna`
3. Redirection vers `/dp-login`

### Protection des routes

- **`isConnected`** — Guard : redirige vers `/dp-login` si non authentifié
- **`isConnectDash`** — Guard inverse : redirige vers `/dashboard` si déjà connecté (pour les pages login/first-login)

### Rate limiting sur le login

| Endpoint                            | Tentatives max | Fenêtre    | Clé                        |
| ----------------------------------- | -------------- | ---------- | -------------------------- |
| `/dp-connect` (login)               | 5              | 15 minutes | `login:{ip}:{login}`       |
| `/dp-first-co` (première connexion) | 3              | 15 minutes | `first-login:{ip}:{login}` |

### Sessions

- Stockées en base de données (MariaDB via `express-mysql-session`)
- Cookie `puna`, `httpOnly`, `sameSite: lax`, `secure` en production
- Durée : 12 heures par défaut (configurable via `SESSION_MAX_AGE`)
- `rolling: false` (pas de renouvellement automatique)

---

## 6. Système de rôles et permissions (RBAC)

### Les 5 rôles

| Rôle          | Description                                               | Accès sites                           |
| ------------- | --------------------------------------------------------- | ------------------------------------- |
| `super_admin` | Administrateur système — accès total                      | Tous les sites                        |
| `owner`       | Propriétaire de sites — gestion complète de ses sites     | Ses propres sites (créés par lui)     |
| `editor`      | Éditeur — peut modifier formulaires et gérer inbox        | Sites assignés via SiteUser           |
| `viewer`      | Lecteur seul — consultation uniquement                    | Sites assignés via SiteUser           |
| **`beta`**    | **Testeur beta — droits complets avec limites de volume** | **Ses propres sites (créés par lui)** |

### Matrice des permissions

| Entité    | Action | super_admin | owner | editor | viewer | **beta** |
| --------- | ------ | ----------- | ----- | ------ | ------ | -------- |
| **User**  | read   | ✅          | ✅    | ❌     | ❌     | ❌       |
| **User**  | create | ✅          | ✅    | ❌     | ❌     | ❌       |
| **User**  | update | ✅          | ✅    | ❌     | ❌     | ❌       |
| **User**  | delete | ✅          | ✅    | ❌     | ❌     | ❌       |
| **Site**  | read   | ✅          | ✅    | ✅     | ✅     | ✅       |
| **Site**  | create | ✅          | ✅    | ❌     | ❌     | ✅       |
| **Site**  | update | ✅          | ✅    | ❌     | ❌     | ✅       |
| **Site**  | delete | ✅          | ✅    | ❌     | ❌     | ✅       |
| **Form**  | read   | ✅          | ✅    | ✅     | ✅     | ✅       |
| **Form**  | create | ✅          | ✅    | ✅     | ❌     | ✅       |
| **Form**  | update | ✅          | ✅    | ✅     | ❌     | ✅       |
| **Form**  | delete | ✅          | ✅    | ✅     | ❌     | ✅       |
| **Inbox** | read   | ✅          | ✅    | ✅     | ✅     | ✅       |
| **Inbox** | delete | ✅          | ✅    | ✅     | ❌     | ✅       |

### Limites du rôle Beta

Le rôle `beta` a les mêmes permissions que `owner` sur les opérations CRUD, mais est **limité en volume** :

| Entité          | Limite                     | Description                                       |
| --------------- | -------------------------- | ------------------------------------------------- |
| **Sites**       | 4 maximum                  | L'utilisateur beta peut créer jusqu'à 4 sites     |
| **Formulaires** | 2 par site maximum         | Chaque site peut contenir au plus 2 formulaires   |
| **Inbox**       | 200 par formulaire maximum | Chaque formulaire accepte au plus 200 soumissions |

> Ces limites sont évaluées via la fonction `isRateLimitReached(role, entity, currentCount)`.

### Contrôle d'accès dans les routes

Deux middlewares sont combinés dans les routes :

1. **`actionAccess(entity, action)`** — Vérifie la permission RBAC (matrice ci-dessus)
2. **`roleAccess([...roles])`** — Vérifie si le rôle est dans une liste autorisée

Exemple :

```
router.post('/create-site', isConnected, actionAccess('site', 'create'), siteCtl.createSite);
router.get('/admin', isConnected, roleAccess(['super_admin', 'owner']), adminCtl.admin);
```

### Contrôle d'accès dans les templates Handlebars

Les permissions sont disponibles directement dans les vues via des block helpers :

```handlebars
{{#actionCan entity='site' action='create'}}
    <button>Créer un site</button>
{{/actionCan}}

{{#roleIs roles='super_admin,owner'}}
    <a href='/admin'>Administration</a>
{{/roleIs}}

{{#isAdmin}}
    <span>Vous êtes super administrateur</span>
{{/isAdmin}}
```

---

## 7. API REST — Réception des soumissions

### Endpoint unique

```
POST /api/v1/send/:code
```

Où `:code` est le code unique du formulaire (ex: `ABC123DEF456`).

### Authentification API

L'API utilise un système d'authentification **triple couche** :

1. **Header `X-KEY-PUNA`** : clé API statique valant `"puna"` (vérification de base)
2. **Bearer Token (JWT)** :
    - Signé avec la clé `KEY_TK`
    - Le payload contient un objet **chiffré en AES** avec `{id, control_code}` du site
    - Le token est déchiffré puis vérifié en base de données
3. **Paramètre `:code`** : le code du formulaire est vérifié pour correspondre à un formulaire du site authentifié

### Obtenir le token API

Dans le dashboard Puna, l'utilisateur peut **générer un token JWT** pour chacun de ses sites via la page de détail du site. Ce token est utilisé dans l'en-tête `Authorization: Bearer <token>`.

Il est possible de **révoquer tous les tokens** d'un site en régénérant le `control_code` (tous les anciens tokens deviennent invalides).

### Pipeline de traitement d'une soumission

Chaque requête `POST /api/v1/send/:code` traverse un pipeline de **9 middlewares** dans l'ordre :

```
1. authApiKeyAccess        → Authentification triple (header + JWT + code)
2. formRateLimiter          → 30 requêtes/minute par formulaire
3. multipartUpload          → Parsing multipart (multer) + limites
4. validateUpload           → Validation des fichiers (extensions + magic bytes)
5. inspectArchive           → Analyse sécurisée des archives (ZIP bombs, macros, etc.)
6. moveFilesToUploads       → Déplacement tmp → storage/uploads/{domain}/{form}/
7. updateFormFileKeys       → Mémorisation des champs fichiers dans le formulaire
8. sanitizeRequestBody      → Nettoyage XSS du body
9. updateFormTemplate       → Auto-apprentissage du schéma du formulaire
→ sendHandler              → Sauvegarde en BDD (Inbox)
```

### Types de contenu supportés

L'API accepte deux types de contenu :

- **`application/json`** — Données JSON simples (sans fichiers)
- **`multipart/form-data`** — Données avec fichiers joints

### Limites d'upload

| Paramètre                  | Valeur par défaut | Variable d'environnement |
| -------------------------- | ----------------- | ------------------------ |
| Taille max par fichier     | 10 Mo             | `API_MAX_FILE_SIZE`      |
| Taille totale max          | 50 Mo             | `API_MAX_TOTAL_SIZE`     |
| Nombre max de fichiers     | 10                | `API_MAX_FILES`          |
| Nombre max de champs       | 40                | `API_MAX_FIELDS`         |
| Taille max par champ texte | 10 000 caractères | `API_MAX_FIELD_SIZE`     |

### Fichiers acceptés

Extensions autorisées par défaut :
`.png`, `.jpg`, `.jpeg`, `.webp`, `.pdf`, `.doc`, `.docx`, `.odt`, `.txt`, `.xls`, `.xlsx`, `.csv`

La validation vérifie les **magic bytes** (signatures binaires) pour détecter les fichiers déguisés.

### Protections sur les fichiers

- **Archives (ZIP, DOCX, XLSX, PPTX, ODT)** : inspectées contre les ZIP bombs (ratio max 100:1), macros VBA, exécutables cachés, path traversal
- **PDF** : rejetés s'ils contiennent `/JavaScript`
- **Limites archives** : 1000 entrées max, 250 Mo décompressés, noms ≤ 255 caractères

### Rate limiting API

- **30 requêtes par minute** par formulaire (configurable)
- Clé : `form:{siteId}:{formCode}`
- Headers de réponse : `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`
- HTTP 429 avec message en français si dépassé

### Auto-apprentissage du template

À chaque soumission, Puna met à jour automatiquement le **template** du formulaire :

- Les nouvelles clés sont ajoutées avec un label auto-capitalisé (ex: `"nom"` → `"Nom"`)
- Les colonnes visibles sont initialisées pour les nouvelles clés
- Ce comportement est non-bloquant (les erreurs sont logguées mais ne bloquent pas la soumission)

### Exemple d'intégration

```html
<form id="contact-form">
    <input type="text" name="nom" placeholder="Votre nom" required />
    <input type="email" name="email" placeholder="Votre email" required />
    <textarea name="message" placeholder="Votre message"></textarea>
    <input type="file" name="document" />
    <button type="submit">Envoyer</button>
</form>

<script>
    document.getElementById('contact-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const response = await fetch('https://votre-puna.com/api/v1/send/VOTRE_CODE', {
            method: 'POST',
            headers: {
                'X-KEY-PUNA': 'puna',
                Authorization: 'Bearer VOTRE_TOKEN_JWT',
            },
            body: formData,
        });

        const result = await response.json();
        console.log(result); // { success: true }
    });
</script>
```

---

## 8. Fonctionnalités du Dashboard

### Pages et navigation

Le dashboard utilise **3 layouts Handlebars** :

- `auth.hbs` — Pages de connexion (sans sidebar)
- `main.hbs` — Dashboard principal (avec sidebar et navbar)
- `admin.hbs` — Pages d'administration

### Dashboard principal (`/dashboard`)

Affiche les statistiques globales de l'utilisateur :

- Compteur de sites, formulaires et soumissions
- **Widgets graphiques** (ApexCharts) :
    - **Inbox Counts** : graphique ligne/barre des soumissions par jour (7j ou 30j)
    - **Inbox Percentages** : variations en % (aujourd'hui vs hier, 7j, 30j)
    - **Top Forms** : top 5 des formulaires par nombre de soumissions
    - **Top Site Radial** : site principal avec répartition par formulaire (donut)
    - **Site Distribution** : répartition des soumissions par site
    - **Inbox Heatmap** : heatmap jour × heure (7j, 30j, 90j, 180j)

### Gestion des sites (`/site/*`)

| Page             | Route                         | Description                                                |
| ---------------- | ----------------------------- | ---------------------------------------------------------- |
| Liste des sites  | `/site/all`                   | Tous les sites accessibles avec compteurs (forms, entries) |
| Détail d'un site | `/site/:id/view`              | Vue d'un site avec ses formulaires en onglets              |
| Création         | POST `/create-site`           | Formulaire de création (domaine requis)                    |
| Suppression      | POST `/delete-site/:id`       | Confirmation par saisie du domaine                         |
| Token API        | GET `/site/:id/token`         | Génération d'un JWT pour le site                           |
| Révocation       | PUT `/site/:id/revoke-tokens` | Révoque tous les tokens existants                          |

### Gestion des formulaires (`/form/*`)

| Action          | Route                        | Description                                |
| --------------- | ---------------------------- | ------------------------------------------ |
| Création        | POST `/create-form`          | Crée un formulaire rattaché à un site      |
| Suppression     | POST `/delete-form`          | Supprime un formulaire et ses soumissions  |
| Données (inbox) | GET `/form/:id/inbox`        | Liste paginée avec filtres JSON avancés    |
| Colonnes        | POST `/form/:id/columns`     | Configure les colonnes visibles du tableau |
| Template        | POST `/form/:id/template`    | Personnalise le mapping champs/labels      |
| Export Excel    | GET `/form/:id/export-excel` | Télécharge les soumissions en .xlsx        |
| Export CSV      | GET `/form/:id/export-csv`   | Télécharge les soumissions en .csv         |

### Consultation des soumissions (`/inbox/*`)

| Action                 | Route                                    | Description                                       |
| ---------------------- | ---------------------------------------- | ------------------------------------------------- |
| Détail                 | GET `/inbox/:id/view`                    | Données texte + fichiers joints (avec type/icône) |
| Suppression            | POST `/inbox/:id/delete`                 | Supprime l'entrée et ses fichiers physiques       |
| Téléchargement fichier | GET `/inbox/:inboxId/download/:filename` | Télécharge un fichier individuel                  |
| Téléchargement ZIP     | GET `/inbox/:inboxId/download-zip`       | Archive ZIP de tous les fichiers                  |

### Fonctionnalités du tableau de données (inbox d'un formulaire)

- **Pagination** : 10, 25, 50 ou 100 entrées par page
- **Filtrage avancé** : filtres JSON sur les champs du contenu (requêtes `JSON_EXTRACT`)
- **Colonnes configurables** : l'utilisateur peut choisir quelles colonnes afficher
- **Labels personnalisables** : le template permet de renommer les champs (ex: `"email_contact"` → `"Email du contact"`)
- **Export** : Excel et CSV disponibles à tout moment

---

## 9. Administration (super_admin et owner uniquement)

> **Note : les utilisateurs Beta n'ont PAS accès à l'administration.**

### Gestion des utilisateurs (`/admin/users/*`)

| Page         | Route                          | Description                                              |
| ------------ | ------------------------------ | -------------------------------------------------------- |
| Liste        | `/admin/users`                 | Liste paginée avec recherche (login, email, rôle)        |
| Données JSON | `/admin/users/list`            | API interne pour la liste avec filtres                   |
| Création     | POST `/admin/users/create`     | Crée un utilisateur (login, email, rôle, sites assignés) |
| Détail       | `/admin/users/:id/view`        | Vue en lecture seule (relations, sites, créateur)        |
| Édition      | `/admin/users/:id/edit`        | Modification des propriétés + assignation de sites       |
| Mise à jour  | POST `/admin/users/:id/update` | Sauvegarde des modifications                             |
| Suppression  | POST `/admin/users/delete`     | Supprime après vérification du mot de passe admin        |
| Export Excel | `/admin/users/export-excel`    | Télécharge liste des users en .xlsx                      |
| Export CSV   | `/admin/users/export-csv`      | Télécharge liste des users en .csv                       |

### Visualiseur de logs (`/admin/logs` — super_admin uniquement)

- Lecture des logs du jour ou des archives
- Filtrage par recherche textuelle, niveau de log, plage horaire
- Logs au format JSON (Pino) parsés pour affichage lisible
- Navigation dans les archives `.tar.gz` (rotation quotidienne)

### Paramètres (`/admin/settings` — super_admin uniquement)

Page de configuration de l'application.

---

## 10. Sécurité

### Couches de sécurité implémentées

| Couche                   | Technologie          | Description                                                                    |
| ------------------------ | -------------------- | ------------------------------------------------------------------------------ |
| **Headers HTTP**         | Helmet.js            | CSP stricte (séparée web/API), HSTS conditionnel, X-Content-Type-Options, etc. |
| **CSRF**                 | csrf-csrf            | Double Submit Cookie (exclu sur API car auth Bearer)                           |
| **XSS**                  | xss                  | Sanitization récursive de tous les inputs (body, query, params)                |
| **Authentification web** | Passport.js + bcrypt | Login/password avec hash bcrypt (10 salt rounds)                               |
| **Authentification API** | JWT + AES            | Triple vérification (header + token chiffré + code formulaire)                 |
| **Rate limiting login**  | express-rate-limit   | 5 tentatives/15min (login), 3 tentatives/15min (first-login)                   |
| **Rate limiting API**    | express-rate-limit   | 30 req/min par formulaire                                                      |
| **Upload**               | multer + validation  | Extensions + magic bytes + inspection archives                                 |
| **Archives**             | Analyse statique     | Anti ZIP bomb, anti macros VBA, anti exécutables, anti path traversal          |
| **PDF**                  | Inspection contenu   | Rejet si contient JavaScript embarqué                                          |
| **Sessions**             | MariaDB-backed       | Stockées en BDD, cookie httpOnly/secure/sameSite                               |
| **Chiffrement**          | AES (crypto-js)      | Payload JWT chiffré pour rotation de tokens                                    |
| **Logging**              | Pino (audit.log)     | Tous les événements de sécurité audités                                        |

### Validation de l'environnement

Au démarrage (`validateEnv()`), le serveur vérifie :

- Présence de toutes les variables obligatoires
- Format des ports (1-65535)
- Longueur minimale des clés de sécurité (32 caractères)
- Valeurs autorisées pour `NODE_ENV` et `DB_DIALECT`
- Détection des valeurs par défaut non sécurisées
- **Le serveur s'arrête (`process.exit(1)`) si une erreur critique est détectée**

---

## 11. Système de logging

### 4 loggers spécialisés

| Logger        | Fichier          | Niveau                    | Usage                          |
| ------------- | ---------------- | ------------------------- | ------------------------------ |
| `logger`      | `logs/app.log`   | debug (dev) / info (prod) | Actions applicatives générales |
| `apiLogger`   | `logs/api.log`   | info                      | Requêtes et réponses API       |
| `errorLogger` | `logs/error.log` | error                     | Erreurs uniquement             |
| `auditLogger` | `logs/audit.log` | info                      | Événements de sécurité         |

### Fonctions de logging métier

| Fonction               | Logger(s)   | Quand                          |
| ---------------------- | ----------- | ------------------------------ |
| `logAuthSuccess()`     | audit       | Connexion réussie              |
| `logAuthFailure()`     | audit       | Tentative de connexion échouée |
| `logPasswordChanged()` | audit       | Changement de mot de passe     |
| `logUserCreated()`     | app + audit | Création d'utilisateur         |
| `logRoleChanged()`     | app + audit | Modification de rôle           |
| `logAccessDenied()`    | app + audit | Accès refusé                   |
| `logDataDeletion()`    | app + audit | Suppression de données         |
| `logApiSuccess()`      | api         | Soumission API réussie         |
| `logApiError()`        | api + error | Erreur API                     |
| `logApiAuthFailure()`  | api + audit | Échec d'authentification API   |
| `logFileRejected()`    | api + error | Fichier uploadé rejeté         |

### Rotation des logs

- **Quotidienne** à minuit via `node-cron`
- Les 4 fichiers sont archivés dans un `.tar.gz` daté
- Fichiers source vidés après archivage
- **Rétention configurable** :
    - Développement : 7 jours (app), 14 jours (api), 30 jours (error), 90 jours (audit)
    - Production : configurable via `LOG_RETENTION_*`

---

## 12. Stockage des fichiers

### Structure

```
storage/
├── tmp/                              ← Fichiers temporaires (pendant le traitement)
└── uploads/
    └── {domain}/                     ← Par domaine de site
        └── {form_name}/
            └── {form_code}/
                └── {timestamp}_{filename}   ← Fichier final
```

### Nommage des fichiers

Les fichiers sont renommés lors de l'upload avec le format :

```
{timestamp}_{nom_sanitize}
```

Le nom original est restauré lors du téléchargement (le préfixe timestamp est retiré).

### Nettoyage

- La suppression d'un **site** supprime le dossier `uploads/{domain}/` entier
- La suppression d'un **formulaire** supprime le dossier du formulaire
- La suppression d'une **soumission** supprime ses fichiers individuels
- Protection contre le **path traversal** sur tous les chemins

---

## 13. Exports de données

### Formats disponibles

| Format            | Usage                                | Caractéristiques                                                      |
| ----------------- | ------------------------------------ | --------------------------------------------------------------------- |
| **Excel (.xlsx)** | Export de formulaire ou utilisateurs | ExcelJS, en-têtes stylisés, colonnes auto-détectées ou personnalisées |
| **CSV**           | Export de formulaire ou utilisateurs | BOM UTF-8 pour compatibilité Excel, séparateur `,`                    |
| **ZIP**           | Fichiers joints d'une soumission     | Compression niveau 9 via archiver                                     |

### Périmètres d'export

- **Par formulaire** : toutes les soumissions d'un formulaire (Excel ou CSV)
- **Par soumission** : fichiers de l'inbox en ZIP
- **Multi-formulaires** : export global de toutes les soumissions accessibles (CSV)
- **Utilisateurs** : liste des utilisateurs (Excel ou CSV, admin uniquement)

---

## 14. Variables d'environnement

### Variables obligatoires

| Variable         | Description                                | Exemple                                   |
| ---------------- | ------------------------------------------ | ----------------------------------------- |
| `DB_IP`          | Adresse hôte de la BDD                     | `127.0.0.1`                               |
| `DB_PORT`        | Port de la BDD                             | `3307`                                    |
| `DB_USER`        | Utilisateur BDD                            | `puna_user`                               |
| `DB_PWD`         | Mot de passe BDD                           | `secret_password`                         |
| `DB_NAME`        | Nom de la BDD                              | `puna`                                    |
| `DB_DIALECT`     | Dialecte SQL                               | `mariadb` (`mysql`, `postgres`, `sqlite`) |
| `KEY_TK`         | Clé secrète JWT (≥32 caractères)           | `une_cle_tres_longue_et_securisee...`     |
| `KEV`            | Clé AES de chiffrement (≥32 caractères)    | `cle_aes_de_chiffrement_securisee...`     |
| `KIV`            | Vecteur d'initialisation AES               | `vecteur_init_aes...`                     |
| `SESSION_SECRET` | Secret de session Express (≥32 caractères) | `secret_session_express...`               |
| `CSRF_SECRET`    | Secret CSRF (≥32 caractères)               | `secret_csrf_protection...`               |
| `PORT`           | Port du serveur                            | `3022`                                    |
| `NODE_ENV`       | Environnement                              | `development` ou `production`             |

### Variables optionnelles

| Variable                    | Défaut            | Description                              |
| --------------------------- | ----------------- | ---------------------------------------- |
| `SESSION_MAX_AGE`           | `43200000` (12h)  | Durée de vie de la session en ms         |
| `HELMET_STRICT_TRANSPORT`   | `false`           | Active HSTS (uniquement si HTTPS)        |
| `API_MAX_FILE_SIZE`         | `10485760` (10Mo) | Taille max par fichier uploadé           |
| `API_MAX_TOTAL_SIZE`        | `52428800` (50Mo) | Taille totale max des fichiers           |
| `API_MAX_FILES`             | `10`              | Nombre max de fichiers par requête       |
| `API_MAX_FIELDS`            | `40`              | Nombre max de champs par requête         |
| `API_MAX_FIELD_SIZE`        | `10000`           | Taille max d'un champ texte (caractères) |
| `RATE_LIMIT_FORM_MAX`       | `30`              | Requêtes max par fenêtre (API)           |
| `RATE_LIMIT_FORM_WINDOW_MS` | `60000` (1min)    | Fenêtre de rate limiting API             |
| `LOG_TO_CONSOLE`            | `true`            | Affichage des logs en console (dev)      |
| `LOG_RETENTION_*`           | Varies            | Rétention par type de log en production  |

---

## 15. Scripts disponibles

| Commande               | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Démarrage en mode développement (watch + .env) |
| `npm start`            | Démarrage en production                        |
| `npm run lint`         | Vérification du code (ESLint)                  |
| `npm run lint:fix`     | Correction automatique (ESLint)                |
| `npm run format`       | Formatage du code (Prettier + Handlebars)      |
| `npm run format:check` | Vérification du formatage                      |
| `npm run logs:clean`   | Nettoyage des logs                             |
| `npm run logs:stats`   | Statistiques des logs                          |
| `npm run logs:rotate`  | Rotation manuelle des logs                     |

---

## 16. Parcours utilisateur Beta — Guide pas à pas

### Étape 1 : Activation du compte

1. Vous recevez vos identifiants (login) par l'administrateur
2. Accédez à l'URL de Puna → page de première connexion
3. Entrez votre login et définissez votre mot de passe
4. Votre compte est activé

### Étape 2 : Connexion et Dashboard

1. Connectez-vous avec votre login et mot de passe
2. Vous arrivez sur le dashboard avec vos statistiques
3. Le menu latéral donne accès à : Dashboard, Sites, Administration (si autorisé)

### Étape 3 : Création d'un site

1. Cliquez sur "Créer un site"
2. Entrez le nom de domaine de votre site (ex: `monsite.fr`)
3. Un `control_code` est généré automatiquement
4. Vous êtes redirigé vers la page du site

> **Limite Beta** : 4 sites maximum

### Étape 4 : Création d'un formulaire

1. Sur la page de votre site, cliquez sur "Créer un formulaire"
2. Donnez un nom au formulaire (ex: "Contact")
3. Un code unique est généré (endpoint API)

> **Limite Beta** : 2 formulaires par site maximum

### Étape 5 : Génération du token API

1. Sur la page de votre site, cliquez sur "Token"
2. Un token JWT est généré
3. Copiez ce token — il sera utilisé dans vos appels API

### Étape 6 : Intégration sur votre site web

Intégrez le formulaire HTML avec un appel `fetch` vers l'API :

- URL : `https://votre-puna.com/api/v1/send/VOTRE_CODE`
- Headers : `X-KEY-PUNA: puna` + `Authorization: Bearer VOTRE_TOKEN`
- Body : `FormData` ou JSON

### Étape 7 : Consultation des soumissions

1. Les soumissions apparaissent dans l'onglet du formulaire sur la page du site
2. Cliquez sur une soumission pour voir le détail
3. Téléchargez les fichiers joints individuellement ou en ZIP

> **Limite Beta** : 200 soumissions par formulaire maximum

### Étape 8 : Export des données

1. Cliquez sur "Export Excel" ou "Export CSV" depuis la vue d'un formulaire
2. Le fichier est téléchargé avec toutes les soumissions

### Étape 9 : Personnalisation

- **Colonnes** : choisissez quelles colonnes afficher dans le tableau
- **Template** : personnalisez les labels des champs (ex: `"email"` → `"Adresse e-mail"`)
- **Filtres** : filtrez les soumissions par contenu JSON

### Étape 10 : Révocation de tokens

Si nécessaire, révoquez tous les tokens d'un site (utile si le token est compromis). Un nouveau `control_code` est généré, et tous les anciens tokens deviennent invalides.

---

## 17. Pages de documentation VuePress suggérées

Voici la structure de pages recommandée pour la documentation VuePress destinée aux Beta testeurs :

```
docs/
├── guide/
│   ├── README.md                    ← Introduction : Qu'est-ce que Puna ?
│   ├── getting-started.md           ← Premiers pas (activation du compte, première connexion)
│   ├── dashboard.md                 ← Le dashboard et les statistiques
│   ├── sites.md                     ← Gestion des sites (créer, voir, supprimer)
│   ├── forms.md                     ← Gestion des formulaires (créer, configurer, supprimer)
│   ├── inbox.md                     ← Consultation des soumissions (détail, fichiers, filtres)
│   ├── exports.md                   ← Export des données (Excel, CSV, ZIP)
│   ├── tokens.md                    ← Tokens API (génération, révocation)
│   └── beta-limits.md               ← Limites du profil Beta (sites, forms, inbox)
│
├── integration/
│   ├── README.md                    ← Introduction à l'intégration
│   ├── api-reference.md             ← Référence API (endpoint, auth, headers, réponses)
│   ├── html-form.md                 ← Intégration formulaire HTML classique
│   ├── javascript-fetch.md          ← Intégration avec JavaScript (fetch / axios)
│   ├── file-upload.md               ← Upload de fichiers (types acceptés, limites)
│   └── rate-limiting.md             ← Rate limiting et erreurs (429, flow control)
│
├── security/
│   ├── README.md                    ← Vue d'ensemble de la sécurité
│   ├── authentication.md            ← Authentification (login, session, mot de passe)
│   ├── api-auth.md                  ← Authentification API (JWT, AES, triple vérification)
│   ├── file-validation.md           ← Validation des fichiers (extensions, magic bytes, archives)
│   └── csrf-xss.md                  ← Protections CSRF et XSS
│
├── faq/
│   └── README.md                    ← Questions fréquentes
│
└── changelog/
    └── README.md                    ← Journal des modifications
```

### Thème et configuration VuePress recommandés

Pour VuePress 1.5.3, la configuration de navigation dans `.vuepress/config.js` devrait suivre cette structure :

```js
module.exports = {
    title: 'Puna Documentation',
    description: 'Documentation pour les Beta testeurs de Puna',
    themeConfig: {
        nav: [
            { text: 'Guide', link: '/guide/' },
            { text: 'Intégration', link: '/integration/' },
            { text: 'Sécurité', link: '/security/' },
            { text: 'FAQ', link: '/faq/' },
        ],
        sidebar: {
            '/guide/': [
                '',
                'getting-started',
                'dashboard',
                'sites',
                'forms',
                'inbox',
                'exports',
                'tokens',
                'beta-limits',
            ],
            '/integration/': ['', 'api-reference', 'html-form', 'javascript-fetch', 'file-upload', 'rate-limiting'],
            '/security/': ['', 'authentication', 'api-auth', 'file-validation', 'csrf-xss'],
            '/faq/': [''],
        },
    },
};
```

---

## 18. Glossaire

| Terme                  | Définition                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Site**               | Représente un domaine web (ex: `monsite.fr`) dans Puna. Conteneur de formulaires.                           |
| **Formulaire (Form)**  | Point de collecte rattaché à un site. Identifié par un code unique utilisé dans l'URL API.                  |
| **Soumission (Inbox)** | Entrée de données reçue via l'API pour un formulaire. Contient les données JSON et références aux fichiers. |
| **Template**           | Mapping entre les noms de champs bruts et des labels lisibles. Auto-appris à chaque soumission.             |
| **Colonnes**           | Configuration de l'affichage du tableau des soumissions (quelles colonnes montrer).                         |
| **Control Code**       | Code secret aléatoire (16 chars) associé à un site, utilisé dans la génération des tokens JWT.              |
| **Token (JWT)**        | Jeton d'authentification pour l'API, chiffré en AES et signé. Généré depuis le dashboard.                   |
| **SiteUser**           | Association entre un utilisateur et un site (permet l'accès aux rôles `editor`/`viewer`).                   |
| **RBAC**               | Role-Based Access Control — système de permissions basé sur les rôles.                                      |
| **Rate Limit**         | Limite du nombre de requêtes par unité de temps (protection contre l'abus).                                 |
| **Magic Bytes**        | Premiers octets d'un fichier identifiant son vrai type (indépendamment de l'extension).                     |

---

## 19. Informations complémentaires pour l'IA de documentation

### Ton et style

- La documentation est destinée à des **développeurs web** et **tech-savvy** en phase de Beta test
- Le ton doit être **professionnel mais accessible**, avec des **exemples concrets**
- Les captures d'écran ne sont pas disponibles — utiliser des **descriptions claires** et des **blocs de code**
- La langue est le **français**

### Points d'attention Beta

- Insister sur les **limites du rôle Beta** (4 sites, 2 forms/site, 200 inbox/form)
- Bien expliquer que les utilisateurs Beta **n'ont pas accès à l'administration** (pas de gestion des utilisateurs)
- Les utilisateurs Beta gèrent **leurs propres sites** uniquement (pas d'accès aux sites des autres)
- L'activation du compte est une étape obligatoire (statut `pending` → `active`)

### Contexte technique pertinent

- L'application est **full-français** (locales, messages d'erreur, flash messages)
- Express 5 (dernière version majeure)
- ESM modules partout (pas de CommonJS)
- Base de données MariaDB (compatible MySQL)
- Les modèles Sequelize sont **définis en JSON** (attributs + relations) et construits dynamiquement
- Le frontend utilise **Tailwind + DaisyUI** (pas de framework JS côté client, vanilla JS)
- Les graphiques utilisent **ApexCharts** (pas de SSR des charts)
