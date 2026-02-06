# 🔍 Audit de maturité — Puna Beta Readiness

> **Date** : 7 février 2026
> **Version analysée** : 0.0.1
> **Objectif** : Évaluer si le projet est prêt pour une mise en ligne beta avec des usagers réels

---

## 🟢 Ce qui est déjà très bien fait

| Domaine                | Détails                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| **Architecture**       | Structure MVC propre, séparation services/controllers/middlewares/modèles, Express 5        |
| **Authentification**   | Passport + bcrypt, sessions MySQL, sérialisation propre, `isConnected` systématique         |
| **RBAC**               | Matrice de permissions complète (`actionAccess`, `roleAccess`), 5 rôles bien définis        |
| **Rate limiting**      | Login (5 req/15min), first-login (3 req/15min), API (configurable par env)                  |
| **Helmet**             | CSP configuré, HSTS conditionnel, séparation config web/API                                 |
| **Sanitization XSS**   | Middleware global avec `xss`, récursif sur body/query/params                                |
| **Validation uploads** | Vérification magic bytes (PDF, PNG, JPEG, etc.), anti-spoofing d'extension, `file-type`     |
| **Anti zip-bomb**      | Ratio compression, taille max, nombre d'entrées, détection path traversal dans les archives |
| **Sécurité archives**  | Rejet exécutables, détection macros VBA, scan JS dans les PDF                               |
| **Logging**            | Pino structuré (app/api/error/audit), rotation quotidienne avec archivage tar.gz            |
| **Env validation**     | Validation complète au démarrage, vérification longueur des clés, alertes production        |
| **Audit trail**        | Login/logout/échecs/rate-limit loggés avec IP + user-agent                                  |

---

## 🔴 Corrections BLOQUANTES avant mise en beta

### 1. Injection SQL — `multipleStatements: true`

**Fichier** : `src/models/index.js` (ligne 16)

```js
dialectOptions: {
    multipleStatements: true,
}
```

**Risque** : Permet les stacked queries et amplifie massivement tout risque d'injection SQL.

**Correction** : Supprimer `multipleStatements: true` sauf besoin spécifique documenté.

---

### 2. Injection SQL dans les filtres inbox

**Fichier** : `src/services/inbox.service.js` (ligne ~288)

```js
Sequelize.literal(`'$.${key}'`);
```

**Risque** : La clé `key` provient des filtres utilisateur et est injectée directement dans un `Sequelize.literal()` — c'est une **injection SQL**.

**Correction** : Valider que `key` ne contient que `[a-zA-Z0-9_]` avant de l'utiliser.

```js
// Exemple de validation
const SAFE_KEY_REGEX = /^[a-zA-Z0-9_]+$/;
if (!SAFE_KEY_REGEX.test(key)) {
    continue; // Ignorer les clés invalides
}
```

---

### 3. Path traversal dans le téléchargement de fichiers

**Fichier** : `src/services/inbox.service.js` (lignes 488 et 595)

```js
const filePath = path.join(uploadDir, filename);
```

**Risque** : Le `filename` n'est pas vérifié contre les traversées de chemin (`../../etc/passwd`).

**Correction** : Vérifier que le chemin résolu reste dans le répertoire attendu.

```js
const filePath = path.join(uploadDir, filename);
const resolvedPath = path.resolve(filePath);
if (!resolvedPath.startsWith(path.resolve(uploadDir))) {
    return { success: false, error: 'Nom de fichier invalide' };
}
```

---

### 4. Clé API statique en dur

**Fichier** : `src/api/v1/middlewares/authApiKeyAccess.js` (ligne 9)

```js
if (!apiKey || apiKey !== 'puna')
```

**Risque** : La valeur `"puna"` est codée en dur. Tout le monde peut la deviner.

**Correction** : Charger depuis une variable d'environnement + comparaison à temps constant.

```js
import crypto from 'node:crypto';

const expectedKey = process.env.API_KEY;
const isValid =
    expectedKey &&
    apiKey &&
    apiKey.length === expectedKey.length &&
    crypto.timingSafeEqual(Buffer.from(apiKey), Buffer.from(expectedKey));
```

---

### 5. Fuite de `err.message` vers le client

**Fichiers concernés** :

- `src/api/v1/handlers/default.handler.js` (ligne 25) : `error: err.message`
- `src/api/v1/middlewares/authApiKeyAccess.js` (ligne 60) : `error: err.message`

**Risque** : Fuite d'informations internes (stack traces, messages Sequelize, chemins fichiers).

**Correction** : Remplacer par un message générique et logger l'erreur côté serveur.

```js
// Avant
return res.status(500).json({ success: false, error: err.message });

// Après
logger.error(err);
return res.status(500).json({ success: false, error: 'Internal server error' });
```

---

