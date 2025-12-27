# Sécurisation de la page de login

Ce document présente les différentes stratégies pour sécuriser la page de connexion de Puna.

---

## 📋 Résumé des protections

| Protection | Complexité | Priorité | Statut | Description |
|------------|------------|----------|--------|-------------|
| Rate Limiting | ⭐ Facile | 🔴 Haute | ✅ Fait | Limiter le nombre de requêtes par IP |
| Logs d'audit | ⭐ Facile | 🔴 Haute | ✅ Fait | Logger toutes les tentatives de connexion |
| Blocage par IP | ⭐⭐ Moyenne | 🔴 Haute | ⏳ À faire | Bloquer temporairement après X échecs |
| Blocage par compte | ⭐⭐ Moyenne | 🟠 Moyenne | ⏳ À faire | Bloquer le compte après X échecs |
| Délai progressif | ⭐⭐ Moyenne | 🟠 Moyenne | ⏳ À faire | Augmenter le délai entre chaque tentative |
| CAPTCHA | ⭐⭐⭐ Complexe | 🟢 Basse | ⏳ À faire | Ajouter un CAPTCHA après X échecs |

---

## ✅ Implémentations actuelles

### 1. Rate Limiting (Implémenté)

**Fichier** : `src/middlewares/loginRateLimiter.js`

| Route | Limite | Fenêtre |
|-------|--------|---------|
| `/dp-connect` | 5 tentatives | 15 minutes |
| `/dp-first-co` | 3 tentatives | 15 minutes |

Le rate limiter est appliqué via les routes dans `src/routes/default.routes.js`.

### 2. Logs d'audit (Implémenté)

**Fichier** : `src/controllers/auth.controller.js`

Les événements suivants sont loggés dans `audit.log` :

| Action | Description |
|--------|-------------|
| `LOGIN_SUCCESS` | Connexion réussie |
| `LOGIN_FAILED` | Échec de connexion (mauvais identifiants) |
| `LOGIN_RATE_LIMIT_EXCEEDED` | Rate limit dépassé |
| `FIRST_LOGIN_SUCCESS` | Activation de compte réussie |
| `FIRST_LOGIN_FAILED` | Échec d'activation (login inconnu, mots de passe différents) |
| `FIRST_LOGIN_ERROR` | Erreur technique lors de l'activation |
| `FIRST_LOGIN_RATE_LIMIT_EXCEEDED` | Rate limit dépassé sur première connexion |
| `LOGOUT` | Déconnexion |

Chaque log inclut : IP, login, User-Agent, et autres infos contextuelles.

---

## ⏳ Améliorations futures

### 1. Système de blocage intelligent (par IP et par compte)

Pour un contrôle plus fin, créer un service `src/services/loginAttempts.service.js` qui :
- Stocke les tentatives échouées par IP et par login
- Bloque après X échecs avec un délai configurable
- Affiche le nombre de tentatives restantes
- Réinitialise après une connexion réussie

<details>
<summary>Voir le code exemple</summary>

```javascript
import { auditLogger } from '../config/logger.js';

/**
 * Service de gestion des tentatives de connexion
 * Stockage en mémoire (pour un usage simple)
 * Pour une solution plus robuste, utiliser Redis
 */

// Stockage des tentatives par IP
const ipAttempts = new Map();

// Stockage des tentatives par login
const loginAttempts = new Map();

// Configuration
const CONFIG = {
    maxAttempts: 5,              // Nombre max de tentatives
    blockDuration: 15 * 60 * 1000, // Durée du blocage (15 min)
    cleanupInterval: 5 * 60 * 1000, // Nettoyage toutes les 5 min
};

/**
 * Enregistrer une tentative échouée
 */
export function recordFailedAttempt(ip, login) {
    const now = Date.now();

    // Par IP
    const ipData = ipAttempts.get(ip) || { count: 0, firstAttempt: now, blockedUntil: 0 };
    ipData.count++;
    ipData.lastAttempt = now;

    if (ipData.count >= CONFIG.maxAttempts) {
        ipData.blockedUntil = now + CONFIG.blockDuration;
        auditLogger.warn({
            action: 'IP_BLOCKED',
            ip,
            login,
            attempts: ipData.count,
            blockedUntil: new Date(ipData.blockedUntil).toISOString(),
        });
    }
    ipAttempts.set(ip, ipData);

    // Par login
    if (login) {
        const loginData = loginAttempts.get(login) || { count: 0, firstAttempt: now, blockedUntil: 0 };
        loginData.count++;
        loginData.lastAttempt = now;
        loginData.lastIp = ip;

        if (loginData.count >= CONFIG.maxAttempts) {
            loginData.blockedUntil = now + CONFIG.blockDuration;
            auditLogger.warn({
                action: 'LOGIN_BLOCKED',
                login,
                ip,
                attempts: loginData.count,
                blockedUntil: new Date(loginData.blockedUntil).toISOString(),
            });
        }
        loginAttempts.set(login, loginData);
    }

    auditLogger.info({
        action: 'LOGIN_FAILED',
        ip,
        login: login || 'unknown',
        attemptCount: ipData.count,
    });
}

/**
 * Réinitialiser les tentatives après une connexion réussie
 */
export function resetAttempts(ip, login) {
    ipAttempts.delete(ip);
    if (login) {
        loginAttempts.delete(login);
    }
}

/**
 * Vérifier si une IP ou un login est bloqué
 * @returns {Object} { blocked: boolean, remainingTime: number, reason: string }
 */
export function isBlocked(ip, login) {
    const now = Date.now();

    // Vérifier IP
    const ipData = ipAttempts.get(ip);
    if (ipData && ipData.blockedUntil > now) {
        return {
            blocked: true,
            remainingTime: Math.ceil((ipData.blockedUntil - now) / 1000 / 60),
            reason: 'ip',
        };
    }

    // Vérifier login
    if (login) {
        const loginData = loginAttempts.get(login);
        if (loginData && loginData.blockedUntil > now) {
            return {
                blocked: true,
                remainingTime: Math.ceil((loginData.blockedUntil - now) / 1000 / 60),
                reason: 'login',
            };
        }
    }

    return { blocked: false };
}

/**
 * Obtenir le nombre de tentatives restantes
 */
export function getRemainingAttempts(ip, login) {
    const ipData = ipAttempts.get(ip);
    const loginData = login ? loginAttempts.get(login) : null;

    const ipCount = ipData?.count || 0;
    const loginCount = loginData?.count || 0;

    const maxCount = Math.max(ipCount, loginCount);
    return Math.max(0, CONFIG.maxAttempts - maxCount);
}

// Nettoyage périodique des anciennes entrées
setInterval(() => {
    const now = Date.now();
    const expiry = now - CONFIG.blockDuration * 2;

    for (const [key, data] of ipAttempts.entries()) {
        if (data.lastAttempt < expiry) {
            ipAttempts.delete(key);
        }
    }

    for (const [key, data] of loginAttempts.entries()) {
        if (data.lastAttempt < expiry) {
            loginAttempts.delete(key);
        }
    }
}, CONFIG.cleanupInterval);
```

