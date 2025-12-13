# TODO: Intégration Helmet.js - Sécurité HTTP Headers

## 📋 Contexte

Helmet.js configure automatiquement plusieurs headers HTTP de sécurité pour protéger l'application contre les vulnérabilités courantes (XSS, clickjacking, etc.).

**Architecture hybride :**
- Routes API (`/api`, `/send`) → Helmet **léger** (pas de CSP strict)
- Routes Web authentifiées → Helmet **complet** (avec CSP)

## 🎯 Objectifs

✅ Protéger le dashboard/admin contre XSS, clickjacking, etc.
✅ Garder les API publiques fonctionnelles (tokens JWT, CORS)
✅ Sécuriser les headers HTTPS (HSTS) en production
✅ Configuration adaptée aux CDN externes (TailwindCSS, FontAwesome)

---

## ✅ TODO List

### Phase 1: Configuration Helmet

#### 1.1 Créer le fichier de configuration

- [ ] **Créer `src/config/helmet.config.js`**
  ```javascript
  import helmet from 'helmet';

  /**
   * Configuration Helmet pour les routes WEB authentifiées
   * Protection complète avec CSP
   */
  export const webHelmet = helmet({
      contentSecurityPolicy: {
          directives: {
              defaultSrc: ["'self'"],
              scriptSrc: [
                  "'self'",
                  "'unsafe-inline'", // Nécessaire pour scripts inline (à minimiser en prod)
                  "cdn.jsdelivr.net", // TailwindCSS/DaisyUI
                  "cdnjs.cloudflare.com", // Font Awesome
              ],
              styleSrc: [
                  "'self'",
                  "'unsafe-inline'", // Nécessaire pour Tailwind et styles inline
                  "cdn.jsdelivr.net",
                  "cdnjs.cloudflare.com",
              ],
              imgSrc: [
                  "'self'",
                  "data:", // Pour images base64
                  "blob:", // Pour images générées
              ],
              connectSrc: ["'self'"], // API calls vers le même domaine
              fontSrc: [
                  "'self'",
                  "cdnjs.cloudflare.com",
                  "data:",
              ],
              frameSrc: ["'none'"], // Pas d'iframes
              objectSrc: ["'none'"], // Pas d'objets/embeds
              upgradeInsecureRequests: [], // Force HTTPS en production
          },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      strictTransportSecurity: {
          maxAge: 31536000, // 1 an
          includeSubDomains: true,
          preload: true,
      },
  });

  /**
   * Configuration Helmet pour les routes API publiques
   * Protection légère sans CSP strict
   */
  export const apiHelmet = helmet({
      contentSecurityPolicy: false, // Désactiver CSP pour API
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      strictTransportSecurity: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
      },
  });

  /**
   * Middleware conditionnel pour appliquer le bon helmet
   */
  export const helmetMiddleware = (req, res, next) => {
      // Routes API : helmet léger
      if (req.path.startsWith('/api') || req.path.startsWith('/send')) {
          return apiHelmet(req, res, next);
      }
      // Routes web : helmet complet
      webHelmet(req, res, next);
  };
  ```

### Phase 2: Intégration dans l'application

#### 2.1 Modifier `src/app.js`

- [ ] **Importer la configuration Helmet**
  ```javascript
  import { helmetMiddleware } from './config/helmet.config.js';
  ```

- [ ] **Appliquer Helmet AVANT les autres middlewares**
  ```javascript
  // Sécurité HTTP headers (doit être en premier)
  app.use(helmetMiddleware);

  // Trust proxy (si derrière reverse proxy)
  app.set('trust proxy', 1);

  // Puis les autres middlewares...
  app.use(express.json());
  // etc.
  ```

- [ ] **Position recommandée :** Juste après la création de l'app Express, avant tout autre middleware

#### 2.2 Configurer CORS pour les API publiques (si nécessaire)

- [ ] **Vérifier si CORS est déjà configuré**
  - Chercher `cors` dans app.js
  - Si oui, s'assurer qu'il est appliqué sur `/api` et `/send`

- [ ] **Si CORS manque ET que des clients externes appellent l'API :**
  ```javascript
  import cors from 'cors';

  // CORS pour routes API/Send uniquement
  app.use('/api', cors({
      origin: true, // Accepter tous les domaines (ou liste spécifique)
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  app.use('/send', cors({
      origin: true,
      credentials: true,
  }));
  ```

### Phase 3: Configuration environnement

#### 3.1 Ajouter variables d'environnement

- [ ] **Ajouter dans `.env`**
  ```env
  # Helmet / Sécurité
  NODE_ENV=development
  HELMET_STRICT_TRANSPORT=false  # true en production uniquement
  ```