### 6. Pas de protection CSRF

**Statut** : Confirmé absent (mentionné dans `TODO.md` et `SECURITY.md` comme à implémenter).

**Risque** : Pour une app avec formulaires POST et sessions cookie, un attaquant peut forger des requêtes depuis un site tiers.

**Correction** : Implémenter un token CSRF avec `csrf-csrf` ou équivalent.

```bash
npm install csrf-csrf
```

```js
import { doubleCsrf } from 'csrf-csrf';

const { doubleCsrfProtection, generateToken } = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET,
    cookieName: 'x-csrf-token',
    cookieOptions: { sameSite: 'lax', secure: process.env.NODE_ENV === 'production' },
});

// Appliquer aux routes web (pas API)
app.use(doubleCsrfProtection);
```

---

### 7. Pas de gestion `uncaughtException` / `unhandledRejection`

**Fichier** : `server.js`

**Risque** : Un crash silencieux en production = interruption de service sans trace.

**Correction** :

```js
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION:', reason);
    process.exit(1);
});
```

---

## 🟡 Corrections RECOMMANDÉES (priorité haute)

| #   | Problème                                                                                             | Fichier                                        | Impact |
| --- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------ |
| 8   | **Rate limiter API en MemoryStore** — inefficace en multi-instances                                  | `src/api/v1/middlewares/rateLimiter.js`        | Moyen  |
| 9   | **Pas de limite de profondeur** dans la sanitisation récursive → stack overflow possible             | `src/middlewares/sanitize.js`                  | Moyen  |
| 10  | **Pas de validation de taille du payload JSON** avant insertion inbox (champ `LONGTEXT` sans limite) | `src/api/v1/handlers/default.handler.js`       | Moyen  |
| 11  | **Pas de limite sur les clés du template** — un attaquant peut créer des milliers de colonnes        | `src/api/v1/middlewares/updateFormTemplate.js` | Moyen  |
| 12  | **`multer.any()`** accepte tous les fieldnames                                                       | `src/api/v1/middlewares/multipartUpload.js`    | Moyen  |
| 13  | **Pas de `fileFilter`** dans multer → les fichiers sont écrits sur disque avant validation           | `src/api/v1/middlewares/multipartUpload.js`    | Bas    |
| 14  | **Pas de cron de nettoyage** du dossier `storage/tmp` (fichiers orphelins)                           | —                                              | Bas    |
| 15  | **Pas de page 404/500 personnalisée** pour les routes non trouvées                                   | `src/app.js`                                   | Bas    |

---

## 📊 Score par domaine

| Domaine                      | Note    | Commentaire                                             |
| ---------------------------- | ------- | ------------------------------------------------------- |
| Architecture & Structure     | 🟢 9/10 | Excellente organisation                                 |
| Authentification & Sessions  | 🟢 8/10 | Solide, bien implémentée                                |
| RBAC & Contrôle d'accès      | 🟢 8/10 | Matrice complète et fonctionnelle                       |
| Upload & Validation fichiers | 🟢 8/10 | Magic bytes, anti-spoofing, zip-bomb                    |
| Sanitization XSS             | 🟡 7/10 | Bonne base, manque limite de profondeur                 |
| Protection injection SQL     | 🔴 3/10 | `multipleStatements` + `Sequelize.literal()` non validé |
| Protection path traversal    | 🔴 4/10 | Pas de validation dans `verifyFileAccessAndGetPath`     |
| Gestion d'erreurs            | 🟡 5/10 | Fuites `err.message`, pas de crash handlers             |
| CSRF                         | 🔴 0/10 | Non implémenté                                          |
| Logging & Audit              | 🟢 8/10 | Pino structuré, rotation, audit trail                   |
| Rate Limiting                | 🟡 6/10 | Fonctionnel en mono-instance seulement                  |

---

## ✅ Verdict

> **Oui, le projet peut partir en beta après correction des 7 points bloquants + intégration ClamAV.**

Les fondations sont solides et sérieuses. Les corrections 1 à 5 sont rapides (quelques heures).
Les corrections 6 (CSRF) et 7 (crash handlers) prendront un peu plus de temps mais restent raisonnables.

### Checklist pré-beta

- [ ] Désactiver `multipleStatements: true` dans `src/models/index.js`
- [ ] Valider les clés de filtre dans `src/services/inbox.service.js`
- [ ] Ajouter la protection path traversal dans `src/services/inbox.service.js`
- [ ] Externaliser la clé API dans une variable d'environnement
- [ ] Remplacer `err.message` par des messages génériques dans les réponses API
- [ ] Implémenter la protection CSRF pour les routes web
- [ ] Ajouter les handlers `uncaughtException` / `unhandledRejection`
- [ ] Intégrer ClamAV pour l'analyse antivirus des fichiers uploadés
