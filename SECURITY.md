# Politique de Sécurité - Puna

Ce document décrit les mesures de sécurité mises en place dans Puna, ainsi que les bonnes pratiques à suivre pour maintenir un haut niveau de protection.

---

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Authentification & Sessions](#authentification--sessions)
- [Autorisation & Permissions](#autorisation--permissions)
- [Sécurité HTTP (Helmet.js)](#sécurité-http-helmetjs)
- [Upload de fichiers](#upload-de-fichiers)
- [Protection contre les injections](#protection-contre-les-injections)
- [Protection CSRF](#protection-csrf)
- [Gestion des secrets](#gestion-des-secrets)
- [Rate Limiting](#rate-limiting)
- [Audit & Logs](#audit--logs)
- [Gestion des erreurs critiques](#gestion-des-erreurs-critiques)
- [Reporter une vulnérabilité](#reporter-une-vulnérabilité)
- [Checklist de sécurité](#checklist-de-sécurité)
- [Ressources](#ressources)

---

## Vue d'ensemble

Puna implémente une approche de sécurité **multi-couches** pour protéger les données des utilisateurs et prévenir les vulnérabilités courantes (OWASP Top 10).

### Principes de sécurité appliqués

- **Défense en profondeur** - Plusieurs couches de protection
- **Moindre privilège** - Permissions minimales par défaut
- **Validation stricte** - Toutes les entrées sont validées
- **Chiffrement** - Données sensibles chiffrées
- **Isolation** - Séparation API publique / routes authentifiées

### Technologies de sécurité

| Technologie            | Usage                                  | Version |
| ---------------------- | -------------------------------------- | ------- |
| **bcrypt**             | Hachage des mots de passe              | ^6.0.0  |
| **jsonwebtoken**       | Tokens API JWT                         | ^9.0.2  |
| **helmet**             | Headers HTTP sécurisés                 | ^8.1.0  |
| **xss**                | Sanitization XSS                       | ^1.0.15 |
| **sanitize-filename**  | Validation noms de fichiers            | ^1.6.3  |
| **sequelize**          | ORM (prévention SQL injection)         | ^6.37.7 |
| **node:crypto**        | Chiffrement AES (module natif Node.js) | natif   |
| **csrf-csrf**          | Protection CSRF (Double Submit Cookie) | ^4.0.3  |
| **express-rate-limit** | Rate limiting login & API              | ^8.2.1  |

---

## Authentification & Sessions

### Hachage des mots de passe (bcrypt)

Les mots de passe sont **hachés** avec bcrypt (10 rounds de salt) avant stockage en base de données.

```javascript
// Hachage lors de la création
import bcrypt from 'bcrypt';
const hashedPassword = await bcrypt.hash(password, 10);

// Vérification lors de la connexion
const isValid = await bcrypt.compare(password, user.password);
```

**Protection contre :**

- Rainbow tables
- Brute force (salt unique par utilisateur)
- Stockage en clair

### Tokens JWT (API publique)

Les API publiques (`/send/:code`) utilisent des **tokens JWT** pour l'authentification.

**Caractéristiques :**

- Signature HMAC SHA-256
- Sans expiration - le token reste valide tant que le `control_code` du site n'est pas régénéré (révocation = `POST /site/:id/revoke`)
- Payload chiffré : `{ id, control_code }` est chiffré via `encryptObject()` (AES-256-CBC), puis stocké dans le champ `data` du JWT
- Le formulaire est vérifié séparément via le paramètre `:code` dans l'URL
- Clé secrète dans `.env` (`KEY_TK`)

**Génération :**

```javascript
import jwt from 'jsonwebtoken';
import { encryptObject } from '../utils/crypto.js';

// Le payload { id, control_code } est d'abord chiffré AES-256-CBC
const payload = {
    data: encryptObject({ id: site.id, control_code: site.control_code }),
};
const token = jwt.sign(payload, process.env.KEY_TK);
```

**Validation :**

- Middleware `authApiKeyAccess` vérifie la signature
- Token invalide → 401 Unauthorized
- Token expiré → 401 Unauthorized

### Authentification à deux facteurs (2FA / TOTP)

Puna supporte l'authentification à deux facteurs via le protocole **TOTP (RFC 6238)**, compatible avec les applications mobiles telles que :

- Google Authenticator
- Authy
- Microsoft Authenticator
- 1Password, Bitwarden, etc.

**Activation :**

- La 2FA est activable globalement via la variable d'environnement `TOTP_ENABLED=true`
- Chaque utilisateur peut activer/désactiver la 2FA depuis le dashboard
- L'activation génère un QR code scannable + une clé manuelle en base32

**Codes de récupération :**

- 8 codes à usage unique au format `xxxx-xxxx` sont générés lors de l'activation
- Chaque code est hashé individuellement (bcrypt) avant stockage
- Les codes hashés sont ensuite chiffrés (AES-256-CBC) en base de données
- Un code utilisé est supprimé définitivement du tableau
- Les codes peuvent être régénérés (nécessite le mot de passe)

**Stockage sécurisé :**

| Donnée                | Méthode                                                | Colonne                  |
| --------------------- | ------------------------------------------------------ | ------------------------ |
| Secret TOTP           | Chiffré AES-256-CBC (`encryptString`)                  | `user.totp_secret`       |
| Codes de récupération | Hashés bcrypt + chiffrés AES-256-CBC (`encryptObject`) | `user.totp_backup_codes` |
| Flag activation       | Booléen en clair                                       | `user.totp_enabled`      |

**Flux de connexion avec 2FA :**

1. L'utilisateur saisit login + mot de passe (Passport LocalStrategy)
2. Si le mot de passe est valide et que `totp_enabled = true` :
    - Une session intermédiaire `pending2FA` est créée (pas de session complète)
    - Redirection vers la page de vérification TOTP
3. L'utilisateur saisit le code à 6 chiffres de son application
4. Si le code est valide → session complète → accès au dashboard
5. Alternative : utilisation d'un code de récupération à usage unique

**Protection contre le brute-force :**

- Rate limiting : 5 tentatives par fenêtre de 15 minutes (par IP + userId)
- Tolérance TOTP : ±1 période (30 secondes) pour compenser les décalages d'horloge

### Sessions Express (routes web)

Les routes authentifiées (`/dashboard`, `/admin`, etc.) utilisent des **sessions** stockées en MySQL.

**Configuration :**

```javascript
import session from 'express-session';
import MySQLStoreConstructor from 'express-mysql-session';

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false, // true en production avec HTTPS
            httpOnly: true, // Prévient XSS
            maxAge: 43200000, // 12 heures
        },
        store: mysqlStore, // Persistance en base
    })
);
```

**Protection contre :**

- Session fixation (cookie régénéré à chaque login)
- Session hijacking (httpOnly cookie)
- CSRF (Double Submit Cookie - voir section dédiée)

### Première connexion obligatoire

Lors de la création d'un compte, l'utilisateur **doit** se connecter avec son mot de passe temporaire et le changer.

**Workflow :**

1. Admin crée un utilisateur → mot de passe temporaire généré
2. Utilisateur reçoit ses identifiants
3. Première connexion → redirection forcée vers changement de mot de passe
4. Nouveau mot de passe défini → accès complet au système

**Fichiers :**

- `src/controllers/auth.controller.js` - flux de première connexion (`dpFirstCoPost`)
- `src/helpers/init_admin_user.helpers.js` - création du compte admin initial

---

## Autorisation & Permissions

### Système ACL (Access Control List)

Puna implémente un système d'autorisation **granulaire** avec 5 rôles et des permissions par entité.

### Hiérarchie des rôles

| Rôle          | Niveau | Description                                  |
| ------------- | ------ | -------------------------------------------- |
| `super_admin` | 5      | Accès total (admin utilisateurs, paramètres) |
| `owner`       | 4      | Propriétaire de sites, gestion utilisateurs  |
| `unique`      | 3      | Utilisateur unique avec privilèges étendus   |
| `editor`      | 2      | Édition de contenu                           |
| `viewer`      | 1      | Lecture seule                                |

### Permissions par entité

Les permissions sont vérifiées sur 4 entités principales :

| Entité    | Actions                      | Description                              |
| --------- | ---------------------------- | ---------------------------------------- |
| **site**  | create, read, update, delete | Gestion des sites                        |
| **form**  | create, read, update, delete | Gestion des formulaires                  |
| **inbox** | read, delete                 | Consultation/suppression des soumissions |
| **user**  | manage                       | Administration des utilisateurs          |

### Middlewares de protection

#### `roleAccess` - Vérification du rôle

```javascript
// Route accessible uniquement par super_admin et owner
router.get('/admin/users', isConnected, roleAccess(['super_admin', 'owner']), adminCtl.adminUsers);
```

**Fichier :** `src/middlewares/checkAccess.js`

#### `actionAccess` - Vérification des permissions

```javascript
// Route nécessitant permission 'read' sur 'form'
router.get('/form/:id/inbox', isConnected, actionAccess('form', 'read'), formCtl.getFormInbox);
```

**Logique :**

1. Récupère le rôle de l'utilisateur
2. Charge les permissions depuis `src/config/permissions.js`
3. Vérifie si l'action est autorisée pour ce rôle
4. Si refusé → 403 Forbidden

**Fichier :** `src/config/permissions.js`

### Helpers Handlebars

Les permissions sont également vérifiées côté front-end pour masquer les boutons inaccessibles.

```handlebars
{{#actionCan entity='site' action='create'}}
    <button>Créer un site</button>
{{/actionCan}}

{{#roleIs role='super_admin'}}
    <a href='/admin'>Administration</a>
{{/roleIs}}
```

**Fichier :** `src/helpers/hbs.helpers.js`

### Isolation des données

Les utilisateurs ne voient **que les sites auxquels ils ont accès** :

```javascript
// Service qui filtre automatiquement par accès utilisateur
const sites = await getAvailableSites(userId, userRole);

// Super_admin → Tous les sites
// Autres → Sites assignés uniquement (table site_users)
```

**Fichier :** `src/services/site.service.js`

---

## Sécurité HTTP (Helmet.js)

Helmet.js configure automatiquement les **headers HTTP de sécurité** pour protéger contre les vulnérabilités web courantes.

### Configuration hybride

**Routes API publiques** (`/api/*`, `/send/*`) → **Helmet léger**

- CSP désactivé (ne bloque pas les appels cross-origin)
- Headers sécurisés mais non restrictifs

**Routes web authentifiées** (`/dashboard`, `/admin`, etc.) → **Helmet complet**

- Content Security Policy (CSP) strict
- Protection contre XSS, clickjacking, etc.

### Headers configurés

| Header                      | Valeur            | Protection                                     |
| --------------------------- | ----------------- | ---------------------------------------------- |
| `X-Content-Type-Options`    | nosniff           | Force le respect du Content-Type               |
| `X-Frame-Options`           | DENY              | Empêche l'intégration en iframe (clickjacking) |
| `X-XSS-Protection`          | 0                 | Désactivé (CSP fait le job)                    |
| `Content-Security-Policy`   | [voir ci-dessous] | Limite les sources de contenu                  |
| `Strict-Transport-Security` | max-age=31536000  | Force HTTPS (prod uniquement)                  |

### Content Security Policy (CSP)

```javascript
contentSecurityPolicy: {
    directives: {
        defaultSrc: ["'self'"],                          // Par défaut: même origine
        scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],                          // API calls vers même domaine
        fontSrc: ["'self'", "cdnjs.cloudflare.com", "data:"],
        frameSrc: ["'none'"],                            // Pas d'iframes
        objectSrc: ["'none'"],                           // Pas d'objets/embeds
        upgradeInsecureRequests: [],                     // HTTP → HTTPS en prod
    },
}
```

> ⚠️ **`'unsafe-inline'` dans `scriptSrc` et `styleSrc`** : cette directive affaiblit la protection XSS offerte par la CSP.
> Elle est actuellement nécessaire pour Tailwind CSS et certains composants front-end.
> **Amélioration prévue :** migrer vers des nonces CSP (`'nonce-<valeur>'`) pour supprimer `'unsafe-inline'` tout en conservant le fonctionnement des scripts inline légitimes.

### HSTS (Strict Transport Security)

**Développement :** Désactivé (pas de HTTPS local)
**Production :** Activé via variable `HELMET_STRICT_TRANSPORT=true`

```env
# .env
NODE_ENV=production
HELMET_STRICT_TRANSPORT=true  # Force HTTPS
```

**Fichier :** `src/config/helmet.config.js`

---

## Upload de fichiers

L'upload de fichiers est **hautement sécurisé** avec validation multi-niveaux.

### Configuration Multer

```javascript
import multer from 'multer';

const upload = multer({
    dest: 'storage/tmp/', // Dossier temporaire
    limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB par fichier
        files: 10, // Max 10 fichiers
    },
});
```

### Validation des fichiers

#### 1. Types autorisés (whitelist)

Extensions validées :

```javascript
const ALLOWED_EXTENSIONS = [
    'png',
    'jpg',
    'jpeg',
    'webp', // Images
    'pdf',
    'doc',
    'docx',
    'odt', // Documents
    'txt',
    'xls',
    'xlsx',
    'csv', // Tableurs & Texte
];
```

**Validation :**

- Extension dans la whitelist
- Content-Type du header HTTP
- Magic bytes du fichier (avec `file-type`)

**Fichier :** `src/api/v1/middlewares/validateUpload.js`

#### 2. Sanitization des noms de fichiers

```javascript
import sanitize from 'sanitize-filename';

const safeName = sanitize(originalName);
// "../../etc/passwd" → "etc-passwd"
// "<script>alert('xss')</script>.jpg" → "scriptalertxssscript.jpg"
```

**Protection contre :**

- Path traversal
- XSS dans les noms de fichiers
- Caractères spéciaux problématiques

#### 3. Stockage sécurisé

Les fichiers sont stockés avec un **préfixe unique** pour éviter les collisions :

```javascript
const timestamp = Date.now();
const random = Math.random().toString(36).substring(7);
const finalName = `${timestamp}_${random}_${sanitizedName}`;

// Exemple: 1702468923_x7k2p_document.pdf
```

**Structure :**

```
storage/
├── tmp/                          # Temporaire (nettoyé)
└── uploads/
    ├── site1.com/
    │   ├── form1/
    │   │   ├── 1702468923_x7k2p_document.pdf
    │   │   └── 1702468924_a3b9z_image.jpg
    │   └── form2/
    └── site2.com/
```

### Pipeline de traitement

```
Upload → Validation → Inspection → Scan antivirus → Déplacement → BDD
  ↓          ↓            ↓              ↓               ↓           ↓
Multer → validateUpload → inspectArchive → scanUpload → moveFiles → saveInbox
```

### Scan antivirus - ClamAV (optionnel)

Le middleware `scanUpload` analyse chaque fichier uploadé via le daemon **ClamAV** (`clamd`) avant qu'il ne soit déplacé vers le stockage permanent.

**Activation :** `CLAMAV_ENABLED=true` dans `.env` (désactivé par défaut - pass-through).

| Mode de connexion | Variables d'environnement                 | Usage typique                          |
| ----------------- | ----------------------------------------- | -------------------------------------- |
| Socket Unix       | `CLAMAV_SOCKET=/tmp/clamd.socket`         | macOS Homebrew / Linux natif           |
| TCP               | `CLAMAV_HOST=clamav` + `CLAMAV_PORT=3310` | Docker (service `clamav` dans Compose) |

> La détection du mode est automatique : si `CLAMAV_SOCKET` est défini, le socket Unix est utilisé ; sinon, TCP.

**Comportement :**

| Situation                     | Réponse                 | Fichiers tmp   |
| ----------------------------- | ----------------------- | -------------- |
| ClamAV désactivé              | `next()` (pass-through) | Conservés      |
| Fichier sain                  | `next()`                | Conservés      |
| Fichier infecté               | **422** + détail virus  | Tous supprimés |
| Erreur de connexion à `clamd` | **503** (fail-closed)   | Tous supprimés |

> ⚠️ **Fail-closed** : si le daemon ClamAV est inaccessible alors qu'il est activé, **tous les uploads sont refusés** (503). Aucun fichier ne passe sans scan.

**Vérification au démarrage :** `env.validator.js` effectue un `PING → PONG` vers le daemon au boot du serveur. Si ClamAV est inaccessible, le processus **refuse de démarrer**.

**Docker :** le fichier `docker-compose.yml` inclut un service `clamav` (image `clamav/clamav:1.4`) prêt à l'emploi.

**Fichier :** `src/api/v1/middlewares/scanUpload.js`

**Tous les middlewares du pipeline :**

- `src/api/v1/middlewares/multipartUpload.js`
- `src/api/v1/middlewares/validateUpload.js`
- `src/api/v1/middlewares/inspectArchive.js`
- `src/api/v1/middlewares/scanUpload.js`
- `src/api/v1/middlewares/moveFilesToUploads.js`

---

## Protection contre les injections

### SQL Injection

**Sequelize ORM** est utilisé pour **toutes** les requêtes en base de données, ce qui prévient automatiquement les injections SQL.

```javascript
// ✅ SÉCURISÉ - Paramètres échappés par Sequelize
const user = await models.User.findOne({
    where: { email: userInput },
});

// ❌ DANGEREUX - Requête SQL brute (à éviter)
const user = await sequelize.query(`SELECT * FROM users WHERE email = '${userInput}'`);
```

**Bonnes pratiques :**

- Toujours utiliser les méthodes Sequelize (`findOne`, `create`, etc.)
- Si requête brute nécessaire, utiliser les paramètres `replacements`
- Valider les entrées utilisateur avant requête
- `multipleStatements: false` dans la configuration Sequelize (désactivé explicitement)

#### Protection des filtres dynamiques

Les filtres dynamiques JSON dans `inbox.service.js` utilisent `Sequelize.literal()`. Pour éviter l'injection via les noms de clés, une validation regex est appliquée :

```javascript
const SAFE_KEY_REGEX = /^[a-zA-Z0-9_]+$/;

for (const [key, value] of Object.entries(jsonFilters)) {
    if (!SAFE_KEY_REGEX.test(key)) {
        throw new Error(`Invalid filter key: ${key}`);
    }
    // Seules les clés alphanumériques sont acceptées dans Sequelize.literal()
}
```

**Fichiers :** `src/models/`, `src/services/`

### XSS (Cross-Site Scripting)

#### Sanitization côté serveur

Package `xss` utilisé pour nettoyer les entrées :

```javascript
import xss from 'xss';

// Nettoyer toutes les valeurs du body
Object.keys(req.body).forEach((key) => {
    if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key]);
    }
});
```

**Fichier :** `src/api/v1/validators/sanitizeRequest.js`

#### Protection Helmet CSP

Content Security Policy bloque l'exécution de scripts non autorisés :

```javascript
scriptSrc: ["'self'", 'cdn.jsdelivr.net']; // Seuls ces domaines autorisés
```

#### Échappement Handlebars

Les templates Handlebars échappent automatiquement les variables :

```handlebars
{{! ✅ Échappé automatiquement }}
<p>{{userInput}}</p>

{{! ❌ Non échappé (à utiliser avec précaution) }}
<p>{{{userInput}}}</p>
```

### Path Traversal

**Sanitization des chemins de fichiers** avec `sanitize-filename` :

```javascript
import sanitize from 'sanitize-filename';

// Empêche "../../../etc/passwd"
const safePath = sanitize(userInput);
```

**Protection supplémentaire avec vérification canonique :**

```javascript
// Résolution du chemin absolu et vérification du préfixe
const resolvedPath = path.resolve(uploadsDir, siteDomain, formName, fileName);
const expectedPrefix = path.resolve(uploadsDir);

if (!resolvedPath.startsWith(expectedPrefix)) {
    throw new Error('Path traversal attempt detected');
}
```

Cette double vérification est appliquée dans :

- **`deleteInboxWithFiles()`** - Avant suppression de fichiers
- **`verifyFileAccessAndGetPath()`** - Avant téléchargement de fichiers

**Fichiers :**

- `src/helpers/file.helpers.js`
- `src/services/inbox.service.js`

---

## Protection CSRF

### Double Submit Cookie Pattern

Puna utilise le package **csrf-csrf** pour protéger toutes les routes web contre les attaques CSRF.

**Principe :**

1. Le serveur génère un token CSRF et le stocke dans un cookie (`__csrf`)
2. Le même token est injecté dans les formulaires via un champ hidden `_csrf`
3. Lors d'un POST, le middleware compare la valeur du cookie et celle du body/header
4. Si les valeurs ne correspondent pas → **403 Forbidden**

**Configuration :**

```javascript
import { doubleCsrf } from 'csrf-csrf';

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET,
    getSessionIdentifier: (req) => req.session?.id ?? '',
    cookieName: '__csrf',
    cookieOptions: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
    },
    getCsrfTokenFromRequest: (req) => {
        return req.body?._csrf || req.headers['x-csrf-token'];
    },
});
```

**Fichier :** `src/middlewares/csrf.js`

### Routes protégées

| Type             | Routes                       | Protection                            |
| ---------------- | ---------------------------- | ------------------------------------- |
| Formulaires HTML | Toutes les routes POST web   | Champ hidden `_csrf`                  |
| Requêtes AJAX    | PUT/POST depuis le dashboard | Header `x-csrf-token`                 |
| API publiques    | `/api/*`, `/send/*`          | **Exclues** (authentification Bearer) |

### Injection dans les templates

Le middleware `csrfTokenInjector` rend le token disponible dans tous les templates Handlebars :

```handlebars
{{! Formulaires HTML }}
<form method='post' action='/dp-connect'>
    <input type='hidden' name='_csrf' value='{{csrfToken}}' />
    ...
</form>

{{! Requêtes AJAX (via meta tag dans head.hbs) }}
<meta name='csrf-token' content='{{csrfToken}}' />
```

```javascript
// JavaScript client - ajout du header pour requêtes AJAX
fetch('/api/endpoint', {
    method: 'POST',
    headers: {
        'x-csrf-token': document.querySelector('meta[name="csrf-token"]')?.content || '',
    },
});
```

### Gestion des erreurs CSRF

Un gestionnaire d'erreur dédié redirige l'utilisateur avec un message flash en cas de token invalide ou expiré :

```javascript
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        logger.warn({ url: req.originalUrl, method: req.method }, 'CSRF token invalide');
        res.flash('error', 'Session expirée ou jeton invalide. Veuillez réessayer.');
        return res.redirect('back');
    }
    next(err);
});
```

**Protection contre :**

- Cross-Site Request Forgery
- Requêtes POST non autorisées depuis des sites tiers
- L'attaquant ne peut pas lire le cookie `httpOnly`

**Variable d'environnement requise :** `CSRF_SECRET` (min. 32 caractères)

---

## Gestion des secrets

### Variables d'environnement

**Tous les secrets** sont stockés dans le fichier `.env` (non versionné dans Git).

```env
# Tokens & Clés
KEY_TK="your_secure_key_tk_here"           # JWT signing key
KEV="your_secure_encryption_key_here"     # AES encryption key
KIV="your_secure_initialization_vector"   # AES IV
CSRF_SECRET="your_csrf_secret_min_32_chars" # CSRF token signing

# Session
SESSION_SECRET="your_secure_session_key"

# Base de données
DB_USER="root"
DB_PWD="your_password"
```

### Chiffrement AES (node:crypto)

Les données sensibles sont chiffrées avec AES-256-CBC via le module **natif** `node:crypto` (aucune dépendance externe) :

```javascript
import { createCipheriv, createDecipheriv } from 'node:crypto';

const key = Buffer.from(process.env.KEV, 'hex'); // 32 bytes (AES-256)
const iv = Buffer.from(process.env.KIV, 'hex'); // 16 bytes

// Chiffrement
const cipher = createCipheriv('aes-256-cbc', key, iv);
let encrypted = cipher.update(data, 'utf8', 'hex');
encrypted += cipher.final('hex');

// Déchiffrement
const decipher = createDecipheriv('aes-256-cbc', key, iv);
let decrypted = decipher.update(encrypted, 'hex', 'utf8');
decrypted += decipher.final('utf8');
```

**Fichier :** `src/utils/crypto.js`

### Bonnes pratiques

- ✅ **Jamais de secrets en dur** dans le code
- ✅ `.env` dans `.gitignore`
- ✅ `.env.example` pour documentation (sans valeurs réelles)
- ✅ Clés différentes par environnement (dev/prod)
- ✅ Rotation des clés régulière (recommandé)

### Génération de clés sécurisées

```bash
# Générer une clé aléatoire (32 caractères)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Générer un JWT secret (64 caractères)
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

## Rate Limiting

### Implémenté

Le rate limiting est implémenté avec **express-rate-limit** sur les routes sensibles.

### Routes protégées

| Route                                                         | Limite     | Fenêtre    | Description                                    |
| ------------------------------------------------------------- | ---------- | ---------- | ---------------------------------------------- |
| `POST /dp-connect`                                            | 5 requêtes | 15 minutes | Login (ne compte pas les succès)               |
| `POST /dp-first-co`                                           | 3 requêtes | 15 minutes | Première connexion                             |
| `POST /dp-forgot-password`                                    | 3 requêtes | 15 minutes | Demande de réinitialisation (anti-énumération) |
| `POST /dp-reset-password/:token`                              | 5 requêtes | 15 minutes | Réinitialisation effective du mot de passe     |
| `POST /dp-2fa-verify`                                         | 5 requêtes | 15 minutes | Vérification TOTP (ne compte pas les succès)   |
| `POST /dp-2fa-recovery`                                       | 5 requêtes | 15 minutes | Utilisation d'un code de récupération          |
| `POST /dp-2fa-setup`, `/dp-2fa-disable`, `/dp-2fa-regenerate` | 5 requêtes | 15 minutes | Actions de configuration 2FA                   |
| `POST /send/:code`                                            | 30 req/min | 1 minute   | API soumission formulaire (configurable)       |

### Configuration

```javascript
import rateLimit from 'express-rate-limit';

// Login rate limiter
const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Trop de tentatives, réessayez dans 15 minutes',
});

// API rate limiter (configurable via env)
const formRateLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_FORM_WINDOW_MS || '60000'),
    max: parseInt(process.env.RATE_LIMIT_FORM_MAX || '30'),
    keyGenerator: (req) => `form:${req.site?.id}:${req.params.code}`,
});
```

**Variables d'environnement :**

- `RATE_LIMIT_FORM_MAX` - Requêtes max par fenêtre (défaut : 30)
- `RATE_LIMIT_FORM_WINDOW_MS` - Fenêtre en ms (défaut : 60000)

**Fichiers :**

- `src/middlewares/loginRateLimiter.js`
- `src/api/v1/middlewares/rateLimiter.js`

### Stockage

- **Actuellement :** MemoryStore (mono-instance)
- **Limitation :** Si le processus Node redémarre (déploiement, crash, OOM), tous les compteurs sont remis à zéro - une fenêtre d'exploitation s'ouvre brièvement.
- **Production multi-instances :** Migrer vers Redis (`rate-limit-redis`) pour un stockage partagé et persistant entre les instances.

---

## Audit & Logs

### Système de logging Pino

**Pino** est intégré pour des logs structurés et performants.

#### Configuration

**4 loggers séparés** pour différents types d'événements :

```javascript
import { logger, apiLogger, errorLogger, auditLogger } from './config/logger.js';

// Logger principal (app.log)
logger.info({ userId, action }, 'User action completed');

// Logger API (api.log)
apiLogger.info({ siteId, formId, method: 'POST' }, 'API request');

// Logger erreurs (error.log)
errorLogger.error({ error, stack, userId }, 'Database error');

// Logger audit/sécurité (audit.log)
auditLogger.info({ userId, ip, event: 'login' }, 'User authenticated');
```

**Fichier :** `src/config/logger.js`

#### Middleware HTTP

**pino-http** remplace Morgan pour logger toutes les requêtes HTTP :

```javascript
import pinoHttp from 'pino-http';

// Utilise le bon logger selon la route
const isApi = req.url.startsWith('/api/') || req.url.startsWith('/send/');
const httpLogger = pinoHttp({
    logger: isApi ? apiLogger : logger,
    customLogLevel: (req, res, err) => {
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
    },
});
```

**Fichier :** `src/app.js`

#### Helpers de logging

15 fonctions helper pour des patterns de logging cohérents :

```javascript
import { logAction, logAuthSuccess, logApiError } from './helpers/logging.helpers.js';

// Action utilisateur
logAction(userId, 'site.create', { siteId, domain });

// Authentification réussie
logAuthSuccess(userId, email, ip, userAgent);

// Erreur API
logApiError(siteId, formId, 'validation_failed', { errors });
```

**Fichier :** `src/helpers/logging.helpers.js`

#### Stockage des logs

```
logs/
├── app.log        # Logs applicatifs généraux
├── api.log        # Requêtes API publiques uniquement
├── error.log      # Erreurs de l'application
└── audit.log      # Événements de sécurité
```

#### Rétention et nettoyage

**Périodes de rétention configurables** via `.env` :

```env
LOG_RETENTION_APP=7      # 7 jours (test phase)
LOG_RETENTION_API=14     # 14 jours
LOG_RETENTION_ERROR=30   # 30 jours
LOG_RETENTION_AUDIT=90   # 90 jours
```

**Scripts de gestion** :

```bash
# Nettoyer les logs anciens selon rétention
npm run logs:clean

# Afficher statistiques des logs
npm run logs:stats
```

**Fichiers :** `scripts/clean-logs.js`, `scripts/logs-stats.js`

#### Format des logs

**Production :** JSON structuré pour parsing et analyse

```json
{
    "level": 30,
    "time": 1702566123456,
    "msg": "request completed",
    "req": { "url": "/dashboard", "method": "GET" },
    "res": { "statusCode": 200 }
}
```

**Développement :** Format lisible avec pino-pretty (configurable)

```
[2025-12-14 17:56:00.386] INFO: request completed /dashboard
```

**Configuration console** via `.env` :

```env
# Désactiver les logs console en dev
LOG_TO_CONSOLE=false
```

#### Personnalisation format console

Options dans `src/config/logger.js` (lignes 52-56) :

```javascript
options: {
    colorize: true,                              // Couleurs activées
    translateTime: 'yyyy-mm-dd HH:MM:ss.l',     // Format date
    ignore: 'pid,hostname,req,res',             // Champs cachés
    messageFormat: '{msg} {req.url}',           # Format personnalisé
    singleLine: true,                           // Tout sur une ligne
}
```

### État de la migration Pino

L'infrastructure Pino est **en place** et la migration des controllers est quasi terminée.

- [x] Remplacer `console.log()` par `logger.info()`
- [x] Remplacer les `console.error()` dans `dashboard.controller.js`
- [ ] Remplacer le dernier `console.error()` dans `site.controller.js`
- [x] Utiliser les helpers dans controllers (`logAction`, `logAuthSuccess`, etc.)
- [ ] Créer interface admin pour visualiser les logs

### Événements à logger (sécurité)

| Événement                  | Niveau | Informations                 |
| -------------------------- | ------ | ---------------------------- |
| Login réussi               | info   | userId, IP, timestamp        |
| Login échoué               | warn   | email, IP, raison            |
| Tentatives multiples       | error  | IP, nombre de tentatives     |
| Création d'utilisateur     | info   | userId créé, par qui         |
| Changement de mot de passe | info   | userId, IP                   |
| Révocation de token        | warn   | siteId, formId, userId       |
| Upload de fichier          | info   | userId, filename, size, type |
| Fichier rejeté             | warn   | userId, filename, raison     |
| Suppression de données     | warn   | entity, entityId, userId     |
| Erreur 403 Forbidden       | warn   | userId, route, raison        |
| Erreur 500                 | error  | stack trace, route, userId   |

---

## Gestion des erreurs critiques

### Graceful Shutdown

Le serveur gère proprement les exceptions non capturées et les promesses rejetées :

```javascript
// server.js
function shutdownAndExit(error) {
    logger.error(error, 'Critical error - initiating graceful shutdown');
    server.close(() => {
        models.sequelize.close().then(() => {
            logger.info('Database connection closed');
            process.exit(1);
        });
    });
    setTimeout(() => process.exit(1), 5000); // Force kill après 5s
}

process.on('uncaughtException', (err) => shutdownAndExit(err));
process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    shutdownAndExit(error);
});
```

**Protection contre :**

- ✅ Crash silencieux sans log
- ✅ Connexions DB laissées ouvertes
- ✅ Requêtes en cours non terminées

### Masquage des erreurs serveur

Les messages d'erreur internes ne sont **jamais** exposés aux utilisateurs :

```javascript
// ✅ Réponse API - message générique
res.status(500).json({ error: 'Internal server error' });

// Log interne avec détails complets (Pino)
apiLogger.error({ err, siteId, formId }, 'Handler error');
```

**Fichiers :** `src/api/v1/handlers/`, `src/api/v1/middlewares/authApiKeyAccess.js`

---

## Reporter une vulnérabilité

### Divulgation responsable

Si vous découvrez une vulnérabilité de sécurité dans Puna, merci de nous la signaler de manière responsable.

### Comment signaler

**NE PAS** créer d'issue publique sur GitHub pour les vulnérabilités de sécurité.

**Procédure recommandée - GitHub Private Vulnerability Reporting :**

1. Aller sur l'onglet **Security** du dépôt GitHub
2. Cliquer sur **"Report a vulnerability"** (signalement privé)
3. Remplir le formulaire avec :
    - Description détaillée de la vulnérabilité
    - Étapes pour reproduire
    - Impact potentiel
    - Version affectée
    - Preuve de concept (si applicable)

Ce mécanisme est entièrement privé - seuls les mainteneurs du projet peuvent voir le rapport jusqu'à la publication du correctif.

**Alternative :** contact direct via les informations de profil GitHub du mainteneur.

### Délai de réponse

- **24-48h** : Confirmation de réception
- **7 jours** : Évaluation initiale et priorité
- **30 jours** : Correction et publication du patch

### Reconnaissance

Les chercheurs en sécurité qui signalent des vulnérabilités de manière responsable seront crédités dans :

- Le fichier `SECURITY.md`
- Les notes de version (CHANGELOG)
- Un "Hall of Fame" (optionnel)

---

## Checklist de sécurité

### Développement

- [x] Toutes les entrées utilisateur sont validées (XSS, SQL, path traversal)
- [x] Aucun secret en dur dans le code
- [x] `.env` dans `.gitignore`
- [x] Permissions vérifiées sur chaque route (RBAC)
- [x] Protection CSRF sur toutes les routes web
- [x] Rate limiting sur login et API
- [x] Graceful shutdown (uncaughtException/unhandledRejection)
- [x] Messages d'erreur masqués (pas de fuite d'info)
- [ ] Tests de régression après modifications

### Avant mise en production

- [ ] Changer **tous** les secrets (KEY_TK, KEV, KIV, SESSION_SECRET, CSRF_SECRET)
- [ ] Activer HTTPS (certificat SSL/TLS)
- [ ] `NODE_ENV=production` dans `.env`
- [ ] `HELMET_STRICT_TRANSPORT=true` dans `.env`
- [ ] Configurer le reverse proxy (Nginx, Apache)
- [x] Rate limiting activé
- [x] Logs de sécurité configurés (Pino structuré)
- [ ] Backups automatiques configurés
- [ ] Monitoring des erreurs (Sentry, etc.)
- [ ] Tester sur securityheaders.com
- [ ] Audit de sécurité (npm audit, Snyk)
- [x] Intégrer ClamAV pour scan antivirus des uploads
- [x] Externaliser la clé API (variable d'environnement `API_KEY`)

### Maintenance continue

- [ ] Mettre à jour les dépendances régulièrement
- [ ] Surveiller les CVE (Common Vulnerabilities and Exposures)
- [ ] Rotation des clés/secrets tous les 6 mois
- [ ] Revue des logs de sécurité (hebdomadaire)
- [ ] Tests de pénétration (annuel)
- [ ] Formation sécurité de l'équipe

---

## Ressources

### Standards de sécurité

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

### Tests en ligne

- [Security Headers](https://securityheaders.com/) - Scanner les headers HTTP
- [Mozilla Observatory](https://observatory.mozilla.org/) - Audit complet
- [SSL Labs](https://www.ssllabs.com/ssltest/) - Test SSL/TLS

---

## Historique des changements

| Date       | Version | Changements                                                                                                                       |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 2025-12-13 | 1.0     | Création initiale de SECURITY.md                                                                                                  |
| 2025-12-13 | 1.1     | Ajout Helmet.js configuration                                                                                                     |
| 2026-02-09 | 2.0     | Ajout CSRF (csrf-csrf), rate limiting, path traversal renforcé, SQL injection protection, graceful shutdown, masquage err.message |
| 2026-04-06 | 2.1     | Migration crypto-js → node:crypto, correction payload JWT, mise à jour checklist, GitHub Private Vulnerability Reporting          |

---

**Dernière mise à jour :** 6 avril 2026

**Contact sécurité :** Onglet Security du dépôt GitHub → "Report a vulnerability"
