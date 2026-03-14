# Plan — Scripts de setup

Ce document décrit les scripts interactifs de configuration du projet.
Utilisent **uniquement des modules natifs Node.js** (`readline`, `crypto`, `fs`) — aucune dépendance npm requise.

---

## Pourquoi Node natif ?

- Aucun `npm install` nécessaire avant d'exécuter les scripts
- Fonctionne sous Linux, macOS et Windows
- Cohérent avec le projet (déjà en Node.js)

---

## Ordre des sections (`setup.js`)

1. **App** — `NODE_ENV`, `PORT`
2. **Base de données** — `DB_IP`, `DB_PORT`, `DB_USER`, `DB_PWD`, `DB_NAME`, `DB_DIALECT`
3. **Sécurité** — `KEY_TK`, `KEV`, `KIV`, `SESSION_SECRET`, `SESSION_MAX_AGE`, `CSRF_SECRET`, `API_KEY` → générées automatiquement
4. **Logs** — `LOG_LEVEL`, `LOG_ROTATION_MAX_SIZE`, `LOG_ROTATION_MAX_FILES`
5. **Rate Limiting** — `LOGIN_WINDOW_MS`, `LOGIN_MAX_ATTEMPTS`, `MAX_FAILED_LOGIN_ATTEMPTS`
6. **Upload** — `API_MAX_FILE_SIZE`, `API_MAX_TOTAL_SIZE`, `API_MAX_FILES`, `API_MAX_FIELDS`, `API_MAX_FIELD_SIZE`
7. **ClamAV** _(optionnel)_ — demande confirmation, skippe si non
8. **SMTP** _(optionnel)_ — demande confirmation, skippe si non
9. **APP_URL** — utilisée pour les liens dans les emails

---

## Comportement prévu

### Valeurs par défaut

Chaque variable affiche sa valeur par défaut entre crochets.
L'utilisateur peut appuyer sur **Entrée** pour l'accepter sans retaper.

```
? PORT [3022] :
```

### Clés de sécurité (section 3)

Générées automatiquement via `crypto.randomBytes()`, sans interaction.
Elles sont affichées à titre informatif dans le terminal.

```
✔ Clés de sécurité générées automatiquement.
```

### Sections optionnelles (ClamAV, SMTP)

```
? Activer ClamAV (scan antivirus) ? (o/N) : N
  → Section ignorée, variables non écrites dans le .env
```

### Si `.env` existe déjà

- Avertissement affiché
- Demande de confirmation avant d'écraser
- Création automatique d'un `.env.backup` avant écrasement

```
⚠ Un fichier .env existe déjà.
? Écraser et créer un .env.backup ? (o/N) :
```

---

## Langue

Questions posées en **anglais** (projet open source public).

---

## Intégration Makefile (à créer en même temps)

```makefile
setup:
    @node setup.js

setup-admin:
    @node scripts/setup-admin.js

install: setup
    npm install

start:
    docker compose up -d

dev:
    npm run dev
```

---

## Part 2 — Script `setup-admin.js`

Script CLI interactif (`scripts/setup-admin.js`) pour créer le premier utilisateur administrateur.
Complété par un fallback via variables d'environnement au démarrage de l'app (Docker/CI).

### Pourquoi un script séparé ?

- La création de l'admin est une action **ponctuelle** (premier déploiement uniquement)
- Séparer du démarrage de l'app rend l'intention explicite
- Compatible Docker/CI via env vars (`ADMIN_LOGIN`, `ADMIN_EMAIL`) en complément
- Le mot de passe n'est **jamais** stocké en clair — le flux `/dp-first-connexion` est conservé

### Fonctionnement CLI (`npm run setup:admin`)

1. Charge les variables d'environnement (`.env`)
2. Se connecte à la base de données via `src/models/index.js`
3. Vérifie si des utilisateurs existent déjà :
    - Si oui → affiche un avertissement, demande confirmation pour continuer
    - Si non → continue directement
4. Pose 2 questions interactives :

```
? Admin login [admin] :
? Admin email (optional) [] :
```

5. Crée le user avec `role: 'super_admin'`, `status: 'pending'`, sans mot de passe
6. Affiche un récapitulatif :

```
✔ Admin user created successfully.
  Login:  admin
  Email:  fabio@example.com
  Status: pending (password must be set via /dp-first-connexion)
```

7. Ferme proprement la connexion DB et quitte

### Fallback au startup — `init_admin_user.js`

Le helper existant reste comme **filet de sécurité** au démarrage de l'app :

- Si la table `user` est vide et que le CLI n'a pas été exécuté, un admin est créé automatiquement
- Lit `ADMIN_LOGIN` (défaut `'admin'`) et `ADMIN_EMAIL` (défaut `''`) depuis les env vars
- Affiche un message explicite dans la console quand un admin est créé ou quand la création est skippée
- Le champ `enabled: false` (inexistant dans le schéma) est retiré

### Variables d'environnement associées

| Variable      | Obligatoire | Défaut   | Description                     |
| ------------- | ----------- | -------- | ------------------------------- |
| `ADMIN_LOGIN` | Non         | `admin`  | Login du premier administrateur |
| `ADMIN_EMAIL` | Non         | _(vide)_ | Email du premier administrateur |

### Script npm

```json
"setup:admin": "node scripts/setup-admin.js"
```

---

## À faire

### `setup.js` (génération `.env`)

- [ ] Écrire `setup.js` (modules natifs uniquement)
- [ ] Écrire `Makefile`
- [ ] Vérifier que toutes les variables de `.env.example` sont couvertes

### `setup-admin.js` (premier utilisateur)

- [ ] Écrire `scripts/setup-admin.js` (CLI interactif, `readline` natif)
- [ ] Modifier `src/helpers/init_admin_user.js` (env vars + cleanup)
- [ ] Ajouter le script npm `setup:admin` dans `package.json`
- [ ] Documenter `ADMIN_LOGIN` / `ADMIN_EMAIL` dans `env.validator.js`
