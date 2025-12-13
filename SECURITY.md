# Politique de Sécurité - Puna

Ce document décrit les mesures de sécurité mises en place dans Puna, ainsi que les bonnes pratiques à suivre pour maintenir un haut niveau de protection.

---

## 📋 Table des matières

- [Vue d'ensemble](#-vue-densemble)
- [Authentification](#-authentification--sessions)
- [Autorisation & Permissions](#-autorisation--permissions)
- [Sécurité HTTP (Helmet.js)](#-sécurité-http-helmetjs)
- [Upload de fichiers](#-upload-de-fichiers)
- [Protection contre les injections](#-protection-contre-les-injections)
- [Gestion des secrets](#-gestion-des-secrets)
- [Rate Limiting](#-rate-limiting)
- [Audit & Logs](#-audit--logs)
- [Reporter une vulnérabilité](#-reporter-une-vulnérabilité)
- [Checklist de sécurité](#-checklist-de-sécurité)

---

## 🎯 Vue d'ensemble

Puna implémente une approche de sécurité **multi-couches** pour protéger les données des utilisateurs et prévenir les vulnérabilités courantes (OWASP Top 10).

### Principes de sécurité appliqués

- ✅ **Défense en profondeur** - Plusieurs couches de protection
- ✅ **Moindre privilège** - Permissions minimales par défaut
- ✅ **Validation stricte** - Toutes les entrées sont validées
- ✅ **Chiffrement** - Données sensibles chiffrées
- ✅ **Isolation** - Séparation API publique / routes authentifiées

### Technologies de sécurité

| Technologie | Usage | Version |
|-------------|-------|---------|
| **bcrypt** | Hachage des mots de passe | ^6.0.0 |
| **jsonwebtoken** | Tokens API JWT | ^9.0.2 |
| **helmet** | Headers HTTP sécurisés | ^8.1.0 |
| **xss** | Sanitization XSS | ^1.0.15 |
| **sanitize-filename** | Validation noms de fichiers | ^1.6.3 |
| **sequelize** | ORM (prévention SQL injection) | ^6.37.7 |
| **crypto-js** | Chiffrement AES | ^4.2.0 |

---

## 🔐 Authentification & Sessions

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
- ✅ Rainbow tables
- ✅ Brute force (salt unique par utilisateur)
- ✅ Stockage en clair

### Tokens JWT (API publique)

Les API publiques (`/send/:code`) utilisent des **tokens JWT** pour l'authentification.

**Caractéristiques :**
- Signature HMAC SHA-256
- Expiration configurable
- Payload minimal (ID site, ID formulaire)
- Clé secrète dans `.env` (`KEY_TK`)

**Génération :**
```javascript
import jwt from 'jsonwebtoken';
const token = jwt.sign(
    { siteId, formId },
    process.env.KEY_TK,
    { expiresIn: '365d' }
);
```

**Validation :**
- Middleware `authApiKeyAccess` vérifie la signature
- Token invalide → 401 Unauthorized
- Token expiré → 401 Unauthorized

### Sessions Express (routes web)

Les routes authentifiées (`/dashboard`, `/admin`, etc.) utilisent des **sessions** stockées en MySQL.

**Configuration :**
```javascript
import session from 'express-session';
import MySQLStoreConstructor from 'express-mysql-session';

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // true en production avec HTTPS
        httpOnly: true, // Prévient XSS
        maxAge: 43200000 // 12 heures
    },
    store: mysqlStore // Persistance en base
}));
```

**Protection contre :**
- ✅ Session fixation (cookie régénéré à chaque login)
- ✅ Session hijacking (httpOnly cookie)
- ✅ CSRF (validation à implémenter)

### Première connexion obligatoire

Lors de la création d'un compte, l'utilisateur **doit** se connecter avec son mot de passe temporaire et le changer.

**Workflow :**
1. Admin crée un utilisateur → mot de passe temporaire généré
2. Utilisateur reçoit ses identifiants
3. Première connexion → redirection forcée vers changement de mot de passe
4. Nouveau mot de passe défini → accès complet au système

**Fichier :** `src/helpers/init_admin_user.js`

---

## 🛡️ Autorisation & Permissions

### Système ACL (Access Control List)

Puna implémente un système d'autorisation **granulaire** avec 5 rôles et des permissions par entité.

### Hiérarchie des rôles

| Rôle | Niveau | Description |
|------|--------|-------------|
| `super_admin` | 5 | Accès total (admin utilisateurs, paramètres) |
| `owner` | 4 | Propriétaire de sites, gestion utilisateurs |
| `beta` | 3 | Testeur beta avec privilèges étendus |
| `editor` | 2 | Édition de contenu |
| `viewer` | 1 | Lecture seule |

### Permissions par entité

Les permissions sont vérifiées sur 4 entités principales :

| Entité | Actions | Description |
|--------|---------|-------------|
| **site** | create, read, update, delete | Gestion des sites |
| **form** | create, read, update, delete | Gestion des formulaires |
| **inbox** | read, delete | Consultation/suppression des soumissions |
| **user** | manage | Administration des utilisateurs |

### Middlewares de protection

#### `roleAccess` - Vérification du rôle

```javascript
// Route accessible uniquement par super_admin et owner
router.get(
    '/admin/users',
    isConnected,
    roleAccess(['super_admin', 'owner']),
    adminCtl.adminUsers
);
```

**Fichier :** `src/middlewares/checkAccess.js`

#### `actionAccess` - Vérification des permissions

```javascript
// Route nécessitant permission 'read' sur 'form'
router.get(
    '/form/:id/inbox',
    isConnected,
    actionAccess('form', 'read'),
    formCtl.getFormInbox
);
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
    <a href="/admin">Administration</a>
{{/roleIs}}
```

**Fichier :** `src/helpers/hbs_fn.js`

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

## 🌐 Sécurité HTTP (Helmet.js)

Helmet.js configure automatiquement les **headers HTTP de sécurité** pour protéger contre les vulnérabilités web courantes.

### Configuration hybride

**Routes API publiques** (`/api/*`, `/send/*`) → **Helmet léger**
- CSP désactivé (ne bloque pas les appels cross-origin)
- Headers sécurisés mais non restrictifs

**Routes web authentifiées** (`/dashboard`, `/admin`, etc.) → **Helmet complet**
- Content Security Policy (CSP) strict
- Protection contre XSS, clickjacking, etc.

### Headers configurés

| Header | Valeur | Protection |
|--------|--------|-----------|
| `X-Content-Type-Options` | nosniff | Force le respect du Content-Type |
| `X-Frame-Options` | DENY | Empêche l'intégration en iframe (clickjacking) |
| `X-XSS-Protection` | 0 | Désactivé (CSP fait le job) |
| `Content-Security-Policy` | [voir ci-dessous] | Limite les sources de contenu |
| `Strict-Transport-Security` | max-age=31536000 | Force HTTPS (prod uniquement) |

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

**Note :** `'unsafe-inline'` est nécessaire pour Tailwind CSS et certains composants. À terme, migration vers nonces CSP recommandée.

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

## 📤 Upload de fichiers

L'upload de fichiers est **hautement sécurisé** avec validation multi-niveaux.

### Configuration Multer

```javascript
import multer from 'multer';

const upload = multer({
    dest: 'storage/tmp/',           // Dossier temporaire
    limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB par fichier
        files: 10                    // Max 10 fichiers
    }
});
```

### Validation des fichiers

#### 1. Types autorisés (whitelist)

Extensions validées :
```javascript
const ALLOWED_EXTENSIONS = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',  // Images
    'pdf', 'doc', 'docx', 'xls', 'xlsx',         // Documents
    'txt', 'csv',                                 // Texte
    'zip', 'rar', '7z'                            // Archives
];
```

**Validation :**
- Extension dans la whitelist
- Content-Type du header HTTP
- Magic bytes du fichier (avec `file-type`)

**Fichier :** `src/api/v1/middlewares/validateUpload.js`

#### 2. Inspection des archives ZIP

Les archives ZIP sont **inspectées** avant acceptation :

```javascript
// Vérification du contenu de l'archive
import StreamZip from 'node-stream-zip';

const zip = new StreamZip.async({ file: zipPath });
const entries = await zip.entries();

for (const entry of Object.values(entries)) {
    // Vérifier que chaque fichier dans le ZIP est autorisé
    if (!isAllowedExtension(entry.name)) {
        throw new Error('Archive contains forbidden file type');
    }
}
```

**Protection contre :**
- ✅ Zip bombs
- ✅ Path traversal (`../../../etc/passwd`)
- ✅ Fichiers exécutables cachés

**Fichier :** `src/api/v1/middlewares/inspectArchive.js`

#### 3. Sanitization des noms de fichiers

```javascript
import sanitize from 'sanitize-filename';

const safeName = sanitize(originalName);
// "../../etc/passwd" → "etc-passwd"
// "<script>alert('xss')</script>.jpg" → "scriptalertxssscript.jpg"
```

**Protection contre :**
- ✅ Path traversal
- ✅ XSS dans les noms de fichiers
- ✅ Caractères spéciaux problématiques

#### 4. Stockage sécurisé

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
Upload → Validation → Inspection → Déplacement → BDD
  ↓          ↓           ↓             ↓           ↓
Multer → validateUpload → inspectArchive → moveFiles → saveInbox
```

**Fichiers :**
- `src/api/v1/middlewares/multipartUpload.js`
- `src/api/v1/middlewares/validateUpload.js`
- `src/api/v1/middlewares/inspectArchive.js`
- `src/api/v1/middlewares/moveFilesToUploads.js`

---

## 💉 Protection contre les injections

### SQL Injection

**Sequelize ORM** est utilisé pour **toutes** les requêtes en base de données, ce qui prévient automatiquement les injections SQL.

```javascript
// ✅ SÉCURISÉ - Paramètres échappés par Sequelize
const user = await models.User.findOne({
    where: { email: userInput }
});

// ❌ DANGEREUX - Requête SQL brute (à éviter)
const user = await sequelize.query(
    `SELECT * FROM users WHERE email = '${userInput}'`
);
```

**Bonnes pratiques :**
- ✅ Toujours utiliser les méthodes Sequelize (`findOne`, `create`, etc.)
- ✅ Si requête brute nécessaire, utiliser les paramètres `replacements`
- ✅ Valider les entrées utilisateur avant requête

**Fichiers :** Tous les fichiers dans `src/models/`, `src/services/`

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
scriptSrc: ["'self'", "cdn.jsdelivr.net"]  // Seuls ces domaines autorisés
```

#### Échappement Handlebars

Les templates Handlebars échappent automatiquement les variables :

```handlebars
{{!-- ✅ Échappé automatiquement --}}
<p>{{userInput}}</p>

{{!-- ❌ Non échappé (à utiliser avec précaution) --}}
<p>{{{userInput}}}</p>
```

### Path Traversal

**Sanitization des chemins de fichiers** avec `sanitize-filename` :

```javascript
import sanitize from 'sanitize-filename';

// Empêche "../../../etc/passwd"
const safePath = sanitize(userInput);
```

**Protection supplémentaire :**
- Validation que le fichier est bien dans `storage/uploads/`
- Vérification de l'existence avec `fs.existsSync`
- Résolution des chemins avec `path.resolve`

**Fichiers :**
- `src/helpers/file.helpers.js`
- `src/controllers/inbox.controller.js`

---

## 🔑 Gestion des secrets

### Variables d'environnement

**Tous les secrets** sont stockés dans le fichier `.env` (non versionné dans Git).

```env
# Tokens & Clés
KEY_TK="your_secure_key_tk_here"           # JWT signing key
KEV="your_secure_encryption_key_here"     # AES encryption key
KIV="your_secure_initialization_vector"   # AES IV

# Session
SESSION_SECRET="your_secure_session_key"

# Base de données
DB_USER="root"
DB_PWD="your_password"
```

### Chiffrement AES (crypto-js)

Les données sensibles peuvent être chiffrées avec AES-256 :

```javascript
import CryptoJS from 'crypto-js';

// Chiffrement
const encrypted = CryptoJS.AES.encrypt(
    data,
    CryptoJS.enc.Utf8.parse(process.env.KEV),
    { iv: CryptoJS.enc.Utf8.parse(process.env.KIV) }
);

// Déchiffrement
const decrypted = CryptoJS.AES.decrypt(
    encrypted,
    CryptoJS.enc.Utf8.parse(process.env.KEV),
    { iv: CryptoJS.enc.Utf8.parse(process.env.KIV) }
);
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

---

## 🚦 Rate Limiting

### ⚠️ À implémenter

Le rate limiting n'est **pas encore** implémenté dans Puna. C'est une priorité haute.

### Plan d'implémentation

**Package recommandé :** `express-rate-limit`

```javascript
import rateLimit from 'express-rate-limit';

// Rate limiter pour routes sensibles
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,                    // 5 tentatives max
    message: 'Trop de tentatives, réessayez plus tard'
});

// Appliquer sur login
app.post('/dp-connect', authLimiter, authCtl.dpConnect);

// Rate limiter pour API publique
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,       // 1 minute
    max: 60,                   // 60 requêtes/min
    keyGenerator: (req) => req.headers['x-api-key'] || req.ip
});

app.use('/api', apiLimiter);
```

### Routes prioritaires

1. **Login** (`/dp-connect`) → 5 tentatives / 15 min
2. **Création de compte** → 3 tentatives / heure
3. **API publique** (`/send/:code`) → 60 requêtes / min
4. **Exports** (Excel, CSV, ZIP) → 10 requêtes / 5 min

### Stockage recommandé

- **Développement :** Mémoire (par défaut)
- **Production :** Redis (partagé entre instances)

---

## 📊 Audit & Logs

### Logs actuels

**Console-stamp** : Horodatage des logs console

```javascript
import consoleStamp from 'console-stamp';

consoleStamp(console, {
    format: ':date(yyyy-mm-dd HH:MM:ss.l)'
});
```

**Morgan** : Logs HTTP (accès, requêtes)

```javascript
import morgan from 'morgan';

app.use(morgan('combined', {
    skip: (req) => req.url.includes('/css') || req.url.includes('/js')
}));
```

### ⚠️ À améliorer avec Pino

Migration vers **Pino** recommandée pour :
- ✅ Logs structurés (JSON)
- ✅ Rotation automatique
- ✅ Niveaux de logs (trace, debug, info, warn, error, fatal)
- ✅ Performance supérieure
- ✅ Interface admin pour visualisation

**Voir TODO.md pour plan détaillé**

### Événements à logger (sécurité)

| Événement | Niveau | Informations |
|-----------|--------|--------------|
| Login réussi | info | userId, IP, timestamp |
| Login échoué | warn | email, IP, raison |
| Tentatives multiples | error | IP, nombre de tentatives |
| Création d'utilisateur | info | userId créé, par qui |
| Changement de mot de passe | info | userId, IP |
| Révocation de token | warn | siteId, formId, userId |
| Upload de fichier | info | userId, filename, size, type |
| Fichier rejeté | warn | userId, filename, raison |
| Suppression de données | warn | entity, entityId, userId |
| Erreur 403 Forbidden | warn | userId, route, raison |
| Erreur 500 | error | stack trace, route, userId |

---

## 🐛 Reporter une vulnérabilité

### Divulgation responsable

Si vous découvrez une vulnérabilité de sécurité dans Puna, merci de nous la signaler de manière responsable.

### Comment signaler

**NE PAS** créer d'issue publique sur GitHub pour les vulnérabilités de sécurité.

**Procédure :**

1. **Email :** Envoyez un email à **security@puna.io** (à créer)
2. **Objet :** "Security Vulnerability Report - [TITRE COURT]"
3. **Contenu :**
   - Description détaillée de la vulnérabilité
   - Étapes pour reproduire
   - Impact potentiel
   - Version affectée
   - Preuve de concept (si applicable)

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

## ✅ Checklist de sécurité

### Développement

- [ ] Toutes les entrées utilisateur sont validées
- [ ] Aucun secret en dur dans le code
- [ ] `.env` dans `.gitignore`
- [ ] Permissions vérifiées sur chaque route
- [ ] Tests de régression après modifications

### Avant mise en production

- [ ] Changer **tous** les secrets (KEY_TK, KEV, KIV, SESSION_SECRET)
- [ ] Activer HTTPS (certificat SSL/TLS)
- [ ] `NODE_ENV=production` dans `.env`
- [ ] `HELMET_STRICT_TRANSPORT=true` dans `.env`
- [ ] Configurer le reverse proxy (Nginx, Apache)
- [ ] Rate limiting activé
- [ ] Logs de sécurité configurés
- [ ] Backups automatiques configurés
- [ ] Monitoring des erreurs (Sentry, etc.)
- [ ] Tester sur securityheaders.com
- [ ] Audit de sécurité (npm audit, Snyk)

### Maintenance continue

- [ ] Mettre à jour les dépendances régulièrement
- [ ] Surveiller les CVE (Common Vulnerabilities and Exposures)
- [ ] Rotation des clés/secrets tous les 6 mois
- [ ] Revue des logs de sécurité (hebdomadaire)
- [ ] Tests de pénétration (annuel)
- [ ] Formation sécurité de l'équipe

---

## 📚 Ressources

### Standards de sécurité

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

### Outils d'audit

```bash
# Audit des dépendances npm
npm audit

# Scan avec Snyk
npx snyk test

# Headers de sécurité
curl -I https://yourdomain.com | grep -E "X-|Content-Security"
```

### Tests en ligne

- [Security Headers](https://securityheaders.com/) - Scanner les headers HTTP
- [Mozilla Observatory](https://observatory.mozilla.org/) - Audit complet
- [SSL Labs](https://www.ssllabs.com/ssltest/) - Test SSL/TLS

---

## 📝 Historique des changements

| Date | Version | Changements |
|------|---------|-------------|
| 2025-12-13 | 1.0 | Création initiale de SECURITY.md |
| 2025-12-13 | 1.1 | Ajout Helmet.js configuration |

---

**Dernière mise à jour :** 13 décembre 2025
**Contact sécurité :** security@puna.io (à créer)

---

Pour toute question sur la sécurité de Puna, consultez également :
- [README.md](README.md) - Documentation générale
- [TODO.md](TODO.md) - Roadmap des améliorations de sécurité
- [HELMET_INTEGRATION_TODO.md](HELMET_INTEGRATION_TODO.md) - Détails Helmet.js
