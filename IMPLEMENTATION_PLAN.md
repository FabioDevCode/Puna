# Plan d'implémentation — Puna

> Analyse du projet et recommandations d'implémentation — 24 mars 2026

---

## Ordre d'implémentation recommandé

| #   | Tâche                                            | Effort | Impact    |
| --- | ------------------------------------------------ | ------ | --------- |
| 1   | Super admin via variables d'environnement        | Faible | Fondation |
| 2   | Validation de mot de passe fort (16 car. min)    | Faible | Sécurité  |
| 3   | Validation des inputs (création site/form)       | Moyen  | Sécurité  |
| 4   | Internationalisation complète (FR + EN + switch) | Élevé  | UX        |
| 5   | Script de setup interactif                       | Moyen  | DX        |
| 6   | Tests end-to-end (Playwright)                    | Élevé  | Qualité   |

---

## 1. Super admin via variables d'environnement

### Pourquoi en premier

C'est un changement fondationnel, rapide et sans risque de régression. Il supprime une convention fragile (`init_admin_user.js` avec des valeurs hardcodées) et aligne la configuration sur le pattern déjà établi dans `env.validator.js`.

### État actuel

- `src/helpers/init_admin_user.js` crée un utilisateur `admin` / `super_admin` / `pending` si la table `User` est vide.
- Login hardcodé à `'admin'`, email à `''`, aucune personnalisation possible.
- Appelé dans `app.js` après `models.sequelize.sync()`.

### Recommandations d'implémentation

1. **Ajouter les variables d'environnement** dans `env.validator.js` :
    - `ADMIN_LOGIN` (obligatoire) — login du premier administrateur
    - `ADMIN_EMAIL` (optionnel) — email du premier administrateur
    - Ces variables ne sont vérifiées qu'au premier démarrage (quand `User.count() === 0`).

2. **Modifier `init_admin_user.js`** pour lire depuis `process.env` :

    ```js
    export const initAdminUser = async () => {
        const count = await models.User.count();
        if (count === 0) {
            const login = process.env.ADMIN_LOGIN;
            if (!login) {
                errorLogger.error('ADMIN_LOGIN env var is required for first startup');
                process.exit(1);
            }
            await models.User.create({
                email: process.env.ADMIN_EMAIL || '',
                login,
                role: 'super_admin',
                status: 'pending',
                enabled: false,
                created_by: null,
            });
            logger.info(`Admin user "${login}" created (status: pending)`);
        }
    };
    ```