- [ ] **Ajouter dans `.env.example`**
  ```env
  # Helmet / Sécurité
  NODE_ENV=development
  HELMET_STRICT_TRANSPORT=false  # Activer en production avec HTTPS
  ```

- [ ] **Modifier helmet.config.js pour utiliser les variables**
  ```javascript
  const isDevelopment = process.env.NODE_ENV === 'development';
  const enableHSTS = process.env.HELMET_STRICT_TRANSPORT === 'true';

  // Dans webHelmet et apiHelmet
  strictTransportSecurity: enableHSTS ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
  } : false, // Désactiver HSTS en dev (pas de HTTPS local)
  ```

### Phase 4: Tests et Validation

#### 4.1 Tests manuels

- [ ] **Démarrer l'application**
  ```bash
  npm run dev
  ```

- [ ] **Tester les routes WEB authentifiées**
  - [ ] Se connecter au dashboard
  - [ ] Vérifier que les pages se chargent normalement
  - [ ] Vérifier que TailwindCSS/DaisyUI fonctionne
  - [ ] Vérifier que Font Awesome s'affiche
  - [ ] Ouvrir DevTools → Réseau → Vérifier les headers de réponse

- [ ] **Tester les routes API**
  - [ ] Tester un appel API authentifié (avec token JWT)
  - [ ] Vérifier que le token fonctionne
  - [ ] Tester `/send` avec un formulaire externe

