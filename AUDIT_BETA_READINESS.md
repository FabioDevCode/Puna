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

## 🔴 Corrections BLOQUANTES restantes

### 1. Clé API statique en dur

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

### 2. Pas de protection CSRF

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

> **Oui, le projet peut partir en beta après correction des 2 points bloquants restants + intégration ClamAV.**

Des 7 corrections bloquantes identifiées, **5 sont déjà implémentées** :

- ✅ Désactivation `multipleStatements`
- ✅ Sécurisation filtres SQL inbox
- ✅ Protection path traversal
- ✅ Masquage `err.message`
- ✅ Crash handlers avec Pino logging

Il reste à faire :

- Externaliser la clé API
- Implémenter CSRF

Les fondations sont solides. Les 2 corrections restantes (API key + CSRF) prennent ~1 heure au total.

### Checklist pré-beta

- [x] Désactiver `multipleStatements: true` dans `src/models/index.js`
- [x] Valider les clés de filtre dans `src/services/inbox.service.js`
- [x] Ajouter la protection path traversal dans `src/services/inbox.service.js`
- [x] Remplacer `err.message` par des messages génériques dans les réponses API
- [x] Ajouter les handlers `uncaughtException` / `unhandledRejection` dans `server.js`
- [ ] Externaliser la clé API dans une variable d'environnement
- [ ] Implémenter la protection CSRF pour les routes web
- [ ] Intégrer ClamAV pour l'analyse antivirus des fichiers uploadés