3. **Corriger le typo** dans le nom de la fonction : `initAdminUSer` → `initAdminUser` (et mettre à jour l'import dans `app.js`).

4. **Documenter** dans `.env.example` et `README.md`.

### Fichiers impactés

- `src/helpers/init_admin_user.js`
- `src/config/env.validator.js` (ajout dans `OPTIONAL_VARS` ou validation conditionnelle)
- `src/app.js` (renommage import)
- `.env.example`

---

## 2. Validation de mot de passe fort

### Pourquoi en deuxième

Faille de sécurité directe : actuellement **aucune validation** de force du mot de passe n'existe. Les 3 points d'entrée acceptent n'importe quelle chaîne (même vide dans certains cas). C'est un changement ciblé avec un scope réduit.

### État actuel

| Point d'entrée        | Fichier                                             | Validation actuelle                                            |
| --------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| Première connexion    | `auth.controller.js` (`dpFirstCoPost`)              | Seulement `password === confirm_password`                      |
| Reset mot de passe    | `passwordReset.controller.js` (`resetPasswordPost`) | Seulement `password !== ''` et `password === confirm_password` |
| Création user (admin) | `admin/adminUsers.controller.js`                    | Aucune                                                         |

### Recommandations d'implémentation

1. **Créer un validateur centralisé** dans `src/utils/password.js` :

    ```js
    /**
     * Valide la force d'un mot de passe.
     * Minimum 16 caractères, au moins : 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial.
     * @param {string} password
     * @returns {{ valid: boolean, errors: string[] }}
     */
    export function validatePasswordStrength(password) {
        const errors = [];
        if (!password || password.length < 16) {
            errors.push('password_min_length'); // clé i18n
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('password_needs_uppercase');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('password_needs_lowercase');
        }
        if (!/[0-9]/.test(password)) {
            errors.push('password_needs_digit');
        }
        if (!/[^A-Za-z0-9]/.test(password)) {
            errors.push('password_needs_special');
        }
        return { valid: errors.length === 0, errors };
    }
    ```

2. **Intégrer dans les 3 controllers** : appeler `validatePasswordStrength()` avant `hashPassword()`.

3. **Ajouter un indicateur visuel** côté vue (HTML/JS) pour afficher les critères en temps réel sur les formulaires de mot de passe.

4. **Ajouter les clés i18n** correspondantes dans `fr.json` (et `en.json` quand l'i18n sera complété).

5. **Écrire les tests unitaires** pour `validatePasswordStrength()` (couverture exhaustive des cas limites).

### Fichiers impactés

- `src/utils/password.js` (nouveau)
- `src/controllers/auth.controller.js`
- `src/controllers/passwordReset.controller.js`
- `src/controllers/admin/adminUsers.controller.js`
- `src/locales/fr.json`
- `tests/unit/utils/password.test.js` (nouveau)
- Vues HBS des formulaires de mot de passe

---

## 3. Validation des inputs (création site / form)

### Pourquoi en troisième

Puisque tu es déjà dans une dynamique de validation (point 2), enchaîner avec la validation des inputs métier est logique. Le risque actuel est modéré car `sanitizeAll` nettoie les XSS, mais il n'y a aucune validation de format ni d'unicité côté serveur.

### État actuel

| Entité | Champ    | Validation actuelle                                                                                                                           |
| ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Site   | `domain` | Aucune. `domainExists()` existe dans le service mais **n'est jamais appelé** dans le controller. Seul un label HTML indique « 253 car. max ». |
| Form   | `name`   | Aucune. Passé tel quel à `models.Form.create()`.                                                                                              |

### Recommandations d'implémentation

1. **Valider le domaine côté serveur** dans `site.controller.js` :
    - Longueur max : 253 caractères
    - Format : regex de domaine valide (`/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i`)
    - **Appeler `domainExists()`** avant la création (la fonction existe déjà !)
    - Retourner un flash d'erreur avec message i18n si invalide

2. **Valider le nom de formulaire** dans `form.controller.js` :
    - Longueur max raisonnable (ex : 100 caractères)
    - Caractères autorisés (alphanumérique + espaces + tirets/underscores)
    - Trim des espaces

3. **Approche recommandée** : plutôt que Joi/Zod (écarté dans `TODO.md` pour l'API publique), créer des fonctions de validation simples dans un fichier `src/utils/validators.js` :

    ```js
    export function isValidDomain(domain) { ... }
    export function isValidFormName(name) { ... }
    ```

4. **Note** : la décision d'écarter Joi/Zod dans `TODO.md` concerne l'API publique (`/api/v1/send`) pour garder le stockage JSON brut. Ici, il s'agit de **l'interface web interne** : la validation est non seulement souhaitable, elle est nécessaire.

### Fichiers impactés

- `src/utils/validators.js` (nouveau)
- `src/controllers/site.controller.js`
- `src/controllers/form.controller.js`
- `src/locales/fr.json` (clés d'erreur)
- `tests/unit/utils/validators.test.js` (nouveau)

---

## 4. Internationalisation complète (FR + EN + switch)

### Pourquoi en quatrième

C'est le chantier le plus volumineux. L'infrastructure i18n existe déjà (`i18n` est configuré dans `app.js`, `fr.json` existe avec 116 lignes), mais **~70+ strings françaises sont hardcodées** dans les controllers, middlewares, services et vues HBS. Il faut d'abord stabiliser les fonctionnalités (points 1-3) avant de tout passer en i18n — sinon chaque modification ajoutera de nouvelles strings à traduire.

### État actuel

**Infrastructure existante :**

- `i18n` (package npm) configuré dans `app.js` avec `locales: ['fr']` et `cookie: 'lang'`, `queryParameter: 'lang'`
- `fr.json` couvre partiellement : 2FA, password reset, menus, boutons, erreurs 404
- Les helpers HBS ont accès à `__()` via i18n

**Strings hardcodées identifiées (~70+) :**

| Zone                                                                       | Nb approximatif | Exemples                                                                     |
| -------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| Controllers (auth, site, form, inbox, passwordReset, twoFactor, admin)     | ~40             | `'Votre compte a été banni.'`, `'Site créé avec succès.'`, `'Accès refusé.'` |
| Middlewares (checkAccess, checkUserStatus, loginRateLimiter, errorHandler) | ~12             | `'Trop de tentatives de connexion...'`, `"Vous n'avez pas la permission..."` |
| Services (site, inbox)                                                     | ~10             | `'Site introuvable ou accès refusé'`, `'Fichier physique introuvable'`       |
| Vues HBS                                                                   | ~50+            | Titres de pages, labels, placeholders, messages d'aide dans les templates    |

### Recommandations d'implémentation

1. **Phase A — Extraire toutes les strings FR restantes vers `fr.json`** :
    - Auditer systématiquement chaque controller, middleware et service.
    - Structurer les clés par domaine : `auth.banned`, `site.created`, `form.access_denied`, `middleware.rate_limit`, etc.
    - Dans les controllers/middlewares, remplacer les strings par `req.__('clé')` ou `res.__('clé')`.
    - Dans les services (qui n'ont pas accès à `req`), retourner des **clés d'erreur** plutôt que des messages traduits, et laisser le controller traduire.
    - Dans les vues HBS, utiliser le helper `{{__ "clé"}}`.

2. **Phase B — Créer `en.json`** :
    - Copier la structure de `fr.json` et traduire toutes les clés.
    - Ajouter `'en'` dans `locales` de la config i18n dans `app.js`.

3. **Phase C — Implémenter le switch de langue** :
    - La librairie `i18n` supporte déjà le cookie `lang` et le query parameter `lang` (configurés dans `app.js`).
    - Ajouter un **sélecteur de langue dans le layout principal** (`views/layouts/main.hbs`) :
        ```hbs
        <a href="?lang=fr" class="{{#if (eq locale 'fr')}}active{{/if}}">FR</a>
        <a href="?lang=en" class="{{#if (eq locale 'en')}}active{{/if}}">EN</a>
        ```
    - Persister le choix via le cookie `lang` (déjà supporté par `i18n`).
    - Injecter `locale` dans `res.locals` pour la vue :
        ```js
        app.use((req, res, next) => {
            res.locals.locale = req.getLocale();
            next();
        });
        ```

4. **Phase D — Sauvegarder la préférence utilisateur** (optionnel) :
    - Ajouter un champ `locale` au modèle `User` (valeur par défaut : `'fr'`).
    - Au login, restaurer la langue depuis le profil utilisateur.
    - Quand l'utilisateur switch, mettre à jour en base.

### Fichiers impactés

- `src/locales/fr.json` (complétion massive)
- `src/locales/en.json` (nouveau)
- `src/app.js` (config i18n, middleware locale)
- Tous les controllers (~8 fichiers)
- Middlewares concernés (~5 fichiers)
- Services concernés (~2 fichiers, changement de pattern)
- Vues HBS (~15-20 fichiers)
- Optionnel : `src/models/attributes/user.attributes.json`, `src/services/user.service.js`

---

## 5. Script de setup interactif

### Pourquoi en cinquième

Le `SETUP_SCRIPT.md` existe déjà avec une spécification détaillée (2 scripts : `setup.js` et `setup-admin.js`). L'implémentation est indépendante du reste, mais il est préférable d'attendre que les points 1-4 soient stabilisés pour que le script reflète la configuration finale (ex : variables `ADMIN_LOGIN` du point 1, la locale par défaut du point 4).

### État actuel

- `SETUP_SCRIPT.md` décrit 2 scripts non implémentés :
    - `setup.js` : génération interactive du `.env` (9 sections, modules natifs uniquement)
    - `setup-admin.js` : création du premier admin via CLI
- Aucun fichier de script n'existe encore.

### Recommandations d'implémentation

1. **`scripts/setup.js`** — Script interactif CLI :
    - Utiliser `readline` natif (pas de dépendance externe, conformément au `SETUP_SCRIPT.md`).
    - 9 sections avec valeurs par défaut et auto-génération des clés crypto via `crypto.randomBytes()`.
    - Sauvegarder un backup de `.env` existant avant écrasement.
    - Valider les inputs avec les mêmes règles que `env.validator.js` (longueur de `KEV`, `KIV`, etc.).

2. **`scripts/setup-admin.js`** — Création du premier admin :
    - Avec le point 1 implémenté, ce script pourrait simplement pré-remplir `ADMIN_LOGIN` et `ADMIN_EMAIL` dans le `.env`.
    - Alternative : mode interactif OU mode non-interactif via env vars (CI/CD friendly).

3. **Ajouter des commandes npm** :

    ```json
    "setup": "node scripts/setup.js",
    "setup:admin": "node scripts/setup-admin.js"
    ```

4. **Gérer le mode Docker** : détecter si on est dans un container (la fonction `isRunningInDocker()` existe déjà dans `env.validator.js`) et adapter les valeurs par défaut (hostname DB → `db`, ClamAV → `clamav`, etc.).

### Fichiers impactés

- `scripts/setup.js` (nouveau)
- `scripts/setup-admin.js` (nouveau)
- `package.json` (scripts npm)
- `.env.example` (mise à jour si nécessaire)
- `README.md` (documentation)

---

## 6. Tests end-to-end (Playwright)

### Pourquoi en dernier

Les tests E2E doivent couvrir des parcours utilisateurs stables. Implémenter d'abord les points 1-5 assure que les flux testés (première connexion avec mot de passe fort, switch de langue, etc.) ne changeront pas immédiatement après l'écriture des tests.

### État actuel

- 26 fichiers de tests existants (unit + middleware + integration) via **Vitest**.
- Aucun test E2E, aucune dépendance Playwright.
- L'app utilise des vues HBS rendues côté serveur → Playwright est adapté (pas besoin de tester un SPA).

### Recommandations d'implémentation

1. **Installation** :

    ```bash
    npm install -D @playwright/test
    npx playwright install chromium  # un seul navigateur suffit au début
    ```

2. **Configuration** — créer `playwright.config.js` :

    ```js
    import { defineConfig } from '@playwright/test';
    export default defineConfig({
        testDir: './tests/e2e',
        webServer: {
            command: 'node --env-file=.env.test server.js',
            port: 3001,
            reuseExistingServer: !process.env.CI,
        },
        use: {
            baseURL: 'http://localhost:3001',
            locale: 'fr-FR',
        },
    });
    ```

3. **Environnement de test** :
    - Créer un `.env.test` dédié avec une base de données de test (SQLite pour simplifier ou une DB MySQL/MariaDB de test).
    - Script de seed pour injecter un admin et des données de test.

4. **Parcours prioritaires à tester** :
   | Priorité | Parcours | Couverture |
   |----------|----------|------------|
   | Haute | Première connexion (activation compte admin) | Auth + validation mot de passe |
   | Haute | Login / Logout | Session + Passport |
   | Haute | Création d'un site | Input validation + RBAC |
   | Haute | Création d'un formulaire | Input validation |
   | Moyenne | Suppression d'un site (confirmation domaine) | UX critique |
   | Moyenne | Consultation de l'inbox | Navigation + données |
   | Moyenne | Export des données | Téléchargement de fichier |
   | Basse | Switch de langue | i18n (après point 4) |
   | Basse | 2FA setup + vérification | TOTP (si `TOTP_ENABLED=true`) |
   | Basse | Reset mot de passe | SMTP (nécessite un mock mail) |

5. **Ajouter le script npm** :

    ```json
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
    ```

6. **Pattern recommended pour les tests** :

    ```js
    // tests/e2e/auth.spec.js
    import { test, expect } from '@playwright/test';

    test.describe('Première connexion', () => {
        test('refuse un mot de passe trop court', async ({ page }) => {
            await page.goto('/dp-first-co');
            await page.fill('[name="login"]', 'admin');
            await page.fill('[name="password"]', 'short');
            await page.fill('[name="confirm_password"]', 'short');
            await page.click('button[type="submit"]');
            await expect(page.locator('.flash-error')).toBeVisible();
        });
    });
    ```

### Fichiers impactés

- `playwright.config.js` (nouveau)
- `tests/e2e/` (nouveau dossier avec les specs)
- `.env.test` (nouveau)
- `package.json` (dépendance + scripts)
- `.gitignore` (ajouter `test-results/`, `playwright-report/`)

---

## Récapitulatif des dépendances entre tâches

```
1. Super admin env vars ──┐
                          ├──→ 5. Script setup (utilise les mêmes env vars)
2. Validation mot de passe ┤
                           ├──→ 6. Tests E2E (teste les parcours stabilisés)
3. Validation inputs ──────┤
                           │
4. i18n complète ──────────┘
```

Les tâches 1, 2, 3 sont indépendantes entre elles mais doivent précéder 5 et 6. La tâche 4 (i18n) est autonome mais volumineuse — elle produira des changements dans de très nombreux fichiers, ce qui rend les tests E2E plus pertinents une fois qu'elle est terminée.