- [ ] **Vérifier les headers de sécurité**
  ```bash
  # Tester une page web
  curl -I http://localhost:3000/dashboard

  # Tester une route API
  curl -I http://localhost:3000/api/v1/test
  ```

  Headers attendus :
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY` (pages web uniquement)
  - `X-XSS-Protection: 0` (désactivé car CSP fait le job)
  - `Content-Security-Policy: ...` (pages web uniquement)
  - `Strict-Transport-Security: ...` (si HTTPS)

#### 4.2 Tests avec navigateur

- [ ] **Chrome DevTools**
  - [ ] Onglet Security → Vérifier les certificats HTTPS (en prod)
  - [ ] Onglet Console → Vérifier qu'il n'y a pas d'erreurs CSP
  - [ ] Onglet Network → Vérifier les headers de réponse

- [ ] **Tests de sécurité en ligne**
  - [ ] [Security Headers](https://securityheaders.com/) - Scanner les headers
  - [ ] [Mozilla Observatory](https://observatory.mozilla.org/) - Audit de sécurité
  - [ ] [SSL Labs](https://www.ssllabs.com/ssltest/) - Test SSL/TLS (en prod)

#### 4.3 Tests de régression

- [ ] **Fonctionnalités à tester**
  - [ ] Login/Logout
  - [ ] Création de site
  - [ ] Création de formulaire
  - [ ] Upload de fichiers
  - [ ] Téléchargement de fichiers
  - [ ] Export Excel
  - [ ] Export CSV
  - [ ] Génération de tokens
  - [ ] Révocation de tokens
  - [ ] Toutes les pages admin

### Phase 5: Optimisation CSP (Optionnel - Phase 2)

#### 5.1 Réduire `'unsafe-inline'` pour les scripts

- [ ] **Identifier les scripts inline**
  ```bash
  grep -r "<script>" src/views/
  ```

- [ ] **Options pour éliminer `'unsafe-inline'` :**
  1. Déplacer tous les scripts inline vers des fichiers externes
  2. Utiliser des nonces CSP (plus complexe)
  3. Utiliser des hashes CSP (pour scripts statiques)

- [ ] **Exemple avec nonce (avancé) :**
  ```javascript
  // Middleware pour générer nonce
  app.use((req, res, next) => {
      res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
      next();
  });

  // CSP avec nonce
  scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],

  // Dans Handlebars
  <script nonce="{{cspNonce}}">...</script>
  ```

#### 5.2 Réduire `'unsafe-inline'` pour les styles

- [ ] **Identifier les styles inline**
  ```bash
  grep -r "style=" src/views/
  ```

- [ ] **Déplacer vers classes Tailwind ou fichiers CSS**

### Phase 6: Documentation

#### 6.1 Documenter la configuration

- [ ] **Créer `docs/SECURITY.md`**
  - Expliquer la config Helmet
  - Headers de sécurité configurés
  - Pourquoi CSP désactivé sur API
  - Comment tester les headers

- [ ] **Mettre à jour README.md**
  - Section "Sécurité"
  - Mentionner Helmet.js
  - Lien vers SECURITY.md

- [ ] **Commenter le code**
  - Expliquer chaque directive CSP
  - Documenter les choix de config

#### 6.2 Créer un guide de troubleshooting

- [ ] **HELMET_TROUBLESHOOTING.md**
  - Erreurs CSP courantes
  - Comment déboguer les violations CSP
  - Console Chrome : violations CSP
  - Ajouter des sources autorisées

---

## 📝 Notes Techniques

### Headers configurés par Helmet

| Header | Fonction | Impact API |
|--------|----------|------------|
| `Content-Security-Policy` | Limite les sources de contenu (scripts, styles, etc.) | ❌ Désactivé sur API |
| `X-Content-Type-Options` | Force le respect du Content-Type | ✅ Actif partout |
| `X-Frame-Options` | Empêche l'intégration en iframe | ✅ Actif (pages web) |
| `X-XSS-Protection` | Protection XSS legacy | ✅ Actif partout |
| `Strict-Transport-Security` | Force HTTPS | ✅ Actif en prod |
| `X-Permitted-Cross-Domain-Policies` | Contrôle politiques cross-domain | ✅ Actif partout |

### CSP Directives expliquées

```javascript
defaultSrc: ["'self'"]           // Par défaut, uniquement même origine
scriptSrc: [...]                 // Sources autorisées pour <script>
styleSrc: [...]                  // Sources autorisées pour <style>
imgSrc: [...]                    // Sources autorisées pour <img>
connectSrc: ["'self'"]           // fetch(), XMLHttpRequest, WebSocket
fontSrc: [...]                   // Sources pour @font-face
frameSrc: ["'none'"]             // <iframe>, <frame> interdits
objectSrc: ["'none'"]            // <object>, <embed> interdits
upgradeInsecureRequests: []      // HTTP → HTTPS automatique
```

### Pourquoi `'unsafe-inline'` ?

**Scripts :**
- Tailwind CDN génère des scripts inline
- Certains plugins (charts, etc.) utilisent inline
- **À terme :** Migrer vers fichiers externes

**Styles :**
- Tailwind utilise massivement les classes utilitaires
- Attributs `style=""` dans certains composants
- **Acceptable :** Styles inline moins risqués que scripts

---

## ⚠️ Points d'attention

### 1. Routes API publiques

Les routes `/api` et `/send` ont **besoin** d'être accessibles depuis n'importe où :
- Désactiver CSP (sinon bloque les appels)
- CORS permissif si clients externes
- Headers sécurisés mais pas restrictifs

### 2. JWT et Helmet

✅ **Aucun problème** : Helmet ne touche pas aux headers d'authentification
- `Authorization: Bearer <token>` passe normalement
- Cookies de session préservés
- Pas d'impact sur le système d'auth

### 3. HSTS (Strict-Transport-Security)

⚠️ **Attention en développement** :
- HSTS force HTTPS même en local
- Si activé sans HTTPS, le site devient inaccessible
- **Solution :** Désactiver en dev, activer en prod uniquement

### 4. Console Chrome : Violations CSP

En cas de violation CSP, Chrome affiche :
```
Refused to load the script 'https://example.com/script.js' because it violates
the following Content Security Policy directive: "script-src 'self'".
```

**Solution :** Ajouter la source dans `scriptSrc` de helmet.config.js

---

## 🎯 Ordre d'implémentation recommandé

1. ✅ **Phase 1** : Créer helmet.config.js (10 min)
2. ✅ **Phase 2** : Intégrer dans app.js (5 min)
3. ✅ **Phase 3** : Configuration .env (2 min)
4. ✅ **Phase 4** : Tests complets (15 min)
5. 💡 **Phase 5** : Optimisation CSP (optionnel, 30+ min)
6. 📚 **Phase 6** : Documentation (10 min)

**Total Phase 1-4 (essentiel) :** ~30 minutes

---

## 🚀 Après l'implémentation

### Tests de sécurité recommandés

```bash
# Headers HTTP
curl -I https://ton-domaine.com

# Scan complet
npm install -g snyk
snyk test

# Audit npm
npm audit

# Scanner en ligne
# → https://securityheaders.com/
# → https://observatory.mozilla.org/
```

### Métriques de succès

- ✅ Score A sur securityheaders.com
- ✅ Score A+ sur Mozilla Observatory
- ✅ Aucune violation CSP en console
- ✅ Toutes les fonctionnalités fonctionnent
- ✅ API publiques accessibles

---

## 📚 Ressources

- [Helmet.js Documentation](https://helmetjs.github.io/)
- [CSP Reference - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)

---

**Dernière mise à jour :** 13 décembre 2025