</details>

Puis modifier le contrôleur pour utiliser ce service :

<details>
<summary>Voir le code exemple pour auth.controller.js</summary>

```javascript
import { recordFailedAttempt, resetAttempts, isBlocked, getRemainingAttempts } from '../services/loginAttempts.service.js';
import { auditLogger } from '../config/logger.js';

export const dpConnect = (req, res) => {
    const { login } = req.body;
    const ip = req.ip;

    // Vérifier si bloqué AVANT l'authentification
    const blockStatus = isBlocked(ip, login);
    if (blockStatus.blocked) {
        auditLogger.warn({
            action: 'LOGIN_ATTEMPT_WHILE_BLOCKED',
            ip,
            login,
            reason: blockStatus.reason,
        });

        req.flash('error', `Trop de tentatives. Réessayez dans ${blockStatus.remainingTime} minute(s).`);
        return res.redirect('/dp-login');
    }

    passport.authenticate('local', async (err, user, info) => {
        if (err || !user) {
            // Enregistrer l'échec
            recordFailedAttempt(ip, login);

            const remaining = getRemainingAttempts(ip, login);
            if (remaining > 0) {
                req.flash('error', `Identifiants incorrects. ${remaining} tentative(s) restante(s).`);
            } else {
                req.flash('error', 'Compte temporairement bloqué. Réessayez dans 15 minutes.');
            }

            return res.redirect('/dp-login');
        }

        try {
            await updateLastConnection(user.id);
        } catch (e) {
            console.error('Failed to update last_connection', e);
        }

        // Réinitialiser les tentatives après succès
        resetAttempts(ip, login);

        // Logger la connexion réussie
        auditLogger.info({
            action: 'LOGIN_SUCCESS',
            userId: user.id,
            login: user.login,
            ip,
        });

        req.session.user = {
            id: user.id,
            login: user.login,
            email: user.email,
            role: user.role,
            status: user.status,
        };

        return res.redirect('/dashboard');
    })(req, res);
};
```

</details>

---

## 2. Options avancées (pour plus tard)

### 2.1 Délai progressif

Ajouter un délai artificiel qui augmente à chaque tentative :

```javascript
// Dans le handler d'échec
const delay = Math.min(1000 * Math.pow(2, attemptCount - 1), 30000);
await new Promise(resolve => setTimeout(resolve, delay));
```

### 2.2 CAPTCHA avec hCaptcha ou Turnstile

Après 3 échecs, afficher un CAPTCHA :

- **hCaptcha** : Gratuit, respectueux de la vie privée
- **Cloudflare Turnstile** : Gratuit, invisible, simple à intégrer

### 2.3 Notifications

Envoyer un email à l'admin après X tentatives bloquées :

```javascript
if (ipData.count >= CONFIG.maxAttempts) {
    // Envoyer notification via nodemailer
    await sendSecurityAlert({
        type: 'BRUTE_FORCE_ATTEMPT',
        ip,
        login,
        attempts: ipData.count,
    });
}
```

### 2.4 Stockage Redis (production)

Pour un environnement multi-instances, utiliser Redis au lieu de la mémoire :

```bash
npm install rate-limit-redis ioredis
```

---

## 📝 Plan d'implémentation

1. **Phase 1** (Priorité haute) - ✅ Terminée :
   - [x] Rate limiting sur `/dp-connect` et `/dp-first-co`
   - [x] Logs d'audit sur les tentatives

2. **Phase 2** (Priorité moyenne) - ⏳ À faire :
   - [ ] Service de blocage par IP/login
   - [ ] Messages d'erreur avec tentatives restantes
   - [ ] Délai progressif

3. **Phase 3** (Priorité basse) - ⏳ À faire :
   - [ ] CAPTCHA après X échecs
   - [ ] Notifications email
   - [ ] Dashboard admin des tentatives bloquées

---

## 🔧 Fichiers concernés

| Fichier | Statut |
|---------|--------|
| `src/middlewares/loginRateLimiter.js` | ✅ Créé |
| `src/controllers/auth.controller.js` | ✅ Modifié |
| `src/routes/default.routes.js` | ✅ Modifié |
| `src/services/loginAttempts.service.js` | ⏳ À créer (Phase 2) |

---

## 📚 Ressources

- [express-rate-limit](https://www.npmjs.com/package/express-rate-limit)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [hCaptcha](https://www.hcaptcha.com/)
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)
